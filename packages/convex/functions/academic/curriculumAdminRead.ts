import { ConvexError, v } from "convex/values";
import { query } from "../../_generated/server";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";
import { isReadyCurriculumSource } from "./curriculumHelpers";

const importStatus = v.union(v.literal("draft"), v.literal("generating"), v.literal("ready_for_review"), v.literal("partially_approved"), v.literal("approved"), v.literal("failed"), v.literal("archived"));
const unitStatus = v.union(v.literal("proposed"), v.literal("approved"), v.literal("rejected"));
const sourceOrder = v.union(v.literal("newest"), v.literal("oldest"));

export const listCurriculumImportContext = query({
  args: { sourceQuery: v.optional(v.string()), sourceOrder: v.optional(sourceOrder) },
  returns: v.object({
    sources: v.array(v.object({ _id: v.id("knowledgeMaterials"), title: v.string(), level: v.string(), subjectId: v.optional(v.id("subjects")), sourceType: v.string(), createdAt: v.number() })),
    imports: v.array(v.object({ _id: v.id("curriculumImports"), materialId: v.id("knowledgeMaterials"), sourceLabel: v.string(), subjectLabel: v.string(), termLabel: v.string(), level: v.string(), status: importStatus, provider: v.optional(v.string()), modelId: v.optional(v.string()), errorMessage: v.optional(v.string()), proposedUnitCount: v.number(), approvedUnitCount: v.number(), rejectedUnitCount: v.number(), updatedAt: v.number() })),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.curriculum.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const normalizedSourceQuery = args.sourceQuery?.trim() ?? "";
    const [readyMaterials, imports] = await Promise.all([
      normalizedSourceQuery
        ? ctx.db.query("knowledgeMaterials").withSearchIndex("search_search_text", (q) => q
            .search("searchText", normalizedSourceQuery)
            .eq("schoolId", schoolId)
            .eq("sourceType", "imported_curriculum")
            .eq("processingStatus", "ready")
            .eq("reviewStatus", "approved")
            .eq("searchStatus", "indexed")).take(60)
        : ctx.db.query("knowledgeMaterials").withIndex("by_school_curriculum_ready_approved_indexed", (q) => q.eq("schoolId", schoolId).eq("sourceType", "imported_curriculum").eq("processingStatus", "ready").eq("reviewStatus", "approved").eq("searchStatus", "indexed")).order(args.sourceOrder === "oldest" ? "asc" : "desc").take(60),
      ctx.db.query("curriculumImports").withIndex("by_school_and_updated_at", (q) => q.eq("schoolId", schoolId)).order("desc").take(40),
    ]);
    const sourceList = readyMaterials
      .filter(isReadyCurriculumSource)
      .sort((left, right) => args.sourceOrder === "oldest" ? left.createdAt - right.createdAt : right.createdAt - left.createdAt)
      .map((material) => ({ _id: material._id, title: material.title, level: material.level, ...(material.subjectId ? { subjectId: material.subjectId } : {}), sourceType: material.sourceType, createdAt: material.createdAt }));
    const result = [];
    for (const item of imports) {
      const [material, subject, term] = await Promise.all([ctx.db.get(item.materialId), ctx.db.get(item.subjectId), ctx.db.get(item.termId)]);
      if (!material || !subject || !term || material.schoolId !== schoolId || subject.schoolId !== schoolId || term.schoolId !== schoolId) continue;
      result.push({ _id: item._id, materialId: item.materialId, sourceLabel: material.title, subjectLabel: subject.name, termLabel: term.name, level: item.level, status: item.status, ...(item.provider ? { provider: item.provider } : {}), ...(item.modelId ? { modelId: item.modelId } : {}), ...(item.errorMessage ? { errorMessage: item.errorMessage } : {}), proposedUnitCount: item.proposedUnitCount, approvedUnitCount: item.approvedUnitCount, rejectedUnitCount: item.rejectedUnitCount, updatedAt: item.updatedAt });
    }
    return { sources: sourceList, imports: result };
  },
});

export const getCurriculumImportReview = query({
  args: { importId: v.id("curriculumImports") },
  returns: v.object({ status: importStatus, provider: v.optional(v.string()), modelId: v.optional(v.string()), errorMessage: v.optional(v.string()), units: v.array(v.object({ _id: v.id("curriculumUnits"), weekNumber: v.optional(v.number()), title: v.string(), subtopics: v.array(v.string()), learningObjectives: v.array(v.string()), suggestedDuration: v.optional(v.string()), sourcePages: v.array(v.number()), supportingExcerpt: v.string(), confidence: v.number(), reviewStatus: unitStatus, validationWarnings: v.array(v.string()), duplicateWarnings: v.array(v.string()) })) }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx, { capability: "academic.curriculum.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const record = await ctx.db.get(args.importId);
    if (!record || record.schoolId !== schoolId) throw new ConvexError("Curriculum import not found");
    const units = await ctx.db.query("curriculumUnits").withIndex("by_import_and_review_status", (q) => q.eq("importId", args.importId)).take(100);
    return { status: record.status, ...(record.provider ? { provider: record.provider } : {}), ...(record.modelId ? { modelId: record.modelId } : {}), ...(record.errorMessage ? { errorMessage: record.errorMessage } : {}), units: units.map((unit) => ({ _id: unit._id, ...(unit.weekNumber === undefined ? {} : { weekNumber: unit.weekNumber }), title: unit.title, subtopics: unit.subtopics, learningObjectives: unit.learningObjectives, ...(unit.suggestedDuration ? { suggestedDuration: unit.suggestedDuration } : {}), sourcePages: unit.sourcePages, supportingExcerpt: unit.supportingExcerpt, confidence: unit.confidence, reviewStatus: unit.reviewStatus, validationWarnings: unit.validationWarnings, duplicateWarnings: unit.duplicateWarnings })) };
  },
});
