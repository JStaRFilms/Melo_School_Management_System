import { convexTest } from "convex-test";
import type { FunctionReference, RegisteredQuery } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as curriculumReadiness from "../curriculumReadiness";
import { countCurriculumReadiness, describeCurriculumReadiness } from "../curriculumReadinessHelpers";

declare global { interface ImportMeta { glob(pattern: string): Record<string, () => Promise<unknown>>; } }

const modules = import.meta.glob("../../../**/*.ts");
const admin = { subject: "readiness-admin" };
type QueryReference<Export> = Export extends RegisteredQuery<infer Visibility, infer Args, infer Result> ? FunctionReference<"query", Visibility, Args, Awaited<Result>> : never;
const getAdminCurriculumReadiness = curriculumReadiness.getAdminCurriculumReadiness as unknown as QueryReference<typeof curriculumReadiness.getAdminCurriculumReadiness>;

describe("curriculum readiness aggregation", () => {
  it("reports only factual preparation states and totals", () => {
    const complete = { source: true, lessonPlan: true, studentNote: true, assignment: true, assessment: true, studentPublication: true };
    const partial = { source: true, lessonPlan: false, studentNote: true, assignment: false, assessment: false, studentPublication: false };
    expect(describeCurriculumReadiness(partial)).toEqual({
      sourceStatus: "approved_curriculum_unit", lessonPlanStatus: "no_lesson_plan_prepared", studentNoteStatus: "student_note_prepared",
      assignmentStatus: "no_assignment_prepared", assessmentStatus: "no_assessment_drafted", studentPublicationStatus: "no_student_resource_published",
    });
    expect(countCurriculumReadiness([complete, partial])).toEqual({
      topicCount: 2, sourceApprovedCount: 2, lessonPlanPreparedCount: 1, studentNotePreparedCount: 2,
      assignmentPreparedCount: 1, assessmentDraftedCount: 1, studentResourcePublishedCount: 1,
    });
  });

  it("derives one school-scoped readiness map and rejects non-admins", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Alpha", slug: "alpha-readiness", createdAt: now, updatedAt: now });
      const otherSchoolId = await ctx.db.insert("schools", { name: "Beta", slug: "beta-readiness", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: "readiness-admin", name: "Admin", email: "admin@alpha.test", role: "admin", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: "readiness-teacher", name: "Teacher", email: "teacher@alpha.test", role: "teacher", createdAt: now, updatedAt: now });
      const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Mathematics", code: "MAT", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term 1", startDate: now, endDate: 2, isActive: true, createdAt: now, updatedAt: now });
      const distractorSubjectId = await ctx.db.insert("subjects", { schoolId, name: "English", code: "ENG", createdAt: now, updatedAt: now });
      const distractorTopicId = await ctx.db.insert("knowledgeTopics", { schoolId, subjectId: distractorSubjectId, level: "JSS 1", termId, title: "Comprehension", slug: "comprehension", searchText: "comprehension", status: "active", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      for (let index = 0; index <= 400; index += 1) await ctx.db.insert("instructionArtifacts", { schoolId, ownerUserId: adminId, ownerRole: "admin", outputType: "lesson_plan", artifactStatus: "active", visibility: "staff_shared", reviewStatus: "approved", subjectId: distractorSubjectId, level: "JSS 1", topicId: distractorTopicId, searchStatus: "indexed", searchText: `distractor-${index}`, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      for (let index = 0; index <= 50; index += 1) await ctx.db.insert("knowledgeTopics", { schoolId, subjectId, level: "JSS 1", termId, title: `Retired ${index}`, slug: `retired-${index}`, searchText: `retired-${index}`, status: "retired", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const topicId = await ctx.db.insert("knowledgeTopics", { schoolId, subjectId, level: "JSS 1", termId, title: "Fractions", slug: "fractions", searchText: "fractions", status: "active", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      for (let index = 0; index < 30; index += 1) await ctx.db.insert("knowledgeTopics", { schoolId, subjectId, level: "JSS 1", termId, title: `Active ${index}`, slug: `active-${index}`, searchText: `active-${index}`, status: "active", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const materialId = await ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: adminId, ownerRole: "admin", sourceType: "imported_curriculum", visibility: "staff_shared", reviewStatus: "approved", title: "Scheme", level: "JSS 1", topicLabel: "Fractions", searchStatus: "indexed", searchText: "scheme", processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      const importId = await ctx.db.insert("curriculumImports", { schoolId, materialId, subjectId, level: "JSS 1", termId, status: "approved", requestedBy: adminId, promptVersion: "v1", schemaVersion: "v1", proposedUnitCount: 1, approvedUnitCount: 1, rejectedUnitCount: 0, duplicateWarningCount: 0, createdAt: now, updatedAt: now });
      for (let index = 0; index <= 50; index += 1) await ctx.db.insert("curriculumUnits", { schoolId, importId, materialId, title: `Proposed ${index}`, subtopics: ["parts"], learningObjectives: ["compare"], sourcePages: [1], sourceChunkHash: `proposed-${index}`, supportingExcerpt: "parts", confidence: 1, reviewStatus: "proposed", validationWarnings: [], duplicateWarnings: [], knowledgeTopicId: topicId, createdAt: now, updatedAt: now });
      await ctx.db.insert("curriculumUnits", { schoolId, importId, materialId, title: "Fractions", subtopics: ["parts"], learningObjectives: ["compare"], sourcePages: [1], sourceChunkHash: "chunk", supportingExcerpt: "parts", confidence: 1, reviewStatus: "approved", validationWarnings: [], duplicateWarnings: [], knowledgeTopicId: topicId, createdAt: now, updatedAt: now });
      for (let index = 0; index <= 50; index += 1) await ctx.db.insert("instructionArtifacts", { schoolId, ownerUserId: adminId, ownerRole: "admin", outputType: "lesson_plan", artifactStatus: "archived", visibility: "staff_shared", reviewStatus: "approved", subjectId, level: "JSS 1", topicId, searchStatus: "indexed", searchText: `archived-${index}`, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      for (const outputType of ["lesson_plan", "student_note", "assignment"] as const) await ctx.db.insert("instructionArtifacts", { schoolId, ownerUserId: adminId, ownerRole: "admin", outputType, artifactStatus: "active", visibility: "staff_shared", reviewStatus: "approved", subjectId, level: "JSS 1", topicId, searchStatus: "indexed", searchText: outputType, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      for (let index = 0; index <= 50; index += 1) await ctx.db.insert("assessmentBanks", { schoolId, ownerUserId: adminId, ownerRole: "admin", outputType: "question_bank_draft", bankStatus: "archived", title: `Archived ${index}`, visibility: "staff_shared", reviewStatus: "approved", subjectId, level: "JSS 1", topicId, searchStatus: "indexed", searchText: `archived-bank-${index}`, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      await ctx.db.insert("assessmentBanks", { schoolId, ownerUserId: adminId, ownerRole: "admin", outputType: "question_bank_draft", bankStatus: "active", title: "Fractions quiz", visibility: "staff_shared", reviewStatus: "approved", subjectId, level: "JSS 1", topicId, searchStatus: "indexed", searchText: "quiz", createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      for (let index = 0; index <= 50; index += 1) await ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: adminId, ownerRole: "admin", sourceType: "generated_draft", visibility: "staff_shared", reviewStatus: "draft", title: `Unpublished ${index}`, subjectId, level: "JSS 1", topicLabel: "Fractions", topicId, searchStatus: "indexed", searchText: `unpublished-${index}`, processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      await ctx.db.insert("knowledgeMaterials", { schoolId, ownerUserId: adminId, ownerRole: "admin", sourceType: "generated_draft", visibility: "student_approved", reviewStatus: "approved", title: "Fractions note", subjectId, level: "JSS 1", topicLabel: "Fractions", topicId, searchStatus: "indexed", searchText: "note", processingStatus: "ready", ingestionErrorMessage: null, ingestionAttemptCount: 0, labelSuggestions: [], chunkCount: 1, indexedAt: now, createdAt: now, updatedAt: now, createdBy: adminId, updatedBy: adminId });
      await ctx.db.insert("subjects", { schoolId: otherSchoolId, name: "Hidden", code: "HID", createdAt: now, updatedAt: now });
      return { subjectId, termId };
    });
    const result = await t.withIdentity(admin).query(getAdminCurriculumReadiness, { subjectId: ids.subjectId, termId: ids.termId, level: " JSS 1 " });
    expect(result.counts).toEqual({ topicCount: 31, sourceApprovedCount: 1, lessonPlanPreparedCount: 1, studentNotePreparedCount: 1, assignmentPreparedCount: 1, assessmentDraftedCount: 1, studentResourcePublishedCount: 1 });
    expect(result.rows).toHaveLength(25);
    expect(result.rows[0]).toMatchObject({ title: "Fractions", studentPublicationStatus: "student_resource_published" });
    await expect(t.withIdentity({ subject: "readiness-teacher" }).query(getAdminCurriculumReadiness, { subjectId: ids.subjectId, termId: ids.termId, level: "JSS 1" })).rejects.toThrow("Admin access required");
  });
});
