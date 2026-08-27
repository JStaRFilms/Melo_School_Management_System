import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v, ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { getAuthenticatedPlatformAdmin } from "./auth";
import { provisionSchoolAdminAuthUser } from "./provisioningHelpers";
import { createAuth } from "../../betterAuth";

/**
 * List all schools with status and assigned-admin summary.
 * Platform-admin only.
 */
export const listSchools = query({
  args: {},
  handler: async (ctx) => {
    await getAuthenticatedPlatformAdmin(ctx);

    const schools = await ctx.db.query("schools").order("desc").collect();

    const result = [];
    for (const school of schools) {
      const adminUser = await ctx.db
        .query("users")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .filter((q) => q.eq(q.field("role"), "admin"))
        .first();

      result.push({
        _id: school._id,
        name: school.name,
        slug: school.slug,
        status: school.status ?? "active",
        createdAt: school.createdAt,
        updatedAt: school.updatedAt,
        adminName: adminUser?.name ?? null,
        adminEmail: adminUser?.email ?? null,
        features: {
          billing: school.features?.billing ?? true,
          curriculum: school.features?.curriculum ?? true,
          knowledgeLibrary: school.features?.knowledgeLibrary ?? true,
          admissions: school.features?.admissions ?? false,
        },
      });
    }

    return result;
  },
});

/**
 * Create a new school with a unique slug.
 * School starts in "pending" status.
 * Platform-admin only.
 */
export const createSchool = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedPlatformAdmin(ctx);

    const name = args.name.trim();
    const slug = args.slug.trim().toLowerCase();

    if (!name) {
      throw new ConvexError("School name is required");
    }

    if (!slug) {
      throw new ConvexError("School slug is required");
    }

    // Validate slug format: lowercase alphanumeric with hyphens
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      throw new ConvexError(
        "Slug must be lowercase alphanumeric with hyphens (e.g. my-school)"
      );
    }

    // Check slug uniqueness
    const existing = await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (existing) {
      throw new ConvexError("A school with this slug already exists");
    }

    const now = Date.now();

    const schoolId = await ctx.db.insert("schools", {
      name,
      slug,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { schoolId, slug };
  },
});

/**
 * Internal mutation: insert school-scoped admin user and transition school status.
 * Called from the provisioning action after Better Auth account is created.
 */
export const assignSchoolAdminInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    adminName: v.string(),
    adminEmail: v.string(),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    if (school.status !== "pending") {
      throw new ConvexError("School already has an admin assigned");
    }

    // Check if the email is already in use by a school-scoped user
    const existingUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.adminEmail))
      .first();

    if (existingUser) {
      throw new ConvexError(
        "This email is already assigned to a user in the system"
      );
    }

    const now = Date.now();

    // Insert school-scoped admin user
    const adminUserId = await ctx.db.insert("users", {
      schoolId: args.schoolId,
      authId: args.authId,
      name: args.adminName,
      email: args.adminEmail,
      role: "admin",
      isSchoolAdmin: true,
      managerUserId: null,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(
      internal.functions.academic.adminLeadershipHelpers.ensureSchoolLeadAdminInternal,
      {
        schoolId: args.schoolId,
        leadAdminUserId: adminUserId,
        updatedBy: adminUserId,
      }
    );

    // Transition school from pending to active
    await ctx.db.patch(args.schoolId, {
      status: "active",
      updatedAt: now,
    });

    return {
      success: true,
      schoolId: args.schoolId,
      adminEmail: args.adminEmail,
    };
  },
});

export const inspectProvisioningEmailInternal = internalQuery({
  args: {
    email: v.string(),
  },
  returns: v.object({
    schoolUserExists: v.boolean(),
    platformAdminExists: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();

    const existingSchoolUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .first();

    const existingPlatformAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    return {
      schoolUserExists: Boolean(existingSchoolUser),
      platformAdminExists: Boolean(existingPlatformAdmin),
    };
  },
});

export const inspectProvisioningAuthIdInternal = internalQuery({
  args: {
    authId: v.string(),
  },
  returns: v.object({
    schoolUserId: v.union(v.id("users"), v.null()),
    platformAdminId: v.union(v.id("platformAdmins"), v.null()),
  }),
  handler: async (ctx, args) => {
    const existingSchoolUser = await ctx.db
      .query("users")
      .withIndex("by_auth", (q) => q.eq("authId", args.authId))
      .unique();

    const existingPlatformAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth", (q) => q.eq("authId", args.authId))
      .unique();

    return {
      schoolUserId: existingSchoolUser?._id ?? null,
      platformAdminId: existingPlatformAdmin?._id ?? null,
    };
  },
});

/**
 * Action: provision a school admin end-to-end.
 * 1. Creates a Better Auth account via the auth API
 * 2. Calls internal mutation to insert the school-scoped user row
 * 3. Transitions school status from pending to active
 *
 * Platform-admin only.
 */
export const provisionSchoolAdmin = action({
  args: {
    schoolId: v.id("schools"),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPassword: v.string(),
    origin: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    schoolId: v.id("schools"),
    adminEmail: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    schoolId: Id<"schools">;
    adminEmail: string;
  }> => {
    await ctx.runQuery(
      internal.functions.platform.auth.requirePlatformAdminInternal,
      {}
    );

    const adminName = args.adminName.trim();
    const adminEmail = args.adminEmail.trim().toLowerCase();
    const adminPassword = args.adminPassword;

    if (!adminName) {
      throw new ConvexError("Admin name is required");
    }

    if (!adminEmail) {
      throw new ConvexError("Admin email is required");
    }

    if (!adminPassword || adminPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    const authId = await provisionSchoolAdminAuthUser(ctx, {
      adminEmail,
      adminName,
      adminPassword,
    });

    // Call internal mutation to create user row and transition school
    const result: {
      success: boolean;
      schoolId: Id<"schools">;
      adminEmail: string;
    } = await ctx.runMutation(
      internal.functions.platform.index.assignSchoolAdminInternal,
      {
        schoolId: args.schoolId,
        adminName,
        adminEmail,
        authId,
      }
    );

    return result;
  },
});

/**
 * Mutation: Update modular feature toggles for a school.
 * Platform-admin only.
 */
export const updateSchoolFeatures = mutation({
  args: {
    schoolId: v.id("schools"),
    features: v.object({
      billing: v.boolean(),
      curriculum: v.boolean(),
      knowledgeLibrary: v.boolean(),
      admissions: v.boolean(),
    }),
  },
  handler: async (ctx, args) => {
    await getAuthenticatedPlatformAdmin(ctx);

    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    await ctx.db.patch(args.schoolId, {
      features: args.features,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const findSchoolAdminAuthIdInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      authId: v.string(),
      email: v.string(),
      name: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .filter((q) => q.eq(q.field("role"), "admin"))
      .first();

    if (!adminUser) return null;

    return {
      userId: adminUser._id,
      authId: adminUser.authId,
      email: adminUser.email,
      name: adminUser.name,
    };
  },
});

/**
 * Action: Platform Super Admin resets the password for any school admin.
 * Platform-admin only.
 */
export const resetSchoolAdminPassword = action({
  args: {
    schoolId: v.id("schools"),
    newPassword: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    adminEmail: v.string(),
    adminName: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    adminEmail: string;
    adminName: string;
  }> => {
    await ctx.runQuery(
      internal.functions.platform.auth.requirePlatformAdminInternal,
      {}
    );

    if (!args.newPassword || args.newPassword.length < 8) {
      throw new ConvexError("Password must be at least 8 characters");
    }

    const admin = await ctx.runQuery(
      internal.functions.platform.index.findSchoolAdminAuthIdInternal,
      { schoolId: args.schoolId }
    );

    if (!admin) {
      throw new ConvexError("No administrator account found for this school");
    }

    const auth = createAuth(ctx);
    const authContext = await auth.$context;
    const passwordHash = await authContext.password.hash(args.newPassword);

    const existingAuth = (await authContext.internalAdapter.findUserByEmail(
      admin.email.trim().toLowerCase(),
      { includeAccounts: true }
    )) as { user: { id: string }; accounts?: Array<{ id: string }> } | null;

    if (existingAuth?.accounts?.length) {
      await authContext.internalAdapter.updatePassword(admin.authId, passwordHash);
    } else {
      await authContext.internalAdapter.linkAccount({
        userId: admin.authId,
        providerId: "credential",
        accountId: admin.authId,
        password: passwordHash,
      });
    }

    await authContext.internalAdapter.deleteSessions(admin.authId);

    return {
      success: true,
      adminEmail: admin.email,
      adminName: admin.name,
    };
  },
});

