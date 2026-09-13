import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { buildApplicationLinkV1 } from "@school/shared";
import { resolveEffectiveTheme } from "../academic/groupSettings";
import { admissionsDataClassValidator, applicationLinkV1Validator } from "../foundation/contracts";
import { configuredApplicationOrigin } from "../foundation/applicationLinks";
import {
  MAX_ADMISSIONS_DOCUMENT_BYTES,
  normalizeRequiredText,
  normalizeSlug,
  recordAdmissionsAudit,
  requireAdmissionsStaff,
  sha256Hex,
} from "./shared";
import {
  ADMISSIONS_FIELD_KINDS,
  isSensitiveDataClass,
  parseCondition,
  parseFieldValidation,
  type AdmissionsFieldKind,
} from "./validation";

const fieldInputValidator = v.object({
  fieldKey: v.string(),
  sectionKey: v.string(),
  kind: v.string(),
  label: v.string(),
  helpText: v.optional(v.string()),
  requiredMode: v.union(v.literal("required"), v.literal("optional"), v.literal("conditional")),
  dataClass: admissionsDataClassValidator,
  purpose: v.optional(v.string()),
  validationJson: v.string(),
  conditionalRuleJson: v.optional(v.string()),
  approvalEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
  order: v.number(),
});

const requirementInputValidator = v.object({
  requirementKey: v.string(),
  category: v.string(),
  label: v.string(),
  requiredMode: v.union(v.literal("required"), v.literal("optional"), v.literal("conditional")),
  acceptedMimeTypes: v.array(v.string()),
  maxBytes: v.number(),
  maxFiles: v.number(),
  sensitivity: admissionsDataClassValidator,
  purpose: v.string(),
  conditionJson: v.optional(v.string()),
  approvalEvidenceId: v.optional(v.id("schoolApprovalEvidence")),
  order: v.number(),
});

const campaignInput = {
  schoolId: v.id("schools"),
  programmeSlug: v.string(),
  programmeName: v.string(),
  programmeDescription: v.optional(v.string()),
  intakeSlug: v.string(),
  intakeName: v.string(),
  cycleLabel: v.string(),
  targetClassId: v.optional(v.id("classes")),
  opensAt: v.number(),
  closesAt: v.number(),
  startsAt: v.optional(v.number()),
  schemaVersion: v.string(),
  fields: v.array(fieldInputValidator),
  requirements: v.array(requirementInputValidator),
  declarationTitle: v.string(),
  declarationBody: v.string(),
  declarationPurpose: v.string(),
  productSlug: v.string(),
  productName: v.string(),
  amountMinor: v.number(),
  currency: v.string(),
  refundPolicyKey: v.string(),
  feeDisclosure: v.string(),
  effectiveFrom: v.number(),
  effectiveTo: v.optional(v.number()),
};

const campaignIdsValidator = v.object({
  programmeId: v.id("admissionsProgrammes"),
  intakeId: v.id("admissionsIntakes"),
  formVersionId: v.id("admissionsFormVersions"),
  declarationVersionId: v.id("admissionsDeclarationVersions"),
  productId: v.id("admissionsProducts"),
  priceId: v.id("admissionsProductPrices"),
});

const campaignDraftResultValidator = campaignIdsValidator.extend({ draftRevision: v.string() });

function draftRevision(formVersionId: Id<"admissionsFormVersions">, revision: number | undefined) {
  return `campaign-draft-v1:${formVersionId}:${revision ?? 1}`;
}

type FieldInput = {
  fieldKey: string;
  sectionKey: string;
  kind: string;
  label: string;
  helpText?: string;
  requiredMode: "required" | "optional" | "conditional";
  dataClass: "public" | "internal" | "personal" | "child_confidential" | "highly_sensitive" | "financial_security";
  purpose?: string;
  validationJson: string;
  conditionalRuleJson?: string;
  approvalEvidenceId?: Id<"schoolApprovalEvidence">;
  order: number;
};

type RequirementInput = {
  requirementKey: string;
  category: string;
  label: string;
  requiredMode: "required" | "optional" | "conditional";
  acceptedMimeTypes: string[];
  maxBytes: number;
  maxFiles: number;
  sensitivity: FieldInput["dataClass"];
  purpose: string;
  conditionJson?: string;
  approvalEvidenceId?: Id<"schoolApprovalEvidence">;
  order: number;
};

function validateCampaign(args: {
  opensAt: number;
  closesAt: number;
  amountMinor: number;
  currency: string;
  fields: FieldInput[];
  requirements: RequirementInput[];
}) {
  if (!Number.isSafeInteger(args.opensAt) || !Number.isSafeInteger(args.closesAt) || args.closesAt <= args.opensAt) {
    throw new ConvexError("Campaign dates must be increasing millisecond timestamps");
  }
  if (!Number.isSafeInteger(args.amountMinor) || args.amountMinor <= 0 || !/^[A-Z]{3}$/.test(args.currency)) {
    throw new ConvexError("Price requires positive minor units and an uppercase currency");
  }
  if (args.fields.length > 100 || args.requirements.length > 30) {
    throw new ConvexError("A form supports at most 100 fields and 30 document requirements");
  }
  if (new Set(args.fields.map((field) => field.fieldKey)).size !== args.fields.length) {
    throw new ConvexError("Form field keys must be unique");
  }
  if (new Set(args.requirements.map((item) => item.requirementKey)).size !== args.requirements.length) {
    throw new ConvexError("Document requirement keys must be unique");
  }
  for (const field of args.fields) {
    if (!ADMISSIONS_FIELD_KINDS.includes(field.kind as AdmissionsFieldKind)) throw new ConvexError("Form field kind is unsupported");
    parseFieldValidation(field.validationJson, field.kind as AdmissionsFieldKind);
    parseCondition(field.conditionalRuleJson);
    if (field.requiredMode === "conditional" && !field.conditionalRuleJson) throw new ConvexError("Conditional fields require a declarative condition");
    if (field.dataClass !== "public" && !field.purpose?.trim()) throw new ConvexError("Non-public fields require a purpose");
  }
  for (const requirement of args.requirements) {
    parseCondition(requirement.conditionJson);
    if (requirement.requiredMode === "conditional" && !requirement.conditionJson) throw new ConvexError("Conditional document requirements require a declarative condition");
    if (!Number.isSafeInteger(requirement.maxBytes) || requirement.maxBytes < 1 || requirement.maxBytes > MAX_ADMISSIONS_DOCUMENT_BYTES ||
        !Number.isSafeInteger(requirement.maxFiles) || requirement.maxFiles < 1 || requirement.maxFiles > 10 ||
        requirement.acceptedMimeTypes.length < 1 || requirement.acceptedMimeTypes.length > 10) {
      throw new ConvexError("Document requirements need bounded MIME, size, and file-count limits");
    }
  }
}

async function insertDefinitionRows(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  formVersionId: Id<"admissionsFormVersions">,
  fields: FieldInput[],
  requirements: RequirementInput[],
  now: number,
) {
  for (const field of fields) {
    await ctx.db.insert("admissionsFormFields", {
      schoolId,
      formVersionId,
      fieldKey: normalizeRequiredText(field.fieldKey, "Field key", 80),
      sectionKey: normalizeRequiredText(field.sectionKey, "Section key", 80),
      kind: normalizeRequiredText(field.kind, "Field kind", 40),
      label: normalizeRequiredText(field.label, "Field label", 160),
      ...(field.helpText ? { helpText: field.helpText.trim().slice(0, 500) } : {}),
      requiredMode: field.requiredMode,
      dataClass: field.dataClass,
      ...(field.purpose ? { purpose: field.purpose.trim().slice(0, 500) } : {}),
      validationJson: field.validationJson,
      ...(field.conditionalRuleJson ? { conditionalRuleJson: field.conditionalRuleJson } : {}),
      ...(field.approvalEvidenceId ? { approvalEvidenceId: field.approvalEvidenceId } : {}),
      order: field.order,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const requirement of requirements) {
    await ctx.db.insert("admissionsDocumentRequirements", {
      schoolId,
      formVersionId,
      requirementKey: normalizeRequiredText(requirement.requirementKey, "Requirement key", 80),
      category: normalizeRequiredText(requirement.category, "Document category", 80),
      label: normalizeRequiredText(requirement.label, "Requirement label", 160),
      requiredMode: requirement.requiredMode,
      acceptedMimeTypes: requirement.acceptedMimeTypes.map((item) => item.trim().toLowerCase()),
      maxBytes: requirement.maxBytes,
      maxFiles: requirement.maxFiles,
      sensitivity: requirement.sensitivity,
      purpose: normalizeRequiredText(requirement.purpose, "Document purpose", 500),
      ...(requirement.conditionJson ? { conditionJson: requirement.conditionJson } : {}),
      ...(requirement.approvalEvidenceId ? { approvalEvidenceId: requirement.approvalEvidenceId } : {}),
      order: requirement.order,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const createCampaignDraft = mutation({
  args: campaignInput,
  returns: campaignDraftResultValidator,
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    validateCampaign(args);
    const programmeSlug = normalizeSlug(args.programmeSlug, "Programme slug");
    const intakeSlug = normalizeSlug(args.intakeSlug, "Intake slug");
    const productSlug = normalizeSlug(args.productSlug, "Product slug");
    const duplicateProgramme = await ctx.db.query("admissionsProgrammes")
      .withIndex("by_school_and_slug", (q) => q.eq("schoolId", args.schoolId).eq("slug", programmeSlug)).unique();
    if (duplicateProgramme) throw new ConvexError("Programme slug is already in use");
    const now = Date.now();
    const programmeId = await ctx.db.insert("admissionsProgrammes", {
      schoolId: args.schoolId,
      slug: programmeSlug,
      name: normalizeRequiredText(args.programmeName, "Programme name", 160),
      ...(args.programmeDescription ? { description: args.programmeDescription.trim().slice(0, 1000) } : {}),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    if (args.targetClassId) {
      const targetClass = await ctx.db.get(args.targetClassId);
      if (!targetClass || targetClass.schoolId !== args.schoolId || targetClass.isArchived) {
        throw new ConvexError("Target class is not available in this school");
      }
    }
    const intakeId = await ctx.db.insert("admissionsIntakes", {
      schoolId: args.schoolId,
      programmeId,
      slug: intakeSlug,
      name: normalizeRequiredText(args.intakeName, "Intake name", 160),
      cycleLabel: normalizeRequiredText(args.cycleLabel, "Cycle label", 120),
      ...(args.targetClassId ? { targetClassId: args.targetClassId } : {}),
      opensAt: args.opensAt,
      closesAt: args.closesAt,
      ...(args.startsAt ? { startsAt: args.startsAt } : {}),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const formVersionId = await ctx.db.insert("admissionsFormVersions", {
      schoolId: args.schoolId,
      programmeId,
      intakeId,
      version: 1,
      schemaVersion: normalizeRequiredText(args.schemaVersion, "Schema version", 40),
      draftRevision: 1,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await insertDefinitionRows(ctx, args.schoolId, formVersionId, args.fields, args.requirements, now);
    const declarationVersionId = await ctx.db.insert("admissionsDeclarationVersions", {
      schoolId: args.schoolId,
      programmeId,
      version: 1,
      title: normalizeRequiredText(args.declarationTitle, "Declaration title", 200),
      body: normalizeRequiredText(args.declarationBody, "Declaration body", 20_000),
      bodyDigest: await sha256Hex(args.declarationBody.trim()),
      purpose: normalizeRequiredText(args.declarationPurpose, "Declaration purpose", 500),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const productId = await ctx.db.insert("admissionsProducts", {
      schoolId: args.schoolId,
      intakeId,
      slug: productSlug,
      name: normalizeRequiredText(args.productName, "Product name", 160),
      slotCount: 1,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const priceId = await ctx.db.insert("admissionsProductPrices", {
      schoolId: args.schoolId,
      productId,
      version: 1,
      amountMinor: args.amountMinor,
      currency: args.currency,
      refundPolicyKey: normalizeRequiredText(args.refundPolicyKey, "Refund policy", 100),
      feeDisclosure: normalizeRequiredText(args.feeDisclosure, "Fee disclosure", 1000),
      effectiveFrom: args.effectiveFrom,
      ...(args.effectiveTo ? { effectiveTo: args.effectiveTo } : {}),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await recordAdmissionsAudit(ctx, {
      schoolId: args.schoolId,
      actorKind: "staff",
      actorUserId: actor.userId,
      action: "campaign.create_draft",
      entityType: "admissionsIntake",
      entityId: intakeId,
    });
    return { programmeId, intakeId, formVersionId, declarationVersionId, productId, priceId, draftRevision: draftRevision(formVersionId, 1) };
  },
});

async function assertPublicationApproval(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  evidenceId: Id<"schoolApprovalEvidence"> | undefined,
  subjectType: "admissions_form_field" | "admissions_document_requirement",
  subjectKey: string,
  now: number,
) {
  if (!evidenceId) throw new ConvexError("Required or sensitive publication needs explicit approval evidence");
  const evidence = await ctx.db.get(evidenceId);
  if (!evidence || evidence.schoolId !== schoolId || evidence.revokedAt !== undefined || evidence.approvedAt > now ||
      (evidence.expiresAt !== undefined && evidence.expiresAt <= now) || evidence.subjectType !== subjectType || evidence.subjectKey !== subjectKey ||
      !["sensitive_public", "identity", "privacy", "finance"].includes(evidence.approvalClass)) {
    throw new ConvexError("Publication approval evidence is not current and subject-bound");
  }
}

export const editCampaignDraft = mutation({
  args: { ...campaignIdsValidator.fields, ...campaignInput, expectedDraftRevision: v.string() },
  returns: campaignDraftResultValidator,
  handler: async (ctx, args) => {
    const [programme, intake, form, declaration, product, price] = await Promise.all([
      ctx.db.get(args.programmeId), ctx.db.get(args.intakeId), ctx.db.get(args.formVersionId),
      ctx.db.get(args.declarationVersionId), ctx.db.get(args.productId), ctx.db.get(args.priceId),
    ]);
    if (!programme || !intake || !form || !declaration || !product || !price ||
        [programme, intake, form, declaration, product, price].some((row) => row.schoolId !== args.schoolId) ||
        form.status !== "draft" || declaration.status !== "draft" || price.status !== "draft") {
      throw new ConvexError("Editable campaign draft was not found");
    }
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    validateCampaign(args);
    const currentRevision = draftRevision(form._id, form.draftRevision);
    if (args.expectedDraftRevision !== currentRevision) {
      throw new ConvexError("CAMPAIGN_DRAFT_CONFLICT: This draft changed on the server. Reload all campaign values before saving again.");
    }
    const now = Date.now();
    const oldFields = await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(101);
    const oldRequirements = await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(31);
    if (oldFields.length > 100 || oldRequirements.length > 30) throw new ConvexError("Campaign draft exceeds editable bounds");
    for (const row of oldFields) await ctx.db.delete(row._id);
    for (const row of oldRequirements) await ctx.db.delete(row._id);
    await insertDefinitionRows(ctx, args.schoolId, form._id, args.fields, args.requirements, now);
    await ctx.db.patch(programme._id, { name: normalizeRequiredText(args.programmeName, "Programme name", 160), description: args.programmeDescription?.trim() || undefined, updatedAt: now });
    await ctx.db.patch(intake._id, { name: normalizeRequiredText(args.intakeName, "Intake name", 160), cycleLabel: normalizeRequiredText(args.cycleLabel, "Cycle label", 120), opensAt: args.opensAt, closesAt: args.closesAt, startsAt: args.startsAt, targetClassId: args.targetClassId, updatedAt: now });
    const nextDraftRevision = (form.draftRevision ?? 1) + 1;
    await ctx.db.patch(form._id, { schemaVersion: normalizeRequiredText(args.schemaVersion, "Schema version", 40), draftRevision: nextDraftRevision, updatedAt: now });
    await ctx.db.patch(declaration._id, { title: normalizeRequiredText(args.declarationTitle, "Declaration title", 200), body: normalizeRequiredText(args.declarationBody, "Declaration body", 20_000), bodyDigest: await sha256Hex(args.declarationBody.trim()), purpose: normalizeRequiredText(args.declarationPurpose, "Declaration purpose", 500), updatedAt: now });
    await ctx.db.patch(product._id, { name: normalizeRequiredText(args.productName, "Product name", 160), updatedAt: now });
    await ctx.db.patch(price._id, { amountMinor: args.amountMinor, currency: args.currency, refundPolicyKey: normalizeRequiredText(args.refundPolicyKey, "Refund policy", 100), feeDisclosure: normalizeRequiredText(args.feeDisclosure, "Fee disclosure", 1000), effectiveFrom: args.effectiveFrom, effectiveTo: args.effectiveTo, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "campaign.edit_draft", entityType: "admissionsIntake", entityId: intake._id });
    return { programmeId: programme._id, intakeId: intake._id, formVersionId: form._id, declarationVersionId: declaration._id, productId: product._id, priceId: price._id, draftRevision: draftRevision(form._id, nextDraftRevision) };
  },
});

export const createReplacementDraft = mutation({
  args: {
    schoolId: v.id("schools"), programmeId: v.id("admissionsProgrammes"), intakeId: v.id("admissionsIntakes"), productId: v.id("admissionsProducts"),
    schemaVersion: v.string(), fields: v.array(fieldInputValidator), requirements: v.array(requirementInputValidator),
    declarationTitle: v.string(), declarationBody: v.string(), declarationPurpose: v.string(),
    amountMinor: v.number(), currency: v.string(), refundPolicyKey: v.string(), feeDisclosure: v.string(), effectiveFrom: v.number(), effectiveTo: v.optional(v.number()),
  },
  returns: campaignDraftResultValidator,
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    const [programme, intake, product] = await Promise.all([ctx.db.get(args.programmeId), ctx.db.get(args.intakeId), ctx.db.get(args.productId)]);
    if (!programme || !intake || !product || programme.schoolId !== args.schoolId || intake.schoolId !== args.schoolId || product.schoolId !== args.schoolId || intake.programmeId !== programme._id || product.intakeId !== intake._id || programme.status !== "published") throw new ConvexError("Published campaign was not found");
    validateCampaign({ opensAt: intake.opensAt, closesAt: intake.closesAt, amountMinor: args.amountMinor, currency: args.currency, fields: args.fields, requirements: args.requirements });
    const existingDrafts = await ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "draft")).take(1);
    if (existingDrafts.length) throw new ConvexError("A replacement draft already exists for this campaign");
    const [forms, declarations, prices] = await Promise.all([
      ctx.db.query("admissionsFormVersions").withIndex("by_school_and_programme", (q) => q.eq("schoolId", args.schoolId).eq("programmeId", programme._id)).take(100),
      ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", programme._id)).take(100),
      ctx.db.query("admissionsProductPrices").withIndex("by_product_and_version", (q) => q.eq("productId", product._id)).take(100),
    ]);
    const now = Date.now();
    const formVersionId = await ctx.db.insert("admissionsFormVersions", { schoolId: args.schoolId, programmeId: programme._id, intakeId: intake._id, version: Math.max(0, ...forms.map((row) => row.version)) + 1, schemaVersion: normalizeRequiredText(args.schemaVersion, "Schema version", 40), draftRevision: 1, status: "draft", createdAt: now, updatedAt: now });
    await insertDefinitionRows(ctx, args.schoolId, formVersionId, args.fields, args.requirements, now);
    const declarationVersionId = await ctx.db.insert("admissionsDeclarationVersions", { schoolId: args.schoolId, programmeId: programme._id, version: Math.max(0, ...declarations.map((row) => row.version)) + 1, title: normalizeRequiredText(args.declarationTitle, "Declaration title", 200), body: normalizeRequiredText(args.declarationBody, "Declaration body", 20_000), bodyDigest: await sha256Hex(args.declarationBody.trim()), purpose: normalizeRequiredText(args.declarationPurpose, "Declaration purpose", 500), status: "draft", createdAt: now, updatedAt: now });
    const priceId = await ctx.db.insert("admissionsProductPrices", { schoolId: args.schoolId, productId: product._id, version: Math.max(0, ...prices.map((row) => row.version)) + 1, amountMinor: args.amountMinor, currency: args.currency, refundPolicyKey: normalizeRequiredText(args.refundPolicyKey, "Refund policy", 100), feeDisclosure: normalizeRequiredText(args.feeDisclosure, "Fee disclosure", 1000), effectiveFrom: args.effectiveFrom, ...(args.effectiveTo ? { effectiveTo: args.effectiveTo } : {}), status: "draft", createdAt: now, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "campaign.create_replacement", entityType: "admissionsIntake", entityId: intake._id });
    return { programmeId: programme._id, intakeId: intake._id, formVersionId, declarationVersionId, productId: product._id, priceId, draftRevision: draftRevision(formVersionId, 1) };
  },
});

export const publishCampaign = mutation({
  args: { ...campaignIdsValidator.fields, draftRevision: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [programme, intake, form, declaration, product, price] = await Promise.all([
      ctx.db.get(args.programmeId), ctx.db.get(args.intakeId), ctx.db.get(args.formVersionId), ctx.db.get(args.declarationVersionId), ctx.db.get(args.productId), ctx.db.get(args.priceId),
    ]);
    if (!programme || !intake || !form || !declaration || !product || !price) throw new ConvexError("Campaign draft is incomplete");
    const schoolId = programme.schoolId;
    const actor = await requireAdmissionsStaff(ctx, schoolId, ["enrollment.intakes.manage"]);
    if ([intake.schoolId, form.schoolId, declaration.schoolId, product.schoolId, price.schoolId].some((id) => id !== schoolId) || intake.programmeId !== programme._id || form.programmeId !== programme._id || form.intakeId !== intake._id || declaration.programmeId !== programme._id || product.intakeId !== intake._id || price.productId !== product._id) throw new ConvexError("Campaign records do not share one school and lifecycle");
    if (form.status !== "draft" || declaration.status !== "draft" || price.status !== "draft" || !["draft", "published"].includes(programme.status) || !["draft", "open", "paused", "closed"].includes(intake.status) || !["draft", "active", "paused"].includes(product.status)) throw new ConvexError("Only complete draft versions can be published");
    const [fields, requirements] = await Promise.all([
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(101),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(31),
    ]);
    if (fields.length > 100 || requirements.length > 30 || price.amountMinor <= 0) throw new ConvexError("Campaign publication validation failed");
    const now = Date.now();
    for (const field of fields) {
      if (!ADMISSIONS_FIELD_KINDS.includes(field.kind as AdmissionsFieldKind)) throw new ConvexError("Form field kind is unsupported");
      parseFieldValidation(field.validationJson, field.kind as AdmissionsFieldKind);
      parseCondition(field.conditionalRuleJson);
      if (field.dataClass !== "public" && !field.purpose?.trim()) throw new ConvexError("Non-public fields require a purpose");
      if (isSensitiveDataClass(field.dataClass)) await assertPublicationApproval(ctx, schoolId, field.approvalEvidenceId, "admissions_form_field", `${String(form._id)}:${field.fieldKey}`, now);
    }
    for (const requirement of requirements) {
      parseCondition(requirement.conditionJson);
      if (!requirement.purpose.trim()) throw new ConvexError("Document requirements require a purpose");
      if (requirement.requiredMode !== "optional" || isSensitiveDataClass(requirement.sensitivity)) await assertPublicationApproval(ctx, schoolId, requirement.approvalEvidenceId, "admissions_document_requirement", `${String(form._id)}:${requirement.requirementKey}`, now);
    }
    const [publishedForms, publishedDeclarations, publishedPrices] = await Promise.all([
      ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "published")).take(10),
      ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", programme._id).eq("status", "published")).take(10),
      ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q) => q.eq("productId", product._id).eq("status", "published")).take(10),
    ]);
    for (const row of publishedForms) await ctx.db.patch(row._id, { status: "retired", updatedAt: now });
    for (const row of publishedDeclarations) await ctx.db.patch(row._id, { status: "retired", updatedAt: now });
    for (const row of publishedPrices) await ctx.db.patch(row._id, { status: "retired", effectiveTo: Math.min(row.effectiveTo ?? now, now), updatedAt: now });
    await ctx.db.patch(programme._id, { status: "published", updatedAt: now });
    await ctx.db.patch(intake._id, { status: "open", updatedAt: now });
    await ctx.db.patch(form._id, { status: "published", publishedAt: now, publishedBy: actor.userId, updatedAt: now });
    await ctx.db.patch(declaration._id, { status: "published", publishedAt: now, publishedBy: actor.userId, updatedAt: now });
    await ctx.db.patch(product._id, { status: "active", updatedAt: now });
    await ctx.db.patch(price._id, { status: "published", updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId, actorKind: "staff", actorUserId: actor.userId, action: "campaign.publish", entityType: "admissionsIntake", entityId: intake._id });
    return null;
  },
});

export const closeCampaign = mutation({
  args: { schoolId: v.id("schools"), intakeId: v.id("admissionsIntakes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    const intake = await ctx.db.get(args.intakeId);
    if (!intake || intake.schoolId !== args.schoolId) throw new ConvexError("Campaign not found");
    const products = await ctx.db.query("admissionsProducts").withIndex("by_school_and_intake", (q) => q.eq("schoolId", args.schoolId).eq("intakeId", intake._id)).take(31);
    if (products.length > 30) throw new ConvexError("Campaign product set exceeds the supported bound");
    const now = Date.now();
    await ctx.db.patch(intake._id, { status: "closed", updatedAt: now });
    for (const product of products) if (product.status === "active") await ctx.db.patch(product._id, { status: "paused", updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "campaign.close", entityType: "admissionsIntake", entityId: intake._id });
    return null;
  },
});

const offeringValidator = v.union(v.object({ available: v.literal(false), link: applicationLinkV1Validator }), v.object({
  available: v.literal(true),
  link: applicationLinkV1Validator,
  school: v.object({ slug: v.string(), name: v.string() }),
  programme: v.object({ slug: v.string(), name: v.string(), description: v.union(v.string(), v.null()) }),
  intake: v.object({ slug: v.string(), name: v.string(), cycleLabel: v.string(), opensAt: v.number(), closesAt: v.number(), startsAt: v.union(v.number(), v.null()) }),
  product: v.object({ slug: v.string(), name: v.string() }),
  price: v.object({ amountMinor: v.number(), currency: v.string(), feeDisclosure: v.string(), refundPolicyKey: v.string() }),
  form: v.object({ schemaVersion: v.string(), fields: v.array(v.object({ fieldKey: v.string(), sectionKey: v.string(), kind: v.string(), label: v.string(), helpText: v.union(v.string(), v.null()), requiredMode: v.string(), dataClass: v.string(), purpose: v.union(v.string(), v.null()), validationJson: v.string(), conditionalRuleJson: v.union(v.string(), v.null()), order: v.number() })), requirements: v.array(v.object({ requirementKey: v.string(), category: v.string(), label: v.string(), requiredMode: v.string(), acceptedMimeTypes: v.array(v.string()), maxBytes: v.number(), maxFiles: v.number(), sensitivity: v.string(), purpose: v.string(), conditionJson: v.union(v.string(), v.null()), order: v.number() })) }),
  declaration: v.object({ title: v.string(), body: v.string(), purpose: v.string(), version: v.number() }),
}));

const campaignBundleValidator = v.object({
  programmeId: v.id("admissionsProgrammes"), intakeId: v.id("admissionsIntakes"), formVersionId: v.id("admissionsFormVersions"), declarationVersionId: v.id("admissionsDeclarationVersions"), productId: v.id("admissionsProducts"), priceId: v.id("admissionsProductPrices"),
  lifecycle: v.union(v.literal("draft"), v.literal("published")), draftRevision: v.string(), applicationLink: applicationLinkV1Validator, programmeSlug: v.string(), programmeName: v.string(), programmeDescription: v.union(v.string(), v.null()), intakeSlug: v.string(), intakeName: v.string(), cycleLabel: v.string(), opensAt: v.number(), closesAt: v.number(), startsAt: v.union(v.number(), v.null()), schemaVersion: v.string(), formVersion: v.number(), declarationTitle: v.string(), declarationBody: v.string(), declarationPurpose: v.string(), productSlug: v.string(), productName: v.string(), amountMinor: v.number(), currency: v.string(), refundPolicyKey: v.string(), feeDisclosure: v.string(), effectiveFrom: v.number(), effectiveTo: v.union(v.number(), v.null()), fields: v.array(fieldInputValidator), requirements: v.array(requirementInputValidator),
});

/** Staff campaign read model. It deliberately returns only immutable version bundles that can be edited or replaced. */
export const listCampaigns = query({
  args: { schoolId: v.id("schools"), now: v.number() },
  returns: v.array(campaignBundleValidator),
  handler: async (ctx, args) => {
    await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage"]);
    if (!Number.isSafeInteger(args.now) || args.now < 0) throw new ConvexError("Current time must be a millisecond timestamp");
    const [school, programmes] = await Promise.all([
      ctx.db.get(args.schoolId),
      ctx.db.query("admissionsProgrammes").withIndex("by_school_and_status", (q) => q.eq("schoolId", args.schoolId)).take(51),
    ]);
    if (!school) throw new ConvexError("Campaign school is unavailable");
    if (programmes.length > 50) throw new ConvexError("Campaign catalogue exceeds the supported bound");
    const result = [];
    for (const programme of programmes) {
      const intakes = (await ctx.db.query("admissionsIntakes").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(51)).filter((row) => row.programmeId === programme._id);
      if (intakes.length > 10) throw new ConvexError("Campaign intake set exceeds the supported bound");
      for (const intake of intakes) {
        const products = await ctx.db.query("admissionsProducts").withIndex("by_school_and_intake", (q) => q.eq("schoolId", args.schoolId).eq("intakeId", intake._id)).take(2);
        if (products.length !== 1) continue;
        const product = products[0];
        const [forms, declarations, prices] = await Promise.all([
          ctx.db.query("admissionsFormVersions").withIndex("by_school_and_programme", (q) => q.eq("schoolId", args.schoolId).eq("programmeId", programme._id)).take(21),
          ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", programme._id)).take(21),
          ctx.db.query("admissionsProductPrices").withIndex("by_product_and_version", (q) => q.eq("productId", product._id)).take(21),
        ]);
        if (forms.length > 20 || declarations.length > 20 || prices.length > 20) throw new ConvexError("Campaign version set exceeds the supported bound");
        for (const lifecycle of ["published", "draft"] as const) {
          const form = forms.filter((row) => row.intakeId === intake._id && row.status === lifecycle).sort((a, b) => b.version - a.version)[0];
          const declaration = declarations.filter((row) => row.status === lifecycle).sort((a, b) => b.version - a.version)[0];
          const price = prices.filter((row) => row.status === lifecycle).sort((a, b) => b.version - a.version)[0];
          if (!form || !declaration || !price) continue;
          const [fields, requirements] = await Promise.all([
            ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(101),
            ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(31),
          ]);
          if (fields.length > 100 || requirements.length > 30) throw new ConvexError("Campaign definition exceeds the supported bound");
          const availability = lifecycle !== "published" ? "unavailable" as const : intake.status === "paused" ? "paused" as const : intake.status === "closed" || intake.status === "archived" || args.now > intake.closesAt ? "closed" as const : intake.status === "open" && args.now < intake.opensAt ? "upcoming" as const : intake.status === "open" ? "open" as const : "unavailable" as const;
          result.push({ programmeId: programme._id, intakeId: intake._id, formVersionId: form._id, declarationVersionId: declaration._id, productId: product._id, priceId: price._id, lifecycle, draftRevision: draftRevision(form._id, form.draftRevision), applicationLink: buildApplicationLinkV1({ applicationOrigin: configuredApplicationOrigin(), schoolSlug: school.slug, intakeSlug: intake.slug, availability, opensAt: intake.opensAt, closesAt: intake.closesAt }), programmeSlug: programme.slug, programmeName: programme.name, programmeDescription: programme.description ?? null, intakeSlug: intake.slug, intakeName: intake.name, cycleLabel: intake.cycleLabel, opensAt: intake.opensAt, closesAt: intake.closesAt, startsAt: intake.startsAt ?? null, schemaVersion: form.schemaVersion, formVersion: form.version, declarationTitle: declaration.title, declarationBody: declaration.body, declarationPurpose: declaration.purpose, productSlug: product.slug, productName: product.name, amountMinor: price.amountMinor, currency: price.currency, refundPolicyKey: price.refundPolicyKey, feeDisclosure: price.feeDisclosure, effectiveFrom: price.effectiveFrom, effectiveTo: price.effectiveTo ?? null, fields: fields.map((field) => ({ fieldKey: field.fieldKey, sectionKey: field.sectionKey, kind: field.kind, label: field.label, ...(field.helpText ? { helpText: field.helpText } : {}), requiredMode: field.requiredMode, dataClass: field.dataClass, ...(field.purpose ? { purpose: field.purpose } : {}), validationJson: field.validationJson, ...(field.conditionalRuleJson ? { conditionalRuleJson: field.conditionalRuleJson } : {}), ...(field.approvalEvidenceId ? { approvalEvidenceId: field.approvalEvidenceId } : {}), order: field.order })), requirements: requirements.map((item) => ({ requirementKey: item.requirementKey, category: item.category, label: item.label, requiredMode: item.requiredMode, acceptedMimeTypes: item.acceptedMimeTypes, maxBytes: item.maxBytes, maxFiles: item.maxFiles, sensitivity: item.sensitivity, purpose: item.purpose, ...(item.conditionJson ? { conditionJson: item.conditionJson } : {}), ...(item.approvalEvidenceId ? { approvalEvidenceId: item.approvalEvidenceId } : {}), order: item.order })) });
        }
      }
    }
    return result;
  },
});

const offeringSummaryValidator = v.object({ intakeSlug: v.string(), intakeName: v.string(), cycleLabel: v.string(), availability: v.union(v.literal("open"), v.literal("upcoming"), v.literal("paused"), v.literal("closed"), v.literal("unavailable")), opensAt: v.number(), closesAt: v.number(), programmeName: v.union(v.string(), v.null()), productSlug: v.union(v.string(), v.null()), productName: v.union(v.string(), v.null()), amountMinor: v.union(v.number(), v.null()), currency: v.union(v.string(), v.null()), feeDisclosure: v.union(v.string(), v.null()), refundPolicyKey: v.union(v.string(), v.null()) });

/** Anonymous school landing read model. Price data comes exclusively from currently published effective versions. */
export const listPublishedOfferings = query({
  args: { schoolSlug: v.string(), now: v.number() },
  returns: v.union(v.object({ available: v.literal(false) }), v.object({ available: v.literal(true), school: v.object({ schoolId: v.id("schools"), slug: v.string(), name: v.string(), primaryColor: v.string(), accentColor: v.string() }), offerings: v.array(offeringSummaryValidator) })),
  handler: async (ctx, args) => {
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.schoolSlug, "School slug"))).unique();
    if (!school || school.status !== "active" || school.features?.admissions !== true) return { available: false as const };
    const theme = await resolveEffectiveTheme(ctx, school);
    const intakes = await ctx.db.query("admissionsIntakes").withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(51);
    if (intakes.length > 50) throw new ConvexError("Admissions offering set exceeds the supported bound");
    const offerings = [];
    for (const intake of intakes) {
      const availability = intake.status === "paused" ? "paused" as const : intake.status === "closed" || intake.status === "archived" || args.now > intake.closesAt ? "closed" as const : intake.status === "open" && args.now < intake.opensAt ? "upcoming" as const : intake.status === "open" ? "open" as const : "unavailable" as const;
      let programmeName: string | null = null, productSlug: string | null = null, productName: string | null = null, amountMinor: number | null = null, currency: string | null = null, feeDisclosure: string | null = null, refundPolicyKey: string | null = null;
      const programme = await ctx.db.get(intake.programmeId);
      if (!programme || programme.status !== "published" || intake.status === "draft") continue;
      const products = await ctx.db.query("admissionsProducts").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "active")).take(2);
      programmeName = programme.name;
      if (products.length === 1) {
        const product = products[0]; productSlug = product.slug; productName = product.name;
        const prices = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q) => q.eq("productId", product._id).eq("status", "published")).order("desc").take(10);
        const price = prices.find((row) => row.effectiveFrom <= args.now && (row.effectiveTo === undefined || row.effectiveTo >= args.now));
        if (price) { amountMinor = price.amountMinor; currency = price.currency; feeDisclosure = price.feeDisclosure; refundPolicyKey = price.refundPolicyKey; }
      }
      offerings.push({ intakeSlug: intake.slug, intakeName: intake.name, cycleLabel: intake.cycleLabel, availability, opensAt: intake.opensAt, closesAt: intake.closesAt, programmeName, productSlug, productName, amountMinor, currency, feeDisclosure, refundPolicyKey });
    }
    return { available: true as const, school: { schoolId: school._id, slug: school.slug, name: school.name, primaryColor: theme.theme.primaryColor, accentColor: theme.theme.accentColor }, offerings };
  },
});

export const getPublishedOffering = query({
  args: { schoolSlug: v.string(), intakeSlug: v.string(), now: v.number() },
  returns: offeringValidator,
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.now) || args.now < 0) throw new ConvexError("Current time must be a millisecond timestamp");
    const requestedSchoolSlug = normalizeSlug(args.schoolSlug, "School slug");
    const requestedIntakeSlug = normalizeSlug(args.intakeSlug, "Intake slug");
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", requestedSchoolSlug)).unique();
    const intake = school ? await ctx.db.query("admissionsIntakes").withIndex("by_school_and_slug", (q) => q.eq("schoolId", school._id).eq("slug", requestedIntakeSlug)).unique() : null;
    const availability = !school || school.status !== "active" || school.features?.admissions !== true || !intake
      ? "unavailable" as const
      : intake.status === "paused"
        ? "paused" as const
        : intake.status === "closed" || intake.status === "archived" || args.now > intake.closesAt
          ? "closed" as const
          : intake.status === "open" && args.now < intake.opensAt
            ? "upcoming" as const
            : intake.status === "open"
              ? "open" as const
              : "unavailable" as const;
    const link = buildApplicationLinkV1({ applicationOrigin: configuredApplicationOrigin(), schoolSlug: school?.slug ?? requestedSchoolSlug, intakeSlug: intake?.slug ?? requestedIntakeSlug, availability, opensAt: intake?.opensAt ?? null, closesAt: intake?.closesAt ?? null });
    if (!school || !intake || availability !== "open") return { available: false as const, link };
    const now = args.now;
    const programme = await ctx.db.get(intake.programmeId);
    const products = await ctx.db.query("admissionsProducts").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "active")).take(2);
    const forms = await ctx.db.query("admissionsFormVersions").withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake._id).eq("status", "published")).take(2);
    if (!programme || programme.schoolId !== school._id || programme.status !== "published" || products.length !== 1 || forms.length !== 1) return { available: false as const, link: { ...link, availability: "unavailable" as const } };
    const product = products[0];
    const form = forms[0];
    const prices = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q) => q.eq("productId", product._id).eq("status", "published")).order("desc").take(10);
    const price = prices.find((item) => item.effectiveFrom <= now && (item.effectiveTo === undefined || item.effectiveTo >= now));
    const declarations = await ctx.db.query("admissionsDeclarationVersions").withIndex("by_programme_and_status", (q) => q.eq("programmeId", programme._id).eq("status", "published")).order("desc").take(2);
    if (!price || price.amountMinor <= 0 || declarations.length !== 1) return { available: false as const, link: { ...link, availability: "unavailable" as const } };
    const [fields, requirements] = await Promise.all([
      ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(101),
      ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", form._id)).take(31),
    ]);
    if (fields.length > 100 || requirements.length > 30) return { available: false as const, link: { ...link, availability: "unavailable" as const } };
    const declaration = declarations[0];
    return {
      available: true as const,
      link,
      school: { slug: school.slug, name: school.name },
      programme: { slug: programme.slug, name: programme.name, description: programme.description ?? null },
      intake: { slug: intake.slug, name: intake.name, cycleLabel: intake.cycleLabel, opensAt: intake.opensAt, closesAt: intake.closesAt, startsAt: intake.startsAt ?? null },
      product: { slug: product.slug, name: product.name },
      price: { amountMinor: price.amountMinor, currency: price.currency, feeDisclosure: price.feeDisclosure, refundPolicyKey: price.refundPolicyKey },
      form: {
        schemaVersion: form.schemaVersion,
        fields: fields.filter((field) => field.status === "active").map((field) => ({ fieldKey: field.fieldKey, sectionKey: field.sectionKey, kind: field.kind, label: field.label, helpText: field.helpText ?? null, requiredMode: field.requiredMode, dataClass: field.dataClass, purpose: field.purpose ?? null, validationJson: field.validationJson, conditionalRuleJson: field.conditionalRuleJson ?? null, order: field.order })),
        requirements: requirements.map((item) => ({ requirementKey: item.requirementKey, category: item.category, label: item.label, requiredMode: item.requiredMode, acceptedMimeTypes: item.acceptedMimeTypes, maxBytes: item.maxBytes, maxFiles: item.maxFiles, sensitivity: item.sensitivity, purpose: item.purpose, conditionJson: item.conditionJson ?? null, order: item.order })),
      },
      declaration: { title: declaration.title, body: declaration.body, purpose: declaration.purpose, version: declaration.version },
    };
  },
});
