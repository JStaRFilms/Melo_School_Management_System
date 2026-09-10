import {
  assertStorageUnclaimed,
  getUnboundStorageUrl,
  isSharedActiveGroupLogo,
  secureUploadUnavailable,
  storageClaimedOnlyBy,
} from "./assetStorageBoundary";
import type { Id } from "../../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
} from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";
import { schoolThemeValidator as schoolBrandingThemeValidator } from "../foundation/brandingContract";
import { hasActiveGroupBranding, resolveEffectiveTheme } from "./groupSettings";
import { requireCapability } from "./rbac";

export const schoolFeaturesValidator = v.object({
  billing: v.boolean(),
  curriculum: v.boolean(),
  knowledgeLibrary: v.boolean(),
  admissions: v.boolean(),
});

export const schoolBrandingSummaryValidator = v.object({
  schoolId: v.id("schools"),
  groupId: v.optional(v.id("schoolGroups")),
  name: v.string(),
  slug: v.string(),
  status: v.optional(v.union(v.literal("pending"), v.literal("active"), v.literal("suspended"))),
  logoUrl: v.union(v.string(), v.null()),
  motto: v.optional(v.string()),
  theme: schoolBrandingThemeValidator,
  contactEmail: v.optional(v.string()),
  contactPhone: v.optional(v.string()),
  address: v.optional(v.string()),
  features: schoolFeaturesValidator,
});

function fallbackTheme(theme?: { primaryColor: string; accentColor: string }) {
  return {
    primaryColor: theme?.primaryColor || "#0f172a",
    accentColor: theme?.accentColor || "#2563eb",
  };
}

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
  args: { schoolId: v.optional(v.id("schools")) },
  returns: v.union(schoolBrandingSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    try {
      const { schoolId } = await getAuthenticatedSchoolMembership(ctx, {
        allowSuspended: true,
        schoolId: args.schoolId,
      });
      const school = await ctx.db.get(schoolId);
      if (!school) {
        return null;
      }

      const effectiveTheme = await resolveEffectiveTheme(ctx, school);
      const groupLink = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .unique();
      const group = groupLink ? await ctx.db.get(groupLink.groupId) : null;
      let logoUrl: string | null = null;
      if (school.logoStorageId) {
        try {
          logoUrl = await getUnboundStorageUrl(ctx, school.logoStorageId);
        } catch {
          // An unsafe legacy logo must stay hidden without denying the school workspace.
        }
      }
      return {
        schoolId,
        groupId: group?.status === "active" ? group._id : undefined,
        name: normalizeHumanName(school.name),
        slug: school.slug,
        status: school.status ?? "active",
        logoUrl,
        motto: school.motto,
        theme: fallbackTheme(effectiveTheme.theme),
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
      await getAuthenticatedSchoolMembership(ctx, {
        capability: ["settings.general.edit", "settings.branding.manage"],
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new ConvexError("School name is required");
    }
    const school = await ctx.db.get(schoolId);
    if (!school) throw new ConvexError("School not found");
    const profileChanged =
      trimmedName !== school.name ||
      (args.motto?.trim() || undefined) !== school.motto ||
      (args.contactEmail?.trim() || undefined) !== school.contactEmail ||
      (args.contactPhone?.trim() || undefined) !== school.contactPhone ||
      (args.address?.trim() || undefined) !== school.address;
    if (profileChanged) {
      await requireCapability(ctx, schoolId, "settings.general.edit");
    }
    if (args.theme) {
      await requireCapability(ctx, schoolId, "settings.branding.manage");
    }
    const groupBrandingControlled = args.theme
      ? await hasActiveGroupBranding(ctx, schoolId)
      : false;
    if (args.theme && groupBrandingControlled) {
      const effectiveTheme = (await resolveEffectiveTheme(ctx, school)).theme;
      if (
        args.theme.primaryColor.toLowerCase() !== effectiveTheme.primaryColor.toLowerCase() ||
        args.theme.accentColor.toLowerCase() !== effectiveTheme.accentColor.toLowerCase()
      ) {
        throw new ConvexError(
          "School group branding must be changed through the branch branding controls",
        );
      }
    }

    await ctx.db.patch(schoolId, {
      name: trimmedName,
      motto: args.motto?.trim() || undefined,
      ...(args.theme && !groupBrandingControlled ? { theme: args.theme } : {}),
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
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "settings.branding.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    return secureUploadUnavailable<string>();
  },
});

const MAX_SCHOOL_LOGO_BYTES = 768 * 1024;
const SCHOOL_LOGO_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

function detectSchoolLogoContentType(bytes: Uint8Array): string | null {
  const matches = (...expected: number[]) =>
    expected.every((value, index) => bytes[index] === value);
  if (matches(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "image/png";
  if (matches(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (
    matches(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  return null;
}

export const authorizeSchoolLogoUpload = internalQuery({
  args: {},
  returns: v.object({
    schoolId: v.id("schools"),
    userId: v.id("users"),
  }),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "settings.branding.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    return { schoolId, userId };
  },
});

export const applySchoolLogoUpload = internalMutation({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
    logoStorageId: v.id("_storage"),
    logoFileName: v.string(),
    logoContentType: v.string(),
  },
  returns: v.object({
    deleteStorageId: v.optional(v.id("_storage")),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    const school = await ctx.db.get(args.schoolId);
    if (
      !user ||
      user.schoolId !== args.schoolId ||
      user.isArchived ||
      (user.role !== "admin" && user.isSchoolAdmin !== true) ||
      !school
    ) {
      throw new ConvexError("School branding access changed during upload");
    }
    await assertStorageUnclaimed(ctx, args.logoStorageId);

    let deleteStorageId: Id<"_storage"> | undefined;
    if (school.logoStorageId) {
      const issuedReportReference = await ctx.db
        .query("issuedReportCards")
        .withIndex("by_school_logo_storage", (q) =>
          q.eq("schoolLogoStorageId", school.logoStorageId),
        )
        .first();
      if (!issuedReportReference) {
        const exclusivelyOwned = await storageClaimedOnlyBy(
          ctx,
          school.logoStorageId,
          {
            purpose: "schoolLogo",
            ownerId: String(school._id),
          },
        );
        if (exclusivelyOwned) {
          deleteStorageId = school.logoStorageId;
        } else if (!(await isSharedActiveGroupLogo(ctx, school.logoStorageId))) {
          throw new ConvexError(
            "Storage object has conflicting ownership and cannot be replaced",
          );
        }
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.schoolId, {
      logoStorageId: args.logoStorageId,
      logoFileName: args.logoFileName,
      logoContentType: args.logoContentType,
      logoUpdatedAt: now,
      updatedAt: now,
    });
    return { deleteStorageId };
  },
});

export const saveSchoolLogo = action({
  args: {
    bytes: v.bytes(),
    logoFileName: v.string(),
    logoContentType: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const authorization = await ctx.runQuery(
      internal.functions.academic.schoolBranding.authorizeSchoolLogoUpload,
      {},
    );
    const fileName = args.logoFileName.trim();
    if (!fileName || fileName.length > 160) {
      throw new ConvexError("Use a logo file name between 1 and 160 characters");
    }
    if (
      args.bytes.byteLength === 0 ||
      args.bytes.byteLength > MAX_SCHOOL_LOGO_BYTES
    ) {
      throw new ConvexError("School crests must be smaller than 768 KB");
    }
    if (
      !SCHOOL_LOGO_CONTENT_TYPES.includes(
        args.logoContentType as (typeof SCHOOL_LOGO_CONTENT_TYPES)[number],
      ) ||
      detectSchoolLogoContentType(new Uint8Array(args.bytes)) !==
        args.logoContentType
    ) {
      throw new ConvexError("Use a valid PNG, JPEG, or WebP school crest");
    }

    const storageId = await ctx.storage.store(
      new Blob([args.bytes], { type: args.logoContentType }),
    );
    try {
      const result = await ctx.runMutation(
        internal.functions.academic.schoolBranding.applySchoolLogoUpload,
        {
          ...authorization,
          logoStorageId: storageId,
          logoFileName: fileName,
          logoContentType: args.logoContentType,
        },
      );
      if (result.deleteStorageId) {
        await ctx.storage.delete(result.deleteStorageId);
      }
      return null;
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
  },
});

export const removeSchoolLogo = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx, {
        capability: "settings.branding.manage",
      });
    await assertAdminForSchool(ctx, userId, schoolId, role);
    await requireCapability(ctx, schoolId, "settings.branding.manage");

    const school = await ctx.db.get(schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    let deleteStorageId: Id<"_storage"> | undefined;
    if (school.logoStorageId) {
      const issuedReportReference = await ctx.db
        .query("issuedReportCards")
        .withIndex("by_school_logo_storage", (q) => q.eq("schoolLogoStorageId", school.logoStorageId))
        .first();
      if (!issuedReportReference) {
        const exclusivelyOwned = await storageClaimedOnlyBy(
          ctx,
          school.logoStorageId,
          {
            purpose: "schoolLogo",
            ownerId: String(school._id),
          },
        );
        if (exclusivelyOwned) {
          deleteStorageId = school.logoStorageId;
        } else if (!(await isSharedActiveGroupLogo(ctx, school.logoStorageId))) {
          throw new ConvexError(
            "Storage object has conflicting ownership and cannot be removed",
          );
        }
      }
    }

    await ctx.db.patch(schoolId, {
      logoStorageId: undefined,
      logoFileName: undefined,
      logoContentType: undefined,
      logoUpdatedAt: undefined,
      updatedAt: Date.now(),
    });
    if (deleteStorageId) await ctx.storage.delete(deleteStorageId);

    return null;
  },
});
