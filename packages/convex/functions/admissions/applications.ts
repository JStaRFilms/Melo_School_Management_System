import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { assertEditable, audit, conditionalRuleMatches, digest, opaqueKey, requireGuardian, requireOwnedApplication, validateTypedAnswer } from "./helpers";

const applicationSummaryValidator = v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), draftVersion: v.number(), currentRevision: v.number() });

async function resolvedForm(ctx: any, application: any) {
  const [form, declaration] = await Promise.all([ctx.db.get(application.formVersionId), ctx.db.get(application.declarationVersionId)]);
  if (!form || !declaration || form.schoolId !== application.schoolId || declaration.schoolId !== application.schoolId) throw new ConvexError("APPLICATION_INCOMPLETE");
  return { form, declaration };
}

export const createOrResume = mutation({
  args: { entitlementId: v.id("admissionsEntitlements") },
  returns: applicationSummaryValidator,
  handler: async (ctx, args) => {
    const owner = await requireGuardian(ctx);
    const entitlement = await ctx.db.get(args.entitlementId);
    if (!entitlement || entitlement.guardianId !== owner.guardian._id) throw new ConvexError("Not found or access denied");
    if (entitlement.applicationId) {
      const existing = await ctx.db.get(entitlement.applicationId);
      if (!existing) throw new ConvexError("Not found or access denied");
      return { applicationId: existing._id, publicId: existing.publicId, state: existing.state, draftVersion: existing.draftVersion, currentRevision: existing.currentRevision };
    }
    if (entitlement.state !== "available") throw new ConvexError("APPLICATION_ALREADY_EXISTS");
    const product = await ctx.db.get(entitlement.productId);
    const intake = product && await ctx.db.get(product.intakeId);
    if (!product || !intake || product.schoolId !== entitlement.schoolId || intake.schoolId !== entitlement.schoolId) throw new ConvexError("Not found or access denied");
    const [forms, declarations, sourceAttempt] = await Promise.all([
      ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "published")).take(2),
      ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", intake.programmeId).eq("status", "published")).take(2),
      ctx.db.get(entitlement.sourcePurchaseAttemptId),
    ]);
    if (!sourceAttempt || sourceAttempt.schoolId !== entitlement.schoolId || sourceAttempt.productId !== product._id || sourceAttempt.guardianId !== owner.guardian._id) throw new ConvexError("Not found or access denied");
    const price = await ctx.db.get(sourceAttempt.priceId);
    if (!price || price.schoolId !== entitlement.schoolId || price.productId !== product._id || forms.length !== 1 || declarations.length !== 1) throw new ConvexError("OFFERING_UNAVAILABLE");
    const now = Date.now();
    const applicationId = await ctx.db.insert("admissionsApplications", {
      schoolId: entitlement.schoolId, guardianId: owner.guardian._id, entitlementId: entitlement._id, programmeId: intake.programmeId, intakeId: intake._id, productId: product._id, priceId: price._id,
      formVersionId: forms[0]._id, declarationVersionId: declarations[0]._id, publicId: opaqueKey("app_"), state: "draft", currentRevision: 0, draftVersion: 1, createdAt: now, updatedAt: now,
    });
    await ctx.db.patch(entitlement._id, { state: "reserved", applicationId, reservedAt: now, updatedAt: now });
    await audit({ ctx, schoolId: entitlement.schoolId, actor: { kind: "guardian", guardianId: owner.guardian._id }, action: "application.reserved", entityType: "application", entityId: String(applicationId), applicationId, outcome: "success" });
    const application = await ctx.db.get(applicationId);
    return { applicationId, publicId: application!.publicId, state: "draft", draftVersion: 1, currentRevision: 0 };
  },
});

export const getDraft = query({
  args: { applicationId: v.id("admissionsApplications") },
  returns: v.union(v.null(), applicationSummaryValidator),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedApplication(ctx, args.applicationId);
    return { applicationId: application._id, publicId: application.publicId, state: application.state, draftVersion: application.draftVersion, currentRevision: application.currentRevision };
  },
});

export const saveCoreSection = mutation({
  args: { applicationId: v.id("admissionsApplications"), expectedVersion: v.number(), firstName: v.string(), lastName: v.string(), dateOfBirth: v.number(), middleName: v.optional(v.string()), preferredName: v.optional(v.string()), gender: v.optional(v.string()), nationality: v.optional(v.string()), countryOfBirth: v.optional(v.string()), address: v.optional(v.string()), requestedEntryLabel: v.optional(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertEditable(application.state);
    if (application.draftVersion !== args.expectedVersion) throw new ConvexError("DRAFT_VERSION_CONFLICT");
    if (!args.firstName.trim() || !args.lastName.trim() || !Number.isFinite(args.dateOfBirth) || args.dateOfBirth <= 0) throw new ConvexError("APPLICATION_INCOMPLETE");
    const now = Date.now();
    const existing = await ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique();
    const profile = { schoolId: application.schoolId, applicationId: application._id, firstName: args.firstName.trim(), lastName: args.lastName.trim(), dateOfBirth: args.dateOfBirth, normalizedName: `${args.firstName} ${args.lastName}`.trim().toLowerCase(), createdAt: existing?.createdAt ?? now, updatedAt: now, ...(args.middleName?.trim() ? { middleName: args.middleName.trim() } : {}), ...(args.preferredName?.trim() ? { preferredName: args.preferredName.trim() } : {}), ...(args.gender?.trim() ? { gender: args.gender.trim() } : {}), ...(args.nationality?.trim() ? { nationality: args.nationality.trim() } : {}), ...(args.countryOfBirth?.trim() ? { countryOfBirth: args.countryOfBirth.trim() } : {}), ...(args.address?.trim() ? { address: args.address.trim() } : {}) };
    if (existing) await ctx.db.replace(existing._id, profile); else await ctx.db.insert("admissionsApplicantProfiles", profile);
    const nextVersion = application.draftVersion + 1;
    await ctx.db.patch(application._id, { draftVersion: nextVersion, requestedEntryLabel: args.requestedEntryLabel?.trim() || undefined, updatedAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "application.core_saved", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" });
    return nextVersion;
  },
});

export const saveAnswer = mutation({
  args: { applicationId: v.id("admissionsApplications"), formFieldId: v.id("admissionsFormFields"), expectedVersion: v.number(), valueType: v.string(), serializedValue: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertEditable(application.state);
    if (application.draftVersion !== args.expectedVersion) throw new ConvexError("DRAFT_VERSION_CONFLICT");
    const field = await ctx.db.get(args.formFieldId);
    if (!field || field.schoolId !== application.schoolId || field.formVersionId !== application.formVersionId || field.status !== "active") throw new ConvexError("Not found or access denied");
    if (application.state === "changes_requested" && application.changeRequestFieldKeys && !application.changeRequestFieldKeys.includes(field.fieldKey)) throw new ConvexError("ANSWER_NOT_APPLICABLE");
    const existingAnswers = await ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id)).take(200);
    const answerMap = new Map<string, unknown>();
    for (const answer of existingAnswers) {
      const configured = await ctx.db.get(answer.formFieldId);
      if (configured) answerMap.set(answer.fieldKey, validateTypedAnswer({ kind: configured.kind, valueType: answer.valueType, serializedValue: answer.serializedValue, validationJson: configured.validationJson }));
    }
    if (field.requiredMode === "conditional" && !conditionalRuleMatches(field.conditionalRuleJson, answerMap)) throw new ConvexError("ANSWER_NOT_APPLICABLE");
    validateTypedAnswer({ kind: field.kind, valueType: args.valueType, serializedValue: args.serializedValue, validationJson: field.validationJson });
    const existing = await ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id).eq("fieldKey", field.fieldKey)).unique();
    const now = Date.now(); const valueVersion = (existing?.valueVersion ?? 0) + 1;
    const row = { schoolId: application.schoolId, applicationId: application._id, formFieldId: field._id, fieldKey: field.fieldKey, valueType: args.valueType.trim(), serializedValue: args.serializedValue, dataClass: field.dataClass, valueVersion, createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing) await ctx.db.replace(existing._id, row); else await ctx.db.insert("admissionsApplicationAnswers", row);
    const nextVersion = application.draftVersion + 1; await ctx.db.patch(application._id, { draftVersion: nextVersion, updatedAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "application.answer_saved", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" });
    return nextVersion;
  },
});

export const withdraw = mutation({
  args: { applicationId: v.id("admissionsApplications"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    if (!["draft", "submitted", "under_review", "changes_requested", "waitlisted"].includes(application.state) || !args.reason.trim()) throw new ConvexError("Invalid application transition");
    const now = Date.now();
    await ctx.db.patch(application._id, { state: "withdrawn", updatedAt: now });
    await ctx.db.insert("admissionsReviewEvents", { schoolId: application.schoolId, applicationId: application._id, actorGuardianId: guardian._id, eventType: "withdrawn", visibility: "staff", reasonCode: args.reason.trim().slice(0, 128), createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "application.withdrawn", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" });
    return null;
  },
});

export const submit = mutation({
  args: { applicationId: v.id("admissionsApplications"), expectedVersion: v.number(), signerName: v.string(), signerRelationship: v.string(), declarationVersion: v.number(), declarationAccepted: v.boolean() },
  returns: v.object({ revision: v.number(), state: v.literal("submitted") }),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertEditable(application.state);
    if (application.draftVersion !== args.expectedVersion) throw new ConvexError("DRAFT_VERSION_CONFLICT");
    const entitlement = await ctx.db.get(application.entitlementId);
    if (!entitlement || entitlement.schoolId !== application.schoolId || (application.currentRevision === 0 && entitlement.state !== "reserved")) throw new ConvexError("APPLICATION_LOCKED");
    const intake = await ctx.db.get(application.intakeId);
    const activeHold = await ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "active")).unique();
    if (!intake || intake.schoolId !== application.schoolId || intake.status !== "open" || intake.opensAt > Date.now() || intake.closesAt < Date.now()) throw new ConvexError("INTAKE_UNAVAILABLE");
    if (activeHold) throw new ConvexError("FINANCE_HOLD");
    const [{ declaration }, profile, fields, requirements, answers, documents, contacts, previousSchools] = await Promise.all([
      resolvedForm(ctx, application),
      ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(200),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(100),
      ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id)).take(200),
      ctx.db.query("admissionsDocuments").withIndex("by_application_and_category_and_version", (q) => q.eq("applicationId", application._id)).take(200),
      ctx.db.query("admissionsApplicationContacts").withIndex("by_application_and_contact_key", (q) => q.eq("applicationId", application._id)).take(100),
      ctx.db.query("admissionsPreviousSchools").withIndex("by_school_and_application", (q) => q.eq("schoolId", application.schoolId).eq("applicationId", application._id)).take(100),
    ]);
    if (!profile || !profile.firstName.trim() || !profile.lastName.trim() || !Number.isFinite(profile.dateOfBirth) || profile.dateOfBirth <= 0 || !args.signerName.trim() || !args.signerRelationship.trim()) throw new ConvexError("APPLICATION_INCOMPLETE");
    if (!args.declarationAccepted || args.declarationVersion !== declaration.version) throw new ConvexError("DECLARATION_ACCEPTANCE_REQUIRED");
    const answerMap = new Map<string, unknown>();
    for (const answer of answers) {
      const field = fields.find((candidate) => candidate._id === answer.formFieldId);
      if (!field || field.status !== "active") continue;
      answerMap.set(answer.fieldKey, validateTypedAnswer({ kind: field.kind, valueType: answer.valueType, serializedValue: answer.serializedValue, validationJson: field.validationJson }));
    }
    for (const field of fields) {
      if (field.status !== "active") continue;
      const applicable = field.requiredMode !== "conditional" || conditionalRuleMatches(field.conditionalRuleJson, answerMap);
      const required = applicable && field.requiredMode !== "optional";
      const answer = answers.find((candidate) => candidate.formFieldId === field._id);
      if (required && (!answer || !answer.serializedValue.trim())) throw new ConvexError("APPLICATION_INCOMPLETE");
    }
    for (const requirement of requirements) {
      const required = requirement.requiredMode === "required" || (requirement.requiredMode === "conditional" && conditionalRuleMatches(requirement.conditionJson, answerMap));
      const matching = documents.filter((document) => document.requirementId === requirement._id && document.state !== "deleted" && document.state !== "quarantined" && document.state !== "superseded");
      if (matching.length > requirement.maxFiles || (required && matching.length === 0)) throw new ConvexError("APPLICATION_INCOMPLETE");
    }
    const revision = application.currentRevision + 1; const submittedAt = Date.now();
    const profileSnapshot = { firstName: profile.firstName, lastName: profile.lastName, middleName: profile.middleName ?? null, dateOfBirth: profile.dateOfBirth, gender: profile.gender ?? null, preferredName: profile.preferredName ?? null, nationality: profile.nationality ?? null, countryOfBirth: profile.countryOfBirth ?? null, address: profile.address ?? null };
    const items = [
      { itemKey: "profile", kind: "profile", valueType: "json", serializedValue: JSON.stringify(profileSnapshot), dataClass: "child_confidential", sourceRowId: String(profile._id), sourceVersion: application.draftVersion },
      { itemKey: "provenance:form", kind: "provenance", valueType: "json", serializedValue: JSON.stringify({ formVersionId: String(application.formVersionId), schemaVersion: (await resolvedForm(ctx, application)).form.schemaVersion, intakeId: String(application.intakeId), priceId: String(application.priceId) }), dataClass: "internal", sourceVersion: application.draftVersion },
      { itemKey: "provenance:declaration", kind: "declaration", valueType: "json", serializedValue: JSON.stringify({ declarationVersion: declaration.version, bodyDigest: declaration.bodyDigest, signerName: args.signerName.trim(), signerRelationship: args.signerRelationship.trim(), acceptedAt: submittedAt }), dataClass: "personal", sourceVersion: application.draftVersion },
      { itemKey: "provenance:requirements", kind: "requirements", valueType: "json", serializedValue: JSON.stringify(requirements.map((requirement) => ({ key: requirement.requirementKey, requiredMode: requirement.requiredMode, condition: requirement.conditionJson ?? null, mime: requirement.acceptedMimeTypes, maxBytes: requirement.maxBytes, maxFiles: requirement.maxFiles }))), dataClass: "internal", sourceVersion: application.draftVersion },
      ...answers.filter((answer) => {
        const field = fields.find((candidate) => candidate._id === answer.formFieldId);
        return field && (field.requiredMode !== "conditional" || conditionalRuleMatches(field.conditionalRuleJson, answerMap));
      }).map((answer) => ({ itemKey: `answer:${answer.fieldKey}`, kind: "answer", valueType: answer.valueType, serializedValue: answer.serializedValue, dataClass: answer.dataClass, sourceRowId: String(answer._id), sourceVersion: answer.valueVersion })),
      ...contacts.map((contact) => ({ itemKey: `contact:${contact.contactKey}`, kind: "contact", valueType: "json", serializedValue: JSON.stringify({ kind: contact.kind, fullName: contact.fullName, relationship: contact.relationship, email: contact.email ?? null, phone: contact.phone ?? null, address: contact.address ?? null, isApplicantGuardian: contact.isApplicantGuardian, isPrimary: contact.isPrimary }), dataClass: "personal", sourceRowId: String(contact._id), sourceVersion: application.draftVersion })),
      ...previousSchools.map((school) => ({ itemKey: `previous_school:${String(school._id)}`, kind: "previous_school", valueType: "json", serializedValue: JSON.stringify({ name: school.name, startDate: school.startDate ?? null, endDate: school.endDate ?? null, classLabel: school.classLabel ?? null }), dataClass: "personal", sourceRowId: String(school._id), sourceVersion: application.draftVersion })),
      ...documents.filter((document) => document.state !== "deleted").map((document) => ({ itemKey: `document:${document.documentKey}`, kind: "document", valueType: "manifest", serializedValue: JSON.stringify({ documentKey: document.documentKey, requirementId: document.requirementId ? String(document.requirementId) : null, category: document.category, state: document.state, sha256: document.sha256, mimeType: document.mimeType, byteSize: document.byteSize, version: document.version }), dataClass: document.sensitivity, sourceRowId: String(document._id), sourceVersion: document.version })),
    ].sort((left, right) => left.itemKey.localeCompare(right.itemKey));
    const canonicalDigest = await digest(JSON.stringify(items)); const requirementsDigest = await digest(JSON.stringify(requirements.map((requirement) => [requirement.requirementKey, requirement.requiredMode, requirement.category])));
    const snapshotId = await ctx.db.insert("admissionsSubmissionSnapshots", { schoolId: application.schoolId, applicationId: application._id, revision, formVersionId: application.formVersionId, declarationVersionId: application.declarationVersionId, productPriceId: application.priceId, requirementsDigest, canonicalDigest, signerGuardianId: guardian._id, signerName: args.signerName.trim(), signerRelationship: args.signerRelationship.trim(), submittedAt, declarationAcceptedAt: submittedAt, createdAt: submittedAt });
    for (const item of items) await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, ...item, createdAt: submittedAt } as any);
    await ctx.db.patch(application._id, { state: "submitted", currentRevision: revision, latestSnapshotId: snapshotId, draftVersion: application.draftVersion + 1, changeRequestFieldKeys: undefined, changeRequestRequirementKeys: undefined, updatedAt: submittedAt });
    if (entitlement.state === "reserved") await ctx.db.patch(entitlement._id, { state: "consumed", consumedAt: submittedAt, updatedAt: submittedAt });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "application.submitted", entityType: "submission_snapshot", entityId: String(snapshotId), applicationId: application._id, outcome: "success" });
    return { revision, state: "submitted" as const };
  },
});
