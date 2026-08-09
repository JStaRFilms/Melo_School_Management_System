/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import type { Id } from "./_generated/dataModel";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const editor = { subject: "campaign-editor", tokenIdentifier: "issuer|campaign-editor", issuer: "issuer" };
const otherEditor = { subject: "campaign-editor-2", tokenIdentifier: "issuer|campaign-editor-2", issuer: "issuer" };

async function fixture(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Campaign School", slug: "campaign-school", status: "active", createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: editor.subject, authTokenIdentifier: editor.tokenIdentifier, name: "Editor", email: "editor@example.test", role: "admin", createdAt: now, updatedAt: now });
    const otherUserId = await ctx.db.insert("users", { schoolId, authId: otherEditor.subject, authTokenIdentifier: otherEditor.tokenIdentifier, name: "Other editor", email: "other@example.test", role: "admin", createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.catalogue.manage", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now });
    await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId: otherUserId, capability: "admissions.catalogue.manage", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now });
    return { schoolId, userId, otherUserId };
  });
}
function createConfiguration(now: number) {
  return {
    programme: { slug: "primary-2027", name: "Primary 2027", description: "Primary entry" },
    intake: { slug: "primary-2027", name: "Primary 2027", cycleLabel: "2027", opensAt: now + 1_000, closesAt: now + 10_000 },
    product: { slug: "primary-2027", name: "Application slot" },
    declaration: { title: "Guardian declaration", body: "I confirm this application is accurate.", purpose: "service" },
    fields: [{ fieldKey: "has-support-needs", sectionKey: "support", kind: "boolean" as const, label: "Support needs", requiredMode: "optional" as const, dataClass: "personal" as const, validationJson: "{}", order: 0 }],
    requirements: [{ requirementKey: "birth-cert", category: "identity", label: "Birth certificate", requiredMode: "required" as const, acceptedMimeTypes: ["application/pdf"], maxBytes: 1_000_000, maxFiles: 1, sensitivity: "child_confidential" as const, purpose: "Identity confirmation", order: 0 }],
  };
}
function replaceConfiguration(now: number) {
  const source = createConfiguration(now);
  return { intake: { name: source.intake.name, cycleLabel: source.intake.cycleLabel, opensAt: source.intake.opensAt, closesAt: source.intake.closesAt, description: source.programme.description }, declaration: source.declaration, fields: source.fields, requirements: source.requirements };
}

async function insertLegacyLiveGraph(t: ReturnType<typeof convexTest>, schoolId: Id<"schools">, options: { productStatus?: "draft" | "active"; publishedForms?: number; publishedDeclarations?: number; includeApplications?: boolean } = {}) {
  const now = Date.now();
  return t.run(async (ctx) => {
    const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId, slug: `legacy-programme-${now}`, name: "Legacy programme", status: "published", createdAt: now, updatedAt: now });
    const intakeId = await ctx.db.insert("admissionsIntakes", { schoolId, programmeId, slug: `legacy-intake-${now}`, name: "Legacy intake", cycleLabel: "2027", opensAt: now + 1_000, closesAt: now + 10_000, status: "open", createdAt: now, updatedAt: now });
    const productId = await ctx.db.insert("admissionsProducts", { schoolId, intakeId, slug: `legacy-product-${now}`, name: "Legacy product", slotCount: 1, status: options.productStatus ?? "active", createdAt: now, updatedAt: now });
    const formStatuses = [...Array(options.publishedForms ?? 1).fill("published" as const), "retired" as const, "draft" as const, "draft" as const, "draft" as const];
    const declarationStatuses = [...Array(options.publishedDeclarations ?? 1).fill("published" as const), "retired" as const, "draft" as const, "draft" as const, "draft" as const];
    const publisherId = (await ctx.db.query("users").take(1))[0]._id;
    const formIds = await Promise.all(formStatuses.map((status, index) => ctx.db.insert("admissionsFormVersions", { schoolId, programmeId, intakeId, version: index + 1, schemaVersion: "1", legalNamePolicyVersion: 2, status, ...(status === "published" ? { publishedAt: now, publishedBy: publisherId } : {}), createdAt: now, updatedAt: now })));
    const declarationIds = await Promise.all(declarationStatuses.map((status, index) => ctx.db.insert("admissionsDeclarationVersions", { schoolId, programmeId, version: index + 1, title: `Legacy declaration ${index + 1}`, body: `Legacy body ${index + 1}`, bodyDigest: `legacy-${index + 1}`, purpose: "service", status, ...(status === "published" ? { publishedAt: now, publishedBy: publisherId } : {}), createdAt: now, updatedAt: now })));
    const applicationIds: Id<"admissionsApplications">[] = [];
    if (options.includeApplications) {
      const guardianId = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: `legacy-guardian-${now}`, normalizedEmail: `legacy-${now}@example.test`, status: "active", createdAt: now, updatedAt: now });
      const priceId = await ctx.db.insert("admissionsProductPrices", { schoolId, productId, version: 1, amountMinor: 0, currency: "NGN", refundPolicyKey: "free", feeDisclosure: "Free", effectiveFrom: now, status: "published", createdAt: now, updatedAt: now });
      const attemptId = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId, guardianId, productId, priceId, provider: "manual", providerMode: "test", reference: `legacy-attempt-${now}`, idempotencyKey: `legacy-attempt-${now}`, amountMinor: 0, currency: "NGN", feeDisclosureSnapshot: "Free", state: "paid", createdAt: now, updatedAt: now });
      const entitlementId = await ctx.db.insert("admissionsEntitlements", { schoolId, guardianId, productId, intakeId, sourcePurchaseAttemptId: attemptId, state: "consumed", createdAt: now, updatedAt: now });
      for (let index = 0; index < 7; index += 1) applicationIds.push(await ctx.db.insert("admissionsApplications", { schoolId, guardianId, entitlementId, programmeId, intakeId, productId, priceId, formVersionId: formIds[0], declarationVersionId: declarationIds[0], publicId: `legacy-application-${now}-${index}`, state: "submitted", currentRevision: 1, draftVersion: 1, createdAt: now, updatedAt: now }));
    }
    return { programmeId, intakeId, productId, formIds, declarationIds, applicationIds };
  });
}

async function campaignCounts(t: ReturnType<typeof convexTest>, schoolId: string) {
  return t.run(async (ctx) => ({
    programmes: (await ctx.db.query("admissionsProgrammes").withIndex("by_school", (q) => q.eq("schoolId", schoolId as never)).take(10)).length,
    intakes: (await ctx.db.query("admissionsIntakes").withIndex("by_school", (q) => q.eq("schoolId", schoolId as never)).take(10)).length,
    operations: (await ctx.db.query("admissionsCampaignOperations").take(10)).length,
  }));
}

describe("atomic admissions campaign commands", () => {
  test("creates exactly one complete graph and replays a canonical request for its actor", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const configuration = createConfiguration(Date.now());
    configuration.programme.description = undefined; configuration.requirements[0].acceptedMimeTypes = ["image/PNG", " application/pdf ", "image/png"];
    const first = await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "create-1", targetStatus: "draft", configuration });
    const replay = await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: " create-1 ", targetStatus: "draft", configuration: { ...configuration, programme: { ...configuration.programme, slug: " PRIMARY-2027 ", name: " Primary 2027 ", description: " " }, intake: { ...configuration.intake, slug: " PRIMARY-2027 ", name: " Primary 2027 ", cycleLabel: " 2027 " }, product: { ...configuration.product, slug: " PRIMARY-2027 ", name: " Application slot " }, declaration: { title: " Guardian declaration ", body: " I confirm this application is accurate. ", purpose: " service " }, fields: configuration.fields.map((field) => ({ ...field, fieldKey: " HAS-SUPPORT-NEEDS ", sectionKey: " support ", label: " Support needs ", validationJson: " { } " })), requirements: configuration.requirements.map((requirement) => ({ ...requirement, requirementKey: " BIRTH-CERT ", category: " identity ", label: " Birth certificate ", purpose: " Identity confirmation ", acceptedMimeTypes: [" application/pdf ", " image/png "] })) } });
    expect(first).toMatchObject({ status: "draft", replayed: false, priceId: null }); expect(replay).toMatchObject({ ...first, replayed: true });
    expect(await campaignCounts(t, schoolId)).toEqual({ programmes: 1, intakes: 1, operations: 1 });
    expect(await t.run((ctx) => ctx.db.get(first.formVersionId))).toMatchObject({ status: "draft" });
    const requirement = await t.run(async (ctx) => (await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", first.formVersionId)).unique())!);
    expect(requirement.acceptedMimeTypes).toEqual(["application/pdf", "image/png"]);
    // bindUpload normalizes storage content types and checks this persisted array by exact membership.
    expect(requirement.acceptedMimeTypes.includes("image/png")).toBe(true);
  });

  test("rejects malformed conditions and a changed digest without writing a partial graph", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const invalid = createConfiguration(Date.now());
    invalid.fields[0] = { ...invalid.fields[0], requiredMode: "conditional", conditionalRuleJson: JSON.stringify({ fieldKey: "missing", exists: true }) };
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "invalid", targetStatus: "draft", configuration: invalid })).rejects.toThrow("Conditional controller");
    const duplicate = createConfiguration(Date.now()); duplicate.fields.push({ ...duplicate.fields[0], fieldKey: "HAS-SUPPORT-NEEDS", order: 1 });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "duplicate", targetStatus: "draft", configuration: duplicate })).rejects.toThrow("Invalid field");
    expect(await campaignCounts(t, schoolId)).toEqual({ programmes: 0, intakes: 0, operations: 0 });
    const configuration = createConfiguration(Date.now()); await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "reused", targetStatus: "draft", configuration });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "reused", targetStatus: "draft", configuration: { ...configuration, declaration: { ...configuration.declaration, body: "Changed" } } })).rejects.toThrow("OPERATION_KEY_REUSED");
    expect(await campaignCounts(t, schoolId)).toEqual({ programmes: 1, intakes: 1, operations: 1 });
  });

  test("rejects underscore and dot campaign slugs before creating a graph", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const now = Date.now();
    for (const malformedSlug of ["primary_2027", "primary.2027"]) {
      const configuration = createConfiguration(now);
      configuration.programme.slug = malformedSlug;
      await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: `invalid-${malformedSlug}`, targetStatus: "draft", configuration })).rejects.toThrow("Invalid slug");
    }
    expect(await campaignCounts(t, schoolId)).toEqual({ programmes: 0, intakes: 0, operations: 0 });
  });

  test("accepts and normalizes an actual FormBuilder-style payload with stable underscore keys", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.sensitive.configure", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now });
      await ctx.db.insert("schoolApprovalEvidence", { schoolId, approvalClass: "privacy", subjectType: "admissions_document_requirement", subjectKey: "medical_records", evidenceReference: "medical-records", approvedByUserId: userId, approvedAt: now, createdAt: now });
    });
    const configuration = createConfiguration(now);
    configuration.fields = [
      { fieldKey: "support_status", sectionKey: "application_details", kind: "boolean", label: "Support needs", requiredMode: "optional", dataClass: "personal", validationJson: "{}", order: 0 },
      { fieldKey: "custom_generated_abc123", sectionKey: "application_details", kind: "textarea", label: "Support details", requiredMode: "conditional", dataClass: "personal", validationJson: "{}", conditionalRuleJson: JSON.stringify({ exists: true, fieldKey: "SUPPORT_STATUS" }), order: 1 },
    ];
    configuration.requirements = [
      { requirementKey: "birth_cert", category: "identity", label: "Birth Certificate", requiredMode: "required", acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024, maxFiles: 1, sensitivity: "child_confidential", purpose: "Age and identity confirmation", order: 0 },
      { requirementKey: "medical_records", category: "medical", label: "Recent Medical Reports", requiredMode: "conditional", acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024, maxFiles: 1, sensitivity: "highly_sensitive", purpose: "Health planning support", retentionPolicyKey: "duration_of_enrollment", audience: "school_medical_officers_and_management", approvalEvidenceId: await t.run(async (ctx) => (await ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_approval_class", (q) => q.eq("schoolId", schoolId).eq("approvalClass", "privacy")).unique())!._id), conditionJson: JSON.stringify({ equals: true, fieldKey: "support_status" }), order: 1 },
    ];
    const created = await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "builder-underscores", targetStatus: "draft", configuration });
    const saved = await t.withIdentity(editor).query(api.functions.admissions.settings.getFormConfiguration, { formVersionId: created.formVersionId });
    expect(saved.fields.map((field) => field.key)).toEqual(["support_status", "custom_generated_abc123"]);
    expect(saved.fields.map((field) => field.sectionKey)).toEqual(["application_details", "application_details"]);
    expect(saved.requirements.map((requirement) => requirement.key)).toEqual(["birth_cert", "medical_records"]);
    expect(saved.fields[1].conditionalRuleJson).toBe('{"exists":true,"fieldKey":"support_status"}');
    expect(saved.requirements[1].conditionJson).toBe('{"equals":true,"fieldKey":"support_status"}');
  });

  test("requires catalogue capability for all command targets and sensitive configuration", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); const now = Date.now();
    const publisher = { subject: "publisher-only", tokenIdentifier: "issuer|publisher-only", issuer: "issuer" };
    await t.run(async (ctx) => { const publisherId = await ctx.db.insert("users", { schoolId, authId: publisher.subject, authTokenIdentifier: publisher.tokenIdentifier, name: "Publisher", email: "publisher@example.test", role: "admin", createdAt: now, updatedAt: now }); await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId: publisherId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now }); });
    await expect(t.withIdentity(publisher).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "publisher-only", targetStatus: "published", configuration: createConfiguration(now) })).rejects.toThrow("Not found or access denied");
    const evidenceId = await t.run((ctx) => ctx.db.insert("schoolApprovalEvidence", { schoolId, approvalClass: "privacy", subjectType: "admissions_field", subjectKey: "has-support-needs", evidenceReference: "current-field", approvedByUserId: userId, approvedAt: now, createdAt: now }));
    const sensitive = createConfiguration(now); sensitive.fields[0] = { ...sensitive.fields[0], dataClass: "highly_sensitive", purpose: "Support", retentionPolicyKey: "enrollment", audience: "staff", approvalEvidenceId: evidenceId };
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "no-sensitive-capability", targetStatus: "draft", configuration: sensitive })).rejects.toThrow("Not found or access denied");
    expect(await campaignCounts(t, schoolId)).toEqual({ programmes: 0, intakes: 0, operations: 0 });
  });

  test("scopes operation keys to the actor and rejects cross-tenant sensitive evidence before writes", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const configuration = createConfiguration(Date.now());
    await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "actor-key", targetStatus: "draft", configuration });
    const other = { ...configuration, programme: { ...configuration.programme, slug: "primary-other" }, intake: { ...configuration.intake, slug: "intake-other" }, product: { ...configuration.product, slug: "product-other" } };
    await expect(t.withIdentity(otherEditor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "actor-key", targetStatus: "draft", configuration: other })).resolves.toMatchObject({ replayed: false });
    const foreignEvidenceId = await t.run(async (ctx) => { const now = Date.now(); const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-campaign-school", status: "active", createdAt: now, updatedAt: now }); return ctx.db.insert("schoolApprovalEvidence", { schoolId: otherSchoolId, approvalClass: "privacy", subjectType: "admissions_field", subjectKey: "has-support-needs", evidenceReference: "foreign", approvedByUserId: (await ctx.db.get((await ctx.db.query("schoolCapabilityGrants").take(1))[0].userId))!._id, approvedAt: now, createdAt: now }); });
    const sensitive = createConfiguration(Date.now()); sensitive.programme.slug = "sensitive"; sensitive.intake.slug = "sensitive-intake"; sensitive.product.slug = "sensitive-product"; sensitive.fields[0] = { ...sensitive.fields[0], dataClass: "highly_sensitive", purpose: "Support", retentionPolicyKey: "enrollment", audience: "staff", approvalEvidenceId: foreignEvidenceId };
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "wrong-evidence", targetStatus: "draft", configuration: sensitive })).rejects.toThrow("Privacy approval");
    expect(await campaignCounts(t, schoolId)).toEqual({ programmes: 2, intakes: 2, operations: 2 });
  });

  test("preserves live statuses and immutable published evidence while publishing a replacement", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); await t.run(async (ctx) => { const now = Date.now(); await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now }); });
    const created = await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "published", targetStatus: "published", configuration: createConfiguration(Date.now()) });
    await t.run(async (ctx) => { await ctx.db.patch(created.intakeId, { status: "paused" }); await ctx.db.patch(created.productId, { status: "paused" }); });
    const priorForm = await t.run((ctx) => ctx.db.get(created.formVersionId)); const priorDeclaration = await t.run((ctx) => ctx.db.get(created.declarationVersionId)); const priorChildren = await t.run(async (ctx) => ({ fields: await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", created.formVersionId)).take(10), requirements: await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", created.formVersionId)).take(10) })); const configuration = replaceConfiguration(Date.now()); configuration.declaration = { ...configuration.declaration, body: "A newly approved declaration." };
    const replacement = await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "replace", targetStatus: "published", configuration });
    expect(replacement).toMatchObject({ status: "published", priceId: null }); expect(await t.run((ctx) => ctx.db.get(created.intakeId))).toMatchObject({ status: "paused" }); expect(await t.run((ctx) => ctx.db.get(created.productId))).toMatchObject({ status: "paused" }); expect(await t.run((ctx) => ctx.db.get(created.formVersionId))).toMatchObject({ status: "retired", schemaVersion: priorForm?.schemaVersion }); expect(await t.run((ctx) => ctx.db.get(created.declarationVersionId))).toMatchObject({ status: "retired", body: priorDeclaration?.body, bodyDigest: priorDeclaration?.bodyDigest }); expect(await t.run(async (ctx) => ({ fields: await ctx.db.query("admissionsFormFields").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", created.formVersionId)).take(10), requirements: await ctx.db.query("admissionsDocumentRequirements").withIndex("by_form_version_and_order", (q) => q.eq("formVersionId", created.formVersionId)).take(10) }))).toEqual(priorChildren);
    await t.run((ctx) => ctx.db.patch(created.intakeId, { status: "closed" })); await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "replace-closed", targetStatus: "published", configuration });
    expect(await t.run((ctx) => ctx.db.get(created.intakeId))).toMatchObject({ status: "closed" });
  });

  test("rejects programme-scoped declaration publication when another intake is active", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); await t.run(async (ctx) => { const now = Date.now(); await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now }); });
    const created = await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "scope", targetStatus: "draft", configuration: createConfiguration(Date.now()) });
    await t.run(async (ctx) => { const now = Date.now(); await ctx.db.insert("admissionsIntakes", { schoolId, programmeId: created.programmeId, slug: "shared-intake", name: "Shared", cycleLabel: "2028", opensAt: now, closesAt: now + 1000, status: "draft", createdAt: now, updatedAt: now }); });
    const configuration = replaceConfiguration(Date.now()); configuration.declaration = { ...configuration.declaration, body: "Changed declaration" };
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "scope-replace", targetStatus: "published", configuration })).rejects.toThrow("DECLARATION_SCOPE_AMBIGUOUS");
    expect(await t.run((ctx) => ctx.db.get(created.intakeId))).toMatchObject({ status: "draft" });
  });

  test("reports untracked partial drafts and refuses to repair their graph", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const legacy = await t.run(async (ctx) => { const now = Date.now(); const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId, slug: "legacy-programme", name: "Legacy", status: "draft", createdAt: now, updatedAt: now }); return ctx.db.insert("admissionsIntakes", { schoolId, programmeId, slug: "legacy-intake", name: "Legacy", cycleLabel: "2027", opensAt: now, closesAt: now + 1000, status: "draft", createdAt: now, updatedAt: now }); });
    const recovery = await t.withIdentity(editor).query(api.functions.admissions.settings.listLegacyCampaignRecovery, { schoolId });
    expect(recovery).toEqual([expect.objectContaining({ intakeId: legacy, recoveryState: "review_required", missingProduct: true, missingForm: true, missingDeclaration: true })]);
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: legacy, operationKey: "legacy", targetStatus: "draft", configuration: replaceConfiguration(Date.now()) })).rejects.toThrow("RECOVERY_GRAPH_AMBIGUOUS");
    expect(await t.run((ctx) => ctx.db.get(legacy))).toMatchObject({ status: "draft" });
  });

  test("replaces a complete legacy campaign graph without rewriting its identity", async () => {
    const t = convexTest(schema, modules); const { schoolId } = await fixture(t); const now = Date.now();
    const legacy = await t.run(async (ctx) => {
      const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId, slug: "legacy-programme", name: "Legacy programme", status: "draft", createdAt: now, updatedAt: now });
      const intakeId = await ctx.db.insert("admissionsIntakes", { schoolId, programmeId, slug: "legacy-intake", name: "Legacy intake", cycleLabel: "2027", opensAt: now + 1_000, closesAt: now + 10_000, status: "draft", createdAt: now, updatedAt: now });
      const productId = await ctx.db.insert("admissionsProducts", { schoolId, intakeId, slug: "legacy-product", name: "Legacy product", slotCount: 1, status: "draft", createdAt: now, updatedAt: now });
      await ctx.db.insert("admissionsDeclarationVersions", { schoolId, programmeId, version: 1, title: "Legacy declaration", body: "Legacy body", bodyDigest: "legacy", purpose: "service", status: "draft", createdAt: now, updatedAt: now });
      await ctx.db.insert("admissionsFormVersions", { schoolId, programmeId, intakeId, version: 1, schemaVersion: "1", legalNamePolicyVersion: 2, status: "draft", createdAt: now, updatedAt: now });
      return { programmeId, intakeId, productId };
    });
    const replacement = await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: legacy.intakeId, operationKey: "replace-legacy", targetStatus: "draft", configuration: replaceConfiguration(now) });
    expect(replacement).toMatchObject({ ...legacy, replayed: false, status: "draft" });
    expect(await t.run((ctx) => ctx.db.get(legacy.programmeId))).toMatchObject({ slug: "legacy-programme", name: "Legacy programme" });
    expect(await t.run((ctx) => ctx.db.get(legacy.intakeId))).toMatchObject({ slug: "legacy-intake" });
    expect(await t.run((ctx) => ctx.db.get(legacy.productId))).toMatchObject({ slug: "legacy-product" });
  });

  test("adopts the bounded live legacy graph without rewriting historical evidence or applications", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); const now = Date.now();
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now }));
    const legacy = await insertLegacyLiveGraph(t, schoolId, { includeApplications: true });
    const replacement = await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: legacy.intakeId, operationKey: "adopt-live-legacy", targetStatus: "published", configuration: replaceConfiguration(now) });
    const replay = await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: legacy.intakeId, operationKey: "adopt-live-legacy", targetStatus: "published", configuration: replaceConfiguration(now) });
    expect(replacement).toMatchObject({ programmeId: legacy.programmeId, intakeId: legacy.intakeId, productId: legacy.productId, status: "published", replayed: false });
    expect(replay).toMatchObject({ ...replacement, replayed: true });
    const history = await t.run(async (ctx) => ({ forms: await ctx.db.query("admissionsFormVersions").withIndex("by_intake", (q) => q.eq("intakeId", legacy.intakeId)).take(10), declarations: await ctx.db.query("admissionsDeclarationVersions").withIndex("by_school_and_programme_and_version", (q) => q.eq("schoolId", schoolId).eq("programmeId", legacy.programmeId).gte("version", 0)).take(10), applications: await ctx.db.query("admissionsApplications").withIndex("by_school_and_intake_and_state", (q) => q.eq("schoolId", schoolId).eq("intakeId", legacy.intakeId).eq("state", "submitted")).take(10), operations: await ctx.db.query("admissionsCampaignOperations").withIndex("by_intake", (q) => q.eq("intakeId", legacy.intakeId)).take(2), audits: await ctx.db.query("admissionsAuditEvents").withIndex("by_school_and_action_and_created_at", (q) => q.eq("schoolId", schoolId).eq("action", "catalogue.campaign_legacy_adopted_atomically")).take(2) }));
    expect(history.forms).toHaveLength(6); expect(history.declarations).toHaveLength(6); expect(history.applications.map((application) => application._id)).toEqual(legacy.applicationIds);
    expect(history).toMatchObject({ forms: expect.arrayContaining([expect.objectContaining({ _id: legacy.formIds[0], status: "retired" }), expect.objectContaining({ _id: legacy.formIds[1], status: "retired" }), expect.objectContaining({ _id: legacy.formIds[2], status: "draft" }), expect.objectContaining({ _id: legacy.formIds[3], status: "draft" }), expect.objectContaining({ _id: legacy.formIds[4], status: "draft" }), expect.objectContaining({ _id: replacement.formVersionId, version: 6, status: "published" })]), declarations: expect.arrayContaining([expect.objectContaining({ _id: legacy.declarationIds[0], status: "retired" }), expect.objectContaining({ _id: legacy.declarationIds[1], status: "retired" }), expect.objectContaining({ _id: legacy.declarationIds[2], status: "draft" }), expect.objectContaining({ _id: legacy.declarationIds[3], status: "draft" }), expect.objectContaining({ _id: legacy.declarationIds[4], status: "draft" })]), operations: [expect.objectContaining({ actorUserId: userId, command: "replace", operationKey: "adopt-live-legacy" })], audits: [expect.objectContaining({ actorUserId: userId, reasonCode: "legacy_adoption", metadataJson: JSON.stringify({ legacyAdoption: true }) })] });
  });

  test("keeps incomplete and ambiguous live legacy graphs blocked", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); const now = Date.now();
    await t.run((ctx) => ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now }));
    const draftProduct = await insertLegacyLiveGraph(t, schoolId, { productStatus: "draft" });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: draftProduct.intakeId, operationKey: "reject-draft-product", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("RECOVERY_GRAPH_AMBIGUOUS");
    const missingPublished = await insertLegacyLiveGraph(t, schoolId, { publishedForms: 0 });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: missingPublished.intakeId, operationKey: "reject-missing-published", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("RECOVERY_GRAPH_AMBIGUOUS");
    const missingDeclaration = await insertLegacyLiveGraph(t, schoolId, { publishedDeclarations: 0 });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: missingDeclaration.intakeId, operationKey: "reject-missing-declaration", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("RECOVERY_GRAPH_AMBIGUOUS");
    const duplicateForm = await insertLegacyLiveGraph(t, schoolId, { publishedForms: 2 });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: duplicateForm.intakeId, operationKey: "reject-duplicate-form", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("Campaign publication evidence is inconsistent");
    const duplicateDeclaration = await insertLegacyLiveGraph(t, schoolId, { publishedDeclarations: 2 });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: duplicateDeclaration.intakeId, operationKey: "reject-duplicate-declaration", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("Campaign publication evidence is inconsistent");
    const crossSchool = await insertLegacyLiveGraph(t, schoolId);
    await t.run(async (ctx) => { const foreignSchoolId = await ctx.db.insert("schools", { name: "Foreign", slug: `foreign-${now}`, status: "active", createdAt: now, updatedAt: now }); await ctx.db.insert("admissionsProducts", { schoolId: foreignSchoolId, intakeId: crossSchool.intakeId, slug: `foreign-product-${now}`, name: "Foreign product", slotCount: 1, status: "active", createdAt: now, updatedAt: now }); });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: crossSchool.intakeId, operationKey: "reject-cross-school", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("RECOVERY_GRAPH_AMBIGUOUS");
    const overflow = await insertLegacyLiveGraph(t, schoolId);
    await t.run(async (ctx) => { for (let version = 6; version <= 101; version += 1) await ctx.db.insert("admissionsFormVersions", { schoolId, programmeId: overflow.programmeId, intakeId: overflow.intakeId, version, schemaVersion: "1", legalNamePolicyVersion: 2, status: "draft", createdAt: now, updatedAt: now }); });
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: overflow.intakeId, operationKey: "reject-overflow", targetStatus: "published", configuration: replaceConfiguration(now) })).rejects.toThrow("RECOVERY_GRAPH_AMBIGUOUS");
    expect(await t.run(async (ctx) => (await ctx.db.query("admissionsCampaignOperations").take(10)).filter((operation) => [draftProduct.intakeId, missingPublished.intakeId, missingDeclaration.intakeId, duplicateForm.intakeId, duplicateDeclaration.intakeId, crossSchool.intakeId, overflow.intakeId].includes(operation.intakeId)))).toEqual([]);
  });

  test("requires exact next-version finance approval and writes a changed price once", async () => {
    const t = convexTest(schema, modules); const { schoolId, userId } = await fixture(t); const created = await t.withIdentity(editor).mutation(api.functions.admissions.settings.createCampaignConfiguration, { schoolId, operationKey: "price-draft", targetStatus: "draft", configuration: createConfiguration(Date.now()) });
    await t.run(async (ctx) => { const now = Date.now(); await ctx.db.insert("schoolCapabilityGrants", { schoolId, userId, capability: "admissions.publish", scope: "school", grantedByUserId: userId, reason: "test", isBreakGlass: false, createdAt: now }); await ctx.db.insert("schoolApprovalEvidence", { schoolId, approvalClass: "finance", subjectType: "admissions_price", subjectKey: `${String(created.productId)}:1`, evidenceReference: "finance-1", approvedByUserId: userId, approvedAt: now, createdAt: now }); });
    const evidenceId = await t.run(async (ctx) => (await ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_approval_class", (q) => q.eq("schoolId", schoolId).eq("approvalClass", "finance")).unique())!._id);
    const configuration = { ...replaceConfiguration(Date.now()), price: { amountMinor: 5000, currency: "NGN", refundPolicyKey: "non_refundable", feeDisclosure: "Fee", approvalEvidenceId: evidenceId } };
    const first = await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "price", targetStatus: "published", configuration }); const replay = await t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "price", targetStatus: "published", configuration });
    expect(first.priceId).not.toBeNull(); expect(replay).toMatchObject({ priceId: first.priceId, replayed: true }); expect(await t.run((ctx) => ctx.db.query("admissionsProductPrices").withIndex("by_product_and_version", (q) => q.eq("productId", created.productId).eq("version", 1)).take(2))).toHaveLength(1);
    const wrongEvidenceId = await t.run(async (ctx) => ctx.db.insert("schoolApprovalEvidence", { schoolId, approvalClass: "finance", subjectType: "admissions_price", subjectKey: `${String(created.productId)}:2`, evidenceReference: "wrong-current-price", approvedByUserId: userId, approvedAt: Date.now(), createdAt: Date.now() }));
    const unchangedPrice = { ...configuration, price: { ...configuration.price, currency: " ngn ", feeDisclosure: " Fee ", approvalEvidenceId: wrongEvidenceId } };
    await expect(t.withIdentity(editor).mutation(api.functions.admissions.settings.replaceCampaignConfiguration, { schoolId, intakeId: created.intakeId, operationKey: "wrong-unchanged-evidence", targetStatus: "published", configuration: unchangedPrice })).rejects.toThrow("Finance approval");
    expect(await t.run((ctx) => ctx.db.query("admissionsProductPrices").withIndex("by_product_and_version", (q) => q.eq("productId", created.productId).eq("version", 1)).take(2))).toHaveLength(1);
  });
});
