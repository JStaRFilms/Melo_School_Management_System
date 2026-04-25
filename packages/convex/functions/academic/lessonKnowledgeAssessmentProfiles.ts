import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query } from "../../_generated/server";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";

const questionStyleValidator = v.union(
  v.literal("balanced"),
  v.literal("open_ended_heavy"),
  v.literal("mixed_open_ended"),
  v.literal("objective_heavy")
);

const questionMixValidator = v.object({
  multiple_choice: v.number(),
  short_answer: v.number(),
  essay: v.number(),
  true_false: v.number(),
  fill_in_the_blank: v.number(),
});

const profilePayloadValidator = v.object({
  profileId: v.optional(v.union(v.id("assessmentGenerationProfiles"), v.null())),
  name: v.string(),
  description: v.optional(v.union(v.string(), v.null())),
  questionStyle: questionStyleValidator,
  totalQuestions: v.number(),
  questionMix: questionMixValidator,
  allowTeacherOverrides: v.boolean(),
  isDefault: v.boolean(),
  isActive: v.boolean(),
});

type QuestionMix = Doc<"assessmentGenerationProfiles">["questionMix"];

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeOptionalText(value?: string | null) {
  const normalized = normalizeText(value ?? "");
  return normalized ? normalized : null;
}

function normalizeCount(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 60) {
    throw new ConvexError(`${label} must be a whole number between 0 and 60`);
  }
  return value;
}

function normalizeMix(mix: QuestionMix): QuestionMix {
  return {
    multiple_choice: normalizeCount(mix.multiple_choice, "Multiple choice count"),
    short_answer: normalizeCount(mix.short_answer, "Short answer count"),
    essay: normalizeCount(mix.essay, "Essay count"),
    true_false: normalizeCount(mix.true_false, "True/false count"),
    fill_in_the_blank: normalizeCount(mix.fill_in_the_blank, "Fill-in-the-blank count"),
  };
}

function mixTotal(mix: QuestionMix) {
  return mix.multiple_choice + mix.short_answer + mix.essay + mix.true_false + mix.fill_in_the_blank;
}

function validateProfile(args: { name: string; totalQuestions: number; questionMix: QuestionMix }) {
  const name = normalizeText(args.name);
  if (name.length < 3) {
    throw new ConvexError("Profile name must be at least 3 characters");
  }
  const questionMix = normalizeMix(args.questionMix);
  const totalQuestions = normalizeCount(args.totalQuestions, "Total questions");
  if (totalQuestions < 1) {
    throw new ConvexError("Total questions must be at least 1");
  }
  if (mixTotal(questionMix) !== totalQuestions) {
    throw new ConvexError("Question mix counts must add up to the total question count");
  }
  return { name, totalQuestions, questionMix };
}

function searchText(args: { name: string; description: string | null; questionStyle: string }) {
  return [args.name, args.description, args.questionStyle.replace(/_/g, " ")].filter(Boolean).join(" ");
}

function mapProfile(profile: Doc<"assessmentGenerationProfiles">) {
  return {
    _id: profile._id,
    name: profile.name,
    description: profile.description ?? null,
    questionStyle: profile.questionStyle,
    totalQuestions: profile.totalQuestions,
    questionMix: profile.questionMix,
    allowTeacherOverrides: profile.allowTeacherOverrides,
    isDefault: profile.isDefault,
    isActive: profile.isActive,
    updatedAt: profile.updatedAt,
  };
}

export const listAssessmentGenerationProfiles = query({
  args: { includeInactive: v.optional(v.boolean()) },
  returns: v.array(v.object({
    _id: v.id("assessmentGenerationProfiles"),
    name: v.string(),
    description: v.union(v.string(), v.null()),
    questionStyle: questionStyleValidator,
    totalQuestions: v.number(),
    questionMix: questionMixValidator,
    allowTeacherOverrides: v.boolean(),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    updatedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    const isTeacher = role === "teacher";
    if (!isTeacher) {
      await assertAdminForSchool(ctx, userId, schoolId, role);
    }

    if (isTeacher && args.includeInactive) {
      throw new ConvexError("Only admins can view inactive assessment generation profiles");
    }

    const rows = await ctx.db
      .query("assessmentGenerationProfiles")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .take(100);

    return rows
      .filter((profile) => args.includeInactive || profile.isActive)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name))
      .map(mapProfile);
  },
});

export const saveAssessmentGenerationProfile = mutation({
  args: profilePayloadValidator,
  returns: v.id("assessmentGenerationProfiles"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const normalized = validateProfile(args);
    const description = normalizeOptionalText(args.description);
    const now = Date.now();

    if (args.profileId) {
      const existing = await ctx.db.get(args.profileId);
      if (!existing || existing.schoolId !== schoolId) {
        throw new ConvexError("Assessment generation profile not found");
      }
      await ctx.db.patch(args.profileId, {
        name: normalized.name,
        ...(description !== null ? { description } : { description: undefined }),
        questionStyle: args.questionStyle,
        totalQuestions: normalized.totalQuestions,
        questionMix: normalized.questionMix,
        allowTeacherOverrides: args.allowTeacherOverrides,
        isDefault: args.isDefault,
        isActive: args.isActive,
        searchText: searchText({ name: normalized.name, description, questionStyle: args.questionStyle }),
        updatedAt: now,
        updatedBy: userId,
      } as never);
    } else {
      args.profileId = await ctx.db.insert("assessmentGenerationProfiles", {
        schoolId,
        name: normalized.name,
        ...(description !== null ? { description } : {}),
        questionStyle: args.questionStyle,
        totalQuestions: normalized.totalQuestions,
        questionMix: normalized.questionMix,
        allowTeacherOverrides: args.allowTeacherOverrides,
        isDefault: args.isDefault,
        isActive: args.isActive,
        searchText: searchText({ name: normalized.name, description, questionStyle: args.questionStyle }),
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    if (args.isDefault) {
      const defaults = await ctx.db
        .query("assessmentGenerationProfiles")
        .withIndex("by_school_and_is_default", (q) => q.eq("schoolId", schoolId).eq("isDefault", true))
        .take(50);
      for (const profile of defaults) {
        if (profile._id !== args.profileId) {
          await ctx.db.patch(profile._id, { isDefault: false, updatedAt: now, updatedBy: userId });
        }
      }
    }

    return args.profileId as Id<"assessmentGenerationProfiles">;
  },
});
