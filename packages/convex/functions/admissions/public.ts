import { action, internalQuery, mutation, query } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import { audit, opaqueKey, requireGuardian } from "./helpers";

type PublicEntry = {
  schoolSlug: string;
  availability: "open" | "upcoming" | "paused" | "closed" | "unavailable";
  intake: { slug: string; name: string; cycleLabel: string; opensAt: number; closesAt: number } | null;
  programme: { slug: string; name: string } | null;
  offering: { slug: string; name: string; amountMinor: number; currency: string; feeDisclosure: string } | null;
};

const publicEntryValidator = v.object({
  schoolSlug: v.string(),
  availability: v.union(v.literal("open"), v.literal("upcoming"), v.literal("paused"), v.literal("closed"), v.literal("unavailable")),
  intake: v.union(v.null(), v.object({ slug: v.string(), name: v.string(), cycleLabel: v.string(), opensAt: v.number(), closesAt: v.number() })),
  programme: v.union(v.null(), v.object({ slug: v.string(), name: v.string() })),
  offering: v.union(v.null(), v.object({ slug: v.string(), name: v.string(), amountMinor: v.number(), currency: v.string(), feeDisclosure: v.string() })),
});

const publicFieldValidator = v.object({
  key: v.string(), sectionKey: v.string(), kind: v.string(), label: v.string(), helpText: v.union(v.string(), v.null()), requiredMode: v.string(), dataClass: v.string(), purpose: v.union(v.string(), v.null()), validation: v.string(), conditionalRule: v.union(v.string(), v.null()), order: v.number(),
});
const publicRequirementValidator = v.object({
  key: v.string(), category: v.string(), label: v.string(), requiredMode: v.string(), acceptedMimeTypes: v.array(v.string()), maxBytes: v.number(), maxFiles: v.number(), sensitivity: v.string(), purpose: v.string(), condition: v.union(v.string(), v.null()), order: v.number(),
});

function safeSlug(value: string) {
  const slug = value.trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) ? slug : "unavailable";
}

async function resolveEntry(ctx: any, schoolSlug: string, intakeSlug?: string): Promise<PublicEntry & { school?: any; intakeRecord?: any; product?: any; price?: any }> {
  const requestedSlug = safeSlug(schoolSlug);
  const school = await ctx.db.query("schools").withIndex("by_slug", (q: any) => q.eq("slug", schoolSlug.trim())).unique();
  if (!school || school.status !== "active") return { schoolSlug: requestedSlug, availability: "unavailable", intake: null, programme: null, offering: null };

  let intake: any = null;
  if (intakeSlug) {
    intake = await ctx.db.query("admissionsIntakes").withIndex("by_school_and_slug", (q: any) => q.eq("schoolId", school._id).eq("slug", intakeSlug.trim())).unique();
  } else {
    const candidates = await ctx.db.query("admissionsIntakes").withIndex("by_school_and_status_and_opens_at", (q: any) => q.eq("schoolId", school._id).eq("status", "open")).order("desc").take(100);
    const now = Date.now();
    const configured: any[] = [];
    for (const candidate of candidates) {
      const products = await ctx.db.query("admissionsProducts").withIndex("by_intake_and_status", (q: any) => q.eq("intakeId", candidate._id).eq("status", "active")).take(2);
      if (products.length !== 1 || products[0].schoolId !== school._id) continue;
      const prices = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q: any) => q.eq("productId", products[0]._id).eq("status", "published")).order("desc").take(50);
      if (!prices.some((price: any) => price.schoolId === school._id && price.effectiveFrom <= now && (!price.effectiveTo || price.effectiveTo > now))) continue;
      configured.push(candidate);
    }
    intake = configured.find((candidate) => candidate.opensAt <= now && candidate.closesAt >= now) ?? configured.find((candidate) => candidate.opensAt > now) ?? configured[0] ?? null;
  }
  if (!intake || intake.schoolId !== school._id) return { schoolSlug: school.slug, availability: "unavailable", intake: null, programme: null, offering: null };
  const programme = await ctx.db.get(intake.programmeId);
  const products = await ctx.db.query("admissionsProducts").withIndex("by_intake_and_status", (q: any) => q.eq("intakeId", intake._id).eq("status", "active")).take(2);
  const product = products.length === 1 ? products[0] : null;
  const now = Date.now();
  const availability: PublicEntry["availability"] =
    !programme || programme.schoolId !== school._id || programme.status !== "published" || !product || product.schoolId !== school._id ? "unavailable"
      : intake.status === "paused" ? "paused"
      : intake.status === "closed" || intake.status === "archived" || intake.closesAt < now ? "closed"
      : intake.status !== "open" ? "unavailable"
      : intake.opensAt > now ? "upcoming" : "open";
  if (availability === "unavailable") return { schoolSlug: school.slug, availability, intake: null, programme: null, offering: null };
  if (availability === "closed" || availability === "paused") return { schoolSlug: school.slug, availability, intake: { slug: intake.slug, name: intake.name, cycleLabel: intake.cycleLabel, opensAt: intake.opensAt, closesAt: intake.closesAt }, programme: { slug: programme.slug, name: programme.name }, offering: null };
  const prices = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q: any) => q.eq("productId", product._id).eq("status", "published")).order("desc").take(50);
  const price = prices.find((candidate: any) => candidate.schoolId === school._id && candidate.effectiveFrom <= now && (!candidate.effectiveTo || candidate.effectiveTo > now));
  if (!price) return { schoolSlug: school.slug, availability: "unavailable", intake: null, programme: null, offering: null };
  const providerConfig: { provider: "paystack"; providerMode: "test" | "live" } | null = await ctx.runQuery(
    (internal as any).functions.admissions.payments.getConfiguredAdmissionsPaymentProviderInternal,
    { schoolId: school._id },
  );
  if (!providerConfig) return { schoolSlug: school.slug, availability: "unavailable", intake: null, programme: null, offering: null };
  return {
    schoolSlug: school.slug, availability,
    intake: { slug: intake.slug, name: intake.name, cycleLabel: intake.cycleLabel, opensAt: intake.opensAt, closesAt: intake.closesAt },
    programme: { slug: programme.slug, name: programme.name },
    offering: { slug: product.slug, name: product.name, amountMinor: price.amountMinor, currency: price.currency, feeDisclosure: price.feeDisclosure },
    school, intakeRecord: intake, product, price,
  };
}

/** Non-enumerating public entry point. It returns only published, current offering data. */
export const getEntry = query({
  args: { schoolSlug: v.string(), intakeSlug: v.optional(v.string()) },
  returns: publicEntryValidator,
  handler: async (ctx, args) => {
    const entry = await resolveEntry(ctx, args.schoolSlug, args.intakeSlug);
    return { schoolSlug: entry.schoolSlug, availability: entry.availability, intake: entry.intake, programme: entry.programme, offering: entry.offering };
  },
});

/** Published configuration is keyed by a public school/intake route, never a form ID. */
export const getPublishedConfiguration = query({
  args: { schoolSlug: v.string(), intakeSlug: v.optional(v.string()) },
  returns: v.object({
    availability: publicEntryValidator.fields.availability,
    fields: v.array(publicFieldValidator), requirements: v.array(publicRequirementValidator),
    declaration: v.union(v.null(), v.object({ version: v.number(), title: v.string(), body: v.string(), purpose: v.string() })),
  }),
  handler: async (ctx, args) => {
    const entry = await resolveEntry(ctx, args.schoolSlug, args.intakeSlug);
    if (entry.availability !== "open" || !entry.intakeRecord || !entry.programme) return { availability: entry.availability, fields: [], requirements: [], declaration: null };
    const forms = await ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q: any) => q.eq("intakeId", entry.intakeRecord._id).eq("status", "published")).take(2);
    const declarations = await ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q: any) => q.eq("programmeId", entry.intakeRecord.programmeId).eq("status", "published")).order("desc").take(100);
    if (forms.length !== 1 || declarations.length === 0) return { availability: "unavailable" as const, fields: [], requirements: [], declaration: null };
    const form = forms[0];
    const declaration = declarations.sort((left: any, right: any) => right.version - left.version)[0];
    const [fieldRows, requirementRows] = await Promise.all([
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q: any) => q.eq("formVersionId", form._id)).take(200),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q: any) => q.eq("formVersionId", form._id)).take(100),
    ]);
    return {
      availability: entry.availability,
      fields: fieldRows.filter((field: any) => field.status === "active").map((field: any) => ({ key: field.fieldKey, sectionKey: field.sectionKey, kind: field.kind, label: field.label, helpText: field.helpText ?? null, requiredMode: field.requiredMode, dataClass: field.dataClass, purpose: field.purpose ?? null, validation: field.validationJson, conditionalRule: field.conditionalRuleJson ?? null, order: field.order })),
      requirements: requirementRows.map((requirement: any) => ({ key: requirement.requirementKey, category: requirement.category, label: requirement.label, requiredMode: requirement.requiredMode, acceptedMimeTypes: requirement.acceptedMimeTypes, maxBytes: requirement.maxBytes, maxFiles: requirement.maxFiles, sensitivity: requirement.sensitivity, purpose: requirement.purpose, condition: requirement.conditionJson ?? null, order: requirement.order })),
      declaration: { version: declaration.version, title: declaration.title, body: declaration.body, purpose: declaration.purpose },
    };
  },
});

async function requireOwnedPublicApplication(ctx: any, args: { schoolSlug: string; publicReference: string }) {
  const { guardian } = await requireGuardian(ctx);
  const school = await ctx.db.query("schools").withIndex("by_slug", (q: any) => q.eq("slug", args.schoolSlug.trim())).unique();
  if (!school) throw new ConvexError("Not found or access denied");
  const application = await ctx.db.query("admissionsApplications").withIndex("by_school_and_public_id", (q: any) => q.eq("schoolId", school._id).eq("publicId", args.publicReference.trim())).unique();
  if (!application || application.guardianId !== guardian._id) throw new ConvexError("Not found or access denied");
  return { guardian, school, application };
}

/** Guardian workspace is school-slug scoped so an external application host never needs a school ID. */
export const getGuardianWorkspace = query({
  args: { schoolSlug: v.string(), limit: v.optional(v.number()) },
  returns: v.object({
    schoolName: v.string(),
    slots: v.array(v.object({ state: v.string(), publicReference: v.union(v.string(), v.null()), applicationState: v.union(v.string(), v.null()), updatedAt: v.number() })),
  }),
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    const school = await ctx.db.query("schools").withIndex("by_slug", (q: any) => q.eq("slug", args.schoolSlug.trim())).unique();
    if (!school || school.status !== "active") throw new ConvexError("Not found or access denied");
    const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
    const entitlements = await ctx.db.query("admissionsEntitlements")
      .withIndex("by_guardian_and_state_and_created_at", (q: any) => q.eq("guardianId", guardian._id)).order("desc").take(100);
    const slots = [];
    for (const entitlement of entitlements) {
      if (entitlement.schoolId !== school._id || slots.length >= limit) continue;
      const application = entitlement.applicationId ? await ctx.db.get(entitlement.applicationId) : null;
      slots.push({
        state: entitlement.state,
        publicReference: application?.publicId ?? null,
        applicationState: application?.state ?? null,
        updatedAt: application?.updatedAt ?? entitlement.updatedAt,
      });
    }
    return { schoolName: school.name, slots };
  },
});

export const getGuardianApplication = query({
  args: { schoolSlug: v.string(), publicReference: v.string() },
  returns: v.object({
    publicReference: v.string(), intakeSlug: v.string(), state: v.string(), revision: v.number(), draftVersion: v.number(), allowedActions: v.array(v.string()),
    profile: v.union(v.null(), v.object({ firstName: v.string(), lastName: v.string(), middleName: v.union(v.string(), v.null()), preferredName: v.union(v.string(), v.null()), dateOfBirth: v.number(), gender: v.union(v.string(), v.null()), nationality: v.union(v.string(), v.null()), countryOfBirth: v.union(v.string(), v.null()), address: v.union(v.string(), v.null()), requestedEntryLabel: v.union(v.string(), v.null()) })),
    answers: v.array(v.object({ fieldKey: v.string(), valueType: v.string(), serializedValue: v.string(), dataClass: v.string() })),
    messages: v.array(v.object({ eventType: v.string(), reasonCode: v.union(v.string(), v.null()), message: v.union(v.string(), v.null()), createdAt: v.number() })),
    conversionState: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedPublicApplication(ctx, args);
    const intake: any = await ctx.db.get(application.intakeId);
    const [profile, answers, events, conversion] = await Promise.all([
      ctx.db.query("admissionsApplicantProfiles").withIndex("by_application", (q: any) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("admissionsApplicationAnswers").withIndex("by_application_and_field_key", (q: any) => q.eq("applicationId", application._id)).take(200),
      ctx.db.query("admissionsReviewEvents").withIndex("by_application_and_created_at", (q: any) => q.eq("applicationId", application._id)).order("desc").take(100),
      application.conversionId ? ctx.db.get(application.conversionId) as Promise<any> : null,
    ]);
    if (!intake || intake.schoolId !== application.schoolId) throw new ConvexError("Not found or access denied");
    const editable = application.state === "draft" || application.state === "changes_requested";
    const allowedActions = editable ? ["save", "upload", "submit"] : application.state === "submitted" || application.state === "under_review" ? ["view_status"] : ["view_status"];
    return {
      publicReference: application.publicId, intakeSlug: intake.slug, state: application.state, revision: application.currentRevision, draftVersion: application.draftVersion, allowedActions,
      profile: profile ? { firstName: profile.firstName, lastName: profile.lastName, middleName: profile.middleName ?? null, preferredName: profile.preferredName ?? null, dateOfBirth: profile.dateOfBirth, gender: profile.gender ?? null, nationality: profile.nationality ?? null, countryOfBirth: profile.countryOfBirth ?? null, address: profile.address ?? null, requestedEntryLabel: application.requestedEntryLabel ?? null } : null,
      answers: answers.map((answer: any) => ({ fieldKey: answer.fieldKey, valueType: answer.valueType, serializedValue: answer.serializedValue, dataClass: answer.dataClass })),
      messages: events.filter((event: any) => event.visibility === "guardian").map((event: any) => ({ eventType: event.eventType, reasonCode: event.reasonCode ?? null, message: event.message ?? null, createdAt: event.createdAt })),
      conversionState: conversion?.state ?? null,
    };
  },
});

/** Creates/replays a purchase attempt from public slugs; the product and price are never client-selected IDs. */
export const createAttemptForOffering = mutation({
  args: { schoolSlug: v.string(), intakeSlug: v.optional(v.string()), idempotencyKey: v.string() },
  returns: v.object({ reference: v.string(), state: v.string(), amountMinor: v.number(), currency: v.string(), disclosure: v.string() }),
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    if (!guardian.emailVerifiedAt) throw new ConvexError("VERIFICATION_REQUIRED");
    const entry = await resolveEntry(ctx, args.schoolSlug, args.intakeSlug);
    if (entry.availability !== "open" || !entry.school || !entry.intakeRecord || !entry.product || !entry.price) throw new ConvexError("OFFERING_UNAVAILABLE");
    const key = args.idempotencyKey.trim(); if (!key || key.length > 128) throw new ConvexError("Invalid idempotency key");
    const existing = await ctx.db.query("admissionsPurchaseAttempts").withIndex("by_school_and_guardian_and_idempotency_key", (q: any) => q.eq("schoolId", entry.school._id).eq("guardianId", guardian._id).eq("idempotencyKey", key)).unique();
    if (existing) return { reference: existing.reference, state: existing.state, amountMinor: existing.amountMinor, currency: existing.currency, disclosure: existing.feeDisclosureSnapshot };
    const providerConfig: { provider: "paystack"; providerMode: "test" | "live" } | null = await ctx.runQuery(
      (internal as any).functions.admissions.payments.getConfiguredAdmissionsPaymentProviderInternal,
      { schoolId: entry.school._id },
    );
    if (!providerConfig) throw new ConvexError("OFFERING_UNAVAILABLE");
    const now = Date.now();
    const attemptId = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId: entry.school._id, guardianId: guardian._id, productId: entry.product._id, priceId: entry.price._id, provider: providerConfig.provider, providerMode: providerConfig.providerMode, reference: opaqueKey("adm_"), idempotencyKey: key, amountMinor: entry.price.amountMinor, currency: entry.price.currency, feeDisclosureSnapshot: entry.price.feeDisclosure, state: "created", createdAt: now, updatedAt: now });
    await audit({ ctx, schoolId: entry.school._id, actor: { kind: "guardian", guardianId: guardian._id }, action: "payment.attempt_created", entityType: "purchase_attempt", entityId: String(attemptId), outcome: "success" });
    const attempt = await ctx.db.get(attemptId);
    return { reference: attempt!.reference, state: "created", amountMinor: entry.price.amountMinor, currency: entry.price.currency, disclosure: entry.price.feeDisclosure };
  },
});

/** Reserves an owned slot for this public offering without exposing entitlement IDs. */
export const createOrResumeForOffering = mutation({
  args: { schoolSlug: v.string(), intakeSlug: v.optional(v.string()) },
  returns: v.object({ publicReference: v.string(), state: v.string(), draftVersion: v.number(), currentRevision: v.number() }),
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    const entry = await resolveEntry(ctx, args.schoolSlug, args.intakeSlug);
    if (!entry.school || !entry.intakeRecord || entry.availability === "unavailable") throw new ConvexError("OFFERING_UNAVAILABLE");
    const available = await ctx.db.query("admissionsEntitlements").withIndex("by_guardian_and_state_and_created_at", (q: any) => q.eq("guardianId", guardian._id).eq("state", "available")).order("asc").take(100);
    const reserved = await ctx.db.query("admissionsEntitlements").withIndex("by_guardian_and_state_and_created_at", (q: any) => q.eq("guardianId", guardian._id).eq("state", "reserved")).order("asc").take(100);
    const entitlement = [...reserved, ...available].find((candidate: any) => candidate.schoolId === entry.school._id && candidate.intakeId === entry.intakeRecord._id);
    if (!entitlement) throw new ConvexError("No application slot is available");
    const result: any = await ctx.runMutation((api as any).functions.admissions.applications.createOrResume, { entitlementId: entitlement._id });
    return { publicReference: result.publicId, state: result.state, draftVersion: result.draftVersion, currentRevision: result.currentRevision };
  },
});

async function requireOwnedAttemptReference(ctx: any, reference: string) {
  const { guardian } = await requireGuardian(ctx);
  const attempt = await ctx.db.query("admissionsPurchaseAttempts").withIndex("by_reference", (q: any) => q.eq("reference", reference.trim())).unique();
  if (!attempt || attempt.guardianId !== guardian._id) throw new ConvexError("Not found or access denied");
  return attempt;
}

const resolveOwnedAttemptReferenceInternal = internalQuery({
  args: { reference: v.string() },
  returns: v.union(v.null(), v.object({ attemptId: v.id("admissionsPurchaseAttempts") })),
  handler: async (ctx, args) => {
    try {
      const attempt = await requireOwnedAttemptReference(ctx, args.reference);
      return { attemptId: attempt._id };
    } catch {
      return null;
    }
  },
});

/** Provider handoff accepts the opaque payment reference; it never returns an internal attempt ID. */
export const initializeAttemptByReference = action({
  args: { reference: v.string() },
  returns: v.object({ state: v.string(), checkoutUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const handle: { attemptId: any } | null = await ctx.runQuery((internal as any).functions.admissions.public.resolveOwnedAttemptReferenceInternal, args);
    if (!handle) throw new ConvexError("Not found or access denied");
    return await ctx.runAction((api as any).functions.admissions.payments.initializeAttempt, { attemptId: handle.attemptId });
  },
});

export const verifyReturnByReference = action({
  args: { reference: v.string() },
  returns: v.object({ state: v.string(), entitlementAvailable: v.boolean() }),
  handler: async (ctx, args) => {
    const handle: { attemptId: any } | null = await ctx.runQuery((internal as any).functions.admissions.public.resolveOwnedAttemptReferenceInternal, args);
    if (!handle) throw new ConvexError("Not found or access denied");
    const result: any = await ctx.runAction((api as any).functions.admissions.payments.verifyReturn, { attemptId: handle.attemptId });
    return { state: result.state, entitlementAvailable: Boolean(result.entitlementId) };
  },
});

export const createUploadUrlByPublicReference = mutation({
  args: { schoolSlug: v.string(), publicReference: v.string(), requirementKey: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedPublicApplication(ctx, args);
    const requirement = await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q: any) => q.eq("formVersionId", application.formVersionId).eq("requirementKey", args.requirementKey.trim())).unique();
    if (!requirement) throw new ConvexError("Not found or access denied");
    return await ctx.runMutation((api as any).functions.admissions.documents.createUploadUrl, { applicationId: application._id, requirementId: requirement._id });
  },
});

export const bindUploadByPublicReference = mutation({
  args: { schoolSlug: v.string(), publicReference: v.string(), requirementKey: v.string(), storageId: v.id("_storage"), fileName: v.string() },
  returns: v.object({ state: v.literal("uploaded"), version: v.number() }),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedPublicApplication(ctx, args);
    const requirement = await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_requirement_key", (q: any) => q.eq("formVersionId", application.formVersionId).eq("requirementKey", args.requirementKey.trim())).unique();
    if (!requirement) throw new ConvexError("Not found or access denied");
    const result: any = await ctx.runMutation((api as any).functions.admissions.documents.bindUpload, { applicationId: application._id, requirementId: requirement._id, storageId: args.storageId, fileName: args.fileName });
    return { state: result.state, version: result.version };
  },
});

export const saveCoreByPublicReference = mutation({
  args: { schoolSlug: v.string(), publicReference: v.string(), expectedVersion: v.number(), firstName: v.string(), lastName: v.string(), dateOfBirth: v.number(), middleName: v.optional(v.string()), preferredName: v.optional(v.string()), gender: v.optional(v.string()), nationality: v.optional(v.string()), countryOfBirth: v.optional(v.string()), address: v.optional(v.string()), requestedEntryLabel: v.optional(v.string()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedPublicApplication(ctx, args);
    return await ctx.runMutation((api as any).functions.admissions.applications.saveCoreSection, { ...args, applicationId: application._id });
  },
});

export const saveAnswerByPublicReference = mutation({
  args: { schoolSlug: v.string(), publicReference: v.string(), fieldKey: v.string(), expectedVersion: v.number(), valueType: v.string(), serializedValue: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedPublicApplication(ctx, args);
    const field = await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_field_key", (q: any) => q.eq("formVersionId", application.formVersionId).eq("fieldKey", args.fieldKey.trim())).unique();
    if (!field || field.status !== "active") throw new ConvexError("Not found or access denied");
    return await ctx.runMutation((api as any).functions.admissions.applications.saveAnswer, { applicationId: application._id, formFieldId: field._id, expectedVersion: args.expectedVersion, valueType: args.valueType, serializedValue: args.serializedValue });
  },
});

export const submitByPublicReference = mutation({
  args: { schoolSlug: v.string(), publicReference: v.string(), expectedVersion: v.number(), signerName: v.string(), signerRelationship: v.string(), declarationVersion: v.number(), declarationAccepted: v.boolean() },
  returns: v.object({ revision: v.number(), state: v.literal("submitted") }),
  handler: async (ctx, args) => {
    const { application } = await requireOwnedPublicApplication(ctx, args);
    return await ctx.runMutation((api as any).functions.admissions.applications.submit, { applicationId: application._id, expectedVersion: args.expectedVersion, signerName: args.signerName, signerRelationship: args.signerRelationship, declarationVersion: args.declarationVersion, declarationAccepted: args.declarationAccepted });
  },
});
