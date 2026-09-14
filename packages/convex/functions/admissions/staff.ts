import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { admissionsDecisionStateValidator, documentAccessResultValidator, documentAccessUpstreamValidator } from "../foundation/contracts";
import {
  admissionsError,
  documentStateAllowsAccess,
  hasFreshAuthentication,
  issueDocumentAccessGrant,
  normalizeRequiredText,
  recordAdmissionsAudit,
  recordDocumentAccessAudit,
  requireAdmissionsStaff,
  sha256Hex,
} from "./shared";
import { getCurrentRetentionPolicy } from "./retention";
import { conditionMatches, isSensitiveDataClass, isSensitiveDocumentClass, validateAnswerForField } from "./validation";

type DecisionWorkflowState = "in_evaluation" | "ready_for_decision" | "waitlisted" | "accepted" | "rejected";

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
    basicDocuments: documentMetadata.filter((document) => !isSensitiveDocumentClass(document.category, document.sensitivity)),
    sensitiveDocuments: documentMetadata.filter((document) => isSensitiveDocumentClass(document.category, document.sensitivity)),
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
    const [legacyActiveClasses, activeClasses, families, conversion] = await Promise.all([
      ctx.db.query("classes").withIndex("by_school_and_archived", (q) => q.eq("schoolId", args.schoolId).eq("isArchived", undefined)).take(501),
      ctx.db.query("classes").withIndex("by_school_and_archived", (q) => q.eq("schoolId", args.schoolId).eq("isArchived", false)).take(501),
      ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(101),
      application.conversionId ? ctx.db.get(application.conversionId) : Promise.resolve(null),
    ]);
    if (legacyActiveClasses.length > 500 || activeClasses.length > 500) throw new ConvexError("Active class catalogue exceeds the supported bound");
    const classes = [...legacyActiveClasses, ...activeClasses];
    const outbox = conversion ? await ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", conversion._id).eq("eventKey", "portal_parent_linkage")).unique() : null;
    return { classes: classes.map((row) => ({ classId: row._id, name: row.name, level: row.level })), families: families.map((row) => ({ familyId: row._id, name: row.name })), conversion: conversion ? { state: conversion.state, errorCode: conversion.errorCode ?? null, admissionNumber: conversion.admissionNumber ?? null, onboardingState: outbox?.state ?? null, idempotencyKey: conversion.idempotencyKey } : null };
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

async function latestDecision(ctx: QueryCtx | MutationCtx, applicationId: Id<"admissionsApplications">) {
  return (await ctx.db.query("admissionsDecisions").withIndex("by_application_and_version", (q) => q.eq("applicationId", applicationId)).order("desc").take(1))[0] ?? null;
}

async function appendDecision(ctx: MutationCtx, args: {
  schoolId: Id<"schools">;
  applicationId: Id<"admissionsApplications">;
  snapshotId: Id<"admissionsSubmissionSnapshots">;
  state: DecisionWorkflowState;
  actorUserId: Id<"users">;
  reasonCode?: string;
  guardianMessage?: string;
  rationale?: string;
}) {
  const previous = await latestDecision(ctx, args.applicationId);
  const version = (previous?.version ?? 0) + 1;
  const now = Date.now();
  const decisionId = await ctx.db.insert("admissionsDecisions", {
    schoolId: args.schoolId,
    applicationId: args.applicationId,
    snapshotId: args.snapshotId,
    version,
    state: args.state,
    ...(args.reasonCode ? { reasonCode: args.reasonCode } : {}),
    ...(args.guardianMessage ? { guardianMessage: args.guardianMessage } : {}),
    ...(args.rationale ? { rationale: args.rationale.slice(0, 2000) } : {}),
    decidedBy: args.actorUserId,
    decidedAt: now,
    ...(previous ? { supersedesDecisionId: previous._id } : {}),
    createdAt: now,
  });
  return { decisionId, version, now, previous };
}

async function computeDecisionReadiness(ctx: QueryCtx | MutationCtx, application: Doc<"admissionsApplications">) {
  if (!application.latestSnapshotId) return { ready: false, acceptanceReady: false, blockers: ["CURRENT_SNAPSHOT_UNAVAILABLE"] };
  const snapshotId = application.latestSnapshotId;
  const [snapshot, fields, requirements, documents, items, entrance, interview] = await Promise.all([
    ctx.db.get(snapshotId),
    ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101),
    ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(31),
    ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id)).take(101),
    ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshotId)).take(204),
    ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id).eq("type", "entrance_assessment")).order("desc").take(1),
    ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id).eq("type", "interview")).order("desc").take(1),
  ]);
  if (!snapshot || snapshot.applicationId !== application._id || snapshot.schoolId !== application.schoolId || fields.length > 100 || requirements.length > 30 || documents.length > 100 || items.length > 203) {
    return { ready: false, acceptanceReady: false, blockers: ["READINESS_EVIDENCE_UNAVAILABLE"] };
  }
  const blockers: string[] = [];
  if (application.financialHoldAt !== undefined) blockers.push("FINANCIAL_HOLD");
  const answers = new Map<string, unknown>();
  for (const item of items) {
    if (item.kind !== "answer" || !item.itemKey.startsWith("answer:")) continue;
    const fieldKey = item.itemKey.slice("answer:".length);
    const field = fields.find((candidate) => candidate.fieldKey === fieldKey && candidate.status === "active");
    if (field) answers.set(fieldKey, validateAnswerForField(field, item.valueType, item.serializedValue));
  }
  const manifestKeys = new Set<string>();
  for (const item of items) {
    if (item.kind !== "document_manifest") continue;
    try {
      const parsed: unknown = JSON.parse(item.serializedValue);
      const key = parsed && typeof parsed === "object" ? Reflect.get(parsed, "documentKey") : null;
      if (typeof key !== "string") throw new Error("invalid manifest");
      manifestKeys.add(key);
    } catch {
      return { ready: false, acceptanceReady: false, blockers: ["READINESS_EVIDENCE_UNAVAILABLE"] };
    }
  }
  let acceptanceReady = true;
  const applicableRequired = requirements.filter((requirement) => requirement.requiredMode === "required" || (requirement.requiredMode === "conditional" && conditionMatches(requirement.conditionJson, answers)));
  for (const requirement of applicableRequired) {
    const submitted = documents.filter((document) => document.requirementId === requirement._id && manifestKeys.has(document.documentKey));
    if (!submitted.length || submitted.some((document) => document.state !== "accepted" && document.state !== "rejected")) blockers.push(`DOCUMENT_REVIEW_PENDING:${requirement.requirementKey}`);
    if (!submitted.length || submitted.some((document) => document.state !== "accepted")) acceptanceReady = false;
  }
  if ([entrance[0], interview[0]].some((evaluation) => evaluation?.state === "scheduled")) blockers.push("EVALUATION_PENDING");
  return { ready: blockers.length === 0, acceptanceReady: blockers.length === 0 && acceptanceReady, blockers };
}

export const getLatestReviewState = query({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), evaluationLimit: v.optional(v.number()) },
  returns: v.object({
    decision: v.union(v.null(), v.object({ decisionId: v.id("admissionsDecisions"), snapshotId: v.union(v.id("admissionsSubmissionSnapshots"), v.null()), version: v.number(), state: admissionsDecisionStateValidator, reasonCode: v.union(v.string(), v.null()), guardianMessage: v.union(v.string(), v.null()), decidedAt: v.number() })),
    evaluations: v.array(v.object({ evaluationId: v.id("admissionsEvaluations"), type: v.union(v.literal("entrance_assessment"), v.literal("interview")), state: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")), scheduledAt: v.union(v.number(), v.null()), completedAt: v.union(v.number(), v.null()), resultCode: v.union(v.string(), v.null()), score: v.union(v.number(), v.null()), version: v.number() })),
    readiness: v.object({ ready: v.boolean(), acceptanceReady: v.boolean(), blockers: v.array(v.string()) }),
  }),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.applications.view_basic"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    const limit = Math.min(Math.max(Math.trunc(args.evaluationLimit ?? 20), 1), 50);
    const [decision, entranceEvaluations, interviewEvaluations, readiness] = await Promise.all([
      latestDecision(ctx, application._id),
      ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id).eq("type", "entrance_assessment")).order("desc").take(limit),
      ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id).eq("type", "interview")).order("desc").take(limit),
      computeDecisionReadiness(ctx, application),
    ]);
    const evaluations = [...entranceEvaluations, ...interviewEvaluations].sort((a, b) => b._creationTime - a._creationTime).slice(0, limit);
    return {
      decision: decision ? { decisionId: decision._id, snapshotId: decision.snapshotId ?? null, version: decision.version, state: decision.state, reasonCode: decision.reasonCode ?? null, guardianMessage: decision.guardianMessage ?? null, decidedAt: decision.decidedAt } : null,
      evaluations: evaluations.map((evaluation) => ({ evaluationId: evaluation._id, type: evaluation.type, state: evaluation.state, scheduledAt: evaluation.scheduledAt ?? null, completedAt: evaluation.completedAt ?? null, resultCode: evaluation.resultCode ?? null, score: evaluation.score ?? null, version: evaluation.version })),
      readiness,
    };
  },
});

export const startReview = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.documents.review"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    if ((application.state !== "submitted" && application.state !== "under_review") || !application.latestSnapshotId) throw new ConvexError("Only a submitted application can enter review");
    const current = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    if (application.state === "under_review" && current?.state === "in_evaluation" && current.snapshotId === application.latestSnapshotId) return null;
    const appended = await appendDecision(ctx, { schoolId: args.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, state: "in_evaluation", actorUserId: actor.userId });
    await ctx.db.patch(application._id, { state: "under_review", currentDecisionId: appended.decisionId, terminalOutcomeAt: undefined, updatedAt: appended.now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "review.start", entityType: "admissionsApplication", entityId: application._id, applicationId: application._id, metadata: { decisionVersion: appended.version, snapshotId: application.latestSnapshotId } });
    return null;
  },
});

export const recordEvaluation = mutation({
  args: {
    schoolId: v.id("schools"),
    applicationId: v.id("admissionsApplications"),
    type: v.union(v.literal("entrance_assessment"), v.literal("interview")),
    state: v.union(v.literal("scheduled"), v.literal("completed"), v.literal("cancelled")),
    scheduledAt: v.optional(v.number()),
    resultCode: v.optional(v.string()),
    score: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.object({ evaluationId: v.id("admissionsEvaluations"), version: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.documents.review"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    const current = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    if (application.state !== "under_review" || !application.latestSnapshotId || !current || current.state !== "in_evaluation" || (current.snapshotId !== undefined && current.snapshotId !== application.latestSnapshotId)) throw new ConvexError("Evaluations can be recorded only during current application evaluation");
    const previous = (await ctx.db.query("admissionsEvaluations").withIndex("by_application_and_type_and_version", (q) => q.eq("applicationId", application._id).eq("type", args.type)).order("desc").take(1))[0];
    if (!previous && args.state !== "scheduled") throw new ConvexError("An evaluation must be scheduled before it is completed or cancelled");
    if (previous && previous.state !== "scheduled" && args.state !== "scheduled") throw new ConvexError("A completed or cancelled evaluation can only be followed by a new schedule");
    if (args.state === "scheduled" && (args.scheduledAt === undefined || !Number.isFinite(args.scheduledAt))) throw new ConvexError("A scheduled evaluation requires a valid scheduled time");
    if (args.state === "completed" && !args.resultCode?.trim()) throw new ConvexError("A completed evaluation requires a result code");
    if (args.score !== undefined && (!Number.isFinite(args.score) || args.score < 0 || args.score > 100)) throw new ConvexError("Evaluation score must be between 0 and 100");
    const now = Date.now();
    const version = (previous?.version ?? 0) + 1;
    const evaluationId = await ctx.db.insert("admissionsEvaluations", {
      schoolId: args.schoolId,
      applicationId: application._id,
      type: args.type,
      state: args.state,
      ...(args.scheduledAt !== undefined ? { scheduledAt: args.scheduledAt } : previous?.scheduledAt !== undefined ? { scheduledAt: previous.scheduledAt } : {}),
      ...(args.state === "completed" ? { completedAt: now } : {}),
      ...(args.resultCode ? { resultCode: normalizeRequiredText(args.resultCode, "Evaluation result", 100) } : {}),
      ...(args.score !== undefined ? { score: args.score } : {}),
      evaluatorUserId: actor.userId,
      version,
      ...(args.notes ? { notes: args.notes.slice(0, 2000) } : {}),
      createdAt: now,
      updatedAt: now,
    });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "evaluation.record", entityType: "admissionsEvaluation", entityId: evaluationId, applicationId: application._id, metadata: { type: args.type, state: args.state, version } });
    return { evaluationId, version };
  },
});

export const markReadyForDecision = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications") },
  returns: v.object({ decisionId: v.id("admissionsDecisions"), version: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.documents.review"]);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    const current = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    if (application.state !== "under_review" || !application.latestSnapshotId || !current || current.state !== "in_evaluation" || (current.snapshotId !== undefined && current.snapshotId !== application.latestSnapshotId)) throw new ConvexError("Application is not in evaluation for its current snapshot");
    const readiness = await computeDecisionReadiness(ctx, application);
    if (!readiness.ready) throw new ConvexError(`Application is not ready for a decision: ${readiness.blockers.join(", ")}`);
    const appended = await appendDecision(ctx, { schoolId: args.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, state: "ready_for_decision", actorUserId: actor.userId });
    await ctx.db.patch(application._id, { currentDecisionId: appended.decisionId, updatedAt: appended.now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "decision.mark_ready", entityType: "admissionsDecision", entityId: appended.decisionId, applicationId: application._id, metadata: { version: appended.version, snapshotId: application.latestSnapshotId } });
    return { decisionId: appended.decisionId, version: appended.version };
  },
});

async function resumeEvaluation(ctx: MutationCtx, args: { schoolId: Id<"schools">; applicationId: Id<"admissionsApplications">; reasonCode: string; rationale?: string; managerOnly: boolean }) {
  const capabilities = args.managerOnly ? ["enrollment.intakes.manage", "enrollment.decisions.record"] : ["enrollment.decisions.record"];
  const actor = await requireAdmissionsStaff(ctx, args.schoolId, capabilities);
  if (!await hasFreshAuthentication(ctx)) admissionsError("FRESH_AUTH_REQUIRED", "Fresh authentication is required to resume a decision");
  const application = await ctx.db.get(args.applicationId);
  if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
  if (!application.latestSnapshotId) throw new ConvexError("Application does not have a current snapshot");
  const current = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
  const allowed = args.managerOnly ? current?.state === "accepted" || current?.state === "rejected" : current?.state === "waitlisted";
  if (!allowed) throw new ConvexError(args.managerOnly ? "Only a final decision can be reopened" : "Only a waitlisted decision can resume evaluation");
  if (args.managerOnly && application.conversionId) {
    const conversion = await ctx.db.get(application.conversionId);
    if (conversion?.state === "succeeded") throw new ConvexError("A completed conversion cannot be reopened");
  }
  const reasonCode = normalizeRequiredText(args.reasonCode, "Resume reason", 100);
  const appended = await appendDecision(ctx, { schoolId: args.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, state: "in_evaluation", actorUserId: actor.userId, reasonCode, rationale: args.rationale });
  await ctx.db.patch(application._id, { state: "under_review", currentDecisionId: appended.decisionId, terminalOutcomeAt: undefined, updatedAt: appended.now });
  await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: args.managerOnly ? "decision.reopen" : "decision.waitlist_resume", entityType: "admissionsDecision", entityId: appended.decisionId, applicationId: application._id, reasonCode, metadata: { version: appended.version, ...(current ? { supersedesDecisionId: current._id } : {}) } });
  return { decisionId: appended.decisionId, version: appended.version };
}

export const resumeWaitlisted = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), reasonCode: v.string(), rationale: v.optional(v.string()) },
  returns: v.object({ decisionId: v.id("admissionsDecisions"), version: v.number() }),
  handler: (ctx, args) => resumeEvaluation(ctx, { ...args, managerOnly: false }),
});

export const reopenDecision = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), reasonCode: v.string(), rationale: v.optional(v.string()) },
  returns: v.object({ decisionId: v.id("admissionsDecisions"), version: v.number() }),
  handler: (ctx, args) => resumeEvaluation(ctx, { ...args, managerOnly: true }),
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

function requiredDocumentAccessCapabilities(document: { category: string; sensitivity: Doc<"admissionsDocuments">["sensitivity"] }, action: "view" | "download") {
  return action === "download" || isSensitiveDocumentClass(document.category, document.sensitivity)
    ? ["enrollment.documents.review", "enrollment.applications.view_sensitive"]
    : ["enrollment.documents.review"];
}

export const getDocumentAccess = mutation({
  args: { schoolId: v.id("schools"), documentKey: v.string(), action: v.union(v.literal("view"), v.literal("download")), reason: v.string() },
  returns: documentAccessResultValidator,
  handler: async (ctx, args) => {
    let actor;
    try {
      actor = await requireAdmissionsStaff(ctx, args.schoolId, []);
    } catch {
      return { status: "unavailable" as const };
    }
    const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", args.documentKey.trim())).unique();
    if (!document || document.schoolId !== args.schoolId) return { status: "unavailable" as const };
    try {
      await requireAdmissionsStaff(ctx, args.schoolId, requiredDocumentAccessCapabilities(document, args.action));
    } catch {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "staff", actorUserId: actor.userId, action: args.action, outcome: "denied", reason: "PERMISSION_DENIED" });
      return { status: "unavailable" as const };
    }
    const application = await ctx.db.get(document.applicationId);
    const freshAuthenticationRequired = isSensitiveDocumentClass(document.category, document.sensitivity);
    const freshEnough = !freshAuthenticationRequired || await hasFreshAuthentication(ctx);
    if (!documentStateAllowsAccess(document, application) || !freshEnough) {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "staff", actorUserId: actor.userId, action: args.action, outcome: "denied", reason: !freshEnough ? "FRESH_AUTH_REQUIRED" : "ACCESS_STATE_DENIED" });
      return { status: "unavailable" as const };
    }
    const reason = normalizeRequiredText(args.reason, "Access reason", 240);
    return await issueDocumentAccessGrant(ctx, { document, actorKind: "staff", actorUserId: actor.userId, audience: "admin", action: args.action, reason });
  },
});

export const consumeDocumentAccessGrant = internalMutation({
  args: { token: v.string() },
  returns: documentAccessUpstreamValidator,
  handler: async (ctx, args) => {
    if (!/^[a-f0-9]{64}$/.test(args.token)) return { status: "unavailable" as const };
    const tokenHash = await sha256Hex(args.token);
    const grant = await ctx.db.query("admissionsDocumentAccessGrants").withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (!grant) return { status: "unavailable" as const };
    const document = await ctx.db.get(grant.documentId);
    if (!document) return { status: "unavailable" as const };
    let actor;
    try {
      actor = await requireAdmissionsStaff(ctx, grant.schoolId, requiredDocumentAccessCapabilities(document, grant.action));
    } catch {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "system", action: grant.action, outcome: "denied", reason: "PERMISSION_DENIED" });
      return { status: "unavailable" as const };
    }
    const application = await ctx.db.get(document.applicationId);
    const freshAuthenticationRequired = isSensitiveDocumentClass(document.category, document.sensitivity);
    const freshEnough = !freshAuthenticationRequired || await hasFreshAuthentication(ctx);
    let deniedReason: string | null = null;
    if (grant.actorKind !== "staff" || grant.audience !== "admin" || grant.actorUserId !== actor.userId) deniedReason = "WRONG_ACTOR_OR_AUDIENCE";
    else if (grant.consumedAt !== undefined) deniedReason = "ACCESS_GRANT_REPLAYED";
    else if (grant.expiresAt <= Date.now()) deniedReason = "ACCESS_GRANT_EXPIRED";
    else if (grant.schoolId !== document.schoolId) deniedReason = "ACCESS_CONTEXT_DENIED";
    else if (!documentStateAllowsAccess(document, application)) deniedReason = "ACCESS_STATE_DENIED";
    else if (!freshEnough) deniedReason = "FRESH_AUTH_REQUIRED";
    if (deniedReason) {
      await recordDocumentAccessAudit(ctx, { document, actorKind: "staff", actorUserId: actor.userId, action: grant.action, outcome: "denied", reason: deniedReason });
      return { status: "unavailable" as const };
    }
    const upstreamUrl = await ctx.storage.getUrl(document.storageId);
    await ctx.db.patch(grant._id, { consumedAt: Date.now() });
    await recordDocumentAccessAudit(ctx, { document, actorKind: "staff", actorUserId: actor.userId, action: grant.action, outcome: upstreamUrl ? "granted" : "denied", reason: upstreamUrl ? grant.reason ?? "ACCESS_GRANT_CONSUMED" : "STORAGE_UNAVAILABLE" });
    return upstreamUrl ? { status: "available" as const, upstreamUrl, fileName: document.fileName, contentType: document.mimeType, byteSize: document.byteSize, action: grant.action } : { status: "unavailable" as const };
  },
});

export const recordDecision = mutation({
  args: { schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), state: v.union(v.literal("waitlisted"), v.literal("accepted"), v.literal("rejected")), reasonCode: v.string(), guardianMessage: v.string(), rationale: v.optional(v.string()) },
  returns: v.object({ decisionId: v.id("admissionsDecisions"), version: v.number(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.decisions.record"]);
    if (!await hasFreshAuthentication(ctx)) admissionsError("FRESH_AUTH_REQUIRED", "Fresh authentication is required to record a decision");
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    if (!application.latestSnapshotId || application.financialHoldAt !== undefined) throw new ConvexError("Application is not ready for a decision");
    const reasonCode = normalizeRequiredText(args.reasonCode, "Decision reason", 100);
    const guardianMessage = normalizeRequiredText(args.guardianMessage, "Guardian-safe decision message", 1000);
    const current = application.currentDecisionId ? await ctx.db.get(application.currentDecisionId) : null;
    if (current?.state === args.state && current.reasonCode === reasonCode && current.guardianMessage === guardianMessage && current.rationale === args.rationale) return { decisionId: current._id, version: current.version, replayed: true };
    const legal = current?.state === "ready_for_decision"
      ? args.state === "waitlisted" || args.state === "accepted" || args.state === "rejected"
      : current?.state === "waitlisted" && (args.state === "accepted" || args.state === "rejected");
    if (!current || !legal || (current.snapshotId !== undefined && current.snapshotId !== application.latestSnapshotId)) throw new ConvexError("Decision transition is not allowed for the current snapshot");
    const readiness = await computeDecisionReadiness(ctx, application);
    if (!readiness.ready) throw new ConvexError(`Application is not ready for a decision: ${readiness.blockers.join(", ")}`);
    if (args.state === "accepted" && !readiness.acceptanceReady) throw new ConvexError("Required documents must be accepted before an acceptance decision");
    const appended = await appendDecision(ctx, { schoolId: args.schoolId, applicationId: application._id, snapshotId: application.latestSnapshotId, state: args.state, actorUserId: actor.userId, reasonCode, guardianMessage, rationale: args.rationale });
    const policy = args.state === "waitlisted" ? null : await getCurrentRetentionPolicy(ctx, args.schoolId);
    await ctx.db.patch(application._id, {
      currentDecisionId: appended.decisionId,
      state: args.state,
      terminalOutcomeAt: args.state === "waitlisted" ? undefined : appended.now,
      ...(policy ? { retentionPolicyId: policy._id } : {}),
      updatedAt: appended.now,
    });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "decision.record", entityType: "admissionsDecision", entityId: appended.decisionId, applicationId: application._id, metadata: { state: args.state, version: appended.version, snapshotId: application.latestSnapshotId } });
    return { decisionId: appended.decisionId, version: appended.version, replayed: false };
  },
});
