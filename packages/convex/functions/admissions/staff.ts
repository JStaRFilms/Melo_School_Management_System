import { mutation, query } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { issueCheckedDocumentAccessV1 } from "../foundation/documentAccess";
import { hasSchoolCapabilityV1 } from "../foundation/auth";
import { audit, requireStaffScope } from "./helpers";

async function applicationAndStaff(ctx: any, applicationId: any, capability: any) {
  const application: any = await ctx.db.get(applicationId);
  if (!application) throw new ConvexError("Not found or access denied");
  const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability });
  return { application, membership };
}

const changeRequestCoreItems = [
  ["firstName", "Legal first name"], ["lastName", "Legal last name"], ["middleName", "Middle name"],
  ["preferredName", "Preferred name"], ["dateOfBirth", "Date of birth"], ["gender", "Gender"],
  ["nationality", "Nationality"], ["countryOfBirth", "Country of birth"], ["address", "Address"],
  ["requestedEntryLabel", "Requested entry"],
] as const;

function isRestrictedDocument(document: { category: string; sensitivity: string }) {
  return document.sensitivity === "highly_sensitive" || document.sensitivity === "financial_security" || /medical|health|identity|passport|birth|government/i.test(document.category);
}

async function hasFreshAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity() as { auth_time?: unknown; authenticatedAt?: unknown } | null;
  const timestamp = typeof identity?.auth_time === "number" ? identity.auth_time * 1000 : identity?.authenticatedAt;
  return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= 5 * 60_000;
}

/** Safe intake labels for queue filters; configuration and applicant data remain separate. */
export const listAccessibleIntakes = query({
  args: { schoolId: v.id("schools") },
  returns: v.array(v.object({ intakeId: v.id("admissionsIntakes"), name: v.string(), status: v.string() })),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("admissionsIntakes").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(200);
    const result = [];
    for (const intake of rows) {
      try {
        await requireStaffScope(ctx, { schoolId: args.schoolId, programmeId: intake.programmeId, intakeId: intake._id, capability: "applications.list" });
        result.push({ intakeId: intake._id, name: intake.name, status: intake.status });
      } catch { /* Non-enumerating omission for an out-of-scope intake. */ }
    }
    return result;
  },
});

export const listQueue = query({
  args: { schoolId: v.id("schools"), intakeId: v.id("admissionsIntakes"), state: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), updatedAt: v.number(), intakeId: v.id("admissionsIntakes") })),
  handler: async (ctx, args) => {
    const intake = await ctx.db.get(args.intakeId);
    if (!intake || intake.schoolId !== args.schoolId) return [];
    await requireStaffScope(ctx, { schoolId: args.schoolId, programmeId: intake.programmeId, intakeId: intake._id, capability: "applications.list" });
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const applications = args.state
      ? await ctx.db.query("admissionsApplications").withIndex("by_school_and_intake_and_state", (q) => q.eq("schoolId", args.schoolId).eq("intakeId", intake._id).eq("state", args.state as any)).order("desc").take(limit)
      : await ctx.db.query("admissionsApplications").withIndex("by_school_and_intake_and_state", (q) => q.eq("schoolId", args.schoolId).eq("intakeId", intake._id)).order("desc").take(limit);
    return applications.map((application) => ({ applicationId: application._id, publicId: application.publicId, state: application.state, updatedAt: application.updatedAt, intakeId: application.intakeId }));
  },
});

export const listQueuePage = query({
  args: { schoolId: v.id("schools"), intakeId: v.id("admissionsIntakes"), state: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), updatedAt: v.number(), intakeId: v.id("admissionsIntakes") })), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const intake = await ctx.db.get(args.intakeId);
    if (!intake || intake.schoolId !== args.schoolId) return { page: [], isDone: true, continueCursor: "" };
    await requireStaffScope(ctx, { schoolId: args.schoolId, programmeId: intake.programmeId, intakeId: intake._id, capability: "applications.list" });
    const source = args.state
      ? ctx.db.query("admissionsApplications").withIndex("by_school_and_intake_and_state", (q) => q.eq("schoolId", args.schoolId).eq("intakeId", intake._id).eq("state", args.state as any)).order("desc")
      : ctx.db.query("admissionsApplications").withIndex("by_school_and_intake_and_state", (q) => q.eq("schoolId", args.schoolId).eq("intakeId", intake._id)).order("desc");
    const result = await source.paginate(args.paginationOpts);
    return { ...result, page: result.page.map((application) => ({ applicationId: application._id, publicId: application.publicId, state: application.state, updatedAt: application.updatedAt, intakeId: application.intakeId })) };
  },
});

const snapshotAnswerValidator = v.object({ key: v.string(), label: v.string(), valueType: v.string(), value: v.union(v.string(), v.null()), dataClass: v.string(), redacted: v.boolean() });
const applicantProfileValidator = v.object({ firstName: v.string(), lastName: v.string(), middleName: v.union(v.string(), v.null()), preferredName: v.union(v.string(), v.null()), dateOfBirth: v.number(), gender: v.union(v.string(), v.null()), nationality: v.union(v.string(), v.null()), countryOfBirth: v.union(v.string(), v.null()), address: v.union(v.string(), v.null()) });
const decisionReadinessValidator = v.object({ hasSnapshot: v.boolean(), requiredDocumentsAccepted: v.boolean(), legalEvidenceBound: v.boolean(), financeClear: v.boolean(), evaluationsComplete: v.boolean(), ready: v.boolean() });
const applicationDetailValidator = v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), revision: v.number(), snapshotId: v.union(v.id("admissionsSubmissionSnapshots"), v.null()), decisionState: v.union(v.string(), v.null()), documentCount: v.number(), profile: v.union(applicantProfileValidator, v.null()), answers: v.array(snapshotAnswerValidator), sensitiveAnswerCount: v.number(), decisionReadiness: decisionReadinessValidator });

function restrictedDataClass(dataClass: string) { return dataClass === "highly_sensitive" || dataClass === "financial_security"; }
async function snapshotProjection(ctx: any, application: any, revealSensitive: boolean) {
  const [documents, requirements, evaluations, hold] = await Promise.all([
    ctx.db.query("admissionsDocuments").withIndex("by_application_and_category_and_version", (q: any) => q.eq("applicationId", application._id)).take(200),
    ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q: any) => q.eq("formVersionId", application.formVersionId)).take(100),
    ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q: any) => q.eq("applicationId", application._id)).take(100),
    ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q: any) => q.eq("applicationId", application._id).eq("state", "active")).unique(),
  ]);
  const decision: any = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
  const requiredDocumentsAccepted = requirements.every((requirement: any) => requirement.requiredMode !== "required" || documents.some((document: any) => document.requirementId === requirement._id && document.state === "accepted"));
  const readinessBase = { hasSnapshot: Boolean(application.latestSnapshotId), requiredDocumentsAccepted, legalEvidenceBound: false, financeClear: !hold && !application.financeBlockedReason, evaluationsComplete: !evaluations.some((evaluation: any) => evaluation.state === "scheduled") };
  if (!application.latestSnapshotId) return { applicationId: application._id, publicId: application.publicId, state: application.state, revision: application.currentRevision, snapshotId: null, decisionState: decision?.state ?? null, documentCount: documents.length, profile: null, answers: [], sensitiveAnswerCount: 0, decisionReadiness: { ...readinessBase, ready: false } };
  const [items, fields] = await Promise.all([
    ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q: any) => q.eq("snapshotId", application.latestSnapshotId)).take(500),
    ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q: any) => q.eq("formVersionId", application.formVersionId)).take(200),
  ]);
  const profileItem = items.find((item: any) => item.kind === "profile");
  let profile = null;
  if (profileItem) { try { profile = JSON.parse(profileItem.serializedValue); } catch { profile = null; } }
  const labels = new Map(fields.map((field: any) => [field.fieldKey, field.label]));
  const answerItems = items.filter((item: any) => item.kind === "answer");
  const answers = answerItems.map((item: any) => { const key = item.itemKey.replace(/^answer:/, ""); const redacted = restrictedDataClass(item.dataClass) && !revealSensitive; return { key, label: labels.get(key) ?? key, valueType: item.valueType, value: redacted ? null : item.serializedValue, dataClass: item.dataClass, redacted }; });
  const legalEvidenceBound = items.some((item: any) => item.kind === "declaration");
  const decisionReadiness = { ...readinessBase, legalEvidenceBound, ready: readinessBase.hasSnapshot && requiredDocumentsAccepted && legalEvidenceBound && readinessBase.financeClear && readinessBase.evaluationsComplete };
  return { applicationId: application._id, publicId: application.publicId, state: application.state, revision: application.currentRevision, snapshotId: application.latestSnapshotId, decisionState: decision?.state ?? null, documentCount: documents.length, profile, answers, sensitiveAnswerCount: answerItems.filter((item: any) => restrictedDataClass(item.dataClass)).length, decisionReadiness };
}

/** Snapshot-backed review projection. High-risk answers are represented but redacted. */
export const getApplicationDetail = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.union(v.null(), applicationDetailValidator),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "applications.view_basic");
    return await snapshotProjection(ctx, application, false);
  },
});

/** Sensitive disclosure requires the exact grant and fresh authentication, and is audited first. */
export const revealSensitiveApplicationDetail = mutation({
  args: { applicationId: v.id("admissionsApplications"), reason: v.string() },
  returns: applicationDetailValidator,
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "applications.view_basic");
    const { membership } = await applicationAndStaff(ctx, args.applicationId, "applications.view_sensitive");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 250 || !await hasFreshAuth(ctx)) throw new ConvexError("Sensitive detail requires fresh authentication and a reason");
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "application.sensitive_detail_viewed", entityType: "submission_snapshot", entityId: String(application.latestSnapshotId ?? application._id), applicationId: application._id, outcome: "success", reasonCode: reason.slice(0, 128) });
    return await snapshotProjection(ctx, application, true);
  },
});

/** Metadata-only document projection. Checked access is a separate audited mutation. */
export const listApplicationDocuments = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.array(v.object({ documentId: v.id("admissionsDocuments"), documentKey: v.string(), category: v.string(), state: v.string(), sensitivity: v.string(), version: v.number(), updatedAt: v.number() })),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "documents.review");
    const rows = await ctx.db.query("admissionsDocuments")
      .withIndex("by_application_and_category_and_version", (q) => q.eq("applicationId", application._id)).take(200);
    return rows.map((document) => ({ documentId: document._id, documentKey: document.documentKey, category: document.category, state: document.state, sensitivity: document.sensitivity, version: document.version, updatedAt: document.updatedAt }));
  },
});

/** Conversion target choices are server-scoped to the accepted application's school. */
export const listConversionClasses = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.array(v.object({ classId: v.id("classes"), name: v.string() })),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "conversions.execute");
    const rows = await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", application.schoolId)).take(200);
    return rows.filter((row) => !row.isArchived).map((row) => ({ classId: row._id, name: row.name }));
  },
});

export const recordDocumentReview = mutation({
  args: { documentId: v.id("admissionsDocuments"), result: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("needs_replacement")), reasonCode: v.optional(v.string()), guardianMessage: v.optional(v.string()), internalNote: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId); const application = document && await ctx.db.get(document.applicationId);
    if (!document || !application || document.schoolId !== application.schoolId) throw new ConvexError("Not found or access denied");
    const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: "documents.review" });
    if (document.state !== "uploaded") throw new ConvexError("Invalid document transition");
    if (args.result !== "accepted" && !args.guardianMessage?.trim()) throw new ConvexError("Guardian-safe message is required");
    const now = Date.now(); const state = args.result === "accepted" ? "accepted" : "rejected" as const;
    await ctx.db.patch(document._id, { state, updatedAt: now });
    await ctx.db.insert("admissionsDocumentReviews", { schoolId: application.schoolId, documentId: document._id, reviewerUserId: membership.userId, result: args.result, ...(args.reasonCode?.trim() ? { reasonCode: args.reasonCode.trim() } : {}), ...(args.guardianMessage?.trim() ? { guardianMessage: args.guardianMessage.trim() } : {}), ...(args.internalNote?.trim() ? { internalNote: args.internalNote.trim() } : {}), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "document.reviewed", entityType: "document", entityId: String(document._id), applicationId: application._id, outcome: "success" });
    return null;
  },
});

export const getDocumentAccess = mutation({
  args: { documentKey: v.string(), action: v.union(v.literal("view"), v.literal("download")), reason: v.optional(v.string()) },
  returns: v.union(v.object({ status: v.literal("available"), documentKey: v.string(), url: v.string(), expiresAt: v.null() }), v.object({ status: v.literal("unavailable"), documentKey: v.string() })),
  handler: async (ctx, args) => {
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey)).unique();
    const application = document && await ctx.db.get(document.applicationId);
    if (!document || !application) return { status: "unavailable" as const, documentKey: args.documentKey };
    const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: args.action === "download" ? "documents.download" : "documents.review" });
    const restricted = isRestrictedDocument(document);
    if (restricted) {
      await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: "applications.view_sensitive" });
    }
    const fresh = !restricted || await hasFreshAuth(ctx);
    const reason = args.reason?.trim();
    const reasonValid = Boolean(reason && reason.length >= 8 && reason.length <= 250);
    return await issueCheckedDocumentAccessV1({ ctx, documentKey: args.documentKey, actor: { kind: "staff", userId: membership.userId, schoolId: application.schoolId, assurance: fresh ? "fresh" : "standard" }, action: args.action, reason: reasonValid ? reason : "reason_required", requiresFreshAuth: restricted, authorize: async () => reasonValid });
  },
});

/** Server-selected whitelist for a guardian correction request; staff never type opaque field IDs. */
export const listChangeRequestItems = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.object({ core: v.array(v.object({ key: v.string(), label: v.string() })), fields: v.array(v.object({ key: v.string(), label: v.string() })), requirements: v.array(v.object({ key: v.string(), label: v.string() })) }),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "reviews.record");
    const [fields, requirements] = await Promise.all([
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(200),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(100),
    ]);
    return { core: changeRequestCoreItems.map(([key, label]) => ({ key, label })), fields: fields.filter((field) => field.status === "active").map((field) => ({ key: field.fieldKey, label: field.label })), requirements: requirements.map((requirement) => ({ key: requirement.requirementKey, label: requirement.label })) };
  },
});

export const requestChanges = mutation({
  args: { applicationId: v.id("admissionsApplications"), message: v.string(), reasonCode: v.optional(v.string()), coreKeys: v.optional(v.array(v.string())), fieldKeys: v.array(v.string()), requirementKeys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "reviews.record");
    const coreKeys = args.coreKeys ?? [];
    if ((application.state !== "submitted" && application.state !== "under_review") || !args.message.trim() || args.message.trim().length > 4_000 || coreKeys.length + args.fieldKeys.length + args.requirementKeys.length < 1 || coreKeys.length > changeRequestCoreItems.length || args.fieldKeys.length > 200 || args.requirementKeys.length > 100 || new Set(coreKeys).size !== coreKeys.length || new Set(args.fieldKeys).size !== args.fieldKeys.length || new Set(args.requirementKeys).size !== args.requirementKeys.length) throw new ConvexError("Invalid application transition");
    const [fields, requirements] = await Promise.all([
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(200),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(100),
    ]);
    if (coreKeys.some((key) => !changeRequestCoreItems.some(([allowed]) => allowed === key)) || args.fieldKeys.some((key) => !fields.some((field) => field.fieldKey === key && field.status === "active")) || args.requirementKeys.some((key) => !requirements.some((requirement) => requirement.requirementKey === key))) throw new ConvexError("Invalid application transition");
    const now = Date.now(); await ctx.db.patch(application._id, { state: "changes_requested", changeRequestCoreKeys: coreKeys, changeRequestFieldKeys: args.fieldKeys, changeRequestRequirementKeys: args.requirementKeys, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, actorUserId: membership.userId, eventType: "changes_requested", visibility: "guardian", message: args.message.trim(), ...(args.reasonCode?.trim() ? { reasonCode: args.reasonCode.trim() } : {}), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "application.changes_requested", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" }); return null;
  },
});

export const recordDecision = mutation({
  args: { applicationId: v.id("admissionsApplications"), state: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("waitlisted")), reasonCode: v.string(), guardianMessage: v.string() },
  returns: v.id("admissionsDecisions"),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "decisions.record");
    if (!application.latestSnapshotId || !["submitted", "under_review", "waitlisted"].includes(application.state) || !args.reasonCode.trim() || !args.guardianMessage.trim()) throw new ConvexError("Invalid decision transition");
    const previous: any = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    if (previous && ["accepted", "rejected"].includes(previous.state)) throw new ConvexError("Invalid decision transition");
    const [hold, requirements, documents, evaluations] = await Promise.all([
      ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "active")).unique(),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(100),
      ctx.db.query("admissionsDocuments").withIndex("by_application_and_category_and_version", (q) => q.eq("applicationId", application._id)).take(200),
      ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id)).take(100),
    ]);
    if (hold || application.financeBlockedReason || evaluations.some((evaluation) => evaluation.state === "scheduled") || requirements.some((requirement) => requirement.requiredMode === "required" && !documents.some((document) => document.requirementId === requirement._id && document.state === "accepted"))) throw new ConvexError("DECISION_PRECONDITIONS_UNMET");
    const now = Date.now(); const decisionId = await ctx.db.insert("admissionsDecisions", { schoolId: application.schoolId, applicationId: application._id, version: (previous?.version ?? 0) + 1, state: args.state, reasonCode: args.reasonCode.trim(), rationale: args.guardianMessage.trim(), decidedBy: membership.userId, decidedAt: now, ...(previous ? { supersedesDecisionId: previous._id } : {}), createdAt: now });
    await ctx.db.patch(application._id, { state: args.state, currentDecisionId: decisionId, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, actorUserId: membership.userId, eventType: "decision_recorded", visibility: "guardian", message: args.guardianMessage.trim(), reasonCode: args.reasonCode.trim(), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "decision.recorded", entityType: "decision", entityId: String(decisionId), applicationId: application._id, outcome: "success" }); return decisionId;
  },
});

/** Selection list avoids a client-entered staff ID; assignments still authorize actor and scope transactionally. */
export const listAssignableStaff = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.array(v.object({ userId: v.id("users"), name: v.string() })),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "reviews.assign");
    const users = await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", application.schoolId)).take(200);
    const result = [];
    for (const user of users) {
      if (user.isArchived) continue;
      const grants = await ctx.db.query("schoolCapabilityGrants").withIndex("by_school_and_user", (q) => q.eq("schoolId", application.schoolId).eq("userId", user._id)).take(100);
      const eligible = grants.some((grant) => !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > Date.now()) && (grant.capability === "reviews.record" || grant.capability === "reviews.assign") && (grant.scope === "school" || grant.scope === "programme" && grant.programmeId === application.programmeId || grant.scope === "intake" && grant.intakeId === application.intakeId));
      if (eligible) result.push({ userId: user._id, name: user.name });
    }
    return result;
  },
});

export const startReview = mutation({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "reviews.record");
    if (application.state !== "submitted") throw new ConvexError("Invalid application transition");
    const now = Date.now();
    await ctx.db.patch(application._id, { state: "under_review", updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, actorUserId: membership.userId, eventType: "review_started", visibility: "staff", createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "review.started", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" });
    return null;
  },
});

export const assignReview = mutation({
  args: { applicationId: v.id("admissionsApplications"), assigneeUserId: v.id("users"), role: v.string(), dueAt: v.optional(v.number()) },
  returns: v.id("admissionsReviewAssignments"),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "reviews.assign");
    const assignee = await ctx.db.get(args.assigneeUserId);
    if (!assignee || assignee.schoolId !== application.schoolId || assignee.isArchived || !args.role.trim()) throw new ConvexError("Not found or access denied");
    const assigneeCanReview = await hasSchoolCapabilityV1(ctx, { userId: assignee._id, schoolId: assignee.schoolId, role: assignee.role, isSchoolAdmin: assignee.role === "admin" || assignee.isSchoolAdmin === true }, "reviews.record", { programmeId: application.programmeId, intakeId: application.intakeId });
    if (!assigneeCanReview) throw new ConvexError("Not found or access denied");
    const now = Date.now();
    const assignmentId = await ctx.db.insert("admissionsReviewAssignments", { schoolId: application.schoolId, applicationId: application._id, assigneeUserId: assignee._id, role: args.role.trim().slice(0, 128), state: "assigned", ...(args.dueAt ? { dueAt: args.dueAt } : {}), assignedByUserId: membership.userId, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, actorUserId: membership.userId, eventType: "assignment_created", visibility: "staff", metadataJson: JSON.stringify({ assignmentId: String(assignmentId), role: args.role.trim().slice(0, 128) }), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "review.assigned", entityType: "assignment", entityId: String(assignmentId), applicationId: application._id, outcome: "success" });
    return assignmentId;
  },
});

export const recordEvaluation = mutation({
  args: { applicationId: v.id("admissionsApplications"), type: v.union(v.literal("entrance_assessment"), v.literal("interview")), state: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")), scheduledAt: v.optional(v.number()), resultCode: v.optional(v.string()), score: v.optional(v.number()), notes: v.optional(v.string()) },
  returns: v.id("admissionsEvaluations"),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "reviews.record");
    if (!["submitted", "under_review", "waitlisted"].includes(application.state) || (args.state === "completed" && !args.resultCode?.trim()) || (args.score !== undefined && (!Number.isFinite(args.score) || args.score < 0 || args.score > 100))) throw new ConvexError("Invalid evaluation");
    const previous = await ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id).eq("type", args.type)).order("desc").take(1);
    const now = Date.now();
    const evaluationId = await ctx.db.insert("admissionsEvaluations", { schoolId: application.schoolId, applicationId: application._id, type: args.type, state: args.state, ...(args.scheduledAt ? { scheduledAt: args.scheduledAt } : {}), ...(args.state === "completed" ? { completedAt: now, evaluatorUserId: membership.userId } : {}), ...(args.resultCode?.trim() ? { resultCode: args.resultCode.trim().slice(0, 128) } : {}), ...(args.score !== undefined ? { score: args.score } : {}), ...(args.notes?.trim() ? { notes: args.notes.trim().slice(0, 4_000) } : {}), version: (previous[0]?.version ?? 0) + 1, createdAt: now, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, actorUserId: membership.userId, eventType: "evaluation_recorded", visibility: "staff", metadataJson: JSON.stringify({ type: args.type, state: args.state, evaluationId: String(evaluationId) }), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "evaluation.recorded", entityType: "evaluation", entityId: String(evaluationId), applicationId: application._id, outcome: "success" });
    return evaluationId;
  },
});

export const reopenDecision = mutation({
  args: { applicationId: v.id("admissionsApplications"), reasonCode: v.string(), guardianMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "decisions.record");
    const decision = application.currentDecisionId && await ctx.db.get(application.currentDecisionId);
    const conversion = application.conversionId && await ctx.db.get(application.conversionId);
    if (!decision || !["accepted", "rejected"].includes(decision.state) || conversion?.state === "succeeded" || !args.reasonCode.trim() || !args.guardianMessage.trim()) throw new ConvexError("Invalid decision transition");
    const now = Date.now();
    await ctx.db.patch(application._id, { state: "under_review", currentDecisionId: undefined, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, actorUserId: membership.userId, eventType: "decision_reopened", visibility: "guardian", reasonCode: args.reasonCode.trim().slice(0, 128), message: args.guardianMessage.trim().slice(0, 4_000), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "decision.reopened", entityType: "decision", entityId: String(decision._id), applicationId: application._id, outcome: "success" });
    return null;
  },
});

export const withdrawApplication = mutation({
  args: { applicationId: v.id("admissionsApplications"), reasonCode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "reviews.record");
    if (["archived", "withdrawn"].includes(application.state) || !args.reasonCode.trim()) throw new ConvexError("Invalid application transition");
    const now = Date.now(); await ctx.db.patch(application._id, { state: "withdrawn", updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, actorUserId: membership.userId, eventType: "staff_withdrawal", visibility: "guardian", reasonCode: args.reasonCode.trim().slice(0, 128), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "application.withdrawn_by_staff", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" }); return null;
  },
});

/** Exceptional recovery only: it is visible to the guardian and never rewrites a snapshot or decision. */
export const overrideApplicationState = mutation({
  args: { applicationId: v.id("admissionsApplications"), state: v.union(v.literal("under_review"), v.literal("withdrawn")), reasonCode: v.string(), guardianMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "decisions.record");
    const conversion = application.conversionId && await ctx.db.get(application.conversionId);
    if (!args.reasonCode.trim() || !args.guardianMessage.trim() || conversion?.state === "succeeded" || (args.state === "under_review" && application.state !== "withdrawn") || (args.state === "withdrawn" && ["archived", "withdrawn"].includes(application.state))) throw new ConvexError("Invalid application transition");
    const now = Date.now();
    await ctx.db.patch(application._id, { state: args.state, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, actorUserId: membership.userId, eventType: "authorized_override", visibility: "guardian", reasonCode: args.reasonCode.trim().slice(0, 128), message: args.guardianMessage.trim().slice(0, 4_000), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "application.authorized_override", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success", reasonCode: args.reasonCode.trim().slice(0, 128) });
    return null;
  },
});

export const setFinanceHold = mutation({
  args: { applicationId: v.id("admissionsApplications"), action: v.union(v.literal("place"), v.literal("release")), reasonCode: v.string(), note: v.optional(v.string()) },
  returns: v.union(v.id("admissionsFinanceHolds"), v.null()),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "decisions.record");
    if (!args.reasonCode.trim()) throw new ConvexError("FINANCE_HOLD_REASON_REQUIRED");
    const active = await ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "active")).unique();
    const now = Date.now();
    if (args.action === "release") {
      if (!active) return null;
      await ctx.db.patch(active._id, { state: "released", releasedByUserId: membership.userId, releasedAt: now, updatedAt: now });
      await ctx.db.patch(application._id, { activeFinanceHoldId: undefined, financeBlockedReason: undefined, updatedAt: now });
      await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "finance_hold.released", entityType: "finance_hold", entityId: String(active._id), applicationId: application._id, outcome: "success" }); return null;
    }
    if (active) return active._id;
    const holdId = await ctx.db.insert("admissionsFinanceHolds", { schoolId: application.schoolId, applicationId: application._id, state: "active", reasonCode: args.reasonCode.trim().slice(0, 128), ...(args.note?.trim() ? { note: args.note.trim().slice(0, 1_000) } : {}), createdByUserId: membership.userId, createdAt: now, updatedAt: now });
    await ctx.db.patch(application._id, { activeFinanceHoldId: holdId, financeBlockedReason: args.reasonCode.trim().slice(0, 128), updatedAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "finance_hold.placed", entityType: "finance_hold", entityId: String(holdId), applicationId: application._id, outcome: "success" }); return holdId;
  },
});

export const getAuditPage = query({
  args: { applicationId: v.id("admissionsApplications"), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.object({ action: v.string(), entityType: v.string(), entityId: v.string(), outcome: v.string(), reasonCode: v.union(v.string(), v.null()), createdAt: v.number() })), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "audit.view");
    const result = await ctx.db.query("admissionsAuditEvents").withIndex("by_application_and_created_at", (q) => q.eq("applicationId", application._id)).order("desc").paginate(args.paginationOpts);
    return { ...result, page: result.page.map((event) => ({ action: event.action, entityType: event.entityType, entityId: event.entityId, outcome: event.outcome, reasonCode: event.reasonCode ?? null, createdAt: event.createdAt })) };
  },
});

export const createRetentionJob = mutation({
  args: { applicationId: v.optional(v.id("admissionsApplications")), schoolId: v.id("schools"), policyKey: v.string(), policyVersion: v.string(), scheduledAt: v.number() },
  returns: v.id("admissionsRetentionJobs"),
  handler: async (ctx, args) => {
    let programmeId: any; let intakeId: any;
    if (args.applicationId) { const application = await ctx.db.get(args.applicationId); if (!application || application.schoolId !== args.schoolId) throw new ConvexError("Not found or access denied"); programmeId = application.programmeId; intakeId = application.intakeId; }
    else throw new ConvexError("An application scope is required");
    const membership = await requireStaffScope(ctx, { schoolId: args.schoolId, programmeId, intakeId, capability: "retention.manage" }); const now = Date.now();
    const jobId = await ctx.db.insert("admissionsRetentionJobs", { schoolId: args.schoolId, applicationId: args.applicationId, policyKey: args.policyKey.trim(), policyVersion: args.policyVersion.trim(), state: "draft", scheduledAt: args.scheduledAt, createdAt: now, updatedAt: now });
    await audit({ ctx, schoolId: args.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "retention.job_created", entityType: "retention_job", entityId: String(jobId), applicationId: args.applicationId, outcome: "success" }); return jobId;
  },
});
