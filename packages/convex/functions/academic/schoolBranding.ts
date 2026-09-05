import {
  assertSecureUploadTransportAvailable,
  assertStorageClaimedOnlyBy,
  assertStorageUnclaimed,
  secureUploadUnavailable,
  getUnboundStorageUrl,
} from "./assetStorageBoundary";
import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";

import { schoolThemeValidator as schoolBrandingThemeValidator } from "../foundation/brandingContract";
import { resolveEffectiveTheme } from "./groupSettings";

export const schoolFeaturesValidator = v.object({
  billing: v.boolean(),
  curriculum: v.boolean(),
  knowledgeLibrary: v.boolean(),
  admissions: v.boolean(),
});

export const schoolBrandingSummaryValidator = v.object({
  schoolId: v.id("schools"),
  name: v.string(),
  slug: v.string(),
  status: v.optional(
    v.union(v.literal("pending"), v.literal("active"), v.literal("suspended")),
  ),
  logoUrl: v.union(v.string(), v.null()),
  motto: v.optional(v.string()),
  theme: schoolBrandingThemeValidator,
  contactEmail: v.optional(v.string()),
  contactPhone: v.optional(v.string()),
  address: v.optional(v.string()),
  features: schoolFeaturesValidator,
});

function fallbackFeatures(features?: {
  billing: boolean;
  curriculum: boolean;
  knowledgeLibrary: boolean;
  admissions: boolean;
}) {
  return {
    billing: features?.billing ?? true,
    curriculum: features?.curriculum ?? true,
    knowledgeLibrary: features?.knowledgeLibrary ?? true,
    admissions: features?.admissions ?? false,
  };
}

export const getCurrentSchoolBranding = query({
  args: {},
  returns: v.union(schoolBrandingSummaryValidator, v.null()),
  handler: async (ctx) => {
    try {
      const { schoolId } = await getAuthenticatedSchoolMembership(ctx, {
        allowSuspended: true,
        membershipOnly: true,
      });
      const school = await ctx.db.get(schoolId);
      if (!school) {
        return null;
      }

      return {
        schoolId,
        name: normalizeHumanName(school.name),
        slug: school.slug,
        status: school.status ?? "active",
        logoUrl: school.logoStorageId
          ? await getUnboundStorageUrl(ctx, school.logoStorageId)
          : null,
        motto: school.motto,
        theme: (await resolveEffectiveTheme(ctx, school)).theme,
        contactEmail: school.contactEmail,
        contactPhone: school.contactPhone,
        address: school.address,
        features: fallbackFeatures(school.features),
      };
    } catch {
      return null;
    }
  },
});

export const updateSchoolProfile = mutation({
  args: {
    name: v.string(),
    motto: v.optional(v.string()),
    theme: v.optional(schoolBrandingThemeValidator),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "settings.branding.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new ConvexError("School name is required");
    }

    const school = await ctx.db.get(schoolId);
    if (!school) throw new ConvexError("School unavailable");
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    if (
      group?.status === "active" &&
      group.brandingDefault &&
      args.theme &&
      (args.theme.primaryColor !== school.theme?.primaryColor ||
        args.theme.accentColor !== school.theme?.accentColor)
    ) {
      throw new ConvexError(
        "Use School group branding to review and confirm a branch override",
      );
    }
    await ctx.db.patch(schoolId, {
      name: trimmedName,
      motto: args.motto?.trim() || undefined,
      theme:
        group?.status === "active" && group.brandingDefault
          ? school.theme
          : args.theme,
      contactEmail: args.contactEmail?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      address: args.address?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const generateSchoolLogoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, { capability: "settings.branding.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    return secureUploadUnavailable<string>();
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
      await getAuthenticatedSchoolMembership(ctx, { capability: "settings.branding.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    assertSecureUploadTransportAvailable();

    if (!args.logoContentType.startsWith("image/")) {
      throw new ConvexError("School logo must be an image file");
    }

    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    await assertStorageUnclaimed(ctx, args.logoStorageId);
    await ctx.db.patch(schoolId, {
      logoStorageId: args.logoStorageId,
      logoFileName: args.logoFileName,
      logoContentType: args.logoContentType,
      logoUpdatedAt: Date.now(),
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
      await getAuthenticatedSchoolMembership(ctx, { capability: "settings.branding.manage" });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    if (school.logoStorageId) {
      await assertStorageClaimedOnlyBy(ctx, school.logoStorageId, {
        purpose: "schoolLogo",
        ownerId: String(school._id),
      });
      await ctx.storage.delete(school.logoStorageId);
    }

    await ctx.db.patch(schoolId, {
      logoStorageId: undefined,
      logoFileName: undefined,
      logoContentType: undefined,
      logoUpdatedAt: undefined,
      updatedAt: Date.now(),
    });

    return null;
  },
});
