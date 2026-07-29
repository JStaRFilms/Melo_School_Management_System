import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { issueCheckedDocumentAccessV1 } from "../foundation/documentAccess";
import { assertEditable, audit, opaqueKey, requireGuardian, requireOwnedApplication } from "./helpers";

const accessResultValidator = v.union(v.object({ status: v.literal("available"), documentKey: v.string(), url: v.string(), expiresAt: v.null() }), v.object({ status: v.literal("unavailable"), documentKey: v.string() }));

export const createUploadUrl = mutation({
  args: { applicationId: v.id("admissionsApplications"), requirementId: v.id("admissionsDocumentRequirements") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedApplication(ctx, args.applicationId);
    assertEditable(application.state);
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement || requirement.schoolId !== application.schoolId || requirement.formVersionId !== application.formVersionId) throw new ConvexError("Not found or access denied");
    if (application.state === "changes_requested" && !(application.changeRequestRequirementKeys ?? []).includes(requirement.requirementKey)) throw new ConvexError("DOCUMENT_REQUIREMENT_LOCKED");
    return await ctx.storage.generateUploadUrl();
  },
});

export const bindUpload = mutation({
  args: { applicationId: v.id("admissionsApplications"), requirementId: v.id("admissionsDocumentRequirements"), storageId: v.id("_storage"), fileName: v.string() },
  returns: v.object({ documentKey: v.string(), state: v.literal("uploaded"), version: v.number() }),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertEditable(application.state);
    const [requirement, bound] = await Promise.all([
      ctx.db.get(args.requirementId),
      ctx.db.query("admissionsDocuments").withIndex("by_storage", (q) => q.eq("storageId", args.storageId)).unique(),
    ]);
    if (!requirement || requirement.schoolId !== application.schoolId || requirement.formVersionId !== application.formVersionId || bound) throw new ConvexError("DOCUMENT_UNAVAILABLE");
    if (application.state === "changes_requested" && !(application.changeRequestRequirementKeys ?? []).includes(requirement.requirementKey)) throw new ConvexError("DOCUMENT_REQUIREMENT_LOCKED");
    const metadata = await ctx.db.system.get(args.storageId);
    const contentType = metadata?.contentType?.trim();
    if (!metadata || !contentType || !requirement.acceptedMimeTypes.includes(contentType) || typeof metadata.size !== "number" || metadata.size > requirement.maxBytes) throw new ConvexError("DOCUMENT_UNAVAILABLE");
    const prior = await ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id).eq("requirementId", requirement._id)).take(100);
    const activeCount = prior.filter((document) => document.state === "uploaded" || document.state === "accepted").length;
    if (activeCount >= requirement.maxFiles) {
      // A new upload supersedes the current version only when the configured rule permits one file.
      if (requirement.maxFiles !== 1) throw new ConvexError("DOCUMENT_LIMIT_REACHED");
    }
    const version = Math.max(0, ...prior.map((document) => document.version)) + 1;
    const now = Date.now();
    const documentId = await ctx.db.insert("admissionsDocuments", { schoolId: application.schoolId, applicationId: application._id, requirementId: requirement._id, category: requirement.category, documentKey: opaqueKey("doc_"), storageId: args.storageId, fileName: args.fileName.trim().slice(0, 256) || "upload", mimeType: contentType, byteSize: metadata.size, sha256: metadata.sha256, version, state: "uploaded", sensitivity: requirement.sensitivity, uploadedByGuardianId: guardian._id, ...(prior.length ? { supersedesDocumentId: prior.sort((left, right) => right.version - left.version)[0]._id } : {}), retentionHold: false, createdAt: now, updatedAt: now });
    if (requirement.maxFiles === 1) for (const document of prior) if (document.state !== "deleted") await ctx.db.patch(document._id, { state: "superseded", updatedAt: now });
    const document = await ctx.db.get(documentId);
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "document.bound", entityType: "document", entityId: String(documentId), applicationId: application._id, outcome: "success" });
    return { documentKey: document!.documentKey, state: "uploaded" as const, version };
  },
});

export const getOwnAccess = mutation({
  args: { documentKey: v.string(), action: v.union(v.literal("view"), v.literal("download")) },
  returns: accessResultValidator,
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey)).unique();
    const application = document ? await ctx.db.get(document.applicationId) : null;
    const schoolId = document?.schoolId ?? ("" as any);
    return await issueCheckedDocumentAccessV1({ ctx, documentKey: args.documentKey, actor: { kind: "guardian", guardianId: guardian._id, schoolId, assurance: "standard" }, action: args.action, requiresFreshAuth: false, authorize: async () => Boolean(application && application.guardianId === guardian._id) });
  },
});
