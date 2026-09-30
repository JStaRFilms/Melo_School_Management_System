import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { beforeEach, expect, it, vi } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";

const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", async original => ({ ...await original<typeof import("ai")>(), generateObject: mock.generate }));
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
function ref(name: string): ReturnType<typeof makeFunctionReference<"action">>;
function ref(name: string, type: "action"): ReturnType<typeof makeFunctionReference<"action">>;
function ref(name: string, type: "mutation"): ReturnType<typeof makeFunctionReference<"mutation">>;
function ref(name: string, type: "query"): ReturnType<typeof makeFunctionReference<"query">>;
function ref(name: string, type: "action" | "mutation" | "query" = "action") {
  return makeFunctionReference<typeof type>(`functions/academic/${name}`);
}
const model = "nvidia/nemotron-3-super-120b-a12b:free";
const result = { object: { title: "Algebra lesson", subject: "Mathematics", level: "JSS 1", topic: "Algebra", sections: [{ sectionId: "content", label: "Content", content: "Worked examples with clear explanations and practice." }], sourceNotes: ["Source used"] }, usage: { inputTokens: 20, outputTokens: 10 }, response: { id: "openrouter-response-1" } };
beforeEach(() => { mock.generate.mockReset(); mock.generate.mockResolvedValue(result); });
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "ai-school", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-ai-school", status: "active", createdAt: now, updatedAt: now });
    const token = "test|ai-teacher";
    const personId = await ctx.db.insert("persons", { authTokenIdentifier: token, email: "ai@test.invalid", name: "Teacher", status: "active", createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: "ai-teacher", authTokenIdentifier: token, personId, email: "ai@test.invalid", name: "Teacher", role: "teacher", createdAt: now, updatedAt: now });
    const membershipId = await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: userId, status: "active", isDefaultBranch: true, joinedAt: now, updatedAt: now });
    await ctx.db.insert("membershipDirectGrants", { membershipId, capability: "academic.planning.use", grantedAt: now });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Mathematics", code: "MTH", createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: userId, ownerRole: "teacher", sourceType: "file_upload", visibility: "private_owner", reviewStatus: "approved", title: "Algebra source", subjectId, level: "JSS 1", topicLabel: "Algebra", searchStatus: "indexed", searchText: "algebra", processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now, createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId });
    const chunkId = await ctx.db.insert("knowledgeMaterialChunks", { schoolId, materialId: sourceId, chunkIndex: 0, chunkText: "Algebra is a branch of mathematics. Solve x + 2 = 5 with inverse operations.", searchText: "algebra solve", visibility: "private_owner", reviewStatus: "approved", searchStatus: "indexed", tokenEstimate: 30, createdAt: now, updatedAt: now });
    const assessmentProfileId = await ctx.db.insert("assessmentGenerationProfiles", { schoolId, name: "One question", questionStyle: "balanced", totalQuestions: 1, questionMix: { multiple_choice: 0, short_answer: 1, essay: 0, true_false: 0, fill_in_the_blank: 0 }, allowTeacherOverrides: true, isDefault: true, isActive: true, searchText: "one question", createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId });
    const templateId = await ctx.db.insert("instructionTemplates", { schoolId, templateKey: "lesson_default", outputType: "lesson_plan", title: "Lesson template", templateScope: "school_default", isSchoolDefault: true, requiredSectionIds: ["content"], sectionDefinitions: [{ id: "content", label: "Content", order: 0, required: true }], objectiveMinimums: { minimumObjectives: 0, minimumSourceMaterials: 1, minimumSections: 1 }, searchText: "lesson", isActive: true, createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId });
    const rate = { currency: "NGN", perStudentMinor: 100, setupMinor: 0, minimumMinor: 0, discountBps: 0, bands: [], cadence: "termly" as const, proration: "none" as const };
    const rateVersionId = await ctx.db.insert("commercialRateVersions", { code: "ai", name: "AI", version: 1, effectiveFrom: now - 1000, rate, createdAt: now });
    const contractId = await ctx.db.insert("commercialContracts", { schoolId, rateVersionId, rate, code: "ai", version: 1, effectiveFrom: now - 1000, effectiveTo: now + 3_600_000, setupHandling: "waived", setupReason: "fixture", createdAt: now });
    const entitlement = { allowances: [{ meterType: "ai_tokens" as const, baseUnits: 500_000, graceUnits: 0 }], warningPercent: 50, criticalPercent: 75, hardStopPercent: 100, maxFileSizeBytes: 100, maxPagesPerOperation: 1, profiles: [{ task: "teacher_lesson_plan" as const, meterType: "ai_tokens" as const, unitsPerItem: 100_000, maxItems: 1, modelProfile: model }, { task: "teacher_assessment" as const, meterType: "ai_tokens" as const, unitsPerItem: 100_000, maxItems: 1, modelProfile: "openai/gpt-oss-120b:free" }] };
    const versionId = await ctx.db.insert("usageEntitlementVersions", { code: "ai", name: "AI", version: 1, effectiveFrom: now - 1000, entitlement, createdAt: now });
    const cycleId = await ctx.db.insert("usageCycles", { schoolId, contractId, entitlementVersionId: versionId, code: "ai", version: 1, entitlement, startAt: now - 1000, endAt: now + 3_600_000, status: "active", createdAt: now });
    const meterId = await ctx.db.insert("usageMeterAllocations", { schoolId, cycleId, meterType: "ai_tokens", allocatedUnits: 500_000, consumedUnits: 0, reservedUnits: 0, resetCadence: "termly", lastResetAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, sourceId, chunkId, templateId, meterId, membershipId, assessmentProfileId, subjectId };
  });
  const teacher = t.withIdentity({ subject: "ai-teacher", tokenIdentifier: "test|ai-teacher" });
  const other = t.withIdentity({ subject: "stranger", tokenIdentifier: "test|stranger" });
  const request = { outputType: "lesson_plan", sourceIds: [ids.sourceId], targetTopicLabel: "Algebra" };
  async function quote() { return await teacher.action(ref("documentGeneration:quoteTeacherLessonPlanDraft"), { ...request, idempotencyKey: crypto.randomUUID().replaceAll("-", "") }) as { attemptId: Id<"usageOperationAttempts">; estimate: number }; }
  async function confirm(attemptId: Id<"usageOperationAttempts">, estimate: number) { await teacher.mutation(ref("aiSpend:confirm", "mutation"), { attemptId, expectedUnits: estimate, confirmation: "CONFIRM" }); }
  return { ...ids, t, teacher, other, request, quote, confirm };
}
it("quotes, confirms, generates a real saved draft through a mocked provider and settles measured tokens once", async () => {
  const f = await setup();
  const quote = await f.quote();
  expect(quote.estimate).toBe(100_000);
  expect(mock.generate).not.toHaveBeenCalled();
  await f.confirm(quote.attemptId, quote.estimate);
  const saved = await f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: quote.attemptId }) as { artifactId: string; documentState: string; generationMeta: { aiRunLogId: Id<"aiRunLogs"> } };
  expect(saved.artifactId).toBeTruthy();
  expect(saved.documentState).toContain("Worked examples");
  expect(await f.t.run(ctx => ctx.db.get(saved.generationMeta.aiRunLogId))).toMatchObject({ attemptId: quote.attemptId, status: "succeeded", tokenPromptCount: 20, tokenCompletionCount: 10 });
  expect(mock.generate).toHaveBeenCalledTimes(1);
  expect(mock.generate.mock.calls[0][0]).toMatchObject({ maxOutputTokens: 2048, maxRetries: 0 });
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: quote.attemptId })).rejects.toThrow("never replay");
  expect(mock.generate).toHaveBeenCalledTimes(1);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
  expect(await f.teacher.query(ref("aiSpend:status", "query"), { attemptId: quote.attemptId })).toMatchObject({ status: "settled", actualUnits: 30, resultId: saved.artifactId });
  const events = await f.t.run(ctx => ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(5));
  expect(events).toMatchObject([{ unitsDelta: 30 }]);
});
it("generates an assessment with effective settings, binds profile edits and settles the saved bank", async () => {
  const f = await setup();
  const settings = { profileId: f.assessmentProfileId, questionStyle: "balanced", totalQuestions: 1,
    questionMix: { multiple_choice: 0, short_answer: 1, essay: 0, true_false: 0, fill_in_the_blank: 0 }, allowTeacherOverrides: true };
  const request = { draftMode: "practice_quiz", sourceIds: [f.sourceId], targetTopicLabel: "Algebra", effectiveGenerationSettings: settings };
  mock.generate.mockResolvedValue({ object: { title: "Algebra quiz", subject: "Mathematics", level: "JSS 1", topic: "Algebra", blueprint: "One question", questions: [{ number: 1, prompt: "Solve x+2=5", answer: "3", explanation: "Subtract 2", difficulty: "easy", marks: 2, tags: ["algebra"] }], answerKeyNotes: "Check working", sourceNotes: ["Source"] }, usage: { inputTokens: 40, outputTokens: 50 }, response: { id: "assessment-response-1" } });
  const quoted = await f.teacher.action(ref("documentGeneration:quoteTeacherAssessmentDraft"), { ...request, idempotencyKey: "assessment-001" }) as { attemptId: Id<"usageOperationAttempts">; estimate: number };
  await f.confirm(quoted.attemptId, quoted.estimate);
  const saved = await f.teacher.action(ref("documentGeneration:generateTeacherAssessmentDraft"), { attemptId: quoted.attemptId }) as { bankId: string; itemCount: number };
  expect(saved.itemCount).toBe(1);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 90, reservedUnits: 0 });
  expect(await f.teacher.query(ref("aiSpend:status", "query"), { attemptId: quoted.attemptId })).toMatchObject({ resultId: saved.bankId });
  const second = await f.teacher.action(ref("documentGeneration:quoteTeacherAssessmentDraft"), { ...request, idempotencyKey: "assessment-002" }) as { attemptId: Id<"usageOperationAttempts">; estimate: number };
  await f.confirm(second.attemptId, second.estimate);
  await f.t.run(ctx => ctx.db.patch(f.assessmentProfileId, { name: "Renamed profile" }));
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherAssessmentDraft"), { attemptId: second.attemptId })).rejects.toThrow("changed");
  expect(mock.generate).toHaveBeenCalledTimes(1);
});
it("denies unauthorized requests and insufficient allowance before a provider call", async () => {
  const f = await setup();
  await expect(f.other.action(ref("documentGeneration:quoteTeacherLessonPlanDraft"), { ...f.request, idempotencyKey: "foreign-request" })).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.meterId, { consumedUnits: 450_000 }));
  await expect(f.quote()).rejects.toThrow("allowance short");
  expect(mock.generate).not.toHaveBeenCalled();
});
it("rejects a reused quote key for changed inputs, direct generation args and revoked capability", async () => {
  const f = await setup();
  const quote = await f.teacher.action(ref("documentGeneration:quoteTeacherLessonPlanDraft"), { ...f.request, idempotencyKey: "bound-request-001" }) as { attemptId: Id<"usageOperationAttempts">; estimate: number };
  await expect(f.teacher.action(ref("documentGeneration:quoteTeacherLessonPlanDraft"), { ...f.request, targetTopicLabel: "Geometry", idempotencyKey: "bound-request-001" })).rejects.toThrow("different work");
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), f.request)).rejects.toThrow();
  await f.confirm(quote.attemptId, quote.estimate);
  await f.t.run(ctx => ctx.db.patch(f.membershipId, { status: "suspended" }));
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: quote.attemptId })).rejects.toThrow();
  expect(mock.generate).not.toHaveBeenCalled();
});
it("changed source content or template invalidates a confirmed quote without dispatch", async () => {
  const f = await setup();
  const quote = await f.quote(); await f.confirm(quote.attemptId, quote.estimate);
  await f.t.run(ctx => ctx.db.patch(f.chunkId, { chunkText: "Changed excerpt before dispatch" }));
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: quote.attemptId })).rejects.toThrow("changed");
  expect(mock.generate).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0 });
  const again = await f.quote(); await f.confirm(again.attemptId, again.estimate);
  await f.t.run(ctx => ctx.db.patch(f.templateId, { title: "New template" }));
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: again.attemptId })).rejects.toThrow("changed");
});
it("rejects a model override changed after a confirmed quote", async () => {
  const f = await setup(); const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  const before = process.env.SCHOOL_AI_LESSON_PLAN_MODEL;
  try {
    process.env.SCHOOL_AI_LESSON_PLAN_MODEL = "other/changed-model";
    await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: quoted.attemptId })).rejects.toThrow("changed");
  } finally {
    if (before === undefined) delete process.env.SCHOOL_AI_LESSON_PLAN_MODEL;
    else process.env.SCHOOL_AI_LESSON_PLAN_MODEL = before;
  }
  expect(mock.generate).not.toHaveBeenCalled();
});
it("settles measured usage even when draft save fails, then recovers without dispatch", async () => {
  const f = await setup();
  const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  mock.generate.mockImplementationOnce(async () => {
    await f.t.run(ctx => ctx.db.patch(f.subjectId, { isArchived: true }));
    return result;
  });
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: quoted.attemptId })).rejects.toThrow();
  expect(await f.teacher.query(ref("aiSpend:status", "query"), { attemptId: quoted.attemptId })).toMatchObject({ status: "settled", actualUnits: 30, resultId: null });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
  await f.t.run(ctx => ctx.db.patch(f.subjectId, { isArchived: false }));
  const saved = await f.teacher.action(ref("documentGeneration:recoverTeacherGenerationDraft"), { attemptId: quoted.attemptId }) as { artifactId: string };
  expect(saved.artifactId).toBeTruthy();
  expect(await f.t.run(ctx => ctx.db.query("aiGenerationResults").withIndex("by_attempt", q => q.eq("attemptId", quoted.attemptId)).unique())).toBeNull();
  expect(mock.generate).toHaveBeenCalledTimes(1);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
  const events = await f.t.run(ctx => ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(5));
  expect(events).toHaveLength(1);
  expect(await f.teacher.action(ref("documentGeneration:recoverTeacherGenerationDraft"), { attemptId: quoted.attemptId })).toMatchObject({ resultId: saved.artifactId });
});
it("known validation failure charges tokens; missing usage keeps the hold and forbids replay", async () => {
  const f = await setup();
  mock.generate.mockResolvedValueOnce({ ...result, object: { ...result.object, sections: [] } });
  const first = await f.quote(); await f.confirm(first.attemptId, first.estimate);
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: first.attemptId })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 30, reservedUnits: 0 });
  mock.generate.mockResolvedValueOnce({ object: result.object });
  const next = await f.quote(); await f.confirm(next.attemptId, next.estimate);
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: next.attemptId })).rejects.toThrow("uncertain");
  expect(await f.teacher.query(ref("aiSpend:status", "query"), { attemptId: next.attemptId })).toMatchObject({ status: "needs_reconciliation" });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 100_000 });
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: next.attemptId })).rejects.toThrow("never replay");
  expect(mock.generate).toHaveBeenCalledTimes(2);
  const thrown = await f.quote(); await f.confirm(thrown.attemptId, thrown.estimate);
  mock.generate.mockRejectedValueOnce(Object.assign(new Error("Provider timed out"), { statusCode: 503 }));
  await expect(f.teacher.action(ref("documentGeneration:generateTeacherLessonPlanDraft"), { attemptId: thrown.attemptId })).rejects.toThrow("uncertain");
  expect(mock.generate).toHaveBeenCalledTimes(3);
  expect(await f.teacher.query(ref("aiSpend:status", "query"), { attemptId: thrown.attemptId })).toMatchObject({ status: "needs_reconciliation" });
});
