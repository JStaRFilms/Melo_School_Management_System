import { mutation, query } from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { issueCheckedDocumentAccessV1 } from "../foundation/documentAccess";
import { audit, requireStaffScope } from "./helpers";

async function applicationAndStaff(ctx: any, applicationId: any, capability: any) {
  const application: any = await ctx.db.get(applicationId);
  if (!application) throw new ConvexError("Not found or access denied");
  const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability });
  return { application, membership };
}

function isRestrictedDocument(document: { category: string; sensitivity: string }) {
  return document.sensitivity === "highly_sensitive" || document.sensitivity === "financial_security" || /medical|health|identity|passport|birth|government/i.test(document.category);
}

async function hasFreshAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity() as { auth_time?: unknown; authenticatedAt?: unknown } | null;
  const timestamp = typeof identity?.auth_time === "number" ? identity.auth_time * 1000 : identity?.authenticatedAt;
  return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= 5 * 60_000;
}

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

export const getApplicationDetail = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.union(v.null(), v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), revision: v.number(), decisionState: v.union(v.string(), v.null()), documentCount: v.number() })),
  handler: async (ctx, args) => {
    const { application } = await applicationAndStaff(ctx, args.applicationId, "applications.view_basic");
    const documents = await ctx.db.query("admissionsDocuments").withIndex("by_application_and_category_and_version", (q) => q.eq("applicationId", application._id)).take(200);
    const decision: any = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    return { applicationId: application._id, publicId: application.publicId, state: application.state, revision: application.currentRevision, decisionState: decision?.state ?? null, documentCount: documents.length };
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

export const requestChanges = mutation({
  args: { applicationId: v.id("admissionsApplications"), message: v.string(), reasonCode: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { application, membership } = await applicationAndStaff(ctx, args.applicationId, "reviews.record");
    if ((application.state !== "submitted" && application.state !== "under_review") || !args.message.trim()) throw new ConvexError("Invalid application transition");
    const now = Date.now(); await ctx.db.patch(application._id, { state: "changes_requested", updatedAt: now });
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
    const now = Date.now(); const decisionId = await ctx.db.insert("admissionsDecisions", { schoolId: application.schoolId, applicationId: application._id, version: (previous?.version ?? 0) + 1, state: args.state, reasonCode: args.reasonCode.trim(), rationale: args.guardianMessage.trim(), decidedBy: membership.userId, decidedAt: now, ...(previous ? { supersedesDecisionId: previous._id } : {}), createdAt: now });
    await ctx.db.patch(application._id, { state: args.state, currentDecisionId: decisionId, updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, actorUserId: membership.userId, eventType: "decision_recorded", visibility: "guardian", message: args.guardianMessage.trim(), reasonCode: args.reasonCode.trim(), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "decision.recorded", entityType: "decision", entityId: String(decisionId), applicationId: application._id, outcome: "success" }); return decisionId;
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
