import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "../../_generated/server";
import { internal } from "../../_generated/api";
import {
  CURRICULUM_EXTRACTION_PROMPT_CLASS,
  generateCurriculumExtraction,
  reconcileCurriculumExtractionEvidence,
  resolveCurriculumAiRuntime,
} from "@school/ai";
import { toCurriculumGenerationFailure } from "@school/ai";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";
import {
  CURRICULUM_SCHEMA_VERSION,
  buildBoundedCurriculumSourcePages,
  detectCurriculumTermMismatch,
  hasMatchingCurriculumEvidence,
  isReadyCurriculumSource,
  MAX_CURRICULUM_SOURCE_PAGES,
  MAX_CURRICULUM_UNITS_PER_IMPORT,
  normalizeCurriculumProposal,
  type CurriculumProposalInput,
} from "./curriculumHelpers";
import type { Id } from "../../_generated/dataModel";
import type { CurriculumExtractionInput } from "@school/ai";

const importIdValidator = { importId: v.id("curriculumImports") };
const pageValidator = v.object({ pageNumbers: v.array(v.number()), text: v.string(), chunkHash: v.string() });
const proposalValidator = v.object({
  weekNumber: v.optional(v.number()), title: v.string(), subtopics: v.array(v.string()),
  learningObjectives: v.array(v.string()), suggestedDuration: v.optional(v.string()),
  sourcePages: v.array(v.number()), sourceChunkHash: v.string(), supportingExcerpt: v.string(), confidence: v.number(),
});

async function loadContext(ctx: Parameters<typeof getAuthenticatedSchoolMembership>[0], importId: Id<"curriculumImports">) {
  const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.curriculum.manage" });
  await assertAdminForSchool(ctx, userId, schoolId, role);
  const importRecord = await ctx.db.get(importId);
  if (!importRecord || importRecord.schoolId !== schoolId) throw new ConvexError("Curriculum import not found");
  const [material, subject, term] = await Promise.all([
    ctx.db.get(importRecord.materialId), ctx.db.get(importRecord.subjectId), ctx.db.get(importRecord.termId),
  ]);
  if (!material || material.schoolId !== schoolId || !isReadyCurriculumSource(material)) throw new ConvexError("Choose a ready school curriculum source");
  if (!subject || subject.schoolId !== schoolId || subject.isArchived || !term || term.schoolId !== schoolId) throw new ConvexError("Curriculum academic context is no longer available");
  const session = await ctx.db.get(term.sessionId);
  if (!session || session.schoolId !== schoolId || !session.isActive) throw new ConvexError("Choose a term from the active academic session");
  return { userId, schoolId, importRecord, subject, term };
}

export const getGenerationInput = internalQuery({
  args: importIdValidator,
  returns: v.object({ subject: v.string(), level: v.string(), term: v.string(), pages: v.array(pageValidator) }),
  handler: async (ctx, args) => {
    const { importRecord, schoolId, subject, term } = await loadContext(ctx, args.importId);
    if (importRecord.status !== "draft") throw new ConvexError("This curriculum import is already being generated or reviewed");
    const chunks = await ctx.db.query("knowledgeMaterialChunks").withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", importRecord.materialId)).take(300);
    const pages = buildBoundedCurriculumSourcePages(chunks);
    if (pages.length === 0) throw new ConvexError("No page-aware extracted source text is available");
    const termMismatch = detectCurriculumTermMismatch(term.name, pages.map((page) => page.text).join("\n"));
    if (termMismatch) {
      throw new ConvexError(`The source appears to cover ${termMismatch.detectedTerm}, not the selected ${termMismatch.requestedTerm}`);
    }
    return { subject: subject.name, level: importRecord.level, term: term.name, pages };
  },
});

export const startGeneration = internalMutation({
  args: { ...importIdValidator, provider: v.string(), model: v.string(), sourceCount: v.number() },
  returns: v.id("aiRunLogs"),
  handler: async (ctx, args) => {
    const { userId, schoolId, importRecord } = await loadContext(ctx, args.importId);
    if (importRecord.status !== "draft" || !Number.isInteger(args.sourceCount) || args.sourceCount < 1 || args.sourceCount > MAX_CURRICULUM_SOURCE_PAGES) throw new ConvexError("This curriculum import is already being generated or reviewed");
    const now = Date.now();
    const aiRunLogId = await ctx.db.insert("aiRunLogs", {
      schoolId, actorUserId: userId, actorRole: "admin", outputType: "curriculum_extraction", promptClass: CURRICULUM_EXTRACTION_PROMPT_CLASS,
      status: "running", model: args.model, provider: args.provider, curriculumImportId: args.importId,
      sourceSelectionSnapshot: JSON.stringify({ materialId: String(importRecord.materialId), pageCount: args.sourceCount }), sourceCount: args.sourceCount, startedAt: now, createdAt: now, updatedAt: now,
    });
    await ctx.db.patch(args.importId, { status: "generating", updatedAt: now });
    return aiRunLogId;
  },
});

export const completeGeneration = internalMutation({
  args: { ...importIdValidator, aiRunLogId: v.id("aiRunLogs"), proposals: v.array(proposalValidator), tokenPromptCount: v.optional(v.number()), tokenCompletionCount: v.optional(v.number()) },
  returns: v.object({ proposalCount: v.number() }),
  handler: async (ctx, args) => {
    const { schoolId, importRecord } = await loadContext(ctx, args.importId);
    const run = await ctx.db.get(args.aiRunLogId);
    if (!run || run.schoolId !== schoolId || run.curriculumImportId !== args.importId || run.status !== "running") throw new ConvexError("Curriculum generation run not found");
    if (args.proposals.length === 0 || args.proposals.length > MAX_CURRICULUM_UNITS_PER_IMPORT) throw new ConvexError("Proposal count is outside the allowed range");
    const chunks = await ctx.db.query("knowledgeMaterialChunks").withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", importRecord.materialId)).take(300);
    const proposals = args.proposals.map((proposal) => normalizeCurriculumProposal(proposal as CurriculumProposalInput));
    for (const proposal of proposals) if (!hasMatchingCurriculumEvidence({ ...proposal, chunks })) throw new ConvexError("Each proposed unit must cite matching extracted page evidence and excerpt text");
    const topics = await ctx.db.query("knowledgeTopics").withIndex("by_school_and_subject_and_level_and_term", (q) => q.eq("schoolId", schoolId).eq("subjectId", importRecord.subjectId).eq("level", importRecord.level).eq("termId", importRecord.termId)).take(100);
    const now = Date.now(); let duplicateWarningCount = 0;
    for (const proposal of proposals) {
      const duplicateWarnings = topics.some((topic) => topic.status !== "retired" && topic.title.trim().toLowerCase() === proposal.title.toLowerCase()) ? ["An active topic with this title already exists for this subject, level, and term."] : [];
      duplicateWarningCount += duplicateWarnings.length;
      await ctx.db.insert("curriculumUnits", { schoolId, importId: args.importId, materialId: importRecord.materialId, ...proposal, reviewStatus: "proposed", validationWarnings: [], duplicateWarnings, createdAt: now, updatedAt: now });
    }
    await ctx.db.patch(args.aiRunLogId, { status: "succeeded", ...(args.tokenPromptCount === undefined ? {} : { tokenPromptCount: args.tokenPromptCount }), ...(args.tokenCompletionCount === undefined ? {} : { tokenCompletionCount: args.tokenCompletionCount }), finishedAt: now, updatedAt: now });
    await ctx.db.patch(args.importId, { status: "ready_for_review", provider: run.provider, modelId: run.model, promptVersion: run.promptClass, schemaVersion: CURRICULUM_SCHEMA_VERSION, aiRunLogId: args.aiRunLogId, proposedUnitCount: proposals.length, duplicateWarningCount, updatedAt: now });
    return { proposalCount: proposals.length };
  },
});

export const failGeneration = internalMutation({
  args: { ...importIdValidator, aiRunLogId: v.id("aiRunLogs"), errorCode: v.string(), errorMessage: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.curriculum.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const importRecord = await ctx.db.get(args.importId);
    if (!importRecord || importRecord.schoolId !== schoolId) throw new ConvexError("Curriculum import not found");
    const run = await ctx.db.get(args.aiRunLogId);
    if (!run || run.schoolId !== schoolId || run.curriculumImportId !== args.importId || run.status !== "running") return null;
    const now = Date.now();
    await ctx.db.patch(args.aiRunLogId, { status: "failed", errorCode: args.errorCode, errorMessage: args.errorMessage, finishedAt: now, updatedAt: now });
    await ctx.db.patch(args.importId, { status: "failed", errorCode: args.errorCode, errorMessage: args.errorMessage, updatedAt: now });
    return null;
  },
});

export const failUnstartedGeneration = internalMutation({
  args: { ...importIdValidator, errorCode: v.string(), errorMessage: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.curriculum.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const record = await ctx.db.get(args.importId);
    if (record && record.schoolId === schoolId && record.status === "draft") await ctx.db.patch(args.importId, { status: "failed", errorCode: args.errorCode, errorMessage: args.errorMessage, updatedAt: Date.now() });
    return null;
  },
});

export const requestCurriculumGeneration = action({
  args: importIdValidator,
  returns: v.object({ importId: v.id("curriculumImports"), aiRunLogId: v.id("aiRunLogs"), proposalCount: v.number() }),
  handler: async (ctx, args): Promise<{ importId: Id<"curriculumImports">; aiRunLogId: Id<"aiRunLogs">; proposalCount: number }> => {
    let aiRunLogId: Id<"aiRunLogs"> | undefined;
    try {
      const input: CurriculumExtractionInput = await ctx.runQuery(internal.functions.academic.curriculumGeneration.getGenerationInput, args);
      const runtime = resolveCurriculumAiRuntime();
      aiRunLogId = await ctx.runMutation(internal.functions.academic.curriculumGeneration.startGeneration, { importId: args.importId, provider: runtime.provider, model: runtime.modelId, sourceCount: input.pages.length });
      const result = await generateCurriculumExtraction({ input });
      const reconciledUnits = reconcileCurriculumExtractionEvidence(result.extraction.units, input.pages);
      const completion: { proposalCount: number } = await ctx.runMutation(internal.functions.academic.curriculumGeneration.completeGeneration, {
        importId: args.importId, aiRunLogId, proposals: reconciledUnits.map((unit) => ({
          ...(unit.weekNumber === null ? {} : { weekNumber: unit.weekNumber }), title: unit.title,
          subtopics: unit.subtopics, learningObjectives: unit.learningObjectives,
          ...(unit.suggestedDuration === null ? {} : { suggestedDuration: unit.suggestedDuration }),
          sourcePages: unit.sourcePages, sourceChunkHash: unit.sourceChunkHash,
          supportingExcerpt: unit.supportingExcerpt, confidence: unit.confidence,
        })), tokenPromptCount: result.inputTokens, tokenCompletionCount: result.outputTokens,
      });
      if (!aiRunLogId) throw new ConvexError("AI run log was not started");
      return { importId: args.importId, aiRunLogId, proposalCount: completion.proposalCount };
    } catch (error) {
      const failure = toCurriculumGenerationFailure(error);
      if (aiRunLogId) await ctx.runMutation(internal.functions.academic.curriculumGeneration.failGeneration, { importId: args.importId, aiRunLogId, ...failure });
      else await ctx.runMutation(internal.functions.academic.curriculumGeneration.failUnstartedGeneration, { importId: args.importId, ...failure });
      throw new ConvexError(failure);
    }
  },
});
