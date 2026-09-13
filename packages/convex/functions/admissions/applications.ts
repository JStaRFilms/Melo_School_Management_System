import { ConvexError, v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";
import {
  admissionsError,
  isApplicationEditable,
  mergeCorrectionScopes,
  normalizeRequiredText,
  recordAdmissionsAudit,
  requireGuardian,
  requireOwnedApplication,
  sha256Hex,
  normalizeSlug,
} from "./shared";
import { getCurrentRetentionPolicy } from "./retention";
import { conditionMatches, parseSerializedValue, validateAnswerForField } from "./validation";

const profileInputValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  middleName: v.optional(v.string()),
  dateOfBirth: v.number(),
  gender: v.optional(v.string()),
  preferredName: v.optional(v.string()),
  nationality: v.optional(v.string()),
  countryOfBirth: v.optional(v.string()),
  address: v.optional(v.string()),
});

const answerInputValidator = v.object({
  fieldKey: v.string(),
  valueType: v.union(v.literal("string"), v.literal("number"), v.literal("boolean"), v.literal("string_array"), v.literal("date")),
  serializedValue: v.string(),
});

const contactInputValidator = v.object({
  fullName: v.string(),
  relationship: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  address: v.optional(v.string()),
});

const draftFieldDefinitionValidator = v.object({
  fieldKey: v.string(),
  sectionKey: v.string(),
  kind: v.string(),
  label: v.string(),
  helpText: v.union(v.string(), v.null()),
  requiredMode: v.string(),
  dataClass: v.string(),
  purpose: v.union(v.string(), v.null()),
  validationJson: v.string(),
  conditionalRuleJson: v.union(v.string(), v.null()),
  order: v.number(),
});

const draftRequirementDefinitionValidator = v.object({
  requirementId: v.id("admissionsDocumentRequirements"),
  requirementKey: v.string(),
  category: v.string(),
  label: v.string(),
  requiredMode: v.string(),
  acceptedMimeTypes: v.array(v.string()),
  maxBytes: v.number(),
  maxFiles: v.number(),
  sensitivity: v.string(),
  purpose: v.string(),
  conditionJson: v.union(v.string(), v.null()),
  order: v.number(),
});

function normalizedName(firstName: string, lastName: string, middleName?: string) {
  return [firstName, middleName, lastName].filter(Boolean).join(" ").trim().toLowerCase().replace(/\s+/g, " ");
}

function assertDraftMutationKey(value: string) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(value)) throw new ConvexError("A bounded draft mutation key is required");
}

export const createOrResume = mutation({
  args: { entitlementId: v.id("admissionsEntitlements") },
  returns: v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const { guardian } = await requireOwnedEntitlement(ctx, args.entitlementId);
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement) throw new ConvexError("Entitlement not found");
    const existing = await ctx.db.query("admissionsApplications").withIndex("by_entitlement", (q) => q.eq("entitlementId", entitlement._id)).unique();
    if (existing) {
      if (existing.guardianId !== guardian._id || existing.schoolId !== entitlement.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
      return { applicationId: existing._id, publicId: existing.publicId, state: existing.state, replayed: true };
    }
    if (entitlement.state !== "available") {
      if (entitlement.applicationId) {
        const linked = await ctx.db.get(entitlement.applicationId);
        if (linked && linked.guardianId === guardian._id) return { applicationId: linked._id, publicId: linked.publicId, state: linked.state, replayed: true };
      }
      admissionsError("APPLICATION_ALREADY_EXISTS", "This application slot is not available");
    }
    const [product, intake] = await Promise.all([ctx.db.get(entitlement.productId), ctx.db.get(entitlement.intakeId)]);
    if (!product || !intake || product.schoolId !== entitlement.schoolId || intake.schoolId !== entitlement.schoolId || product.intakeId !== intake._id) throw new ConvexError("Entitlement campaign context is invalid");
    const forms = await ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "published")).take(2);
    const declarations = await ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", intake.programmeId).eq("status", "published")).take(2);
    const purchase = await ctx.db.get(entitlement.sourcePurchaseAttemptId);
    if (forms.length !== 1 || declarations.length !== 1 || !purchase || purchase.state !== "paid" || purchase.entitlementId !== entitlement._id) throw new ConvexError("Paid entitlement is not bound to one published application form");
    const now = Date.now();
    const applicationId = await ctx.db.insert("admissionsApplications", {
      schoolId: entitlement.schoolId,
      guardianId: guardian._id,
      entitlementId: entitlement._id,
      programmeId: intake.programmeId,
      intakeId: intake._id,
      productId: product._id,
      priceId: purchase.priceId,
      formVersionId: forms[0]._id,
      declarationVersionId: declarations[0]._id,
      publicId: crypto.randomUUID(),
      state: "draft",
      currentRevision: 0,
      draftVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(entitlement._id, { state: "reserved", applicationId, reservedAt: now, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: entitlement.schoolId, actorKind: "guardian", actorGuardianId: guardian._id, action: "application.create", entityType: "admissionsApplication", entityId: applicationId, applicationId });
    const application = await ctx.db.get(applicationId);
    if (!application) throw new ConvexError("Application was not persisted");
    return { applicationId, publicId: application.publicId, state: application.state, replayed: false };
  },
});

async function requireOwnedEntitlement(ctx: Parameters<typeof requireOwnedApplication>[0], entitlementId: Doc<"admissionsEntitlements">["_id"]) {
  const guardian = await requireGuardian(ctx);
  const entitlement = await ctx.db.get(entitlementId);
  if (!entitlement || entitlement.guardianId !== guardian._id) admissionsError("NOT_FOUND_OR_DENIED", "Application slot not found");
  return { guardian, entitlement };
}

export const saveDraft = mutation({
  args: {
    applicationId: v.id("admissionsApplications"),
    expectedVersion: v.number(),
    mutationKey: v.string(),
    requestedEntryLabel: v.optional(v.string()),
    profile: v.optional(profileInputValidator),
    primaryContact: v.optional(contactInputValidator),
    answers: v.array(answerInputValidator),
    clearAnswerKeys: v.optional(v.array(v.string())),
  },
  returns: v.object({ draftVersion: v.number(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertDraftMutationKey(args.mutationKey);
    if (!isApplicationEditable(application.state) || application.financialHoldAt !== undefined) admissionsError("APPLICATION_LOCKED", "Submitted or financially held application data is locked");
    const clearAnswerKeys = args.clearAnswerKeys ?? [];
    if (args.answers.length > 100 || clearAnswerKeys.length > 100 || new Set(args.answers.map((answer) => answer.fieldKey)).size !== args.answers.length || new Set(clearAnswerKeys).size !== clearAnswerKeys.length || clearAnswerKeys.some((key) => args.answers.some((answer) => answer.fieldKey === key))) throw new ConvexError("Draft answer changes must be unique and bounded");
    const digest = await sha256Hex(JSON.stringify({ requestedEntryLabel: args.requestedEntryLabel ?? null, profile: args.profile ?? null, primaryContact: args.primaryContact ?? null, answers: args.answers, clearAnswerKeys }));
    if (application.lastDraftMutationKey === args.mutationKey) {
      if (application.lastDraftMutationDigest !== digest) throw new ConvexError("Draft mutation key was replayed with different content");
      return { draftVersion: application.draftVersion, replayed: true };
    }
    if (args.expectedVersion !== application.draftVersion) admissionsError("DRAFT_VERSION_CONFLICT", `Draft changed; current version is ${application.draftVersion}`);
    if (application.state === "changes_requested") {
      const events = await ctx.db.query("admissionsReviewEvents").withIndex("by_application_and_created_at", (q) => q.eq("applicationId", application._id)).order("desc").take(501);
      if (events.length > 500) throw new ConvexError("Application correction history exceeds the supported bound");
      const scope = mergeCorrectionScopes(events, application.latestSnapshotId);
      if (!scope || (args.profile && !scope.fieldKeys.includes("profile")) || (args.primaryContact && !scope.fieldKeys.includes("primaryContact")) || (args.requestedEntryLabel !== undefined && !scope.fieldKeys.includes("requestedEntryLabel")) || args.answers.some((answer) => !scope.fieldKeys.includes(answer.fieldKey)) || clearAnswerKeys.some((key) => !scope.fieldKeys.includes(key))) {
        admissionsError("APPLICATION_LOCKED", "Only requested corrections may be changed");
      }
    }
    const fieldRows = await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101);
    if (fieldRows.length > 100) throw new ConvexError("Application form exceeds the supported field bound");
    const fields = new Map(fieldRows.filter((field) => field.status === "active").map((field) => [field.fieldKey, field]));
    if (args.answers.some((answer) => !fields.has(answer.fieldKey)) || clearAnswerKeys.some((key) => !fields.has(key))) throw new ConvexError("Draft answer does not match the published form");
    for (const answer of args.answers) {
      const field = fields.get(answer.fieldKey);
      if (!field) throw new ConvexError("Application field was not found");
      validateAnswerForField(field, answer.valueType, answer.serializedValue);
    }
    for (const key of clearAnswerKeys) {
      if (fields.get(key)?.requiredMode === "required") throw new ConvexError("A required answer cannot be cleared");
    }
    const now = Date.now();
    if (args.profile) {
      const firstName = normalizeRequiredText(args.profile.firstName, "First name", 100);
      const lastName = normalizeRequiredText(args.profile.lastName, "Last name", 100);
      if (!Number.isSafeInteger(args.profile.dateOfBirth) || args.profile.dateOfBirth <= 0 || args.profile.dateOfBirth >= now) throw new ConvexError("A valid date of birth is required");
      const existingProfile = await ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique();
      const profile = {
        firstName,
        lastName,
        middleName: args.profile.middleName?.trim().slice(0, 100) || undefined,
        dateOfBirth: args.profile.dateOfBirth,
        gender: args.profile.gender?.trim().slice(0, 40) || undefined,
        preferredName: args.profile.preferredName?.trim().slice(0, 100) || undefined,
        nationality: args.profile.nationality?.trim().slice(0, 100) || undefined,
        countryOfBirth: args.profile.countryOfBirth?.trim().slice(0, 100) || undefined,
        address: args.profile.address?.trim().slice(0, 500) || undefined,
        normalizedName: normalizedName(firstName, lastName, args.profile.middleName),
        updatedAt: now,
      };
      if (existingProfile) await ctx.db.patch(existingProfile._id, profile);
      else await ctx.db.insert("admissionsApplicantProfiles", { schoolId: application.schoolId, applicationId: application._id, ...profile, createdAt: now });
    }
    if (args.primaryContact) {
      const fullName = normalizeRequiredText(args.primaryContact.fullName, "Primary contact name", 160);
      const relationship = normalizeRequiredText(args.primaryContact.relationship, "Primary contact relationship", 80);
      const email = args.primaryContact.email?.trim().toLowerCase() || undefined;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError("Primary contact email is invalid");
      const existingContact = await ctx.db.query("admissionsApplicationContacts").withIndex("by_application_and_contact_key", (q) => q.eq("applicationId", application._id).eq("contactKey", "primary")).unique();
      const contact = { fullName, relationship, email, phone: args.primaryContact.phone?.trim().slice(0, 40) || undefined, address: args.primaryContact.address?.trim().slice(0, 500) || undefined, updatedAt: now };
      if (existingContact) await ctx.db.patch(existingContact._id, contact);
      else await ctx.db.insert("admissionsApplicationContacts", { schoolId: application.schoolId, applicationId: application._id, contactKey: "primary", kind: "guardian", ...contact, isApplicantGuardian: true, isPrimary: true, createdAt: now });
    }
    for (const key of clearAnswerKeys) {
      const existing = await ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id).eq("fieldKey", key)).unique();
      if (existing) await ctx.db.delete(existing._id);
    }
    for (const answer of args.answers) {
      const field = fields.get(answer.fieldKey);
      if (!field) throw new ConvexError("Application field was not found");
      const existing = await ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id).eq("fieldKey", answer.fieldKey)).unique();
      if (existing) await ctx.db.patch(existing._id, { valueType: answer.valueType, serializedValue: answer.serializedValue, valueVersion: existing.valueVersion + 1, updatedAt: now });
      else await ctx.db.insert("admissionsApplicationAnswers", { schoolId: application.schoolId, applicationId: application._id, formFieldId: field._id, fieldKey: field.fieldKey, valueType: answer.valueType, serializedValue: answer.serializedValue, dataClass: field.dataClass, valueVersion: 1, createdAt: now, updatedAt: now });
    }
    const draftVersion = application.draftVersion + 1;
    await ctx.db.patch(application._id, { ...(args.requestedEntryLabel !== undefined ? { requestedEntryLabel: args.requestedEntryLabel.trim().slice(0, 120) || undefined } : {}), draftVersion, lastDraftMutationKey: args.mutationKey, lastDraftMutationDigest: digest, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: application.schoolId, actorKind: "guardian", actorGuardianId: guardian._id, action: "application.save_draft", entityType: "admissionsApplication", entityId: application._id, applicationId: application._id, metadata: { draftVersion } });
    return { draftVersion, replayed: false };
  },
});

export const submit = mutation({
  args: { applicationId: v.id("admissionsApplications"), expectedVersion: v.number(), submissionKey: v.string(), signerName: v.string(), signerRelationship: v.string(), declarationAccepted: v.boolean() },
  returns: v.object({ snapshotId: v.id("admissionsSubmissionSnapshots"), revision: v.number(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertDraftMutationKey(args.submissionKey);
    if (application.lastSubmissionKey === args.submissionKey && application.latestSnapshotId) return { snapshotId: application.latestSnapshotId, revision: application.currentRevision, replayed: true };
    if (!isApplicationEditable(application.state) || application.financialHoldAt !== undefined) admissionsError("APPLICATION_LOCKED", "Application cannot be submitted in its current state");
    if (args.expectedVersion !== application.draftVersion) admissionsError("DRAFT_VERSION_CONFLICT", `Draft changed; current version is ${application.draftVersion}`);
    if (!args.declarationAccepted) admissionsError("APPLICATION_INCOMPLETE", "The published declaration must be accepted");
    const [profile, primaryContact, fields, answers, requirements, documents, form, declaration, entitlement, intake, programme, product, price] = await Promise.all([
      ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("admissionsApplicationContacts").withIndex("by_application_and_is_primary", (q) => q.eq("applicationId", application._id).eq("isPrimary", true)).unique(),
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101),
      ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id)).take(101),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(31),
      ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id)).take(101),
      ctx.db.get(application.formVersionId),
      ctx.db.get(application.declarationVersionId),
      ctx.db.get(application.entitlementId),
      ctx.db.get(application.intakeId),
      ctx.db.get(application.programmeId),
      ctx.db.get(application.productId),
      ctx.db.get(application.priceId),
    ]);
    const now = Date.now();
    const boundDefinitionsRemainValid = form && declaration && intake && programme && product && price &&
      form.schoolId === application.schoolId && form.programmeId === programme._id && form.intakeId === intake._id && ["published", "retired"].includes(form.status) && form.publishedAt !== undefined &&
      declaration.schoolId === application.schoolId && declaration.programmeId === programme._id && ["published", "retired"].includes(declaration.status) && declaration.publishedAt !== undefined &&
      price.schoolId === application.schoolId && price.productId === product._id && ["published", "retired"].includes(price.status) &&
      programme.schoolId === application.schoolId && intake.schoolId === application.schoolId && intake.programmeId === programme._id && product.schoolId === application.schoolId && product.intakeId === intake._id;
    if (!profile || !application.requestedEntryLabel?.trim() || !boundDefinitionsRemainValid) admissionsError("APPLICATION_INCOMPLETE", "Applicant profile, requested entry, and valid bound definitions are required");
    if (fields.length > 100 || answers.length > 100 || requirements.length > 30 || documents.length > 100) throw new ConvexError("Application exceeds supported submission bounds");
    const answersByKey = new Map(answers.map((answer) => [answer.fieldKey, answer]));
    const parsedAnswers = new Map<string, unknown>();
    for (const answer of answers) {
      const field = fields.find((candidate) => candidate._id === answer.formFieldId && candidate.fieldKey === answer.fieldKey && candidate.status === "active");
      if (!field) throw new ConvexError("Draft answer no longer matches the published form");
      parsedAnswers.set(answer.fieldKey, validateAnswerForField(field, answer.valueType, answer.serializedValue));
    }
    const hasValue = (key: string) => {
      const value = parsedAnswers.get(key);
      return typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
    };
    const missingFields = fields.filter((field) => field.status === "active" && (field.requiredMode === "required" || (field.requiredMode === "conditional" && conditionMatches(field.conditionalRuleJson, parsedAnswers))) && !hasValue(field.fieldKey)).map((field) => field.fieldKey);
    const activeDocuments = documents.filter((document) => !["deleted", "superseded", "archived"].includes(document.state));
    const missingRequirements = requirements.filter((requirement) => (requirement.requiredMode === "required" || (requirement.requiredMode === "conditional" && conditionMatches(requirement.conditionJson, parsedAnswers))) && !activeDocuments.some((document) => document.requirementId === requirement._id && (document.state === "uploaded" || document.state === "accepted"))).map((requirement) => requirement.requirementKey);
    if (missingFields.length || missingRequirements.length) admissionsError("APPLICATION_INCOMPLETE", `Missing required items: ${[...missingFields, ...missingRequirements].join(", ")}`);
    if (!entitlement || entitlement.guardianId !== guardian._id || (application.currentRevision === 0 && entitlement.state !== "reserved") || (application.currentRevision > 0 && entitlement.state !== "consumed")) throw new ConvexError("Application entitlement cannot be consumed");
    const revision = application.currentRevision + 1;
    const documentManifest = activeDocuments.map((document) => ({ documentKey: document.documentKey, requirementId: document.requirementId ? String(document.requirementId) : null, category: document.category, mimeType: document.mimeType, byteSize: document.byteSize, sha256: document.sha256, version: document.version, state: document.state })).sort((a, b) => a.documentKey.localeCompare(b.documentKey));
    const requirementsDigest = await sha256Hex(JSON.stringify({ requirements: requirements.map((item) => ({ key: item.requirementKey, mode: item.requiredMode })).sort((a, b) => a.key.localeCompare(b.key)), documents: documentManifest }));
    const signerName = normalizeRequiredText(args.signerName, "Signer name", 160);
    const signerRelationship = normalizeRequiredText(args.signerRelationship, "Signer relationship", 80);
    const contact = primaryContact ? { fullName: primaryContact.fullName, relationship: primaryContact.relationship, email: primaryContact.email ?? guardian.normalizedEmail, phone: primaryContact.phone ?? null, address: primaryContact.address ?? null } : { fullName: signerName, relationship: signerRelationship, email: guardian.normalizedEmail, phone: guardian.normalizedPhone ?? null, address: null };
    const canonical = { profile: { firstName: profile.firstName, lastName: profile.lastName, middleName: profile.middleName ?? null, dateOfBirth: profile.dateOfBirth, gender: profile.gender ?? null, preferredName: profile.preferredName ?? null, nationality: profile.nationality ?? null, countryOfBirth: profile.countryOfBirth ?? null, address: profile.address ?? null }, primaryContact: contact, requestedEntryLabel: application.requestedEntryLabel.trim(), answers: answers.map((answer) => ({ fieldKey: answer.fieldKey, valueType: answer.valueType, serializedValue: answer.serializedValue, dataClass: answer.dataClass, valueVersion: answer.valueVersion })).sort((a, b) => a.fieldKey.localeCompare(b.fieldKey)), documents: documentManifest, declaration: { id: String(declaration._id), digest: declaration.bodyDigest } };
    const snapshotId = await ctx.db.insert("admissionsSubmissionSnapshots", { schoolId: application.schoolId, applicationId: application._id, revision, formVersionId: application.formVersionId, declarationVersionId: declaration._id, productPriceId: application.priceId, requirementsDigest, canonicalDigest: await sha256Hex(JSON.stringify(canonical)), signerGuardianId: guardian._id, signerName, signerRelationship, submittedAt: now, declarationAcceptedAt: now, createdAt: now });
    await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, itemKey: "profile", kind: "profile", valueType: "json", serializedValue: JSON.stringify(canonical.profile), dataClass: "child_confidential", sourceRowId: String(profile._id), createdAt: now });
    await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, itemKey: "primaryContact", kind: "contact", valueType: "json", serializedValue: JSON.stringify(canonical.primaryContact), dataClass: "personal", ...(primaryContact ? { sourceRowId: String(primaryContact._id) } : {}), createdAt: now });
    await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, itemKey: "requestedEntryLabel", kind: "application_core", valueType: "string", serializedValue: canonical.requestedEntryLabel, dataClass: "personal", createdAt: now });
    for (const answer of canonical.answers) await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, itemKey: `answer:${answer.fieldKey}`, kind: "answer", valueType: answer.valueType, serializedValue: answer.serializedValue, dataClass: answer.dataClass, sourceRowId: String(answersByKey.get(answer.fieldKey)?._id), sourceVersion: answer.valueVersion, createdAt: now });
    for (const document of documentManifest) await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, itemKey: `document:${document.documentKey}`, kind: "document_manifest", valueType: "json", serializedValue: JSON.stringify(document), dataClass: "child_confidential", createdAt: now });
    await ctx.db.patch(application._id, { state: "submitted", currentRevision: revision, latestSnapshotId: snapshotId, lastSubmissionKey: args.submissionKey, updatedAt: now });
    if (entitlement.state === "reserved") await ctx.db.patch(entitlement._id, { state: "consumed", consumedAt: now, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: application.schoolId, actorKind: "guardian", actorGuardianId: guardian._id, action: "application.submit", entityType: "admissionsApplication", entityId: application._id, applicationId: application._id, metadata: { revision } });
    return { snapshotId, revision, replayed: false };
  },
});

export const withdraw = mutation({
  args: { applicationId: v.id("admissionsApplications"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    if (["accepted", "rejected", "withdrawn", "archived"].includes(application.state)) throw new ConvexError("Application cannot be withdrawn in its current state");
    const now = Date.now();
    const policy = await getCurrentRetentionPolicy(ctx, application.schoolId);
    await ctx.db.patch(application._id, { state: "withdrawn", terminalOutcomeAt: now, ...(policy ? { retentionPolicyId: policy._id } : {}), updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: application.schoolId, actorKind: "guardian", actorGuardianId: guardian._id, action: "application.withdraw", entityType: "admissionsApplication", entityId: application._id, applicationId: application._id, reasonCode: normalizeRequiredText(args.reason, "Withdrawal reason", 240) });
    return null;
  },
});

export const getOwnedApplicationByPublicId = query({
  args: { schoolSlug: v.string(), publicId: v.string() },
  returns: v.union(v.null(), v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), draftVersion: v.number(), currentRevision: v.number(), financialHold: v.boolean(), safeMessages: v.array(v.string()), conversion: v.union(v.null(), v.object({ state: v.union(v.literal("processing"), v.literal("completed"), v.literal("needs_attention")), message: v.string(), admissionNumber: v.union(v.string(), v.null()) })) })),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.schoolSlug, "School slug"))).unique();
    if (!school) return null;
    const application = await ctx.db.query("admissionsApplications").withIndex("by_school_and_public_id", (q) => q.eq("schoolId", school._id).eq("publicId", args.publicId.trim())).unique();
    if (!application || application.guardianId !== guardian._id) return null;
    const [conversion, events, decision] = await Promise.all([
      application.conversionId ? ctx.db.get(application.conversionId) : Promise.resolve(null),
      ctx.db.query("admissionsReviewEvents").withIndex("by_application_and_created_at", (q) => q.eq("applicationId", application._id)).order("desc").take(20),
      application.currentDecisionId ? ctx.db.get(application.currentDecisionId) : Promise.resolve(null),
    ]);
    const reviewMessages = events.flatMap((event) => event.visibility === "guardian" && event.message?.trim() ? [event.message.trim()] : []);
    const safeMessages = [...new Set([...(decision?.guardianMessage ? [decision.guardianMessage] : []), ...reviewMessages])];
    const safeConversion = conversion ? conversion.state === "succeeded"
      ? { state: "completed" as const, message: "Enrollment setup completed.", admissionNumber: conversion.admissionNumber ?? null }
      : conversion.state === "failed_retryable" || conversion.state === "failed_terminal"
        ? { state: "needs_attention" as const, message: "Enrollment setup needs staff attention. The school will contact you if action is required.", admissionNumber: null }
        : { state: "processing" as const, message: "Enrollment setup is in progress.", admissionNumber: null }
      : null;
    return { applicationId: application._id, publicId: application.publicId, state: application.state, draftVersion: application.draftVersion, currentRevision: application.currentRevision, financialHold: application.financialHoldAt !== undefined, safeMessages, conversion: safeConversion };
  },
});

export const getDraft = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.object({
    state: v.string(),
    draftVersion: v.number(),
    currentRevision: v.number(),
    safeMessages: v.array(v.string()),
    requestedEntryLabel: v.union(v.string(), v.null()),
    profile: v.union(v.null(), profileInputValidator),
    primaryContact: v.union(v.null(), contactInputValidator),
    form: v.object({ version: v.number(), schemaVersion: v.string(), status: v.string(), fields: v.array(draftFieldDefinitionValidator), requirements: v.array(draftRequirementDefinitionValidator) }),
    declaration: v.object({ version: v.number(), title: v.string(), body: v.string(), purpose: v.string(), status: v.string() }),
    correction: v.union(v.null(), v.object({ fieldKeys: v.array(v.string()), requirementIds: v.array(v.id("admissionsDocumentRequirements")), reasonCode: v.string(), message: v.string(), createdAt: v.number() })),
    answers: v.array(v.object({ fieldKey: v.string(), valueType: v.string(), serializedValue: v.string(), valueVersion: v.number() })),
    documents: v.array(v.object({ documentKey: v.string(), requirementId: v.union(v.id("admissionsDocumentRequirements"), v.null()), category: v.string(), state: v.string(), version: v.number() })),
  }),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedApplication(ctx, args.applicationId);
    const [profile, primaryContact, form, fields, requirements, declaration, answers, documents, guardianEvents, decision] = await Promise.all([
      ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("admissionsApplicationContacts").withIndex("by_application_and_is_primary", (q) => q.eq("applicationId", application._id).eq("isPrimary", true)).unique(),
      ctx.db.get(application.formVersionId),
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(101),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(31),
      ctx.db.get(application.declarationVersionId),
      ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id)).take(101),
      ctx.db.query("admissionsDocuments").withIndex("by_application_and_requirement", (q) => q.eq("applicationId", application._id)).take(101),
      ctx.db.query("admissionsReviewEvents").withIndex("by_application_and_created_at", (q) => q.eq("applicationId", application._id)).order("desc").take(501),
      application.currentDecisionId ? ctx.db.get(application.currentDecisionId) : Promise.resolve(null),
    ]);
    const latestCorrection = guardianEvents.find((event) => event.visibility === "guardian" && event.eventType === "changes_requested" && (!application.latestSnapshotId || event.snapshotId === application.latestSnapshotId)) ?? null;
    if (!form || form.schoolId !== application.schoolId || !declaration || declaration.schoolId !== application.schoolId || declaration.programmeId !== application.programmeId || fields.length > 100 || requirements.length > 30 || answers.length > 100 || documents.length > 100 || guardianEvents.length > 500) {
      throw new ConvexError("Application-bound form definitions are unavailable");
    }
    const correctionScope = mergeCorrectionScopes(guardianEvents.filter((event) => event.visibility === "guardian"), application.latestSnapshotId);
    const correction = latestCorrection && correctionScope ? {
      fieldKeys: correctionScope.fieldKeys,
      requirementIds: requirements.filter((requirement) => correctionScope.requirementIds.includes(String(requirement._id))).map((requirement) => requirement._id),
      reasonCode: latestCorrection.reasonCode ?? "CHANGES_REQUESTED",
      message: latestCorrection.message ?? "Changes were requested.",
      createdAt: latestCorrection.createdAt,
    } : null;
    return {
      state: application.state,
      draftVersion: application.draftVersion,
      currentRevision: application.currentRevision,
      safeMessages: [...new Set([...(decision?.guardianMessage ? [decision.guardianMessage] : []), ...guardianEvents.flatMap((event) => event.visibility === "guardian" && event.message?.trim() ? [event.message.trim()] : [])])],
      requestedEntryLabel: application.requestedEntryLabel ?? null,
      profile: profile ? { firstName: profile.firstName, lastName: profile.lastName, ...(profile.middleName ? { middleName: profile.middleName } : {}), dateOfBirth: profile.dateOfBirth, ...(profile.gender ? { gender: profile.gender } : {}), ...(profile.preferredName ? { preferredName: profile.preferredName } : {}), ...(profile.nationality ? { nationality: profile.nationality } : {}), ...(profile.countryOfBirth ? { countryOfBirth: profile.countryOfBirth } : {}), ...(profile.address ? { address: profile.address } : {}) } : null,
      primaryContact: primaryContact ? { fullName: primaryContact.fullName, relationship: primaryContact.relationship, ...(primaryContact.email ? { email: primaryContact.email } : {}), ...(primaryContact.phone ? { phone: primaryContact.phone } : {}), ...(primaryContact.address ? { address: primaryContact.address } : {}) } : null,
      form: {
        version: form.version,
        schemaVersion: form.schemaVersion,
        status: form.status,
        fields: fields.map((field) => ({ fieldKey: field.fieldKey, sectionKey: field.sectionKey, kind: field.kind, label: field.label, helpText: field.helpText ?? null, requiredMode: field.requiredMode, dataClass: field.dataClass, purpose: field.purpose ?? null, validationJson: field.validationJson, conditionalRuleJson: field.conditionalRuleJson ?? null, order: field.order })),
        requirements: requirements.map((requirement) => ({ requirementId: requirement._id, requirementKey: requirement.requirementKey, category: requirement.category, label: requirement.label, requiredMode: requirement.requiredMode, acceptedMimeTypes: requirement.acceptedMimeTypes, maxBytes: requirement.maxBytes, maxFiles: requirement.maxFiles, sensitivity: requirement.sensitivity, purpose: requirement.purpose, conditionJson: requirement.conditionJson ?? null, order: requirement.order })),
      },
      declaration: { version: declaration.version, title: declaration.title, body: declaration.body, purpose: declaration.purpose, status: declaration.status },
      correction,
      answers: answers.map((answer) => ({ fieldKey: answer.fieldKey, valueType: answer.valueType, serializedValue: answer.serializedValue, valueVersion: answer.valueVersion })),
      documents: documents.map((document) => ({ documentKey: document.documentKey, requirementId: document.requirementId ?? null, category: document.category, state: document.state, version: document.version })),
    };
  },
});
