import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation, type MutationCtx } from "../../_generated/server";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
import { assertCurriculumAdminScope, calculateCurriculumImportStatus, normalizeCurriculumText, resolveCurriculumApproval } from "./curriculumHelpers";

async function refreshImportCounts(ctx: MutationCtx, importId: Id<"curriculumImports">, schoolId: Id<"schools">, reviewedBy: Id<"users">) {
  const units = await ctx.db.query("curriculumUnits").withIndex("by_import_and_review_status", (q) => q.eq("importId", importId)).take(100);
  const counts = { proposed: 0, approved: 0, rejected: 0 };
  for (const unit of units) counts[unit.reviewStatus] += 1;
  await ctx.db.patch(importId, {
    status: calculateCurriculumImportStatus(counts), reviewedBy,
    proposedUnitCount: counts.proposed, approvedUnitCount: counts.approved, rejectedUnitCount: counts.rejected,
    updatedAt: Date.now(),
  });
}

async function uniqueTopicSlug(ctx: Pick<MutationCtx, "db">, schoolId: Id<"schools">, base: string) {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "topic";
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix ? `${root}-${suffix + 1}` : root;
    const existing = await ctx.db.query("knowledgeTopics").withIndex("by_school_and_slug", (q) => q.eq("schoolId", schoolId).eq("slug", slug)).unique();
    if (!existing) return slug;
  }
  throw new ConvexError("Could not create a unique topic identifier");
}

export const reviewCurriculumUnit = mutation({
  args: { unitId: v.id("curriculumUnits"), reviewStatus: v.union(v.literal("proposed"), v.literal("rejected")), title: v.optional(v.string()), subtopics: v.optional(v.array(v.string())), learningObjectives: v.optional(v.array(v.string())), suggestedDuration: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const unit = await ctx.db.get(args.unitId);
    if (!unit || unit.schoolId !== schoolId) throw new ConvexError("Curriculum unit not found");
    assertCurriculumAdminScope({ actorSchoolId: String(schoolId), targetSchoolId: String(unit.schoolId), isAdmin: true });
    if (unit.reviewStatus === "approved") throw new ConvexError("Approved units cannot be changed here");
    const title = args.title === undefined ? unit.title : normalizeCurriculumText(args.title, "Unit title");
    const subtopics = args.subtopics === undefined ? unit.subtopics : args.subtopics.map((item) => normalizeCurriculumText(item, "Subtopic"));
    const objectives = args.learningObjectives === undefined ? unit.learningObjectives : args.learningObjectives.map((item) => normalizeCurriculumText(item, "Learning objective"));
    if (objectives.length === 0) throw new ConvexError("Units need learning objectives");
    const now = Date.now();
    await ctx.db.patch(args.unitId, { reviewStatus: args.reviewStatus, title, subtopics, learningObjectives: objectives, ...(args.suggestedDuration === undefined ? {} : { suggestedDuration: normalizeCurriculumText(args.suggestedDuration, "Suggested duration", 120) }), editedBy: userId, reviewedBy: userId, reviewedAt: now, updatedAt: now });
    await ctx.db.insert("contentAuditEvents", { schoolId, actorUserId: userId, actorRole: "admin", eventType: args.reviewStatus === "rejected" ? "rejected" : "overridden", entityType: "curriculumUnit", curriculumUnitId: args.unitId, curriculumImportId: unit.importId, changeSummary: `Marked curriculum unit ${args.reviewStatus}.`, createdAt: now });
    await refreshImportCounts(ctx, unit.importId, schoolId, userId);
    return null;
  },
});

export const approveCurriculumUnit = mutation({
  args: { unitId: v.id("curriculumUnits") },
  returns: v.id("knowledgeTopics"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);
    const unit = await ctx.db.get(args.unitId);
    if (!unit || unit.schoolId !== schoolId) throw new ConvexError("Curriculum unit not found");
    assertCurriculumAdminScope({ actorSchoolId: String(schoolId), targetSchoolId: String(unit.schoolId), isAdmin: true });
    const existingApproval = resolveCurriculumApproval({ currentTopicId: unit.knowledgeTopicId ? String(unit.knowledgeTopicId) : undefined });
    if (existingApproval.kind === "already_approved") return unit.knowledgeTopicId!;
    const importRecord = await ctx.db.get(unit.importId);
    if (!importRecord || importRecord.schoolId !== schoolId) throw new ConvexError("Curriculum import not found");
    const subject = await ctx.db.get(importRecord.subjectId);
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) throw new ConvexError("Subject not found");
    const candidates = await ctx.db.query("knowledgeTopics").withIndex("by_school_and_subject_and_level_and_term", (q) => q.eq("schoolId", schoolId).eq("subjectId", importRecord.subjectId).eq("level", importRecord.level).eq("termId", importRecord.termId)).take(100);
    const existing = candidates.find((topic) => topic.title.trim().toLowerCase() === unit.title.trim().toLowerCase() && topic.status !== "retired");
    const now = Date.now();
    const decision = resolveCurriculumApproval({ matchingTopicId: existing ? String(existing._id) : undefined });
    const topicId = decision.kind === "link_existing" ? existing!._id : await ctx.db.insert("knowledgeTopics", {
      schoolId, subjectId: importRecord.subjectId, level: importRecord.level, termId: importRecord.termId,
      title: unit.title, slug: await uniqueTopicSlug(ctx, schoolId, `${subject.name}-${importRecord.level}-${unit.title}`),
      summary: unit.learningObjectives.join(" ").slice(0, 600), searchText: `${unit.title} ${subject.name} ${importRecord.level} ${unit.subtopics.join(" ")}`,
      status: "active", createdAt: now, updatedAt: now, createdBy: userId, updatedBy: userId,
    });
    await ctx.db.patch(args.unitId, { reviewStatus: "approved", knowledgeTopicId: topicId, reviewedBy: userId, reviewedAt: now, updatedAt: now });
    await ctx.db.insert("contentAuditEvents", { schoolId, actorUserId: userId, actorRole: "admin", eventType: "approved", entityType: "curriculumUnit", curriculumUnitId: args.unitId, curriculumImportId: unit.importId, topicId, afterTopicId: topicId, changeSummary: "Approved a curriculum unit and linked its active knowledge topic.", createdAt: now });
    await refreshImportCounts(ctx, unit.importId, schoolId, userId);
    return topicId;
  },
});
