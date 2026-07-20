import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

type JudgeLessonSeedArgs = {
  schoolId: Id<"schools">;
  teacherUserId: Id<"users">;
  subjectId: Id<"subjects">;
  topicId: Id<"knowledgeTopics">;
  materialId: Id<"knowledgeMaterials">;
  now: number;
};

export async function populateJudgeLessonFixture(ctx: MutationCtx, args: JudgeLessonSeedArgs) {
  const template = await ctx.db
    .query("instructionTemplates")
    .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
    .first();
  const documentState = `# Revision of Last Term's Work

## Learning objectives
Learners will recall important Social Studies ideas from the previous term and explain corrections from the resumption exercise.

## Learning activities
Pairs sort revision cards into themes, compare answers, and present one corrected misconception to the class.

## Check for understanding
Each learner writes one remembered idea and one corrected response supported by the curriculum source.`;
  const artifactId = await ctx.db.insert("instructionArtifacts", {
    schoolId: args.schoolId,
    ownerUserId: args.teacherUserId,
    ownerRole: "teacher",
    outputType: "lesson_plan",
    artifactStatus: "active",
    visibility: "staff_shared",
    reviewStatus: "approved",
    templateId: template?._id,
    templateResolutionPath: template ? "school_default" : undefined,
    subjectId: args.subjectId,
    level: "JSS 1",
    topicId: args.topicId,
    searchStatus: "indexed",
    searchText: "Revision of Last Term's Work Social Studies lesson plan",
    createdAt: args.now,
    updatedAt: args.now,
    createdBy: args.teacherUserId,
    updatedBy: args.teacherUserId,
  });
  const documentId = await ctx.db.insert("instructionArtifactDocuments", {
    schoolId: args.schoolId,
    artifactId,
    documentFormat: "markdown",
    documentState,
    plainText: documentState.replace(/#/g, ""),
    searchText: "revision previous term Social Studies corrections learning activities",
    visibility: "staff_shared",
    reviewStatus: "approved",
    outputType: "lesson_plan",
    topicId: args.topicId,
    searchStatus: "indexed",
    createdAt: args.now,
    updatedAt: args.now,
    createdBy: args.teacherUserId,
    updatedBy: args.teacherUserId,
  });
  const revisionId = await ctx.db.insert("instructionArtifactRevisions", {
    schoolId: args.schoolId,
    artifactId,
    revisionNumber: 1,
    revisionKind: "manual_save",
    documentFormat: "markdown",
    documentState,
    plainText: documentState.replace(/#/g, ""),
    searchText: "revision previous term Social Studies corrections learning activities",
    visibility: "staff_shared",
    reviewStatus: "approved",
    outputType: "lesson_plan",
    templateId: template?._id,
    templateResolutionPath: template ? "school_default" : undefined,
    sourceSelectionSnapshot: `knowledge-material:${args.materialId}`,
    sourceCount: 1,
    createdAt: args.now,
    createdBy: args.teacherUserId,
  });
  await ctx.db.patch(artifactId, { currentDocumentId: documentId, currentRevisionId: revisionId });
  await ctx.db.insert("instructionArtifactSources", {
    schoolId: args.schoolId,
    artifactId,
    materialId: args.materialId,
    sourceOrder: 0,
    createdAt: args.now,
    updatedAt: args.now,
    createdBy: args.teacherUserId,
    updatedBy: args.teacherUserId,
  });
  return artifactId;
}
