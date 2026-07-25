import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { assertEditable, audit, digest, opaqueKey, requireGuardian, requireOwnedApplication } from "./helpers";

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
    const forms = await ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "published")).take(2);
    const declarations = await ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", intake.programmeId).eq("status", "published")).take(2);
    const prices = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q) => q.eq("productId", product._id).eq("status", "published")).order("desc").take(50);
    const price = prices.find((candidate) => candidate.effectiveFrom <= Date.now() && (!candidate.effectiveTo || candidate.effectiveTo > Date.now()));
    if (forms.length !== 1 || declarations.length !== 1 || !price) throw new ConvexError("OFFERING_UNAVAILABLE");
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
    if (args.serializedValue.length > 16_000) throw new ConvexError("Answer is too large");
    const existing = await ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id).eq("fieldKey", field.fieldKey)).unique();
    const now = Date.now(); const valueVersion = (existing?.valueVersion ?? 0) + 1;
    const row = { schoolId: application.schoolId, applicationId: application._id, formFieldId: field._id, fieldKey: field.fieldKey, valueType: args.valueType.trim(), serializedValue: args.serializedValue, dataClass: field.dataClass, valueVersion, createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing) await ctx.db.replace(existing._id, row); else await ctx.db.insert("admissionsApplicationAnswers", row);
    const nextVersion = application.draftVersion + 1; await ctx.db.patch(application._id, { draftVersion: nextVersion, updatedAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "application.answer_saved", entityType: "application", entityId: String(application._id), applicationId: application._id, outcome: "success" });
    return nextVersion;
  },
});

export const submit = mutation({
  args: { applicationId: v.id("admissionsApplications"), expectedVersion: v.number(), signerName: v.string(), signerRelationship: v.string() },
  returns: v.object({ revision: v.number(), state: v.literal("submitted") }),
  handler: async (ctx, args) => {
    const { guardian, application } = await requireOwnedApplication(ctx, args.applicationId);
    assertEditable(application.state);
    if (application.draftVersion !== args.expectedVersion) throw new ConvexError("DRAFT_VERSION_CONFLICT");
    const entitlement = await ctx.db.get(application.entitlementId);
    if (!entitlement || entitlement.schoolId !== application.schoolId || (application.currentRevision === 0 && entitlement.state !== "reserved")) throw new ConvexError("APPLICATION_LOCKED");
    const [profile, requirements, answers, documents] = await Promise.all([
      ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", application.formVersionId)).take(100),
      ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q) => q.eq("applicationId", application._id)).take(200),
      ctx.db.query("admissionsDocuments").withIndex("by_application_and_category_and_version", (q) => q.eq("applicationId", application._id)).take(200),
    ]);
    if (!profile) throw new ConvexError("APPLICATION_INCOMPLETE");
    for (const requirement of requirements) {
      if (requirement.requiredMode === "required" && !documents.some((document) => document.requirementId === requirement._id && document.state !== "deleted" && document.state !== "quarantined")) throw new ConvexError("APPLICATION_INCOMPLETE");
    }
    const revision = application.currentRevision + 1; const submittedAt = Date.now();
    const items = [
      { itemKey: "profile", kind: "profile", valueType: "json", serializedValue: JSON.stringify(profile), dataClass: "child_confidential", sourceRowId: String(profile._id), sourceVersion: application.draftVersion },
      ...answers.map((answer) => ({ itemKey: `answer:${answer.fieldKey}`, kind: "answer", valueType: answer.valueType, serializedValue: answer.serializedValue, dataClass: answer.dataClass, sourceRowId: String(answer._id), sourceVersion: answer.valueVersion })),
      ...documents.filter((document) => document.state !== "deleted").map((document) => ({ itemKey: `document:${document.documentKey}`, kind: "document", valueType: "manifest", serializedValue: JSON.stringify({ documentKey: document.documentKey, category: document.category, state: document.state, sha256: document.sha256 }), dataClass: document.sensitivity, sourceRowId: String(document._id), sourceVersion: document.version })),
    ].sort((left, right) => left.itemKey.localeCompare(right.itemKey));
    const canonicalDigest = await digest(JSON.stringify(items)); const requirementsDigest = await digest(JSON.stringify(requirements.map((requirement) => [requirement.requirementKey, requirement.requiredMode, requirement.category])));
    const snapshotId = await ctx.db.insert("admissionsSubmissionSnapshots", { schoolId: application.schoolId, applicationId: application._id, revision, formVersionId: application.formVersionId, declarationVersionId: application.declarationVersionId, productPriceId: application.priceId, requirementsDigest, canonicalDigest, signerGuardianId: guardian._id, signerName: args.signerName.trim(), signerRelationship: args.signerRelationship.trim(), submittedAt, declarationAcceptedAt: submittedAt, createdAt: submittedAt });
    for (const item of items) await ctx.db.insert("admissionsSubmissionSnapshotItems", { schoolId: application.schoolId, snapshotId, ...item, createdAt: submittedAt } as any);
    await ctx.db.patch(application._id, { state: "submitted", currentRevision: revision, latestSnapshotId: snapshotId, draftVersion: application.draftVersion + 1, updatedAt: submittedAt });
    if (entitlement.state === "reserved") await ctx.db.patch(entitlement._id, { state: "consumed", consumedAt: submittedAt, updatedAt: submittedAt });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "application.submitted", entityType: "submission_snapshot", entityId: String(snapshotId), applicationId: application._id, outcome: "success" });
    return { revision, state: "submitted" as const };
  },
});
