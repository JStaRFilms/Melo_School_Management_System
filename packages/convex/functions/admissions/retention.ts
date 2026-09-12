import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { storageClaimedOnlyBy } from "../academic/assetStorageBoundary";
import {
  DAY_MS,
  admissionsError,
  recordAdmissionsAudit,
  requireAdmissionsStaff,
} from "./shared";

type Context = QueryCtx | MutationCtx;

export async function getCurrentRetentionPolicy(ctx: Context, schoolId: Id<"schools">) {
  const rows = await ctx.db.query("admissionsRetentionPolicies")
    .withIndex("by_school_id_and_status", (q) => q.eq("schoolId", schoolId).eq("status", "current"))
    .take(2);
  if (rows.length > 1) throw new ConvexError("Admissions retention policy requires reconciliation");
  return rows[0] ?? null;
}

export const getPolicy = query({
  args: { schoolId: v.id("schools") },
  returns: v.object({ mode: v.union(v.literal("never"), v.literal("archive")), archiveAfterDays: v.union(v.number(), v.null()), version: v.number(), effectiveFrom: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    const policy = await getCurrentRetentionPolicy(ctx, args.schoolId);
    return policy ? { mode: policy.mode, archiveAfterDays: policy.archiveAfterDays ?? null, version: policy.version, effectiveFrom: policy.effectiveFrom } : { mode: "never" as const, archiveAfterDays: null, version: 0, effectiveFrom: null };
  },
});

export const setPolicy = mutation({
  args: { schoolId: v.id("schools"), mode: v.union(v.literal("never"), v.literal("archive")), archiveAfterDays: v.optional(v.number()), expectedVersion: v.number() },
  returns: v.object({ policyId: v.id("admissionsRetentionPolicies"), version: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    if (args.mode === "archive" && (!Number.isSafeInteger(args.archiveAfterDays) || (args.archiveAfterDays ?? 0) < 30)) throw new ConvexError("Admissions document archive retention must be at least 30 days");
    if (args.mode === "never" && args.archiveAfterDays !== undefined) throw new ConvexError("Never-retain policy does not accept an archive delay");
    const current = await getCurrentRetentionPolicy(ctx, args.schoolId);
    if ((current?.version ?? 0) !== args.expectedVersion) throw new ConvexError("Retention policy changed; reload and review again");
    const now = Date.now();
    if (current) await ctx.db.patch(current._id, { status: "superseded" });
    const version = args.expectedVersion + 1;
    const policyId = await ctx.db.insert("admissionsRetentionPolicies", { schoolId: args.schoolId, version, mode: args.mode, ...(args.mode === "archive" ? { archiveAfterDays: args.archiveAfterDays } : {}), status: "current", effectiveFrom: now, createdByUserId: actor.userId, createdAt: now });
    if (args.mode === "archive") await ctx.db.insert("admissionsRetentionJobs", { schoolId: args.schoolId, policyKey: "document_cleanup", policyVersion: String(version), state: "running", scheduledAt: now, cursor: JSON.stringify({ stateIndex: 0, updatedAt: 0 }), createdAt: now, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "retention.policy_set", entityType: "admissionsRetentionPolicy", entityId: policyId, metadata: { mode: args.mode, archiveAfterDays: args.archiveAfterDays ?? null, version } });
    return { policyId, version };
  },
});

async function retentionBlocker(ctx: Context, document: Doc<"admissionsDocuments">, now: number, operation: "archive" | "delete", expectedPolicyId?: Id<"admissionsRetentionPolicies">) {
  const application = await ctx.db.get(document.applicationId);
  if (!application || application.schoolId !== document.schoolId) return "APPLICATION_CONTEXT_MISSING";
  if (document.retentionHold) return "LEGAL_OR_RETENTION_HOLD";
  if (!application.terminalOutcomeAt || !application.retentionPolicyId) return "NO_PROSPECTIVE_POLICY";
  if (expectedPolicyId && application.retentionPolicyId !== expectedPolicyId) return "POLICY_VERSION_MISMATCH";
  const policy = await ctx.db.get(application.retentionPolicyId);
  if (!policy || policy.schoolId !== document.schoolId || policy.mode !== "archive" || policy.archiveAfterDays === undefined) return "POLICY_NEVER";
  const terminalEligible = application.state === "rejected" || application.state === "withdrawn" || application.state === "archived" ||
    (application.state === "accepted" && application.conversionId !== undefined);
  if (!terminalEligible || application.state === "waitlisted") return "APPLICATION_NOT_TERMINAL";
  if (application.state === "accepted") {
    const conversion = application.conversionId ? await ctx.db.get(application.conversionId) : null;
    if (!conversion || conversion.state !== "succeeded") return "CONVERSION_NOT_SUCCEEDED";
  }
  const [assignments, conversions, outbox, jobs, students] = await Promise.all([
    ctx.db.query("admissionsReviewAssignments").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "assigned")).take(1),
    ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).take(2),
    ctx.db.query("admissionsCommunicationOutbox").withIndex("by_application_and_event_key", (q) => q.eq("applicationId", application._id)).take(21),
    ctx.db.query("admissionsRetentionJobs").withIndex("by_application", (q) => q.eq("applicationId", application._id)).take(11),
    ctx.db.query("students").withIndex("by_source_application", (q) => q.eq("sourceApplicationId", application._id)).take(2),
  ]);
  if (assignments.length || conversions.some((item) => item.state === "requested" || item.state === "running" || item.state === "failed_retryable") || outbox.some((item) => item.state === "pending" || item.state === "sending") || jobs.some((item) => item.state === "approved" || item.state === "running")) return "PENDING_WORKFLOW";
  if (students.some((student) => student.photoSourceDocumentId === document._id || (student.photoStorageId === document.storageId && student.photoProvenance === "application_upload"))) return "STUDENT_PHOTO_SOURCE";
  if (operation === "archive") {
    if (now < application.terminalOutcomeAt + policy.archiveAfterDays * DAY_MS) return "ARCHIVE_NOT_DUE";
  } else {
    if (document.archivedAt === undefined || now < document.archivedAt + 30 * DAY_MS) return "DELETE_NOT_DUE";
    if (!document.quotaReservationKey || !document.storageAccountingInitializedAt) return "UNTRUSTWORTHY_STORAGE_PROVENANCE";
  }
  return null;
}

async function archiveDocument(ctx: MutationCtx, document: Doc<"admissionsDocuments">, now: number, expectedPolicyId?: Id<"admissionsRetentionPolicies">) {
  if (document.state === "deleted" || document.state === "archived") return { changed: false, state: document.state, blocker: null };
  const blocker = await retentionBlocker(ctx, document, now, "archive", expectedPolicyId);
  if (blocker) return { changed: false, state: document.state, blocker };
  await ctx.db.patch(document._id, { state: "archived", archivedAt: now, updatedAt: now });
  return { changed: true, state: "archived" as const, blocker: null };
}

async function deleteDocument(ctx: MutationCtx, document: Doc<"admissionsDocuments">, now: number, expectedPolicyId?: Id<"admissionsRetentionPolicies">) {
  if (document.state === "deleted") return { changed: false, state: "deleted" as const, blocker: null };
  if (document.state !== "archived") return { changed: false, state: document.state, blocker: "DOCUMENT_NOT_ARCHIVED" };
  const blocker = await retentionBlocker(ctx, document, now, "delete", expectedPolicyId);
  if (blocker) return { changed: false, state: document.state, blocker };
  if (!(await storageClaimedOnlyBy(ctx, document.storageId, { purpose: "admissionsDocument", ownerId: String(document._id) }))) return { changed: false, state: document.state, blocker: "CONFLICTING_STORAGE_OWNERSHIP" };
  const metadata = await ctx.db.system.get("_storage", document.storageId);
  if (!metadata || metadata.size !== document.byteSize || metadata.sha256 === undefined) return { changed: false, state: document.state, blocker: "STORAGE_METADATA_UNTRUSTWORTHY" };
  const quotaReservationKey = document.quotaReservationKey;
  if (!quotaReservationKey) return { changed: false, state: document.state, blocker: "QUOTA_PROVENANCE_UNTRUSTWORTHY" };
  const reservation = await ctx.db.query("usageQuotaReservations").withIndex("by_school_and_meter_and_idempotency_key", (q) => q.eq("schoolId", document.schoolId).eq("meterType", "storage_bytes").eq("idempotencyKey", quotaReservationKey)).unique();
  if (!reservation || reservation.status !== "committed" || reservation.actualUnits !== document.byteSize) return { changed: false, state: document.state, blocker: "QUOTA_PROVENANCE_UNTRUSTWORTHY" };
  await ctx.storage.delete(document.storageId);
  await ctx.runMutation(internal.functions.academic.metering.releaseUsageQuota, { schoolId: document.schoolId, meterType: "storage_bytes", idempotencyKey: quotaReservationKey });
  await ctx.db.patch(document._id, { state: "deleted", deletedAt: now, updatedAt: now });
  return { changed: true, state: "deleted" as const, blocker: null };
}

const cleanupResultValidator = v.object({ changed: v.boolean(), state: v.string(), blocker: v.union(v.string(), v.null()) });

export const archiveDocumentManually = mutation({
  args: { schoolId: v.id("schools"), documentKey: v.string() },
  returns: cleanupResultValidator,
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage", "enrollment.decisions.record"]);
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey.trim())).unique();
    if (!document || document.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Document not found");
    const result = await archiveDocument(ctx, document, Date.now());
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "retention.manual_archive", entityType: "admissionsDocument", entityId: document.documentKey, applicationId: document.applicationId, outcome: result.blocker ? "blocked" : "success", ...(result.blocker ? { reasonCode: result.blocker } : {}) });
    return result;
  },
});

export const deleteDocumentManually = mutation({
  args: { schoolId: v.id("schools"), documentKey: v.string() },
  returns: cleanupResultValidator,
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage", "enrollment.decisions.record"]);
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey.trim())).unique();
    if (!document || document.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Document not found");
    const result = await deleteDocument(ctx, document, Date.now());
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "retention.manual_delete", entityType: "admissionsDocument", entityId: document.documentKey, applicationId: document.applicationId, outcome: result.blocker ? "blocked" : "success", ...(result.blocker ? { reasonCode: result.blocker } : {}) });
    return result;
  },
});

const RETENTION_STATES = ["uploaded", "accepted", "rejected", "superseded", "archived"] as const;

function parseCursor(value: string | undefined) {
  if (!value) return { stateIndex: 0, updatedAt: 0, creationTime: 0 };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return { stateIndex: 0, updatedAt: 0, creationTime: 0 };
    const stateIndex = Reflect.get(parsed, "stateIndex");
    const updatedAt = Reflect.get(parsed, "updatedAt");
    const creationTime = Reflect.get(parsed, "creationTime");
    return { stateIndex: typeof stateIndex === "number" && Number.isSafeInteger(stateIndex) ? Math.max(0, Math.min(stateIndex, RETENTION_STATES.length - 1)) : 0, updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? Math.max(0, updatedAt) : 0, creationTime: typeof creationTime === "number" && Number.isFinite(creationTime) ? Math.max(0, creationTime) : 0 };
  } catch {
    return { stateIndex: 0, updatedAt: 0, creationTime: 0 };
  }
}

export const processRetentionCleanup = internalMutation({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  returns: v.object({ inspected: v.number(), archived: v.number(), deleted: v.number(), blocked: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 25), 1), 50);
    const jobs = await ctx.db.query("admissionsRetentionJobs").withIndex("by_state_and_scheduled_at", (q) => q.eq("state", "running").lte("scheduledAt", now)).take(limit);
    let inspected = 0, archived = 0, deleted = 0, blocked = 0;
    for (const job of jobs) {
      if (inspected >= limit) break;
      const policyVersion = Number(job.policyVersion);
      const policy = Number.isSafeInteger(policyVersion) && policyVersion > 0
        ? await ctx.db.query("admissionsRetentionPolicies").withIndex("by_school_id_and_version", (q) => q.eq("schoolId", job.schoolId).eq("version", policyVersion)).unique()
        : null;
      if (!policy || policy.mode !== "archive") {
        await ctx.db.patch(job._id, { state: "cancelled", updatedAt: now });
        continue;
      }
      const cursor = parseCursor(job.cursor);
      let selected: Doc<"admissionsDocuments"> | null = null;
      let selectedStateIndex = cursor.stateIndex;
      for (let stateIndex = cursor.stateIndex; stateIndex < RETENTION_STATES.length; stateIndex += 1) {
        const state = RETENTION_STATES[stateIndex];
        const sameState = stateIndex === cursor.stateIndex;
        if (sameState && cursor.updatedAt > 0) {
          selected = await ctx.db.query("admissionsDocuments").withIndex("by_school_and_state_and_updated_at", (q) => q.eq("schoolId", job.schoolId).eq("state", state).eq("updatedAt", cursor.updatedAt).gt("_creationTime", cursor.creationTime)).first();
        }
        if (!selected) {
          const after = sameState ? cursor.updatedAt : 0;
          selected = await ctx.db.query("admissionsDocuments").withIndex("by_school_and_state_and_updated_at", (q) => q.eq("schoolId", job.schoolId).eq("state", state).gt("updatedAt", after)).first();
        }
        if (selected) { selectedStateIndex = stateIndex; break; }
      }
      if (!selected) {
        await ctx.db.patch(job._id, { cursor: JSON.stringify({ stateIndex: 0, updatedAt: 0 }), scheduledAt: now + 6 * 60 * 60 * 1_000, updatedAt: now });
        continue;
      }
      inspected += 1;
      const originalUpdatedAt = selected.updatedAt;
      const result = RETENTION_STATES[selectedStateIndex] === "archived" ? await deleteDocument(ctx, selected, now, policy._id) : await archiveDocument(ctx, selected, now, policy._id);
      if (result.changed && result.state === "archived") archived += 1;
      else if (result.changed && result.state === "deleted") deleted += 1;
      else if (result.blocker) blocked += 1;
      await ctx.db.patch(job._id, { cursor: JSON.stringify({ stateIndex: selectedStateIndex, updatedAt: originalUpdatedAt, creationTime: selected._creationTime }), scheduledAt: now + 1, updatedAt: now });
    }
    return { inspected, archived, deleted, blocked };
  },
});
