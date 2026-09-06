import { mutation, query, internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { draftRegistry, isDraftFormKey, parseDraftPayload, type DraftFormKey } from "../../../shared/src/drafts/registry";
import { getAuthenticatedSchoolMembership } from "./auth";
import { recordAuditEventHelper } from "./audit";
import { TEACHER_PLANNING_CAPABILITIES } from "./rbac";

const scope = { schoolId: v.id("schools"), formKey: v.string(), entityId: v.optional(v.string()) };
const instance = { schoolId: v.id("schools"), draftId: v.id("formDrafts"), expectedRevision: v.number() };
const EXPIRY_BATCH_SIZE = 100;
function fail(code: string, message: string): never { throw new ConvexError({ code, message }); }
function activeScopeKey(schoolId: Id<"schools">, userId: Id<"users">, formKey: string) {
  return `${schoolId}:${userId}:${formKey}`;
}
async function authority(ctx: QueryCtx | MutationCtx, schoolId: Id<"schools">, formKey: string, entityId?: string) {
  const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId, membershipOnly: true });
  if (!isDraftFormKey(formKey)) return fail("SCHEMA_REJECTED", "This form has no reviewed draft schema.");
  const policy = draftRegistry[formKey];
  if (!auth.isSchoolAdmin && !(policy.authority === "staff" && auth.role === "teacher")) fail("FORBIDDEN", "Draft creation is not permitted for this form.");
  const capability = formKey === "curriculum_plan" ? TEACHER_PLANNING_CAPABILITIES : ({
    student_onboarding: "enrollment.intakes.manage", family_onboarding: "enrollment.intakes.manage",
    staff_onboarding: "staff.onboard", fee_plan_builder: "finance.fee_plans.manage",
    academic_setup: "academic.classes.manage", report_card_configuration: "academic.grading_bands.manage",
    import_review: "system.migration.execute",
    institutional_email_review: ["settings.domains.manage", "staff.onboard", "enrollment.intakes.manage"],
  } as const)[formKey];
  // Managed teachers are subject to the same restrictions as managed administrators.
  await getAuthenticatedSchoolMembership(ctx, { schoolId, capability });
  // Entity editing requires a domain-specific ownership resolver, not arbitrary string IDs.
  if (entityId !== undefined) fail("SCHEMA_REJECTED", "This draft schema supports new records only.");
  return { auth, policy, formKey };
}
async function owned(ctx: MutationCtx, args: { schoolId: Id<"schools">; draftId: Id<"formDrafts">; expectedRevision: number }) {
  const draft = await ctx.db.get(args.draftId);
  const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId, membershipOnly: true });
  if (!draft || draft.userId !== auth.userId || draft.schoolId !== args.schoolId) return fail("FORBIDDEN", "Draft unavailable.");
  await authority(ctx, args.schoolId, draft.formKey, draft.entityId);
  if (draft.status !== "active") fail("CLOSED", "This draft has already been submitted or discarded.");
  if (!draft.expiresAt || draft.expiresAt <= Date.now()) fail("EXPIRED", "This draft has expired.");
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== draft.revision) fail("CONFLICT", "Conflict detected: load the latest draft before saving.");
  return { draft, auth };
}
async function audit(ctx: MutationCtx, schoolId: Id<"schools">, userId: Id<"users">, draftId: Id<"formDrafts">, action: string) {
  const user = await ctx.db.get(userId);
  await recordAuditEventHelper(ctx, { schoolId, actorKind: action === "expired" ? "system" : "user", actorEmailSnapshot: action === "expired" ? "system" : user?.email ?? "", module: "drafts", action, targetType: "formDraft", targetId: draftId, outcome: "success", safeSummary: `Private draft ${action}; content omitted.` });
}

/** Explicit allocation. Autosave NEVER allocates an instance. Closed IDs stay closed forever. */
export const beginFormDraft = mutation({
  args: { ...scope, schemaVersion: v.number() },
  handler: async (ctx, args) => {
    const { auth, policy } = await authority(ctx, args.schoolId, args.formKey, args.entityId);
    if (args.schemaVersion !== policy.version) fail("SCHEMA_REJECTED", "Unsupported draft version.");
    const now = Date.now();
    const active = await ctx.db.query("formDrafts").withIndex("by_school_and_user_and_form_and_status", q => q.eq("schoolId", args.schoolId).eq("userId", auth.userId).eq("formKey", args.formKey).eq("status", "active")).take(2);
    if (active.length > 1) fail("DATA_INTEGRITY", "Multiple active drafts require reviewed remediation.");
    if (active[0]?.expiresAt && active[0].expiresAt > now) fail("RECOVERY_REQUIRED", "Preview, resume or discard the existing draft first.");
    if (active[0]) {
      await ctx.db.patch(active[0]._id, { payload: {}, status: "discarded", activeScopeKey: undefined, expiresAt: undefined, updatedAt: now });
      await audit(ctx, active[0].schoolId, active[0].userId, active[0]._id, "expired");
    }
    const claim = activeScopeKey(args.schoolId, auth.userId, args.formKey);
    const claimed = await ctx.db.query("formDrafts").withIndex("by_activeScopeKey", q => q.eq("activeScopeKey", claim)).unique();
    if (claimed) fail("RECOVERY_REQUIRED", "Preview, resume or discard the existing draft first.");
    const expiresAt = now + policy.retentionDays * 86400000;
    const draftId = await ctx.db.insert("formDrafts", { schoolId: args.schoolId, userId: auth.userId, formKey: args.formKey, activeScopeKey: claim, payload: {}, schemaVersion: policy.version, expiresAt, status: "active", revision: 0, lastSavedAt: now, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAt(expiresAt, internal.functions.academic.drafts.expireFormDrafts, {});
    await audit(ctx, args.schoolId, auth.userId, draftId, "created");
    return { draftId, revision: 0, expiresAt };
  },
});
export const saveFormDraft = mutation({
  args: { ...instance, schemaVersion: v.number(), payload: v.any() },
  handler: async (ctx, args) => {
    const { draft } = await owned(ctx, args);
    if (!isDraftFormKey(draft.formKey) || args.schemaVersion !== draft.schemaVersion) return fail("SCHEMA_REJECTED", "Unsupported draft version.");
    let payload;
    try { payload = parseDraftPayload(draft.formKey, args.payload); }
    catch { return fail("SCHEMA_REJECTED", "Draft contains unapproved fields or invalid values."); }
    if (JSON.stringify(payload).length > 64000) fail("SCHEMA_REJECTED", "Draft exceeds the size limit.");
    const revision = args.expectedRevision + 1;
    const lastSavedAt = Date.now();
    await ctx.db.patch(args.draftId, { payload, revision, lastSavedAt, updatedAt: lastSavedAt });
    return { draftId: args.draftId, revision, lastSavedAt };
  },
});
export const getFormDraft = query({
  args: scope,
  handler: async (ctx, args) => {
    const { auth, policy } = await authority(ctx, args.schoolId, args.formKey, args.entityId);
    const rows = await ctx.db.query("formDrafts").withIndex("by_school_and_user_and_form_and_status", q => q.eq("schoolId", args.schoolId).eq("userId", auth.userId).eq("formKey", args.formKey).eq("status", "active")).take(2);
    if (rows.length > 1) fail("DATA_INTEGRITY", "Multiple active drafts require reviewed remediation.");
    const draft = rows.find(d => d.schemaVersion === policy.version && d.expiresAt && d.expiresAt > Date.now());
    return draft ? { ...draft, draftId: draft._id } : null;
  },
});
/** Call this helper INSIDE a domain's successful submission transaction. Never before submission. */
export async function finishFormDraft(ctx: MutationCtx, args: { schoolId: Id<"schools">; draftId: Id<"formDrafts">; expectedRevision: number; expectedFormKey?: DraftFormKey }, status: "committed" | "discarded") {
  const { draft, auth } = await owned(ctx, args);
  if (args.expectedFormKey && draft.formKey !== args.expectedFormKey)
    return fail("SCHEMA_REJECTED", "Submission cannot close a draft for another form.");
  await ctx.db.patch(draft._id, { status, activeScopeKey: undefined, payload: {}, revision: args.expectedRevision + 1, updatedAt: Date.now() });
  await audit(ctx, args.schoolId, auth.userId, draft._id, status);
  return { success: true as const };
}
export const discardFormDraft = mutation({ args: instance, handler: (ctx, args) => finishFormDraft(ctx, args, "discarded") });
// Compatibility endpoint for non-atomic legacy submit adapters; new domain mutations use the helper.
export const commitFormDraft = mutation({ args: instance, handler: (ctx, args) => finishFormDraft(ctx, args, "committed") });
/** Bounded, idempotent retention worker. Per-draft schedules and the recurring safety run invoke it. */
export const expireFormDrafts = internalMutation({
  args: {},
  handler: async ctx => {
    const rows = await ctx.db.query("formDrafts").withIndex("by_expiresAt", q => q.gt("expiresAt", 0).lte("expiresAt", Date.now())).take(EXPIRY_BATCH_SIZE);
    const now = Date.now();
    for (const draft of rows) {
      await ctx.db.patch(draft._id, { payload: {}, status: draft.status === "active" ? "discarded" : draft.status, activeScopeKey: undefined, expiresAt: undefined, updatedAt: now });
      await audit(ctx, draft.schoolId, draft.userId, draft._id, "expired");
    }
    const mayHaveMore = rows.length === EXPIRY_BATCH_SIZE;
    if (mayHaveMore) await ctx.scheduler.runAfter(0, internal.functions.academic.drafts.expireFormDrafts, {});
    return { processed: rows.length, mayHaveMore };
  },
});
export const saveDraft = saveFormDraft;
export const getDraft = getFormDraft;
export const discardDraft = discardFormDraft;
export const commitDraft = commitFormDraft;
