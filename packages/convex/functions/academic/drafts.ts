import { mutation, query, internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { draftRegistry, isDraftFormKey, parseDraftPayload } from "../../../shared/src/drafts/registry";
import { getAuthenticatedSchoolMembership } from "./auth";
import { recordAuditEventHelper } from "./audit";
import { TEACHER_PLANNING_CAPABILITIES } from "./rbac";

const scope = { schoolId: v.id("schools"), formKey: v.string(), entityId: v.optional(v.string()) };
const instance = { schoolId: v.id("schools"), draftId: v.id("formDrafts"), expectedRevision: v.number() };
function fail(code: string, message: string): never { throw new ConvexError({ code, message }); }
async function authority(ctx: QueryCtx | MutationCtx, schoolId: Id<"schools">, formKey: string, entityId?: string) {
  const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId });
  if (!isDraftFormKey(formKey)) return fail("SCHEMA_REJECTED", "This form has no reviewed draft schema.");
  const policy = draftRegistry[formKey];
  if (!auth.isSchoolAdmin && !(policy.authority === "staff" && auth.role === "teacher")) fail("FORBIDDEN", "Draft creation is not permitted for this form.");
  const capability = formKey === "curriculum_plan" ? TEACHER_PLANNING_CAPABILITIES : ({
    student_onboarding: "enrollment.intakes.manage", family_onboarding: "enrollment.intakes.manage",
    staff_onboarding: "staff.onboard", fee_plan_builder: "finance.fee_plans.manage",
    academic_setup: "academic.classes.manage", report_card_configuration: "academic.grading_bands.manage",
    import_review: "system.migration.execute",
  } as const)[formKey];
  // Managed teachers are subject to the same restrictions as managed administrators.
  await getAuthenticatedSchoolMembership(ctx, { schoolId, capability });
  // Entity editing requires a domain-specific ownership resolver, not arbitrary string IDs.
  if (entityId !== undefined) fail("SCHEMA_REJECTED", "This draft schema supports new records only.");
  return { auth, policy, formKey };
}
async function owned(ctx: MutationCtx, args: { schoolId: Id<"schools">; draftId: Id<"formDrafts">; expectedRevision: number }) {
  const draft = await ctx.db.get(args.draftId);
  const auth = await getAuthenticatedSchoolMembership(ctx, { schoolId: args.schoolId });
  if (!draft || draft.userId !== auth.userId || draft.schoolId !== args.schoolId) return fail("FORBIDDEN", "Draft unavailable.");
  const { policy, formKey } = await authority(ctx, args.schoolId, draft.formKey, draft.entityId);
  if (draft.status !== "active") fail("CLOSED", "This draft has already been submitted or discarded.");
  if (draft.schemaVersion !== undefined && draft.schemaVersion !== policy.version) fail("SCHEMA_REJECTED", "Unsupported draft version.");
  const expiresAt = draft.expiresAt ?? draft.createdAt + policy.retentionDays * 86400000;
  if (expiresAt <= Date.now()) fail("EXPIRED", "This draft has expired.");
  const revision = draft.revision ?? 0;
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== revision) fail("CONFLICT", "Conflict detected: load the latest draft before saving.");
  if (draft.schemaVersion === undefined || draft.expiresAt === undefined || draft.revision === undefined) {
    let payload;
    try { payload = parseDraftPayload(formKey, draft.payload); }
    catch { return fail("SCHEMA_REJECTED", "Legacy draft contains unsupported fields."); }
    await ctx.db.patch(draft._id, {
      payload,
      schemaVersion: policy.version,
      activeScopeKey: activeScopeKey(draft.userId, draft.schoolId, formKey),
      expiresAt,
      revision,
    });
  }
  return { draft: { ...draft, schemaVersion: policy.version, expiresAt, revision }, auth };
}
function activeScopeKey(userId: Id<"users">, schoolId: Id<"schools">, formKey: string) {
  return `${userId}:${schoolId}:${formKey}:new`;
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
    const scopeKey = activeScopeKey(auth.userId, args.schoolId, args.formKey);
    const current = await ctx.db.query("formDrafts").withIndex("by_active_scope", q => q.eq("activeScopeKey", scopeKey)).take(2);
    const legacy = await ctx.db.query("formDrafts").withIndex("by_user_and_form", q => q.eq("userId", auth.userId).eq("formKey", args.formKey)).order("desc").take(100);
    if ([...current, ...legacy].some(d => d.schoolId === args.schoolId && d.status === "active" && (d.expiresAt ?? d.createdAt + policy.retentionDays * 86400000) > Date.now())) fail("RECOVERY_REQUIRED", "Preview, resume or discard the existing draft first.");
    const now = Date.now();
    const expiresAt = now + policy.retentionDays * 86400000;
    const draftId = await ctx.db.insert("formDrafts", { schoolId: args.schoolId, userId: auth.userId, formKey: args.formKey, activeScopeKey: scopeKey, payload: {}, schemaVersion: policy.version, expiresAt, status: "active", revision: 0, lastSavedAt: now, createdAt: now, updatedAt: now });
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
    const { auth, policy, formKey } = await authority(ctx, args.schoolId, args.formKey, args.entityId);
    const rows = await ctx.db.query("formDrafts").withIndex("by_user_and_form", q => q.eq("userId", auth.userId).eq("formKey", args.formKey)).order("desc").take(100);
    const now = Date.now();
    for (const draft of rows) {
      if (draft.schoolId !== args.schoolId || draft.status !== "active") continue;
      if (draft.schemaVersion !== undefined && draft.schemaVersion !== policy.version) continue;
      const expiresAt = draft.expiresAt ?? draft.createdAt + policy.retentionDays * 86400000;
      if (expiresAt <= now) continue;
      try {
        const payload = parseDraftPayload(formKey, draft.payload);
        return { ...draft, payload, schemaVersion: policy.version, expiresAt, revision: draft.revision ?? 0, draftId: draft._id };
      } catch {
        continue;
      }
    }
    return null;
  },
});
/** Call this helper INSIDE a domain's successful submission transaction. Never before submission. */
export async function finishFormDraft(ctx: MutationCtx, args: { schoolId: Id<"schools">; draftId: Id<"formDrafts">; expectedRevision: number }, status: "committed" | "discarded") {
  const { draft, auth } = await owned(ctx, args);
  await ctx.db.patch(draft._id, { status, activeScopeKey: undefined, payload: {}, revision: args.expectedRevision + 1, updatedAt: Date.now() });
  await audit(ctx, args.schoolId, auth.userId, draft._id, status);
  return { success: true as const };
}
export const discardFormDraft = mutation({ args: instance, handler: (ctx, args) => finishFormDraft(ctx, args, "discarded") });
// Trusted server code may close a legacy draft while adapters move to atomic domain submissions.
export const commitFormDraft = internalMutation({ args: instance, handler: (ctx, args) => finishFormDraft(ctx, args, "committed") });
/** Retention contract only: bounded and internal; no cron/scheduler is installed or run. */
export const expireFormDrafts = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const legacyRows = await ctx.db.query("formDrafts").withIndex("by_status_and_expiresAt", q => q.eq("status", "active").eq("expiresAt", undefined)).take(100);
    const expiredRows = legacyRows.length === 100 ? [] : await ctx.db.query("formDrafts").withIndex("by_status_and_expiresAt", q => q.eq("status", "active").gt("expiresAt", 0).lte("expiresAt", now)).take(100 - legacyRows.length);
    let processed = 0;
    for (const draft of [...legacyRows, ...expiredRows]) {
      const formKey = draft.formKey;
      const policy = isDraftFormKey(formKey) ? draftRegistry[formKey] : null;
      const expiresAt = draft.expiresAt ?? (policy ? draft.createdAt + policy.retentionDays * 86400000 : now);
      if (expiresAt > now && policy && isDraftFormKey(formKey)) {
        let payload;
        try { payload = parseDraftPayload(formKey, draft.payload); }
        catch { payload = null; }
        if (payload) {
          await ctx.db.patch(draft._id, {
            payload,
            schemaVersion: policy.version,
            activeScopeKey: activeScopeKey(draft.userId, draft.schoolId, formKey),
            expiresAt,
            revision: draft.revision ?? 0,
            updatedAt: now,
          });
          processed++;
          continue;
        }
      }
      await ctx.db.patch(draft._id, { payload: {}, status: "discarded", activeScopeKey: undefined, expiresAt: undefined, updatedAt: now });
      await audit(ctx, draft.schoolId, draft.userId, draft._id, "expired");
      processed++;
    }
    return { processed, mayHaveMore: legacyRows.length + expiredRows.length === 100 };
  },
});
export const saveDraft = saveFormDraft;
export const getDraft = getFormDraft;
export const discardDraft = discardFormDraft;
export const commitDraft = commitFormDraft;
