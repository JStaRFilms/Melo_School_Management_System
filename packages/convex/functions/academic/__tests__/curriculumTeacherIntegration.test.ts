import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

declare global { interface ImportMeta { glob(pattern: string): Record<string, () => Promise<unknown>>; } }
const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob("../../../**/*.ts");
const modules = Object.fromEntries(
  Object.entries(rawModules).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);
const admin = { subject: "curriculum-teacher-admin", issuer: "https://legacy-auth.test" };

describe("curriculum topics in teacher planning", () => {
  it("keeps a subjectless curriculum-planning source attached in the subject-specific lesson workspace", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Alpha", slug: "broad-curriculum-source", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: "curriculum-teacher-admin", name: "Admin", email: "admin@broad-curriculum.test", role: "admin", createdAt: now, updatedAt: now });
      const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Social Studies", code: "SOS", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Second Term", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
      const classId = await ctx.db.insert("classes", { schoolId, name: "JSS 1A", level: "JSS 1", gradeName: "JSS 1", createdAt: now, updatedAt: now });
      const materialId = await ctx.db.insert("knowledgeMaterials", {
        schoolId, ownerUserId: adminId, ownerRole: "admin", sourceType: "imported_curriculum", visibility: "staff_shared", reviewStatus: "approved",
        title: "Whole-school second term scheme", level: "JSS 1", topicLabel: "Second Term", searchStatus: "indexed", searchText: "second term scheme",
        processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now,
        createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId,
      });
      return { schoolId, subjectId, termId, classId, materialId };
    });

    const importId = await t.withIdentity(admin).mutation(api.functions.academic.curriculumImportLifecycle.createCurriculumImport, {
      materialId: ids.materialId, subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId,
    });
    // Seed the extracted proposal; approval is the real source-to-topic linkage under test.
    const unitId = await t.run((ctx) => ctx.db.insert("curriculumUnits", {
      schoolId: ids.schoolId, importId, materialId: ids.materialId, title: "Safety Club", subtopics: [],
      learningObjectives: ["Describe road safety clubs"], sourcePages: [3], sourceChunkHash: "chunk-3",
      supportingExcerpt: "Safety Club as an Agent of Socialization", confidence: 1, reviewStatus: "proposed",
      validationWarnings: [], duplicateWarnings: [], createdAt: 1, updatedAt: 1,
    }));
    const topicId = await t.withIdentity(admin).mutation(api.functions.academic.curriculumReviewLifecycle.approveCurriculumUnit, { unitId });
    const persisted = await t.run(async (ctx) => ({
      material: await ctx.db.get(ids.materialId),
      importRecord: await ctx.db.get(importId),
      unit: await ctx.db.get(unitId),
      topic: await ctx.db.get(topicId),
    }));
    expect(persisted.material?.subjectId).toBeUndefined();
    expect(persisted.material?.level).toBe("JSS 1");
    expect(persisted.importRecord).toMatchObject({ materialId: ids.materialId, subjectId: ids.subjectId, status: "approved" });
    expect(persisted.unit).toMatchObject({ materialId: ids.materialId, knowledgeTopicId: topicId, reviewStatus: "approved" });
    expect(persisted.topic).toMatchObject({ subjectId: ids.subjectId, level: "JSS 1" });

    const work = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, { subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId, limit: 20 });
    expect(work.items).toMatchObject([{ topicId, sourceIds: [ids.materialId], sourceCount: 1 }]);

    const workspace = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace, {
      outputType: "lesson_plan", sourceIds: work.items[0].sourceIds,
      planningContext: { kind: "topic", classId: ids.classId, termId: ids.termId, subjectId: ids.subjectId, level: "JSS 1", topicId },
    });
    expect(workspace.sourceIds).toEqual([ids.materialId]);
    expect(workspace.selectedSources.map((source) => source._id)).toContain(ids.materialId);
    expect(workspace.selectedSourceCount).toBe(1);
    expect(workspace.inaccessibleSourceIds).toEqual([]);

    const { matchingId, subjectlessFileId } = await t.run(async (ctx) => {
      const common = {
        schoolId: ids.schoolId, ownerUserId: persisted.material!.ownerUserId, ownerRole: "admin" as const,
        visibility: "staff_shared" as const, reviewStatus: "approved" as const,
        level: "JSS 1", topicLabel: "Safety Club", searchStatus: "indexed" as const,
        searchText: "safety club", processingStatus: "ready" as const,
        ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1,
        indexedAt: 1, createdAt: 1, updatedAt: 1,
        createdBy: persisted.material!.ownerUserId, updatedBy: persisted.material!.ownerUserId,
      };
      const matchingId = await ctx.db.insert("knowledgeMaterials", {
        ...common, sourceType: "file_upload", subjectId: ids.subjectId, title: "Safety Club handout", topicId,
      });
      const subjectlessFileId = await ctx.db.insert("knowledgeMaterials", {
        ...common, sourceType: "file_upload", title: "Unscoped handout", topicId,
      });
      return { matchingId, subjectlessFileId };
    });
    const planningContext = { kind: "topic" as const, classId: ids.classId, termId: ids.termId, subjectId: ids.subjectId, level: "JSS 1", topicId };
    const mixedWorkspace = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace, {
      outputType: "lesson_plan", sourceIds: [ids.materialId, matchingId], planningContext,
    });
    expect(mixedWorkspace.selectedSources.map((source) => source._id)).toEqual([ids.materialId, matchingId]);
    expect(mixedWorkspace.warnings).not.toContain(
      "The selected sources span more than one subject. The first accessible source is being used for template resolution."
    );

    const invalidWorkspace = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace, {
      outputType: "lesson_plan", sourceIds: [ids.materialId, subjectlessFileId], planningContext,
    });
    expect(invalidWorkspace.inaccessibleSourceIds).toEqual([String(subjectlessFileId)]);
    expect(invalidWorkspace.selectedSources.map((source) => source._id)).toEqual([ids.materialId]);
  });

  it("uses exact topic scope and inherits the approved curriculum source", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Alpha", slug: "teacher-curriculum", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: "curriculum-teacher-admin", name: "Admin", email: "admin@teacher-curriculum.test", role: "admin", createdAt: now, updatedAt: now });
      const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Social Studies", code: "SOS", createdAt: now, updatedAt: now });
      const distractorSubjectId = await ctx.db.insert("subjects", { schoolId, name: "English", code: "ENG", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Second Term", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
      await ctx.db.insert("classes", { schoolId, name: "JSS 1A", level: "JSS 1", gradeName: "JSS 1", createdAt: now, updatedAt: now });
      for (let index = 0; index < 301; index += 1) await ctx.db.insert("knowledgeTopics", { schoolId, subjectId: distractorSubjectId, level: "JSS 1", termId, title: `Distractor ${index}`, slug: `distractor-${index}`, searchText: `distractor-${index}`, status: "active", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const topicId = await ctx.db.insert("knowledgeTopics", { schoolId, subjectId, level: "JSS 1", termId, title: "Safety Club", normalizedTitle: "safety club", slug: "safety-club", searchText: "safety club", status: "active", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const materialId = await ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: adminId, ownerRole: "admin", sourceType: "imported_curriculum", visibility: "staff_shared", reviewStatus: "approved", title: "Second Term Scheme", subjectId, level: "JSS 1", topicLabel: "Second Term", searchStatus: "indexed", searchText: "second term scheme", processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const importId = await ctx.db.insert("curriculumImports", { schoolId, materialId, subjectId, level: "JSS 1", termId, status: "approved", requestedBy: adminId, promptVersion: "v1", schemaVersion: "v1", proposedUnitCount: 0, approvedUnitCount: 1, rejectedUnitCount: 0, duplicateWarningCount: 0, createdAt: now, updatedAt: now });
      await ctx.db.insert("curriculumUnits", { schoolId, importId, materialId, title: "Safety Club", subtopics: [], learningObjectives: ["Describe road safety clubs"], sourcePages: [3], sourceChunkHash: "chunk-3", supportingExcerpt: "Safety Club as an Agent of Socialization", confidence: 1, reviewStatus: "approved", knowledgeTopicId: topicId, validationWarnings: [], duplicateWarnings: [], createdAt: now, updatedAt: now });
      return { subjectId, distractorSubjectId, termId, topicId, materialId };
    });

    const topics = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherKnowledgeTopics, { subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId, limit: 80 });
    expect(topics.map((topic) => topic._id)).toEqual([ids.topicId]);
    const work = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, { subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId, limit: 20 });
    expect(work).toMatchObject({ totalCount: 1, totalIsExact: true, hasMore: false });
    expect(work.items).toHaveLength(1);
    expect(work.items[0]).toMatchObject({ topicId: ids.topicId, sourceCount: 1, readySourceCount: 1, sourceIds: [ids.materialId] });

    const subjectPage = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, { subjectId: ids.distractorSubjectId, limit: 18 });
    expect(subjectPage).toMatchObject({ totalCount: 301, totalIsExact: true, hasMore: true });
    expect(subjectPage.items).toHaveLength(18);
    expect(subjectPage.items.every((item) => item.subjectId === ids.distractorSubjectId)).toBe(true);
    expect(subjectPage.subjectCounts).toEqual([
      { id: ids.distractorSubjectId, name: "English", count: 301 },
      { id: ids.subjectId, name: "Social Studies", count: 1 },
    ]);

    const combinedFilter = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, {
      searchQuery: "Distractor",
      subjectId: ids.distractorSubjectId,
      limit: 18,
    });
    expect(combinedFilter).toMatchObject({ totalCount: 301, totalIsExact: true, hasMore: true });
    expect(combinedFilter.items).toHaveLength(18);
    expect(combinedFilter.items.every((item) => item.subjectId === ids.distractorSubjectId)).toBe(true);

    const searchResult = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, { searchQuery: "Safety Club", limit: 18 });
    expect(searchResult).toMatchObject({ totalCount: 1, totalIsExact: true, hasMore: false });
    expect(searchResult.items.map((item) => item.topicId)).toEqual([ids.topicId]);

    const firstPage = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, { searchQuery: "Distractor", limit: 18 });
    expect(firstPage).toMatchObject({ totalCount: 301, totalIsExact: true, hasMore: true });
    expect(firstPage.items).toHaveLength(18);

    const expandedPage = await t.withIdentity(admin).query(api.functions.academic.lessonKnowledgeTeacher.listTeacherPlanningTopicWork, { searchQuery: "Distractor", limit: 36 });
    expect(expandedPage).toMatchObject({ totalCount: 301, totalIsExact: true, hasMore: true });
    expect(expandedPage.items).toHaveLength(36);
  });
});
