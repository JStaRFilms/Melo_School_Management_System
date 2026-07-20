import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
import {
  CURRICULUM_SCHEMA_VERSION, hasMatchingCurriculumEvidence, isReadyCurriculumSource, MAX_CURRICULUM_UNITS_PER_IMPORT,
  normalizeCurriculumProposal, type CurriculumProposalInput,
} from "./curriculumHelpers";

const proposalValidator = v.object({
  weekNumber: v.optional(v.number()), title: v.string(), subtopics: v.array(v.string()),
  learningObjectives: v.array(v.string()), suggestedDuration: v.optional(v.string()),
  sourcePages: v.array(v.number()), sourceChunkHash: v.string(), supportingExcerpt: v.string(), confidence: v.number(),
});

export const createCurriculumImport = mutation({
  args: { materialId: v.id("knowledgeMaterials"), subjectId: v.id("subjects"), level: v.string(), termId: v.id("academicTerms") },
  returns: v.id("curriculumImports"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const [material, subject, term] = await Promise.all([ctx.db.get(args.materialId), ctx.db.get(args.subjectId), ctx.db.get(args.termId)]);
    if (!material || material.schoolId !== schoolId || !isReadyCurriculumSource(material)) throw new ConvexError("Choose a ready school curriculum source");
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) throw new ConvexError("Subject not found");
    if (!term || term.schoolId !== schoolId) throw new ConvexError("Choose a school term");
    const session = await ctx.db.get(term.sessionId);
    if (!session || session.schoolId !== schoolId || !session.isActive) throw new ConvexError("Choose a term from the active academic session");
    const level = args.level.trim().replace(/\s+/g, " ");
    if (!level) throw new ConvexError("Level is required");
    if (material.subjectId && material.subjectId !== args.subjectId) throw new ConvexError("Choose a curriculum source for the selected subject");
    if (material.level.trim().replace(/\s+/g, " ") !== level) throw new ConvexError("Choose a curriculum source for the selected level");
    const now = Date.now();
    const importId = await ctx.db.insert("curriculumImports", {
      schoolId, materialId: args.materialId, subjectId: args.subjectId, level, termId: args.termId, status: "draft", requestedBy: userId,
      promptVersion: "pending-canonical-run", schemaVersion: CURRICULUM_SCHEMA_VERSION,
      proposedUnitCount: 0, approvedUnitCount: 0, rejectedUnitCount: 0, duplicateWarningCount: 0, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("contentAuditEvents", { schoolId, actorUserId: userId, actorRole: "admin", eventType: "created", entityType: "curriculumImport", curriculumImportId: importId, changeSummary: "Created a curriculum import draft from a ready school source.", createdAt: now });
    return importId;
  },
});

export const saveCurriculumProposals = mutation({
  args: { importId: v.id("curriculumImports"), proposals: v.array(proposalValidator), aiRunLogId: v.id("aiRunLogs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const importRecord = await ctx.db.get(args.importId);
    if (!importRecord || importRecord.schoolId !== schoolId) throw new ConvexError("Curriculum import not found");
    if (importRecord.status !== "draft" && importRecord.status !== "generating") throw new ConvexError("This curriculum import is already under review");
    if (args.proposals.length === 0 || args.proposals.length > MAX_CURRICULUM_UNITS_PER_IMPORT) throw new ConvexError("Proposal count is outside the allowed range");
    const run = await ctx.db.get(args.aiRunLogId);
    if (!run || run.schoolId !== schoolId || run.curriculumImportId !== args.importId || run.outputType !== "curriculum_extraction" || run.status !== "succeeded" || !run.provider.trim() || !run.model.trim()) {
      throw new ConvexError("A successful canonical curriculum run log is required");
    }
    const chunks = await ctx.db.query("knowledgeMaterialChunks").withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", importRecord.materialId)).take(300);
    const proposals = args.proposals.map((proposal) => normalizeCurriculumProposal(proposal as CurriculumProposalInput));
    for (const proposal of proposals) if (!hasMatchingCurriculumEvidence({ ...proposal, chunks })) throw new ConvexError("Each proposed unit must cite matching extracted page evidence and excerpt text");
    const topicCandidates = await ctx.db.query("knowledgeTopics").withIndex("by_school_and_subject_and_level_and_term", (q) => q.eq("schoolId", schoolId).eq("subjectId", importRecord.subjectId).eq("level", importRecord.level).eq("termId", importRecord.termId)).take(100);
    const now = Date.now();
    let duplicateWarningCount = 0;
    for (const proposal of proposals) {
      const duplicateWarnings = topicCandidates.some((topic) => topic.status !== "retired" && topic.title.trim().toLowerCase() === proposal.title.toLowerCase()) ? ["An active topic with this title already exists for this subject, level, and term."] : [];
      duplicateWarningCount += duplicateWarnings.length;
      await ctx.db.insert("curriculumUnits", { schoolId, importId: args.importId, materialId: importRecord.materialId, ...proposal, reviewStatus: "proposed", validationWarnings: [], duplicateWarnings, createdAt: now, updatedAt: now });
    }
    await ctx.db.patch(args.importId, { status: "ready_for_review", provider: run.provider, modelId: run.model, promptVersion: run.promptClass, schemaVersion: CURRICULUM_SCHEMA_VERSION, aiRunLogId: args.aiRunLogId, proposedUnitCount: proposals.length, duplicateWarningCount, updatedAt: now });
    return null;
  },
});
