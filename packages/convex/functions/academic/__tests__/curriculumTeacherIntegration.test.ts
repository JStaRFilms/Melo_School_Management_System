import { convexTest } from "convex-test";
import type { FunctionReference, RegisteredQuery } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as lessonKnowledgeTeacher from "../lessonKnowledgeTeacher";

declare global { interface ImportMeta { glob(pattern: string): Record<string, () => Promise<unknown>>; } }
const modules = import.meta.glob("../../../**/*.ts");
const admin = { subject: "curriculum-teacher-admin" };
type QueryReference<Export> = Export extends RegisteredQuery<infer Visibility, infer Args, infer Result> ? FunctionReference<"query", Visibility, Args, Awaited<Result>> : never;
const listTopics = lessonKnowledgeTeacher.listTeacherKnowledgeTopics as unknown as QueryReference<typeof lessonKnowledgeTeacher.listTeacherKnowledgeTopics>;
const listWork = lessonKnowledgeTeacher.listTeacherPlanningTopicWork as unknown as QueryReference<typeof lessonKnowledgeTeacher.listTeacherPlanningTopicWork>;

describe("curriculum topics in teacher planning", () => {
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
      return { subjectId, termId, topicId, materialId };
    });

    const topics = await t.withIdentity(admin).query(listTopics, { subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId, limit: 80 });
    expect(topics.map((topic) => topic._id)).toEqual([ids.topicId]);
    const work = await t.withIdentity(admin).query(listWork, { subjectId: ids.subjectId, level: "JSS 1", termId: ids.termId, limit: 20 });
    expect(work).toHaveLength(1);
    expect(work[0]).toMatchObject({ topicId: ids.topicId, sourceCount: 1, readySourceCount: 1, sourceIds: [ids.materialId] });
  });
});
