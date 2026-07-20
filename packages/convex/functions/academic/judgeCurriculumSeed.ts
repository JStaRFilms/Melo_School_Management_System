import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

const WEEKS = [
  { week: 1, title: "Revision of Last Term's Work", objectives: ["Recall key ideas from the previous term", "Explain corrections from the resumption exercise"] },
  { week: 2, title: "Our Roles in Promoting Safety", objectives: ["Define safety", "Identify safety measures at home and school", "Explain road-safety guidelines"] },
  { week: 3, title: "Safety Club as an Agent of Socialization", objectives: ["Describe how a school safety club is formed", "Explain the club's role in socialization", "List functions of the FRSC"] },
  { week: 4, title: "Drug Abuse", objectives: ["Define drug abuse", "Identify commonly abused substances", "Explain effects of drug abuse"] },
  { week: 5, title: "Ways of Solving Common Social Problems", objectives: ["Identify common social problems", "Compare peaceful problem-solving methods", "Propose a community response"] },
] as const;

type JudgeCurriculumSeedArgs = {
  schoolId: Id<"schools">;
  adminUserId: Id<"users">;
  teacherUserId: Id<"users">;
  socialStudiesSubjectId: Id<"subjects">;
  secondTermId: Id<"academicTerms">;
  jssOneClassIds: Id<"classes">[];
  now: number;
};

export async function populateJudgeCurriculumFixture(ctx: MutationCtx, args: JudgeCurriculumSeedArgs) {
  const materialId = await ctx.db.insert("knowledgeMaterials", {
    schoolId: args.schoolId,
    ownerUserId: args.adminUserId,
    ownerRole: "admin",
    sourceType: "imported_curriculum",
    visibility: "staff_shared",
    reviewStatus: "approved",
    title: "JSS 1 Social Studies — Second Term Scheme of Work",
    description: "A prepared, page-aware scheme of work for the hackathon judge journey.",
    subjectId: args.socialStudiesSubjectId,
    level: "JSS 1",
    topicLabel: "Second Term Curriculum",
    searchStatus: "indexed",
    searchText: "JSS 1 Social Studies second term scheme of work safety drug abuse social problems",
    processingStatus: "ready",
    ingestionErrorMessage: null,
    ingestionAttemptCount: 0,
    labelSuggestions: ["curriculum", "social studies", "second term"],
    chunkCount: WEEKS.length,
    indexedAt: args.now,
    selectedPageNumbers: WEEKS.map((item) => item.week),
    pdfPageCount: WEEKS.length,
    sourceFileMode: "original",
    sourcePdfPageCount: WEEKS.length,
    createdAt: args.now,
    updatedAt: args.now,
    createdBy: args.adminUserId,
    updatedBy: args.adminUserId,
  });

  for (const item of WEEKS) {
    const chunkText = `WEEK ${item.week} SUBJECT: Social Studies CLASS: JSS 1 TERM: Second Term TOPIC: ${item.title} LEARNING OBJECTIVES: ${item.objectives.join("; ")}.`;
    await ctx.db.insert("knowledgeMaterialChunks", {
      schoolId: args.schoolId,
      materialId,
      chunkIndex: item.week - 1,
      chunkText,
      searchText: chunkText.toLowerCase(),
      visibility: "staff_shared",
      reviewStatus: "approved",
      searchStatus: "indexed",
      tokenEstimate: Math.ceil(chunkText.length / 4),
      pageStart: item.week,
      pageEnd: item.week,
      pageNumbers: [item.week],
      chunkHash: `judge-social-studies-week-${item.week}`,
      createdAt: args.now,
      updatedAt: args.now,
    });
  }

  for (const classId of args.jssOneClassIds) {
    await ctx.db.insert("knowledgeMaterialClassBindings", {
      schoolId: args.schoolId,
      materialId,
      classId,
      bindingPurpose: "supplemental_upload",
      bindingStatus: "active",
      createdAt: args.now,
      updatedAt: args.now,
      createdBy: args.adminUserId,
      updatedBy: args.adminUserId,
    });
  }

  const firstWeek = WEEKS[0];
  const supportingExcerpt = `WEEK 1 SUBJECT: Social Studies CLASS: JSS 1 TERM: Second Term TOPIC: ${firstWeek.title} LEARNING OBJECTIVES: ${firstWeek.objectives.join("; ")}.`;
  const topicId = await ctx.db.insert("knowledgeTopics", {
    schoolId: args.schoolId,
    subjectId: args.socialStudiesSubjectId,
    level: "JSS 1",
    termId: args.secondTermId,
    title: firstWeek.title,
    normalizedTitle: firstWeek.title.toLowerCase(),
    slug: "revision-of-last-terms-work",
    summary: "A reviewed curriculum topic prepared for the judge walkthrough.",
    searchText: `${firstWeek.title} JSS 1 Social Studies Second Term`,
    status: "active",
    createdAt: args.now,
    updatedAt: args.now,
    createdBy: args.adminUserId,
    updatedBy: args.adminUserId,
  });
  const importId = await ctx.db.insert("curriculumImports", {
    schoolId: args.schoolId,
    materialId,
    subjectId: args.socialStudiesSubjectId,
    level: "JSS 1",
    termId: args.secondTermId,
    status: "approved",
    requestedBy: args.adminUserId,
    reviewedBy: args.adminUserId,
    provider: "seed_fixture",
    modelId: "none",
    promptVersion: "judge-seed-v1",
    schemaVersion: "1.0",
    proposedUnitCount: 1,
    approvedUnitCount: 1,
    rejectedUnitCount: 0,
    duplicateWarningCount: 0,
    createdAt: args.now,
    updatedAt: args.now,
  });
  await ctx.db.insert("curriculumUnits", {
    schoolId: args.schoolId,
    importId,
    materialId,
    weekNumber: firstWeek.week,
    title: firstWeek.title,
    subtopics: [],
    learningObjectives: [...firstWeek.objectives],
    suggestedDuration: "40 minutes per period",
    sourcePages: [1],
    sourceChunkHash: "judge-social-studies-week-1",
    supportingExcerpt,
    confidence: 1,
    reviewStatus: "approved",
    validationWarnings: [],
    duplicateWarnings: [],
    reviewedBy: args.adminUserId,
    reviewedAt: args.now,
    knowledgeTopicId: topicId,
    createdAt: args.now,
    updatedAt: args.now,
  });

  return { materialId, topicId };
}
