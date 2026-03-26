import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";

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
      createdAt: school.createdAt,
      updatedAt: Date.now(),
    });

    return null;
  },
});
