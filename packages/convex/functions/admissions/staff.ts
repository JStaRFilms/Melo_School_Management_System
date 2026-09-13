import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { Id } from "../../_generated/dataModel";
import { documentAccessResultValidator } from "../foundation/contracts";
import {
  admissionsError,
  hasFreshAuthentication,
  normalizeRequiredText,
  recordAdmissionsAudit,
  requireAdmissionsStaff,
} from "./shared";
import { getCurrentRetentionPolicy } from "./retention";
import { conditionMatches, isSensitiveDataClass, validateAnswerForField } from "./validation";

const immutableProfileValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  middleName: v.union(v.string(), v.null()),
  dateOfBirth: v.number(),
  gender: v.union(v.string(), v.null()),
  preferredName: v.union(v.string(), v.null()),
  nationality: v.union(v.string(), v.null()),
  countryOfBirth: v.union(v.string(), v.null()),
  address: v.union(v.string(), v.null()),
});

const immutableContactValidator = v.object({
  fullName: v.string(),
  relationship: v.string(),
  email: v.union(v.string(), v.null()),
  phone: v.union(v.string(), v.null()),
  address: v.union(v.string(), v.null()),
});

const immutableAnswerValidator = v.object({
  fieldKey: v.string(),
  valueType: v.string(),
  serializedValue: v.string(),
  dataClass: v.string(),
});

const documentMetadataValidator = v.object({
  documentKey: v.string(),
  requirementId: v.union(v.id("admissionsDocumentRequirements"), v.null()),
  category: v.string(),
  fileName: v.string(),
  mimeType: v.string(),
  byteSize: v.number(),
  sha256: v.string(),
  version: v.number(),
  submittedState: v.string(),
  currentState: v.string(),
  sensitivity: v.string(),
});

const detailContextValidator = v.object({
  applicationId: v.id("admissionsApplications"),
  publicId: v.string(),
  state: v.string(),
  intakeId: v.id("admissionsIntakes"),
  currentRevision: v.number(),
  snapshotId: v.id("admissionsSubmissionSnapshots"),
  submittedAt: v.number(),
  signerName: v.string(),
  signerRelationship: v.string(),
  declarationAcceptedAt: v.number(),
});

function parseSnapshotObject(serializedValue: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(serializedValue);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return Object.fromEntries(Object.entries(parsed));
  } catch {
    // Fall through to the safe review error below.
  }
  throw new ConvexError(`${label} snapshot projection is unavailable`);
}

function requiredSnapshotString(value: unknown, label: string) {
  if (typeof value !== "string") throw new ConvexError(`${label} snapshot projection is unavailable`);
  return value;
}

function optionalSnapshotString(value: unknown) {
  return typeof value === "string" ? value : null;
}

async function loadImmutableDetail(ctx: QueryCtx | MutationCtx, schoolId: Id<"schools">, applicationId: Id<"admissionsApplications">) {
  const application = await ctx.db.get(applicationId);
  if (!application || application.schoolId !== schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
  if (!application.latestSnapshotId) throw new ConvexError("Application does not have a submitted snapshot");
  const snapshotId = application.latestSnapshotId;
  const [snapshot, items, documents] = await Promise.all([
    ctx.db.get(snapshotId),
    ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshotId)).take(204),
    ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id)).take(101),
  ]);
  if (!snapshot || snapshot.schoolId !== schoolId || snapshot.applicationId !== application._id || items.length > 203 || documents.length > 100) {
    throw new ConvexError("Application snapshot detail is unavailable");
  }
  const profileItem = items.find((item) => item.itemKey === "profile" && item.kind === "profile");
  const contactItem = items.find((item) => item.itemKey === "primaryContact" && item.kind === "contact");
  const requestedEntryItem = items.find((item) => item.itemKey === "requestedEntryLabel" && item.kind === "application_core");
  if (!profileItem || !contactItem) throw new ConvexError("Application snapshot profile is unavailable");
  const profileValue = parseSnapshotObject(profileItem.serializedValue, "Applicant profile");
  const contactValue = parseSnapshotObject(contactItem.serializedValue, "Primary contact");
  const dateOfBirth = profileValue.dateOfBirth;
  if (typeof dateOfBirth !== "number" || !Number.isFinite(dateOfBirth)) throw new ConvexError("Applicant profile snapshot projection is unavailable");
  const profile = {
    firstName: requiredSnapshotString(profileValue.firstName, "Applicant first name"),
    lastName: requiredSnapshotString(profileValue.lastName, "Applicant last name"),
    middleName: optionalSnapshotString(profileValue.middleName),
    dateOfBirth,
    gender: optionalSnapshotString(profileValue.gender),
    preferredName: optionalSnapshotString(profileValue.preferredName),
    nationality: optionalSnapshotString(profileValue.nationality),
    countryOfBirth: optionalSnapshotString(profileValue.countryOfBirth),
    address: optionalSnapshotString(profileValue.address),
  };
  const primaryContact = {
    fullName: requiredSnapshotString(contactValue.fullName, "Primary contact name"),
    relationship: requiredSnapshotString(contactValue.relationship, "Primary contact relationship"),
    email: optionalSnapshotString(contactValue.email),
    phone: optionalSnapshotString(contactValue.phone),
    address: optionalSnapshotString(contactValue.address),
  };
  const answers = items.filter((item) => item.kind === "answer" && item.itemKey.startsWith("answer:")).map((item) => ({
    fieldKey: item.itemKey.slice("answer:".length),
    valueType: item.valueType,
    serializedValue: item.serializedValue,
    dataClass: item.dataClass,
  }));
  const documentsByKey = new Map(documents.map((document) => [document.documentKey, document]));
  const documentMetadata = items.filter((item) => item.kind === "document_manifest" && item.itemKey.startsWith("document:")).map((item) => {
    const manifest = parseSnapshotObject(item.serializedValue, "Document manifest");
    const documentKey = requiredSnapshotString(manifest.documentKey, "Document key");
    const document = documentsByKey.get(documentKey);
    if (!document || document.schoolId !== schoolId) throw new ConvexError("Document snapshot metadata is unavailable");
    return {
      documentKey,
      requirementId: document.requirementId ?? null,
      category: requiredSnapshotString(manifest.category, "Document category"),
      fileName: document.fileName,
      mimeType: requiredSnapshotString(manifest.mimeType, "Document MIME type"),
      byteSize: typeof manifest.byteSize === "number" ? manifest.byteSize : document.byteSize,
      sha256: requiredSnapshotString(manifest.sha256, "Document digest"),
      version: typeof manifest.version === "number" ? manifest.version : document.version,
      submittedState: requiredSnapshotString(manifest.state, "Document submitted state"),
      currentState: document.state,
      sensitivity: document.sensitivity,
    };
  });
  return {
    context: {
      applicationId: application._id,
      publicId: application.publicId,
      state: application.state,
      intakeId: application.intakeId,
      currentRevision: application.currentRevision,
      snapshotId: snapshot._id,
      submittedAt: snapshot.submittedAt,
      signerName: snapshot.signerName,
      signerRelationship: snapshot.signerRelationship,
      declarationAcceptedAt: snapshot.declarationAcceptedAt,
    },
    profile,
    primaryContact,
    requestedEntryLabel: requestedEntryItem?.serializedValue || null,
    basicAnswers: answers.filter((answer) => !isSensitiveDataClass(answer.dataClass)),
    sensitiveAnswers: answers.filter((answer) => isSensitiveDataClass(answer.dataClass)),
    basicDocuments: documentMetadata.filter((document) => !isSensitiveDataClass(document.sensitivity)),
    sensitiveDocuments: documentMetadata.filter((document) => isSensitiveDataClass(document.sensitivity)),
  };
}

export const resolveApplicationByPublicId = query({
  args: { schoolId: v.id("schools"), publicId: v.string() },
  returns: v.union(v.null(), v.object({ applicationId: v.id("admissionsApplications"), state: v.string() })),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.view_basic"]);
    const application = await ctx.db.query("admissionsApplications").withIndex("by_school_and_public_id", (q) => q.eq("schoolId", args.schoolId).eq("publicId", args.publicId.trim())).unique();
    return application ? { applicationId: application._id, state: application.state } : null;
  },
});

export const getApplicationWorkflow = query({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications") },
  returns: v.object({ fieldKeys: v.array(v.string()), requirements: v.array(v.object({ requirementId: v.id("admissionsDocumentRequirements"), label: v.string() })) }),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.view_basic"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    const [fields, requirements] = await Promise.all([
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(31),
    ]);
    return { fieldKeys: ["profile", "primaryContact", "requestedEntryLabel", ...fields.filter((field) => field.status === "active").map((field) => field.fieldKey)], requirements: requirements.map((requirement) => ({ requirementId: requirement._id, label: requirement.label })) };
  },
});

export const getConversionWorkflow = query({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications") },
  returns: v.object({ classes: v.array(v.object({ classId: v.id("classes"), name: v.string(), level: v.string() })), families: v.array(v.object({ familyId: v.id("families"), name: v.string() })), conversion: v.union(v.null(), v.object({ state: v.string(), errorCode: v.union(v.string(), v.null()), admissionNumber: v.union(v.string(), v.null()), onboardingState: v.union(v.string(), v.null()), idempotencyKey: v.string() })) }),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage", "enrollment.decisions.record"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    const [classes, families, conversion] = await Promise.all([
      ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(101),
      ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(101),
      application.conversionId ? ctx.db.get(application.conversionId) : Promise.resolve(null),
    ]);
    const outbox = conversion ? await ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", conversion._id).eq("eventKey", "portal_parent_linkage")).unique() : null;
    return { classes: classes.filter((row) => !row.isArchived).map((row) => ({ classId: row._id, name: row.name, level: row.level })), families: families.map((row) => ({ familyId: row._id, name: row.name })), conversion: conversion ? { state: conversion.state, errorCode: conversion.errorCode ?? null, admissionNumber: conversion.admissionNumber ?? null, onboardingState: outbox?.state ?? null, idempotencyKey: conversion.idempotencyKey } : null };
  },
});

export const getApplicationDetail = query({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications") },
  returns: v.object({
    context: detailContextValidator,
    profile: immutableProfileValidator,
    primaryContact: immutableContactValidator,
    requestedEntryLabel: v.union(v.string(), v.null()),
    answers: v.array(immutableAnswerValidator),
    documents: v.array(documentMetadataValidator),
  }),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.view_basic"]);
    const detail = await loadImmutableDetail(ctx, args.schoolId, args.applicationId);
    return { context: detail.context, profile: detail.profile, primaryContact: detail.primaryContact, requestedEntryLabel: detail.requestedEntryLabel, answers: detail.basicAnswers, documents: detail.basicDocuments };
  },
});

export const revealSensitiveApplicationDetail = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), reason: v.string() },
  returns: v.object({ context: detailContextValidator, answers: v.array(immutableAnswerValidator), documents: v.array(documentMetadataValidator) }),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.view_basic", "enrollment.applications.view_sensitive"]);
    const reason = normalizeRequiredText(args.reason, "Sensitive reveal reason", 120);
    const detail = await loadImmutableDetail(ctx, args.schoolId, args.applicationId);
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "application.reveal_sensitive", entityType: "admissionsApplication", entityId: args.applicationId, applicationId: args.applicationId, reasonCode: reason, metadata: { revision: detail.context.currentRevision, answerCount: detail.sensitiveAnswers.length, documentCount: detail.sensitiveDocuments.length } });
    return { context: detail.context, answers: detail.sensitiveAnswers, documents: detail.sensitiveDocuments };
  },
});

const queueItemValidator = v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), intakeId: v.id("admissionsIntakes"), currentRevision: v.number(), updatedAt: v.number() });

export const listQueuePage = query({
  args: { schoolId: v.id("schools"), state: v.union(v.literal("submitted"), v.literal("under_review"), v.literal("changes_requested"), v.literal("waitlisted"), v.literal("accepted"), v.literal("rejected")), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(queueItemValidator),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.list"]);
    const result = await ctx.db.query("admissionsApplications").withIndex("by_school_and_state_and_updated_at", (q) => q.eq("schoolId", args.schoolId).eq("state", args.state)).order("desc").paginate(args.paginationOpts);
    return { ...result, page: result.page.map((row) => ({ applicationId: row._id, publicId: row.publicId, state: row.state, intakeId: row.intakeId, currentRevision: row.currentRevision, updatedAt: row.updatedAt })) };
  },
});

export const listQueue = query({
  args: { schoolId: v.id("schools"), state: v.union(v.literal("submitted"), v.literal("under_review"), v.literal("changes_requested"), v.literal("waitlisted"), v.literal("accepted"), v.literal("rejected")), limit: v.optional(v.number()) },
  returns: v.array(v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), intakeId: v.id("admissionsIntakes"), currentRevision: v.number(), updatedAt: v.number() })),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.list"]);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100);
    const rows = await ctx.db.query("admissionsApplications").withIndex("by_school_and_state_and_updated_at", (q) => q.eq("schoolId", args.schoolId).eq("state", args.state)).order("desc").take(limit);
    return rows.map((row) => ({ applicationId: row._id, publicId: row.publicId, state: row.state, intakeId: row.intakeId, currentRevision: row.currentRevision, updatedAt: row.updatedAt }));
  },
});

export const startReview = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.view_basic"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    if (application.state === "under_review") return null;
    if (application.state !== "submitted") throw new ConvexError("Only a submitted application can enter review");
    await ctx.db.patch(application._id, { state: "under_review", updatedAt: Date.now() });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "review.start", entityType: "admissionsApplication", entityId: application._id, applicationId: application._id });
    return null;
  },
});

export const assignReview = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), assigneeUserId: v.id("users"), role: v.string(), dueAt: v.optional(v.number()) },
  returns: v.id("admissionsReviewAssignments"),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    const [application, assignee] = await Promise.all([ctx.db.get(args.applicationId), ctx.db.get(args.assigneeUserId)]);
    if (!application || application.schoolId !== args.schoolId || !assignee || assignee.schoolId !== args.schoolId || assignee.isArchived) admissionsError("NOT_FOUND_OR_DENIED", "Application or assignee not found");
    const memberships = await ctx.db.query("branchMemberships").withIndex("by_legacy_user", (q) => q.eq("legacyUserId", assignee._id)).take(2);
    if (memberships.length !== 1 || memberships[0].schoolId !== args.schoolId || memberships[0].status !== "active") throw new ConvexError("Assignee does not have a current school membership");
    const now = Date.now();
    const assignmentId = await ctx.db.insert("admissionsReviewAssignments", { schoolId: args.schoolId, applicationId: application._id, assigneeUserId: assignee._id, role: normalizeRequiredText(args.role, "Review role", 80), state: "assigned", ...(args.dueAt ? { dueAt: args.dueAt } : {}), assignedByUserId: actor.userId, createdAt: now, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "review.assign", entityType: "admissionsReviewAssignment", entityId: assignmentId, applicationId: application._id });
    return assignmentId;
  },
});

export const requestChanges = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), fieldKeys: v.array(v.string()), requirementIds: v.array(v.id("admissionsDocumentRequirements")), reasonCode: v.string(), guardianMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.documents.review"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    if (application.state !== "submitted" && application.state !== "under_review") throw new ConvexError("Changes can be requested only during submitted review");
    if ((!args.fieldKeys.length && !args.requirementIds.length) || args.fieldKeys.length > 100 || args.requirementIds.length > 30) throw new ConvexError("Correction request must identify bounded fields or requirements");
    const requirements = await Promise.all(args.requirementIds.map((id) => ctx.db.get(id)));
    if (requirements.some((item) => !item || item.schoolId !== args.schoolId || item.formVersionId !== application.formVersionId)) throw new ConvexError("Correction requirement does not match the application form");
    const fields = await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101);
    const validKeys = new Set(["profile", "primaryContact", "requestedEntryLabel", ...fields.map((field) => field.fieldKey)]);
    if (args.fieldKeys.some((key) => !validKeys.has(key))) throw new ConvexError("Correction field does not match the application form");
    const now = Date.now();
    await ctx.db.insert("admissionsReviewEvents", { schoolId: args.schoolId, applicationId: application._id, ...(application.latestSnapshotId ? { snapshotId: application.latestSnapshotId } : {}), actorUserId: actor.userId, eventType: "changes_requested", visibility: "guardian", reasonCode: normalizeRequiredText(args.reasonCode, "Reason code", 100), message: normalizeRequiredText(args.guardianMessage, "Guardian message", 1000), metadataJson: JSON.stringify({ fieldKeys: [...new Set(args.fieldKeys)], requirementIds: [...new Set(args.requirementIds.map(String))] }), createdAt: now });
    await ctx.db.patch(application._id, { state: "changes_requested", updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "review.request_changes", entityType: "admissionsApplication", entityId: application._id, applicationId: application._id, reasonCode: args.reasonCode });
    return null;
  },
});

export const recordDocumentReview = mutation({
  args: { schoolId: v.id("schools"), documentKey: v.string(), result: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("needs_replacement")), reasonCode: v.optional(v.string()), guardianMessage: v.optional(v.string()), internalNote: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.documents.review"]);
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey.trim())).unique();
    if (!document || document.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Document not found");
    if (!["uploaded", "accepted", "rejected"].includes(document.state)) throw new ConvexError("Document cannot be reviewed in its current state");
    if (args.result !== "accepted" && (!args.reasonCode || !args.guardianMessage)) throw new ConvexError("Rejected documents require a reason and guardian-safe message");
    const application = await ctx.db.get(document.applicationId);
    if (!application || application.schoolId !== args.schoolId) throw new ConvexError("Document application context is unavailable");
    if (args.result === "needs_replacement" && (!document.requirementId || !["submitted", "under_review", "changes_requested"].includes(application.state))) throw new ConvexError("A replacement can be requested only for an application document under review");
    const now = Date.now();
    await ctx.db.insert("admissionsDocumentReviews", { schoolId: args.schoolId, documentId: document._id, reviewerUserId: actor.userId, result: args.result, ...(args.reasonCode ? { reasonCode: args.reasonCode.slice(0, 100) } : {}), ...(args.guardianMessage ? { guardianMessage: args.guardianMessage.slice(0, 1000) } : {}), ...(args.internalNote ? { internalNote: args.internalNote.slice(0, 1000) } : {}), createdAt: now });
    await ctx.db.patch(document._id, { state: args.result === "accepted" ? "accepted" : "rejected", updatedAt: now });
    if (args.result === "needs_replacement" && document.requirementId) {
      await ctx.db.insert("admissionsReviewEvents", { schoolId: args.schoolId, applicationId: application._id, ...(application.latestSnapshotId ? { snapshotId: application.latestSnapshotId } : {}), actorUserId: actor.userId, eventType: "changes_requested", visibility: "guardian", reasonCode: normalizeRequiredText(args.reasonCode ?? "DOCUMENT_REPLACEMENT", "Reason code", 100), message: normalizeRequiredText(args.guardianMessage ?? "Replace the requested document.", "Guardian message", 1000), metadataJson: JSON.stringify({ fieldKeys: [], requirementIds: [String(document.requirementId)] }), createdAt: now });
      await ctx.db.patch(application._id, { state: "changes_requested", updatedAt: now });
    }
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "document.review", entityType: "admissionsDocument", entityId: document.documentKey, applicationId: document.applicationId, metadata: { result: args.result } });
    return null;
  },
});

export const getDocumentAccess = mutation({
  args: { schoolId: v.id("schools"), documentKey: v.string(), action: v.union(v.literal("view"), v.literal("download")), reason: v.string() },
  returns: documentAccessResultValidator,
  handler: async (ctx, args) => {
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey.trim())).unique();
    if (!document || document.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Document not found");
    const required = args.action === "download" || document.sensitivity === "highly_sensitive" || document.sensitivity === "financial_security"
      ? ["enrollment.documents.review", "enrollment.applications.view_sensitive"]
      : ["enrollment.documents.review"];
    let actor;
    try {
      actor = await requireAdmissionsStaff(ctx, args.schoolId, required);
    } catch {
      await ctx.db.insert("admissionsDocumentAccessAudits", { schoolId: args.schoolId, documentId: document._id, actorKind: "system", action: args.action, outcome: "denied", reason: "PERMISSION_DENIED", createdAt: Date.now() });
      return { status: "unavailable" as const, documentKey: document.documentKey };
    }
    const freshAuthenticationRequired = document.sensitivity === "highly_sensitive" || document.sensitivity === "financial_security";
    const freshEnough = !freshAuthenticationRequired || await hasFreshAuthentication(ctx);
    if (["quarantined", "archived", "deleted"].includes(document.state) || !freshEnough) {
      await ctx.db.insert("admissionsDocumentAccessAudits", { schoolId: args.schoolId, documentId: document._id, actorKind: "staff", actorUserId: actor.userId, action: args.action, outcome: "denied", reason: !freshEnough ? "FRESH_AUTH_REQUIRED" : normalizeRequiredText(args.reason, "Access reason", 240), createdAt: Date.now() });
      return { status: "unavailable" as const, documentKey: document.documentKey };
    }
    const url = await ctx.storage.getUrl(document.storageId);
    await ctx.db.insert("admissionsDocumentAccessAudits", { schoolId: args.schoolId, documentId: document._id, actorKind: "staff", actorUserId: actor.userId, action: args.action, outcome: url ? "granted" : "denied", reason: normalizeRequiredText(args.reason, "Access reason", 240), createdAt: Date.now() });
    return url ? { status: "available" as const, documentKey: document.documentKey, url, expiresAt: null } : { status: "unavailable" as const, documentKey: document.documentKey };
  },
});

export const recordDecision = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), state: v.union(v.literal("accepted"), v.literal("rejected")), reasonCode: v.string(), guardianMessage: v.string(), rationale: v.optional(v.string()) },
  returns: v.object({ decisionId: v.id("admissionsDecisions"), version: v.number(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.decisions.record"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    if (!["submitted", "under_review"].includes(application.state) || !application.latestSnapshotId || application.financialHoldAt !== undefined) throw new ConvexError("Application is not ready for a decision");
    const reasonCode = normalizeRequiredText(args.reasonCode, "Decision reason", 100);
    const guardianMessage = normalizeRequiredText(args.guardianMessage, "Guardian-safe decision message", 1000);
    const [snapshot, fields, answers, requirements, documents] = await Promise.all([
      ctx.db.get(application.latestSnapshotId),
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101),
      ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id)).take(101),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(31),
      ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id)).take(101),
    ]);
    if (!snapshot || snapshot.applicationId !== application._id || fields.length > 100 || answers.length > 100 || requirements.length > 30 || documents.length > 100) throw new ConvexError("Application completeness evidence is unavailable");
    const parsedAnswers = new Map<string, unknown>();
    for (const answer of answers) {
      const field = fields.find((candidate) => candidate._id === answer.formFieldId && candidate.status === "active");
      if (field) parsedAnswers.set(answer.fieldKey, validateAnswerForField(field, answer.valueType, answer.serializedValue));
    }
    const requiredDocuments = requirements.filter((requirement) => requirement.requiredMode === "required" || (requirement.requiredMode === "conditional" && conditionMatches(requirement.conditionJson, parsedAnswers)));
    if (requiredDocuments.some((requirement) => !documents.some((document) => document.requirementId === requirement._id && document.state === "accepted"))) throw new ConvexError("Required documents must be accepted before a decision");
    const previous = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    if (previous?.state === args.state && previous.reasonCode === reasonCode && previous.guardianMessage === guardianMessage && previous.rationale === args.rationale) return { decisionId: previous._id, version: previous.version, replayed: true };
    const rows = await ctx.db.query("admissionsDecisions").withIndex("by_application_and_version", (q) => q.eq("applicationId", application._id)).order("desc").take(2);
    const version = (rows[0]?.version ?? 0) + 1;
    const now = Date.now();
    const decisionId = await ctx.db.insert("admissionsDecisions", { schoolId: args.schoolId, applicationId: application._id, version, state: args.state, reasonCode, guardianMessage, ...(args.rationale ? { rationale: args.rationale.slice(0, 2000) } : {}), decidedBy: actor.userId, decidedAt: now, ...(previous ? { supersedesDecisionId: previous._id } : {}), createdAt: now });
    const policy = await getCurrentRetentionPolicy(ctx, args.schoolId);
    await ctx.db.patch(application._id, { currentDecisionId: decisionId, state: args.state, terminalOutcomeAt: now, ...(policy ? { retentionPolicyId: policy._id } : {}), updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "decision.record", entityType: "admissionsDecision", entityId: decisionId, applicationId: application._id, metadata: { state: args.state, version } });
    return { decisionId, version, replayed: false };
  },
});
