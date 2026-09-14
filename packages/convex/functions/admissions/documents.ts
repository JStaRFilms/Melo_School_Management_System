import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { assertStorageUnclaimed, storageClaimedOnlyBy } from "../academic/assetStorageBoundary";
import { requireContractBoundStorageForUpload } from "../academic/knowledgeUploadReadiness";
import type { QuotaReservationResult } from "../academic/metering";
import { documentAccessResultValidator, documentAccessUpstreamValidator } from "../foundation/contracts";
import { cleanupUploadIntentRef } from "./refs";
import {
  ADMISSIONS_UPLOAD_OPERATION,
  MAX_ADMISSIONS_DOCUMENT_BYTES,
  UPLOAD_INTENT_TTL_MS,
  admissionsError,
  consumeAdmissionsRateLimit,
  documentStateAllowsAccess,
  hasFreshAuthentication,
  isApplicationEditable,
  issueDocumentAccessGrant,
  mergeCorrectionScopes,
  normalizeRequiredText,
  recordAdmissionsAudit,
  recordDocumentAccessAudit,
  requireAdmissionsModuleEnabled,
  requireGuardian,
  requireOwnedApplication,
  sha256Hex,
  storageSha256ToHex,
} from "./shared";

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeMimeType(value: string) {
  return value.split(";", 1)[0].trim().toLowerCase();
}

async function correctionAllowsRequirement(ctx: MutationCtx, application: Doc<"admissionsApplications">, requirementId: Id<"admissionsDocumentRequirements">) {
  if (application.state !== "changes_requested") return false;
  const events = await ctx.db.query("admissionsReviewEvents").withIndex("by_application_and_created_at", (q) => q.eq("applicationId", application._id)).order("desc").take(501);
  if (events.length > 500) return false;
  return mergeCorrectionScopes(events, application.latestSnapshotId)?.requirementIds.includes(String(requirementId)) ?? false;
}

function assertUploadMetadata(args: { fileName: string; contentType: string; size: number; sha256: string }) {
  const fileName = normalizeRequiredText(args.fileName, "File name", 200);
  const contentType = normalizeMimeType(args.contentType);
  if (!ALLOWED_UPLOAD_MIME_TYPES.has(contentType)) throw new ConvexError("Unsupported admissions document type");
  if (!Number.isSafeInteger(args.size) || args.size < 1 || args.size > MAX_ADMISSIONS_DOCUMENT_BYTES) throw new ConvexError("Document size must be between 1 byte and 20 MiB");
  const sha256 = args.sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ConvexError("A valid SHA-256 document fingerprint is required");
  return { fileName, contentType, sha256 };
}

export const requestUploadIntent = mutation({
  args: {
    applicationId: v.id("admissionsApplications"),
    requirementId: v.id("admissionsDocumentRequirements"),
    fileName: v.string(),
    contentType: v.string(),
    size: v.number(),
    sha256: v.string(),
  },
  returns: v.object({ uploadIntentId: v.id("admissionsDocumentUploadIntents"), uploadToken: v.string(), uploadPath: v.literal("/admissions/document-upload"), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    await requireAdmissionsModuleEnabled(ctx, application.schoolId);
    if (!isApplicationEditable(application.state) || application.financialHoldAt !== undefined) admissionsError("APPLICATION_LOCKED", "Application documents are locked");
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement || requirement.schoolId !== application.schoolId || requirement.formVersionId !== application.formVersionId) admissionsError("NOT_FOUND_OR_DENIED", "Document requirement not found");
    const metadata = assertUploadMetadata(args);
    if (!requirement.acceptedMimeTypes.map(normalizeMimeType).includes(metadata.contentType) || args.size > requirement.maxBytes) throw new ConvexError("Document does not satisfy the published type and size requirement");
    const existingDocuments = await ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id).eq("requirementId", requirement._id)).take(requirement.maxFiles + 1);
    const activeDocuments = existingDocuments.filter((document) => document.state !== "deleted" && document.state !== "superseded");
    const replacementAllowed = requirement.maxFiles === 1 && activeDocuments.length === 1 && await correctionAllowsRequirement(ctx, application, requirement._id);
    if (application.state === "changes_requested" && !await correctionAllowsRequirement(ctx, application, requirement._id)) admissionsError("APPLICATION_LOCKED", "Only requested document corrections may be changed");
    if (activeDocuments.length >= requirement.maxFiles && !replacementAllowed) throw new ConvexError("Document requirement file limit reached");
    await requireContractBoundStorageForUpload(ctx, application.schoolId, args.size);
    await consumeAdmissionsRateLimit(ctx, {
      action: "upload_intent_reserve",
      schoolId: application.schoolId,
      applicationId: application._id,
    });
    const uploadToken = `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
    const tokenHash = await sha256Hex(uploadToken);
    const quotaReservationKey = `admissions-upload:${tokenHash}`;
    const reservation: QuotaReservationResult = await ctx.runMutation(internal.functions.academic.metering.reserveUsageQuota, {
      schoolId: application.schoolId,
      meterType: "storage_bytes",
      unitsRequested: args.size,
      idempotencyKey: quotaReservationKey,
      operationName: ADMISSIONS_UPLOAD_OPERATION,
    });
    if (!reservation.allowed || reservation.status !== "reserved") admissionsError("STORAGE_QUOTA_EXCEEDED", "Storage quota is insufficient for this document");
    const now = Date.now();
    const expiresAt = now + UPLOAD_INTENT_TTL_MS;
    const uploadIntentId = await ctx.db.insert("admissionsDocumentUploadIntents", {
      schoolId: application.schoolId,
      guardianId: guardian._id,
      applicationId: application._id,
      requirementId: requirement._id,
      purpose: "admissions_document",
      tokenHash,
      quotaReservationKey,
      fileName: metadata.fileName,
      contentType: metadata.contentType,
      expectedSize: args.size,
      expectedSha256: metadata.sha256,
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(expiresAt, cleanupUploadIntentRef, { uploadIntentId });
    await recordAdmissionsAudit(ctx, { schoolId: application.schoolId, actorKind: "guardian", actorGuardianId: guardian._id, action: "document.upload_intent_created", entityType: "admissionsDocumentUploadIntent", entityId: uploadIntentId, applicationId: application._id });
    return { uploadIntentId, uploadToken, uploadPath: "/admissions/document-upload" as const, expiresAt };
  },
});

export const beginHttpUpload = internalMutation({
  args: { uploadIntentId: v.id("admissionsDocumentUploadIntents"), uploadToken: v.string(), uploadAttemptId: v.string() },
  returns: v.object({ contentType: v.string(), expectedSize: v.number(), expectedSha256: v.string() }),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const intent = await ctx.db.get(args.uploadIntentId);
    const tokenHash = await sha256Hex(args.uploadToken);
    if (!intent || intent.guardianId !== guardian._id || intent.tokenHash !== tokenHash || intent.purpose !== "admissions_document") admissionsError("NOT_FOUND_OR_DENIED", "Upload intent not found");
    const application = await ctx.db.get(intent.applicationId);
    const requirement = await ctx.db.get(intent.requirementId);
    if (!application || !requirement || application.schoolId !== intent.schoolId || requirement.schoolId !== intent.schoolId || !isApplicationEditable(application.state) || application.financialHoldAt !== undefined) admissionsError("NOT_FOUND_OR_DENIED", "Upload intent not found");
    await requireAdmissionsModuleEnabled(ctx, intent.schoolId);
    if (intent.status !== "pending" || intent.expiresAt <= Date.now() || !/^[A-Za-z0-9_-]{16,128}$/.test(args.uploadAttemptId)) throw new ConvexError("Upload intent is no longer available");
    await ctx.db.patch(intent._id, { status: "uploading", activeAttemptId: args.uploadAttemptId, updatedAt: Date.now() });
    return { contentType: intent.contentType, expectedSize: intent.expectedSize, expectedSha256: intent.expectedSha256 };
  },
});

export const recordHttpUploadStorage = internalMutation({
  args: { uploadIntentId: v.id("admissionsDocumentUploadIntents"), uploadToken: v.string(), uploadAttemptId: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || intent.guardianId !== guardian._id || intent.tokenHash !== await sha256Hex(args.uploadToken) || intent.status !== "uploading" || intent.activeAttemptId !== args.uploadAttemptId || intent.expiresAt <= Date.now()) throw new ConvexError("Upload intent is no longer available");
    await requireAdmissionsModuleEnabled(ctx, intent.schoolId);
    await assertStorageUnclaimed(ctx, args.storageId);
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata || metadata.size !== intent.expectedSize || storageSha256ToHex(metadata.sha256) !== intent.expectedSha256) throw new ConvexError("Stored document metadata does not match the reserved upload");
    await ctx.db.patch(intent._id, { storageId: args.storageId, status: "stored", updatedAt: Date.now() });
    return null;
  },
});

export const finalizeUpload = mutation({
  args: { uploadIntentId: v.id("admissionsDocumentUploadIntents") },
  returns: v.object({ documentKey: v.string(), state: v.string(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || intent.guardianId !== guardian._id) admissionsError("NOT_FOUND_OR_DENIED", "Upload intent not found");
    if (intent.status === "completed" && intent.documentId) {
      const document = await ctx.db.get(intent.documentId);
      if (!document || document.applicationId !== intent.applicationId) throw new ConvexError("Finalized document is unavailable");
      return { documentKey: document.documentKey, state: document.state, replayed: true };
    }
    await requireAdmissionsModuleEnabled(ctx, intent.schoolId);
    if (intent.status !== "stored" || !intent.storageId || intent.expiresAt <= Date.now()) throw new ConvexError("Upload is not ready to finalize");
    const [application, requirement, metadata] = await Promise.all([ctx.db.get(intent.applicationId), ctx.db.get(intent.requirementId), ctx.db.system.get("_storage", intent.storageId)]);
    if (!application || application.guardianId !== guardian._id || application.schoolId !== intent.schoolId || !isApplicationEditable(application.state) || application.financialHoldAt !== undefined || !requirement || requirement.schoolId !== intent.schoolId || requirement.formVersionId !== application.formVersionId) admissionsError("NOT_FOUND_OR_DENIED", "Upload context changed");
    if (!metadata || metadata.size !== intent.expectedSize || storageSha256ToHex(metadata.sha256) !== intent.expectedSha256) throw new ConvexError("Stored document metadata does not match the reserved upload");
    if (!(await storageClaimedOnlyBy(ctx, intent.storageId, { purpose: "admissionsDocumentUploadIntent", ownerId: String(intent._id) }))) throw new ConvexError("Stored document has conflicting ownership");
    const previous = await ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id).eq("requirementId", requirement._id)).order("desc").take(requirement.maxFiles + 1);
    const active = previous.filter((document) => document.state !== "deleted" && document.state !== "superseded");
    const replacementAllowed = requirement.maxFiles === 1 && active.length === 1 && await correctionAllowsRequirement(ctx, application, requirement._id);
    if (active.length >= requirement.maxFiles && !replacementAllowed) throw new ConvexError("Document requirement file limit reached");
    const now = Date.now();
    const version = previous.reduce((maximum, document) => Math.max(maximum, document.version), 0) + 1;
    const supersedes = replacementAllowed ? active[0] : undefined;
    const documentKey = crypto.randomUUID();
    const documentId = await ctx.db.insert("admissionsDocuments", {
      schoolId: intent.schoolId,
      applicationId: application._id,
      requirementId: requirement._id,
      category: requirement.category,
      documentKey,
      storageId: intent.storageId,
      fileName: intent.fileName,
      mimeType: intent.contentType,
      byteSize: metadata.size,
      sha256: intent.expectedSha256,
      version,
      state: "uploaded",
      sensitivity: requirement.sensitivity,
      uploadedByGuardianId: guardian._id,
      ...(supersedes ? { supersedesDocumentId: supersedes._id } : {}),
      retentionHold: false,
      quotaReservationKey: intent.quotaReservationKey,
      storageAccountingInitializedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.runMutation(internal.functions.academic.metering.commitUsageQuota, {
      schoolId: intent.schoolId,
      meterType: "storage_bytes",
      idempotencyKey: intent.quotaReservationKey,
      operationName: ADMISSIONS_UPLOAD_OPERATION,
      description: "Stored admissions application document",
      actualUnits: metadata.size,
      measurementMetadata: { source: "convex_storage_metadata", measuredAt: now, reference: documentKey },
    });
    if (supersedes) await ctx.db.patch(supersedes._id, { state: "superseded", updatedAt: now });
    await ctx.db.patch(intent._id, { status: "completed", activeAttemptId: undefined, storageId: undefined, documentId, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: intent.schoolId, actorKind: "guardian", actorGuardianId: guardian._id, action: "document.finalize", entityType: "admissionsDocument", entityId: documentKey, applicationId: application._id });
    return { documentKey, state: "uploaded", replayed: false };
  },
});

async function closeUploadIntent(ctx: MutationCtx, uploadIntentId: Id<"admissionsDocumentUploadIntents">, status: "failed" | "expired", failureReason?: string) {
  const intent = await ctx.db.get(uploadIntentId);
  if (!intent || ["completed", "failed", "expired"].includes(intent.status)) return;
  if (intent.storageId) {
    if (!(await storageClaimedOnlyBy(ctx, intent.storageId, { purpose: "admissionsDocumentUploadIntent", ownerId: String(intent._id) }))) throw new ConvexError("Upload cleanup found conflicting storage ownership");
    await ctx.storage.delete(intent.storageId);
  }
  await ctx.runMutation(internal.functions.academic.metering.releaseUsageQuota, { schoolId: intent.schoolId, meterType: "storage_bytes", idempotencyKey: intent.quotaReservationKey });
  await ctx.db.patch(intent._id, { status, activeAttemptId: undefined, storageId: undefined, ...(failureReason ? { failureReason: failureReason.slice(0, 240) } : {}), updatedAt: Date.now() });
}

export const failHttpUpload = internalMutation({
  args: { uploadIntentId: v.id("admissionsDocumentUploadIntents"), uploadToken: v.string(), uploadAttemptId: v.string(), failureReason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || intent.tokenHash !== await sha256Hex(args.uploadToken) || intent.activeAttemptId !== args.uploadAttemptId || !["uploading", "stored"].includes(intent.status)) return null;
    await closeUploadIntent(ctx, intent._id, "failed", args.failureReason);
    return null;
  },
});

export const cleanupUploadIntent = internalMutation({
  args: { uploadIntentId: v.id("admissionsDocumentUploadIntents") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const intent = await ctx.db.get(args.uploadIntentId);
    if (!intent || ["completed", "failed", "expired"].includes(intent.status)) return null;
    if (intent.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(intent.expiresAt, cleanupUploadIntentRef, args);
      return null;
    }
    await closeUploadIntent(ctx, intent._id, "expired");
    return null;
  },
});

export const getOwnAccess = mutation({
  args: { documentKey: v.string(), action: v.union(v.literal("view"), v.literal("download")) },
  returns: documentAccessResultValidator,
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey.trim())).unique();
    if (!document) return { status: "unavailable" as const };
    if (document.uploadedByGuardianId !== guardian._id) {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "guardian", guardianId: guardian._id, action: args.action, outcome: "denied", reason: "WRONG_ACTOR" });
      return { status: "unavailable" as const };
    }
    const application = await ctx.db.get(document.applicationId);
    const freshEnough = document.sensitivity !== "highly_sensitive" && document.sensitivity !== "financial_security" ? true : await hasFreshAuthentication(ctx);
    const allowed = documentStateAllowsAccess(document, application) && application?.guardianId === guardian._id && freshEnough;
    if (!allowed) {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "guardian", guardianId: guardian._id, action: args.action, outcome: "denied", reason: !freshEnough ? "FRESH_AUTH_REQUIRED" : "ACCESS_STATE_DENIED" });
      return { status: "unavailable" as const };
    }
    return await issueDocumentAccessGrant(ctx, { document, actorKind: "guardian", guardianId: guardian._id, audience: "apply", action: args.action });
  },
});

export const consumeOwnAccessGrant = internalMutation({
  args: { token: v.string() },
  returns: documentAccessUpstreamValidator,
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    if (!/^[a-f0-9]{64}$/.test(args.token)) return { status: "unavailable" as const };
    const tokenHash = await sha256Hex(args.token);
    const grant = await ctx.db.query("admissionsDocumentAccessGrants").withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (!grant) return { status: "unavailable" as const };
    const document = await ctx.db.get(grant.documentId);
    if (!document) return { status: "unavailable" as const };
    const application = await ctx.db.get(document.applicationId);
    const freshEnough = document.sensitivity !== "highly_sensitive" && document.sensitivity !== "financial_security" ? true : await hasFreshAuthentication(ctx);
    let deniedReason: string | null = null;
    if (grant.actorKind !== "guardian" || grant.audience !== "apply" || grant.guardianId !== guardian._id) deniedReason = "WRONG_ACTOR_OR_AUDIENCE";
    else if (grant.consumedAt !== undefined) deniedReason = "ACCESS_GRANT_REPLAYED";
    else if (grant.expiresAt <= Date.now()) deniedReason = "ACCESS_GRANT_EXPIRED";
    else if (grant.schoolId !== document.schoolId || !application || application.guardianId !== guardian._id) deniedReason = "ACCESS_CONTEXT_DENIED";
    else if (!documentStateAllowsAccess(document, application)) deniedReason = "ACCESS_STATE_DENIED";
    else if (!freshEnough) deniedReason = "FRESH_AUTH_REQUIRED";
    if (deniedReason) {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "guardian", guardianId: guardian._id, action: grant.action, outcome: "denied", reason: deniedReason });
      return { status: "unavailable" as const };
    }
    const upstreamUrl = await ctx.storage.getUrl(document.storageId);
    await ctx.db.patch(grant._id, { consumedAt: Date.now() });
    await recordDocumentAccessAudit(ctx, { document, actorKind: "guardian", guardianId: guardian._id, action: grant.action, outcome: upstreamUrl ? "granted" : "denied", reason: upstreamUrl ? "ACCESS_GRANT_CONSUMED" : "STORAGE_UNAVAILABLE" });
    return upstreamUrl ? { status: "available" as const, upstreamUrl, fileName: document.fileName, contentType: document.mimeType, byteSize: document.byteSize, action: grant.action } : { status: "unavailable" as const };
  },
});
