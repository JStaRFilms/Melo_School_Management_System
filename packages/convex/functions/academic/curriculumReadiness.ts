import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";
import { countCurriculumReadiness, describeCurriculumReadiness, type ReadinessEvidence } from "./curriculumReadinessHelpers";

const MAX_TOPICS = 50;
const statusValidator = v.union(
  v.literal("approved_curriculum_unit"), v.literal("no_approved_curriculum_unit"),
  v.literal("lesson_plan_prepared"), v.literal("no_lesson_plan_prepared"),
  v.literal("student_note_prepared"), v.literal("no_student_note_prepared"),
  v.literal("assignment_prepared"), v.literal("no_assignment_prepared"),
  v.literal("assessment_drafted"), v.literal("no_assessment_drafted"),
  v.literal("student_resource_published"), v.literal("no_student_resource_published"),
);
const rowValidator = v.object({
  topicId: v.id("knowledgeTopics"), title: v.string(), subjectId: v.id("subjects"), level: v.string(), termId: v.id("academicTerms"),
  sourceStatus: statusValidator, lessonPlanStatus: statusValidator, studentNoteStatus: statusValidator,
  assignmentStatus: statusValidator, assessmentStatus: statusValidator, studentPublicationStatus: statusValidator,
});
const countsValidator = v.object({
  topicCount: v.number(), sourceApprovedCount: v.number(), lessonPlanPreparedCount: v.number(), studentNotePreparedCount: v.number(),
  assignmentPreparedCount: v.number(), assessmentDraftedCount: v.number(), studentResourcePublishedCount: v.number(),
});

export const getAdminCurriculumReadiness = query({
  args: { subjectId: v.id("subjects"), termId: v.id("academicTerms"), level: v.string(), limit: v.optional(v.number()) },
  returns: v.object({ rows: v.array(rowValidator), counts: countsValidator, evidenceNotice: v.string() }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const [subject, term] = await Promise.all([ctx.db.get(args.subjectId), ctx.db.get(args.termId)]);
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) throw new ConvexError("Subject not found");
    if (!term || term.schoolId !== schoolId) throw new ConvexError("Academic term not found");
    const level = args.level.trim();
    if (!level) throw new ConvexError("Level is required");
    const limit = Math.max(1, Math.min(args.limit ?? 25, MAX_TOPICS));
    const topics = await ctx.db.query("knowledgeTopics").withIndex("by_school_and_subject_and_level_and_term_and_status", (q) => q.eq("schoolId", schoolId).eq("subjectId", args.subjectId).eq("level", level).eq("termId", args.termId).eq("status", "active")).take(limit);
    const evidenceByTopic = new Map<string, ReadinessEvidence>();
    await Promise.all(topics.map(async (topic) => {
      const [unit, lessonPlan, studentNote, assignment, bank, material] = await Promise.all([
        ctx.db.query("curriculumUnits").withIndex("by_school_and_knowledge_topic_and_review_status", (q) => q.eq("schoolId", schoolId).eq("knowledgeTopicId", topic._id).eq("reviewStatus", "approved")).first(),
        ctx.db.query("instructionArtifacts").withIndex("by_school_and_topic_and_artifact_status_and_output_type", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id).eq("artifactStatus", "active").eq("outputType", "lesson_plan")).first(),
        ctx.db.query("instructionArtifacts").withIndex("by_school_and_topic_and_artifact_status_and_output_type", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id).eq("artifactStatus", "active").eq("outputType", "student_note")).first(),
        ctx.db.query("instructionArtifacts").withIndex("by_school_and_topic_and_artifact_status_and_output_type", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id).eq("artifactStatus", "active").eq("outputType", "assignment")).first(),
        ctx.db.query("assessmentBanks").withIndex("by_school_and_topic_and_bank_status", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id).eq("bankStatus", "active")).first(),
        ctx.db.query("knowledgeMaterials").withIndex("by_school_and_topic_and_visibility_and_review_status", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id).eq("visibility", "student_approved").eq("reviewStatus", "approved")).first(),
      ]);
      const evidence: ReadinessEvidence = { source: Boolean(unit), lessonPlan: Boolean(lessonPlan), studentNote: Boolean(studentNote), assignment: Boolean(assignment), assessment: Boolean(bank), studentPublication: Boolean(material) };
      evidenceByTopic.set(String(topic._id), evidence);
    }));
    const evidence = topics.map((topic) => evidenceByTopic.get(String(topic._id))!);
    return { rows: topics.map((topic, index) => ({ topicId: topic._id, title: topic.title, subjectId: topic.subjectId, level: topic.level, termId: topic.termId, ...describeCurriculumReadiness(evidence[index]) })), counts: countCurriculumReadiness(evidence), evidenceNotice: "Preparation evidence only. This does not confirm that a topic was taught." };
  },
});
