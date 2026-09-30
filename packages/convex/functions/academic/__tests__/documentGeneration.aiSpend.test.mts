/// <reference types="vite/client" />
import { api, internal } from "../../../_generated/api";
import { internalMutation, mutation } from "../../../_generated/server";
import { v } from "convex/values";
import { NoObjectGeneratedError } from "ai";
import { convexTest } from "convex-test";
import { beforeEach, expect, it, vi } from "vitest";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";

const mock = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", async original => ({ ...await original<typeof import("ai")>(), generateObject: mock.generate }));
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const model = "nvidia/nemotron-3-super-120b-a12b:free";
const result = { object: { title: "Algebra lesson", subject: "Mathematics", level: "JSS 1", topic: "Algebra", sections: [{ sectionId: "content", label: "Content", content: "Worked examples with clear explanations and practice." }], sourceNotes: ["Source used"] }, usage: { inputTokens: 20, outputTokens: 10 }, response: { id: "openrouter-response-1" } };
beforeEach(() => { mock.generate.mockReset(); mock.generate.mockResolvedValue(result); });
async function setup(moduleMap = modules) {
  const t = convexTest(schema, moduleMap);
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
  async function quote() { return await teacher.action(api.functions.academic.documentGeneration.quoteTeacherLessonPlanDraft, { ...request, idempotencyKey: crypto.randomUUID().replaceAll("-", "") }) as { attemptId: Id<"usageOperationAttempts">; estimate: number }; }
  async function confirm(attemptId: Id<"usageOperationAttempts">, estimate: number) { await teacher.mutation(api.functions.academic.aiSpend.confirm, { attemptId, expectedUnits: estimate, confirmation: "CONFIRM" }); }
  return { ...ids, t, teacher, other, request, quote, confirm };
}
it("quotes, confirms, generates a real saved draft through a mocked provider and settles measured tokens once", async () => {
  const f = await setup();
  const quote = await f.quote();
  expect(quote.estimate).toBe(100_000);
  expect(mock.generate).not.toHaveBeenCalled();
  await f.confirm(quote.attemptId, quote.estimate);
  const saved = await f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quote.attemptId }) as { artifactId: string; documentState: string; generationMeta: { aiRunLogId: Id<"aiRunLogs"> } };
  expect(saved.artifactId).toBeTruthy();
  expect(saved.documentState).toContain("Worked examples");
  expect(await f.t.run(ctx => ctx.db.get(saved.generationMeta.aiRunLogId))).toMatchObject({ attemptId: quote.attemptId, status: "succeeded", tokenPromptCount: 20, tokenCompletionCount: 10 });
  expect(mock.generate).toHaveBeenCalledTimes(1);
  expect(mock.generate.mock.calls[0][0]).toMatchObject({ maxOutputTokens: 2048, maxRetries: 0 });
  const providerSchema = JSON.stringify(await mock.generate.mock.calls[0][0].schema.jsonSchema);
  expect(providerSchema).toContain("sections");
  const sent = mock.generate.mock.calls[0][0];
  const knownBytes = new TextEncoder().encode(sent.system + sent.prompt + providerSchema).length;
  expect(knownBytes * 16 + 4096).toBeLessThanOrEqual(quote.estimate);
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quote.attemptId })).rejects.toThrow("never replay");
  expect(mock.generate).toHaveBeenCalledTimes(1);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quote.attemptId })).toMatchObject({ status: "settled", actualUnits: 30, resultId: saved.artifactId });
  const events = await f.t.run(ctx => ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(5));
  expect(events).toMatchObject([{ unitsDelta: 30 }]);
});
it("keeps a claimed hold through quote expiry and stages a slow result after the dispatch watchdog", async () => {
  const f = await setup();
  const quoted = await f.quote();
  const attempt = await f.t.run(ctx => ctx.db.get(quoted.attemptId));
  if (!attempt?.expiresAt) throw new Error("missing expiry");
  const clock = Date.now;
  try {
    Date.now = () => attempt.expiresAt! - 500;
    await f.confirm(quoted.attemptId, quoted.estimate);
    mock.generate.mockImplementationOnce(async () => {
      Date.now = () => attempt.expiresAt! + 10_000;
      await f.t.mutation(internal.functions.academic.aiSpend.expire, { attemptId: quoted.attemptId });
      expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
        .toMatchObject({ status: "dispatch_started" });
      expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: quoted.estimate });
      await f.t.mutation(internal.functions.academic.aiSpend.watchDispatch, { attemptId: quoted.attemptId });
      expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
        .toMatchObject({ status: "needs_reconciliation" });
      return result;
    });
    const saved = await f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft,
      { attemptId: quoted.attemptId }) as { artifactId: string };
    expect(saved.artifactId).toBeTruthy();
    expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
      .toMatchObject({ status: "settled", actualUnits: 30, resultId: saved.artifactId });
    expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
    expect(mock.generate).toHaveBeenCalledTimes(1);
  } finally { Date.now = clock; }
});
it("generates an assessment with effective settings, binds profile edits and settles the saved bank", async () => {
  const f = await setup();
  const settings = { profileId: f.assessmentProfileId, questionStyle: "balanced", totalQuestions: 1,
    questionMix: { multiple_choice: 0, short_answer: 1, essay: 0, true_false: 0, fill_in_the_blank: 0 }, allowTeacherOverrides: true };
  const request = { draftMode: "practice_quiz", sourceIds: [f.sourceId], targetTopicLabel: "Algebra", effectiveGenerationSettings: settings };
  mock.generate.mockResolvedValue({ object: { title: "Algebra quiz", subject: "Mathematics", level: "JSS 1", topic: "Algebra", blueprint: "One question", questions: [{ number: 1, prompt: "Solve x+2=5", answer: "3", explanation: "Subtract 2", difficulty: "easy", marks: 2, tags: ["algebra"] }], answerKeyNotes: "Check working", sourceNotes: ["Source"] }, usage: { inputTokens: 40, outputTokens: 50 }, response: { id: "assessment-response-1" } });
  const quoted = await f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherAssessmentDraft, { ...request, idempotencyKey: "assessment-001" }) as { attemptId: Id<"usageOperationAttempts">; estimate: number };
  await f.confirm(quoted.attemptId, quoted.estimate);
  const saved = await f.teacher.action(api.functions.academic.documentGeneration.generateTeacherAssessmentDraft, { attemptId: quoted.attemptId }) as { bankId: string; itemCount: number };
  expect(saved.itemCount).toBe(1);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 90, reservedUnits: 0 });
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId })).toMatchObject({ resultId: saved.bankId });
  await expect(f.teacher.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft,
    { attemptId: quoted.attemptId, bankId: null, draftMode: "practice_quiz", title: "Forged bank",
      sourceIds: [f.sourceId], sourceSelectionSnapshot: "forged", effectiveGenerationSettings: settings,
      subjectId: f.subjectId, level: "JSS 1", topicLabel: "Algebra",
      items: [{ questionType: "short_answer", difficulty: "easy", promptText: "Forged",
        answerText: "Forged", explanationText: "Forged", marks: 1, tags: [] }] } as never)).rejects.toThrow();
  const second = await f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherAssessmentDraft, { ...request, idempotencyKey: "assessment-002" }) as { attemptId: Id<"usageOperationAttempts">; estimate: number };
  await f.confirm(second.attemptId, second.estimate);
  await f.t.run(ctx => ctx.db.patch(f.assessmentProfileId, { name: "Renamed profile" }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherAssessmentDraft, { attemptId: second.attemptId })).rejects.toThrow("changed");
  expect(mock.generate).toHaveBeenCalledTimes(1);
});
for (const editTiming of ["during_provider", "before_recovery"] as const) {
  it(`keeps newer manual assessment edits when they occur ${editTiming}`, async () => {
    const f = await setup();
    const settings = { profileId: f.assessmentProfileId, questionStyle: "balanced" as const, totalQuestions: 1,
      questionMix: { multiple_choice: 0, short_answer: 1, essay: 0, true_false: 0, fill_in_the_blank: 0 }, allowTeacherOverrides: true };
    const baseSave = { bankId: null as Id<"assessmentBanks"> | null, draftMode: "practice_quiz" as const, title: "Working bank",
      sourceIds: [f.sourceId], sourceSelectionSnapshot: "manual", effectiveGenerationSettings: settings,
      subjectId: f.subjectId, level: "JSS 1", topicLabel: "Algebra", items: [
        { questionType: "short_answer" as const, difficulty: "easy" as const, promptText: "Initial question",
          answerText: "Initial answer", explanationText: "Initial explanation", marks: 1, tags: ["algebra"] }],
    };
    const baseline = await f.teacher.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft, baseSave);
    const request = { draftMode: "practice_quiz" as const, sourceIds: [f.sourceId], targetTopicLabel: "Algebra", effectiveGenerationSettings: settings };
    const quoted = await f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherAssessmentDraft,
      { ...request, idempotencyKey: `assessment-conflict-${editTiming}` });
    await f.confirm(quoted.attemptId, quoted.estimate);
    const newer = { ...baseSave, bankId: baseline.bankId, title: "Newer manual bank", items: [
      { ...baseSave.items[0], promptText: "Teacher's newer question" }] };
    const generated = { object: { title: "Staged quiz", subject: "Mathematics", level: "JSS 1", topic: "Algebra",
      blueprint: "One question", questions: [{ number: 1, prompt: "AI question", answer: "3",
        explanation: "Subtract 2", difficulty: "easy", marks: 2, tags: ["algebra"] }],
      answerKeyNotes: "Check working", sourceNotes: ["Source"] },
      usage: { inputTokens: 40, outputTokens: 50 }, response: { id: `assessment-conflict-${editTiming}` } };
    mock.generate.mockImplementationOnce(async () => {
      if (editTiming === "during_provider") await f.teacher.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft, newer);
      else await f.t.run(ctx => ctx.db.patch(f.subjectId, { isArchived: true }));
      return generated;
    });
    await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherAssessmentDraft,
      { attemptId: quoted.attemptId })).rejects.toThrow();
    if (editTiming === "before_recovery") {
      await f.t.run(ctx => ctx.db.patch(f.subjectId, { isArchived: false }));
      await f.teacher.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft, newer);
    }
    await expect(f.teacher.action(api.functions.academic.documentGeneration.recoverTeacherGenerationDraft,
      { attemptId: quoted.attemptId })).rejects.toThrow("Assessment draft changed");
    expect(await f.t.run(ctx => ctx.db.get(baseline.bankId))).toMatchObject({ title: "Newer manual bank", draftRevision: 2 });
    const items = await f.t.run(ctx => ctx.db.query("assessmentBankItems")
      .withIndex("by_school_and_bank", q => q.eq("schoolId", f.schoolId).eq("bankId", baseline.bankId)).take(5));
    expect(items).toHaveLength(1);
    expect(items[0].promptText).toBe("Teacher's newer question");
    expect(await f.t.run(ctx => ctx.db.query("aiGenerationResults")
      .withIndex("by_attempt", q => q.eq("attemptId", quoted.attemptId)).unique())).not.toBeNull();
    expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
      .toMatchObject({ status: "settled", actualUnits: 90, resultId: null });
    expect(mock.generate).toHaveBeenCalledTimes(1);
  });
}
for (const scenario of [
  { draftMode: "practice_quiz" as const, mix: { multiple_choice: 3, short_answer: 4, essay: 1, true_false: 1, fill_in_the_blank: 1 }, outputCap: 4256 },
  { draftMode: "exam_draft" as const, mix: { multiple_choice: 16, short_answer: 0, essay: 0, true_false: 2, fill_in_the_blank: 2 }, outputCap: 7104 },
]) {
  it(`budgets a normal ${scenario.draftMode} mix and uses its confirmed output cap`, async () => {
    const f = await setup();
    const count = Object.values(scenario.mix).reduce((sum, value) => sum + value, 0);
    const settings = { profileId: f.assessmentProfileId, questionStyle: "balanced" as const, totalQuestions: count,
      questionMix: scenario.mix, allowTeacherOverrides: true };
    const questions = Array.from({ length: count }, (_, index) => ({ number: index + 1, prompt: `Question ${index + 1}`,
      answer: "Answer", explanation: "Explanation with working", difficulty: "easy", marks: 2, tags: ["algebra"] }));
    const common = { title: "Algebra questions", subject: "Mathematics", level: "JSS 1", topic: "Algebra",
      answerKeyNotes: "Review answers", sourceNotes: ["Source"] };
    const object = scenario.draftMode === "exam_draft"
      ? { ...common, examMode: "class exam", timeLimitMinutes: 40, instructions: ["Answer all"],
        sections: [{ title: "Questions", instructions: ["Work carefully"], questions }] }
      : { ...common, blueprint: "Mixed questions", questions };
    mock.generate.mockResolvedValueOnce({ object, usage: { inputTokens: 40, outputTokens: 50 }, response: { id: "mixed-response" } });
    const quoted = await f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherAssessmentDraft,
      { draftMode: scenario.draftMode, sourceIds: [f.sourceId], targetTopicLabel: "Algebra",
        effectiveGenerationSettings: settings, idempotencyKey: `mixed-${scenario.draftMode}` });
    await f.confirm(quoted.attemptId, quoted.estimate);
    const saved = await f.teacher.action(api.functions.academic.documentGeneration.generateTeacherAssessmentDraft,
      { attemptId: quoted.attemptId }) as { itemCount: number };
    expect(saved.itemCount).toBe(count);
    expect(mock.generate).toHaveBeenCalledTimes(1);
    const call = mock.generate.mock.calls[0][0];
    expect(call).toMatchObject({ maxOutputTokens: scenario.outputCap, maxRetries: 0 });
    const schema = JSON.stringify(await call.schema.jsonSchema);
    const inputBytes = new TextEncoder().encode(call.system + call.prompt + schema).length;
    expect(quoted.estimate).toBeGreaterThanOrEqual(inputBytes * 16 + scenario.outputCap + 2048);
    expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 90, reservedUnits: 0 });
  });
}
it("refuses an oversized AI assessment before quote or provider while manual saves still work", async () => {
  const f = await setup();
  const settings = { profileId: f.assessmentProfileId, questionStyle: "balanced" as const, totalQuestions: 60,
    questionMix: { multiple_choice: 0, short_answer: 0, essay: 60, true_false: 0, fill_in_the_blank: 0 }, allowTeacherOverrides: true };
  await expect(f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherAssessmentDraft,
    { draftMode: "class_test", sourceIds: [f.sourceId], targetTopicLabel: "Algebra",
      effectiveGenerationSettings: settings, idempotencyKey: "oversize-ai-001" })).rejects.toThrow("Reduce the question mix");
  expect(mock.generate).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.query("usageOperationAttempts").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(5))).toHaveLength(0);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 0, reservedUnits: 0 });
  const manual = await f.teacher.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft,
    { bankId: null, draftMode: "class_test", title: "Manually edited test", sourceIds: [f.sourceId],
      sourceSelectionSnapshot: "manual", effectiveGenerationSettings: settings, subjectId: f.subjectId,
      level: "JSS 1", topicLabel: "Algebra", items: [{ questionType: "essay", difficulty: "easy",
        promptText: "Write an explanation", answerText: "Worked answer", explanationText: "Working", marks: 2, tags: ["algebra"] }] });
  expect(manual.bankId).toBeTruthy();
});
it("immediately releases a rate-denied reservation without any provider charge", async () => {
  const f = await setup();
  for (let i = 0; i < 10; i += 1) {
    const admitted = await f.teacher.mutation(api.functions.academic.lessonKnowledgeRateLimits.consumeTeacherLessonPlanGenerationLimit, {});
    expect(admitted.allowed).toBe(true);
  }
  const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft,
    { attemptId: quoted.attemptId })).rejects.toThrow("Rate limit exceeded");
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
    .toMatchObject({ status: "cancelled", actualUnits: null });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 0 });
  expect(await f.t.run(ctx => ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(5))).toHaveLength(0);
  expect(mock.generate).not.toHaveBeenCalled();
});
it("cannot cancel another caller's claimed attempt while handling pre-dispatch denial", async () => {
  const f = await setup();
  const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  const attempt = await f.t.run(ctx => ctx.db.get(quoted.attemptId));
  if (!attempt?.requestDigest || !attempt.modelId) throw new Error("missing bound attempt");
  await f.teacher.mutation(internal.functions.academic.aiSpend.claim,
    { attemptId: quoted.attemptId, digest: attempt.requestDigest, modelId: attempt.modelId });
  await expect(f.teacher.mutation(api.functions.academic.aiSpend.cancel,
    { attemptId: quoted.attemptId })).rejects.toThrow("cannot be cancelled");
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
    .toMatchObject({ status: "dispatch_started" });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: quoted.estimate, consumedUnits: 0 });
});
it("keeps a concurrent caller's claimed hold when the denying rate check races cancellation", async () => {
  const key = "./functions/academic/lessonKnowledgeRateLimits.ts";
  let attemptId: Id<"usageOperationAttempts">;
  let digest = "";
  let modelId = "";
  const override = { ...modules, [key]: async () => ({
    ...await (modules[key] as () => Promise<object>)(),
    consumeTeacherLessonPlanGenerationLimit: mutation({ args: {}, handler: async ctx => {
      await ctx.runMutation(internal.functions.academic.aiSpend.claim, { attemptId, digest, modelId });
      return { allowed: false, action: "teacher_lesson_plan_generation", limit: 10, remaining: 0,
        resetAt: Date.now() + 60_000, retryAfterMs: 60_000 };
    } }),
  }) };
  const f = await setup(override);
  const quoted = await f.quote(); attemptId = quoted.attemptId;
  const attempt = await f.t.run(ctx => ctx.db.get(attemptId));
  if (!attempt?.requestDigest || !attempt.modelId) throw new Error("missing bound attempt");
  digest = attempt.requestDigest; modelId = attempt.modelId;
  await f.confirm(attemptId, quoted.estimate);
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft,
    { attemptId })).rejects.toThrow("Rate limit exceeded");
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId })).toMatchObject({ status: "dispatch_started" });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: quoted.estimate, consumedUnits: 0 });
  expect(mock.generate).not.toHaveBeenCalled();
});
it("denies unauthorized requests and insufficient allowance before a provider call", async () => {
  const f = await setup();
  await expect(f.other.action(api.functions.academic.documentGeneration.quoteTeacherLessonPlanDraft, { ...f.request, idempotencyKey: "foreign-request" })).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.meterId, { consumedUnits: 450_000 }));
  await expect(f.quote()).rejects.toThrow("allowance short");
  expect(mock.generate).not.toHaveBeenCalled();
});
it("rejects a reused quote key for changed inputs, direct generation args and revoked capability", async () => {
  const f = await setup();
  const quote = await f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherLessonPlanDraft, { ...f.request, idempotencyKey: "bound-request-001" }) as { attemptId: Id<"usageOperationAttempts">; estimate: number };
  await expect(f.teacher.action(api.functions.academic.documentGeneration.quoteTeacherLessonPlanDraft, { ...f.request, targetTopicLabel: "Geometry", idempotencyKey: "bound-request-001" })).rejects.toThrow("different work");
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, f.request as never)).rejects.toThrow();
  await f.confirm(quote.attemptId, quote.estimate);
  await f.t.run(ctx => ctx.db.patch(f.membershipId, { status: "suspended" }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quote.attemptId })).rejects.toThrow();
  expect(mock.generate).not.toHaveBeenCalled();
});
it("changed source content or template invalidates a confirmed quote without dispatch", async () => {
  const f = await setup();
  const quote = await f.quote(); await f.confirm(quote.attemptId, quote.estimate);
  await f.t.run(ctx => ctx.db.patch(f.chunkId, { chunkText: "Changed excerpt before dispatch" }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quote.attemptId })).rejects.toThrow("changed");
  expect(mock.generate).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0 });
  const again = await f.quote(); await f.confirm(again.attemptId, again.estimate);
  await f.t.run(ctx => ctx.db.patch(f.templateId, { title: "New template" }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: again.attemptId })).rejects.toThrow("changed");
});
it("rejects a model override changed after a confirmed quote", async () => {
  const f = await setup(); const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  const before = process.env.SCHOOL_AI_LESSON_PLAN_MODEL;
  try {
    process.env.SCHOOL_AI_LESSON_PLAN_MODEL = "other/changed-model";
    await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quoted.attemptId })).rejects.toThrow("changed");
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
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quoted.attemptId })).rejects.toThrow();
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId })).toMatchObject({ status: "settled", actualUnits: 30, resultId: null });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
  await f.t.run(ctx => ctx.db.patch(f.subjectId, { isArchived: false }));
  const fakeSave = { artifactId: null, expectedRevisionNumber: 0, outputType: "lesson_plan" as const, title: "Forged output", documentState: "# Not from provider", plainText: "Not from provider", sourceIds: [f.sourceId], subjectId: f.subjectId, level: "JSS 1", topicLabel: "Algebra", revisionKind: "generated" as const };
  await expect(f.teacher.mutation(api.functions.academic.lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft, { ...fakeSave, attemptId: quoted.attemptId } as never)).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.query("aiGenerationResults").withIndex("by_attempt", q => q.eq("attemptId", quoted.attemptId)).unique())).not.toBeNull();
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId })).toMatchObject({ resultId: null });
  const saved = await f.teacher.action(api.functions.academic.documentGeneration.recoverTeacherGenerationDraft, { attemptId: quoted.attemptId }) as { artifactId: Id<"instructionArtifacts">; revisionNumber: number };
  expect(saved.artifactId).toBeTruthy();
  expect(await f.t.run(ctx => ctx.db.query("aiGenerationResults").withIndex("by_attempt", q => q.eq("attemptId", quoted.attemptId)).unique())).toBeNull();
  expect(mock.generate).toHaveBeenCalledTimes(1);
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 30 });
  const events = await f.t.run(ctx => ctx.db.query("usageEvents").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(5));
  expect(events).toHaveLength(1);
  expect(await f.teacher.action(api.functions.academic.documentGeneration.recoverTeacherGenerationDraft, { attemptId: quoted.attemptId })).toMatchObject({ resultId: saved.artifactId });
  const manual = await f.teacher.mutation(api.functions.academic.lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft,
    { ...fakeSave, artifactId: saved.artifactId, expectedRevisionNumber: saved.revisionNumber, revisionKind: "manual_save" });
  expect(manual.revisionNumber).toBe(saved.revisionNumber + 1);
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId })).toMatchObject({ resultId: saved.artifactId });
});
it("settles complete SDK NoObject usage from a thrown response and never replays it", async () => {
  const f = await setup();
  const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  mock.generate.mockRejectedValueOnce(new NoObjectGeneratedError({ message: "response did not match schema", text: "invalid",
    response: { id: "sdk-failed-1", timestamp: new Date(), modelId: model },
    usage: { inputTokens: 12, outputTokens: 7 } as never, finishReason: "error" }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quoted.attemptId })).rejects.toThrow();
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId })).toMatchObject({ status: "settled", actualUnits: 19, outcome: "failed" });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 0, consumedUnits: 19 });
  const attempt = await f.t.run(ctx => ctx.db.get(quoted.attemptId));
  expect(attempt?.evidence).toContain("sdk:no-object:provider:sdk-failed-1");
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quoted.attemptId })).rejects.toThrow("never replay");
  expect(mock.generate).toHaveBeenCalledTimes(1);
});
it("reports staging failure safely even if the uncertainty transition also fails", async () => {
  const key = "./functions/academic/aiSpend.ts";
  const override = { ...modules, [key]: async () => ({
    ...await (modules[key] as () => Promise<object>)(),
    stage: internalMutation({
      args: { attemptId: v.id("usageOperationAttempts"), payload: v.string(), inputTokens: v.number(), outputTokens: v.number(), evidence: v.string() },
      handler: async () => { throw new Error("raw private generated content: secret"); },
    }),
    uncertain: internalMutation({
      args: { attemptId: v.id("usageOperationAttempts") },
      handler: async () => { throw new Error("second private error"); },
    }),
  }) };
  const f = await setup(override);
  const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  const failure = await f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft,
    { attemptId: quoted.attemptId }).then(() => null, error => error);
  expect(String(failure)).toContain("Measured provider result could not be staged or marked for review");
  expect(String(failure)).not.toContain("raw private generated content");
  expect(String(failure)).not.toContain("second private error");
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: quoted.attemptId }))
    .toMatchObject({ status: "dispatch_started", resultId: null });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: quoted.estimate, consumedUnits: 0 });
  expect(mock.generate).toHaveBeenCalledTimes(1);
});
it("holds a branded SDK error when its usage is partial", async () => {
  const f = await setup(); const quoted = await f.quote(); await f.confirm(quoted.attemptId, quoted.estimate);
  mock.generate.mockRejectedValueOnce(new NoObjectGeneratedError({ message: "invalid schema", text: "invalid",
    response: { id: "partial-1", timestamp: new Date(), modelId: model },
    usage: { inputTokens: 12, outputTokens: undefined } as never, finishReason: "error" }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: quoted.attemptId })).rejects.toThrow("uncertain");
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 0, reservedUnits: quoted.estimate });
});
it("known validation failure charges tokens; missing usage keeps the hold and forbids replay", async () => {
  const f = await setup();
  mock.generate.mockResolvedValueOnce({ ...result, object: { ...result.object, sections: [] } });
  const first = await f.quote(); await f.confirm(first.attemptId, first.estimate);
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: first.attemptId })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ consumedUnits: 30, reservedUnits: 0 });
  mock.generate.mockResolvedValueOnce({ object: result.object });
  const next = await f.quote(); await f.confirm(next.attemptId, next.estimate);
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: next.attemptId })).rejects.toThrow("uncertain");
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: next.attemptId })).toMatchObject({ status: "needs_reconciliation" });
  expect(await f.t.run(ctx => ctx.db.get(f.meterId))).toMatchObject({ reservedUnits: 100_000 });
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: next.attemptId })).rejects.toThrow("never replay");
  expect(mock.generate).toHaveBeenCalledTimes(2);
  const thrown = await f.quote(); await f.confirm(thrown.attemptId, thrown.estimate);
  mock.generate.mockRejectedValueOnce(Object.assign(new Error("Provider timed out"), { statusCode: 503,
    usage: { inputTokens: 9, outputTokens: 8 }, response: { id: "untrusted-error" } }));
  await expect(f.teacher.action(api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft, { attemptId: thrown.attemptId })).rejects.toThrow("uncertain");
  expect(mock.generate).toHaveBeenCalledTimes(3);
  expect(await f.teacher.query(api.functions.academic.aiSpend.status, { attemptId: thrown.attemptId })).toMatchObject({ status: "needs_reconciliation" });
});
