import { convexTest } from "convex-test";
import type { FunctionReference, RegisteredMutation } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as curriculumImportLifecycle from "../curriculumImportLifecycle";
import * as curriculumReviewLifecycle from "../curriculumReviewLifecycle";
import * as curriculumGeneration from "../curriculumGeneration";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("../../../**/*.ts");
const admin = { subject: "admin-auth" };
type MutationReference<Export> = Export extends RegisteredMutation<infer Visibility, infer Args, infer Result> ? FunctionReference<"mutation", Visibility, Args, Awaited<Result>> : never;
const createCurriculumImport = curriculumImportLifecycle.createCurriculumImport as unknown as MutationReference<typeof curriculumImportLifecycle.createCurriculumImport>;
const saveCurriculumProposals = curriculumImportLifecycle.saveCurriculumProposals as unknown as MutationReference<typeof curriculumImportLifecycle.saveCurriculumProposals>;
const approveCurriculumUnit = curriculumReviewLifecycle.approveCurriculumUnit as unknown as MutationReference<typeof curriculumReviewLifecycle.approveCurriculumUnit>;
const startGeneration = curriculumGeneration.startGeneration as unknown as MutationReference<typeof curriculumGeneration.startGeneration>;
const completeGeneration = curriculumGeneration.completeGeneration as unknown as MutationReference<typeof curriculumGeneration.completeGeneration>;
const failGeneration = curriculumGeneration.failGeneration as unknown as MutationReference<typeof curriculumGeneration.failGeneration>;
const failUnstartedGeneration = curriculumGeneration.failUnstartedGeneration as unknown as MutationReference<typeof curriculumGeneration.failUnstartedGeneration>;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = 1;
    const schoolId = await ctx.db.insert("schools", { name: "Alpha", slug: "alpha", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Beta", slug: "beta", createdAt: now, updatedAt: now });
    const adminId = await ctx.db.insert("users", { schoolId, authId: "admin-auth", name: "Admin", email: "admin@alpha.test", role: "admin", createdAt: now, updatedAt: now });
    await ctx.db.insert("users", { schoolId, authId: "teacher-auth", name: "Teacher", email: "teacher@alpha.test", role: "teacher", createdAt: now, updatedAt: now });
    await ctx.db.insert("users", { schoolId: otherSchoolId, authId: "other-auth", name: "Other", email: "other@beta.test", role: "admin", createdAt: now, updatedAt: now });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Mathematics", code: "MAT", createdAt: now, updatedAt: now });
    const otherSubjectId = await ctx.db.insert("subjects", { schoolId, name: "English", code: "ENG", createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term 1", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
    const materialId = await ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: adminId, ownerRole: "admin", sourceType: "imported_curriculum", visibility: "staff_shared", reviewStatus: "approved", title: "Math scheme", subjectId, level: "JSS 1", topicLabel: "Scheme", searchStatus: "indexed", searchText: "math scheme", processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
    const chunkId = await ctx.db.insert("knowledgeMaterialChunks", { schoolId, materialId, chunkIndex: 0, chunkText: "Fractions compare equal parts using visual models.", searchText: "fractions", visibility: "staff_shared", reviewStatus: "approved", searchStatus: "indexed", pageNumbers: [3], createdAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, adminId, subjectId, otherSubjectId, termId, materialId, chunkId };
  });
  return { t, ids };
}

async function createImport() {
  const { t, ids } = await fixture();
  const importId = await t.withIdentity(admin).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId });
  const runId = await t.run((ctx) => ctx.db.insert("aiRunLogs", { schoolId: ids.schoolId, actorUserId: ids.adminId, actorRole: "admin", outputType: "curriculum_extraction", promptClass: "curriculum-extraction:v1", status: "succeeded", model: "gpt-test", provider: "mock", curriculumImportId: importId, sourceSelectionSnapshot: String(ids.chunkId), sourceCount: 1, createdAt: 2, updatedAt: 2 }));
  const mismatchedRunId = await t.run((ctx) => ctx.db.insert("aiRunLogs", { schoolId: ids.schoolId, actorUserId: ids.adminId, actorRole: "admin", outputType: "curriculum_extraction", promptClass: "curriculum-extraction:v1", status: "succeeded", model: "gpt-test", provider: "mock", sourceSelectionSnapshot: "wrong", sourceCount: 1, createdAt: 2, updatedAt: 2 }));
  return { t, ids, importId, runId, mismatchedRunId };
}

const proposalFor = (sourceChunkHash: string) => ({ weekNumber: 1, title: "Fractions", subtopics: ["Equal parts"], learningObjectives: ["Compare fractions"], suggestedDuration: "1 week", sourcePages: [3], sourceChunkHash, supportingExcerpt: "compare equal parts using visual models", confidence: 0.9 });

describe("curriculum lifecycle", () => {
  it("enforces admin ownership and cross-school source boundaries", async () => {
    const { t, ids } = await fixture();
    await expect(t.withIdentity({ subject: "teacher-auth" }).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId })).rejects.toThrow("Admin access required");
    await expect(t.withIdentity({ subject: "other-auth" }).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId })).rejects.toThrow("ready school curriculum source");
    await expect(t.withIdentity(admin).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.otherSubjectId, level: "JSS 1", termId: ids.termId })).rejects.toThrow("selected subject");
    await expect(t.withIdentity(admin).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 2", termId: ids.termId })).rejects.toThrow("selected level");
  });

  it("requires a matching successful run and excerpt-grounded chunk evidence", async () => {
    const { t, ids, importId, runId, mismatchedRunId } = await createImport();
    const proposal = proposalFor(String(ids.chunkId));
    await expect(t.withIdentity(admin).mutation(saveCurriculumProposals, { importId, proposals: [proposal], aiRunLogId: mismatchedRunId })).rejects.toThrow("canonical curriculum run log");
    await expect(t.withIdentity(admin).mutation(saveCurriculumProposals, { importId, proposals: [{ ...proposal, supportingExcerpt: "not in the source" }], aiRunLogId: runId })).rejects.toThrow("excerpt text");
  });

  it("writes audits, derives run provenance, and approves exactly once on retry", async () => {
    const { t, ids, importId, runId } = await createImport();
    const proposal = proposalFor(String(ids.chunkId));
    await t.withIdentity(admin).mutation(saveCurriculumProposals, { importId, proposals: [proposal], aiRunLogId: runId });
    const unitId = await t.run(async (ctx) => (await ctx.db.query("curriculumUnits").withIndex("by_import_and_review_status", (q) => q.eq("importId", importId).eq("reviewStatus", "proposed")).unique())!._id);
    const firstTopicId = await t.withIdentity(admin).mutation(approveCurriculumUnit, { unitId });
    const retryTopicId = await t.withIdentity(admin).mutation(approveCurriculumUnit, { unitId });
    expect(retryTopicId).toBe(firstTopicId);
    const result = await t.run(async (ctx) => ({ importRecord: await ctx.db.get(importId), topics: await ctx.db.query("knowledgeTopics").withIndex("by_school", (q) => q.eq("schoolId", ids.schoolId)).collect(), audits: await ctx.db.query("contentAuditEvents").withIndex("by_school_and_curriculum_import", (q) => q.eq("schoolId", ids.schoolId).eq("curriculumImportId", importId)).collect() }));
    expect(result.importRecord).toMatchObject({ provider: "mock", modelId: "gpt-test", promptVersion: "curriculum-extraction:v1", schemaVersion: "curriculum-unit-v1", aiRunLogId: runId });
    expect(result.topics).toHaveLength(1);
    expect(result.audits.map((audit) => audit.entityType)).toEqual(expect.arrayContaining(["curriculumImport", "curriculumUnit"]));
  });

  it("marks the run and import failed after completion rejection", async () => {
    const { t, ids } = await fixture();
    const importId = await t.withIdentity(admin).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId });
    const runId = await t.withIdentity(admin).mutation(startGeneration, { importId, provider: "mock", model: "mock/curriculum-fixture-v1", sourceCount: 1 });
    const proposal = proposalFor(String(ids.chunkId));
    await t.run((ctx) => ctx.db.patch(ids.termId, { isActive: false }));
    await expect(t.withIdentity(admin).mutation(completeGeneration, { importId, aiRunLogId: runId, proposals: [proposal] })).rejects.toThrow("academic context");
    await t.withIdentity(admin).mutation(failGeneration, { importId, aiRunLogId: runId, errorCode: "validation_error", errorMessage: "Curriculum proposal generation failed." });
    const result = await t.run(async (ctx) => ({ record: await ctx.db.get(importId), run: await ctx.db.get(runId), units: await ctx.db.query("curriculumUnits").withIndex("by_import_and_review_status", (q) => q.eq("importId", importId).eq("reviewStatus", "proposed")).take(10) }));
    expect(result.record?.status).toBe("failed"); expect(result.run?.status).toBe("failed"); expect(result.units).toHaveLength(0);
  });

  it("records canonical start provenance and atomically completes valid proposals", async () => {
    const { t, ids } = await fixture();
    const importId = await t.withIdentity(admin).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId });
    const runId = await t.withIdentity(admin).mutation(startGeneration, { importId, provider: "mock", model: "mock/curriculum-fixture-v1", sourceCount: 1 });
    const proposal = proposalFor(String(ids.chunkId));
    const running = await t.run((ctx) => ctx.db.get(runId));
    expect(running).toMatchObject({ status: "running", provider: "mock", model: "mock/curriculum-fixture-v1", sourceCount: 1 });
    expect(JSON.parse(running!.sourceSelectionSnapshot)).toEqual({ materialId: String(ids.materialId), pageCount: 1 });
    await t.withIdentity(admin).mutation(completeGeneration, { importId, aiRunLogId: runId, proposals: [proposal], tokenPromptCount: 12, tokenCompletionCount: 8 });
    const result = await t.run(async (ctx) => ({ record: await ctx.db.get(importId), run: await ctx.db.get(runId), units: await ctx.db.query("curriculumUnits").withIndex("by_import_and_review_status", (q) => q.eq("importId", importId).eq("reviewStatus", "proposed")).take(10) }));
    expect(result.record).toMatchObject({ status: "ready_for_review", aiRunLogId: runId, provider: "mock", modelId: "mock/curriculum-fixture-v1", proposedUnitCount: 1 });
    expect(result.run).toMatchObject({ status: "succeeded", tokenPromptCount: 12, tokenCompletionCount: 8 });
    expect(result.units).toHaveLength(1);
  });

  it("blocks inactive terms and records a retryable pre-run failure without run metadata", async () => {
    const { t, ids } = await fixture();
    const importId = await t.withIdentity(admin).mutation(createCurriculumImport, { materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId });
    await t.run((ctx) => ctx.db.patch(ids.termId, { isActive: false }));
    await expect(t.withIdentity(admin).mutation(startGeneration, { importId, provider: "mock", model: "mock", sourceCount: 1 })).rejects.toThrow("academic context");
    await t.withIdentity(admin).mutation(failUnstartedGeneration, { importId, errorCode: "preflight_failed", errorMessage: "Curriculum proposal generation failed." });
    const record = await t.run((ctx) => ctx.db.get(importId));
    expect(record).toMatchObject({ status: "failed", errorCode: "preflight_failed" });
    expect(record?.provider).toBeUndefined(); expect(record?.aiRunLogId).toBeUndefined();
  });

});
