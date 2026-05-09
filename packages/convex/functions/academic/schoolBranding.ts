import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";

const schoolBrandingThemeValidator = v.object({
  primaryColor: v.string(),
  accentColor: v.string(),
});

export const schoolBrandingSummaryValidator = v.object({
  schoolId: v.id("schools"),
  name: v.string(),
  logoUrl: v.union(v.string(), v.null()),
  theme: schoolBrandingThemeValidator,
});

function fallbackTheme() {
  return {
    primaryColor: "#020617",
    accentColor: "#2563eb",
  };
}

export const getCurrentSchoolBranding = query({
  args: {},
  returns: schoolBrandingSummaryValidator,
  handler: async (ctx) => {
    const { schoolId } = await getAuthenticatedSchoolMembership(ctx);
    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    return {
      schoolId,
      name: normalizeHumanName(school.name),
      logoUrl: school.logoStorageId ? await ctx.storage.getUrl(school.logoStorageId) : null,
      theme: fallbackTheme(),
    };
  },
});

export const generateSchoolLogoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    return await ctx.storage.generateUploadUrl();
  },
});

export const saveSchoolLogo = mutation({
  args: {
    logoStorageId: v.id("_storage"),
    logoFileName: v.string(),
    logoContentType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    if (!args.logoContentType.startsWith("image/")) {
      throw new ConvexError("School logo must be an image file");
    }

    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    await ctx.db.replace(schoolId, {
      name: school.name,
      slug: school.slug,
      ...(school.status ? { status: school.status } : { status: "active" }),
      logoStorageId: args.logoStorageId,
      logoFileName: args.logoFileName,
      logoContentType: args.logoContentType,
      logoUpdatedAt: Date.now(),
      createdAt: school.createdAt,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const removeSchoolLogo = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    await ctx.db.replace(schoolId, {
      name: school.name,
      slug: school.slug,
      ...(school.status ? { status: school.status } : { status: "active" }),
      createdAt: school.createdAt,
      updatedAt: Date.now(),
    });

    return null;
  },
});
