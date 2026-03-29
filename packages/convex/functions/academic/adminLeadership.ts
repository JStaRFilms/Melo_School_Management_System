import { api, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { action, mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { normalizeHumanName, normalizePersonName } from "@school/shared/name-format";
import { createAuth } from "../../betterAuth";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
import { provisionSchoolAdminAuthUser } from "../platform/provisioningHelpers";
import {
  ensureResolvedSchoolLeadAdminRecord,
  getResolvedSchoolLeadAdminUserId,
  getSchoolAdminRows,
  getSchoolLeadAdmin,
} from "./adminLeadershipHelpers";

export const listSchoolAdmins = query({
  args: {},
  returns: v.object({
    viewerUserId: v.id("users"),
    leadAdmin: v.union(
      v.null(),
      v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
      })
    ),
    admins: v.array(
      v.object({
        _id: v.id("users"),
        name: v.string(),
        email: v.string(),
        isArchived: v.boolean(),
        isLeadAdmin: v.boolean(),
        managerUserId: v.union(v.id("users"), v.null()),
        managerName: v.union(v.string(), v.null()),
        createdAt: v.number(),
      })
    ),
  }),
  handler: async (ctx) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const resolvedLeadAdminUserId = await getResolvedSchoolLeadAdminUserId(
      ctx,
      schoolId
    );
    const [leadership, admins] = await Promise.all([
      getSchoolLeadAdmin(ctx, schoolId),
      getSchoolAdminRows(ctx, schoolId),
    ]);

    const adminById = new Map(admins.map((admin) => [String(admin._id), admin]));
    const leadAdmin =
      (leadership
        ? adminById.get(String(leadership.leadAdminUserId)) ?? null
        : null) ??
      (resolvedLeadAdminUserId
        ? adminById.get(String(resolvedLeadAdminUserId)) ?? null
        : null);

    const sortedAdmins = admins
      .map((admin) => ({
        _id: admin._id,
        name: normalizePersonName(admin.name),
        email: admin.email,
        isArchived: Boolean(admin.isArchived),
        isLeadAdmin:
          String(leadership?.leadAdminUserId ?? resolvedLeadAdminUserId ?? "") ===
          String(admin._id),
        managerUserId: admin.managerUserId ?? null,
        managerName: admin.managerUserId
          ? adminById.get(String(admin.managerUserId))?.name
            ? normalizePersonName(adminById.get(String(admin.managerUserId))!.name)
            : null
          : null,
        createdAt: admin.createdAt,
      }))
      .sort((a, b) => {
        if (a.isLeadAdmin !== b.isLeadAdmin) {
          return a.isLeadAdmin ? -1 : 1;
        }

        if (a.isArchived !== b.isArchived) {
          return a.isArchived ? 1 : -1;
        }

        return a.name.localeCompare(b.name);
      });

    return {
      viewerUserId: userId,
      leadAdmin: leadAdmin
        ? {
            _id: leadAdmin._id,
            name: normalizePersonName(leadAdmin.name),
            email: leadAdmin.email,
          }
        : null,
      admins: sortedAdmins,
    };
  },
});

export const createSchoolAdmin = action({
  args: {
    name: v.string(),
    email: v.string(),
    temporaryPassword: v.string(),
    origin: v.string(),
  },
  returns: v.object({
    adminId: v.id("users"),
    email: v.string(),
    temporaryPassword: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    adminId: Id<"users">;
    email: string;
    temporaryPassword: string;
  }> => {
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer || viewer.isSchoolAdmin !== true) {
      throw new ConvexError("Admin access required");
    }

    const normalizedName = normalizeHumanName(args.name);
    const normalizedEmail = args.email.trim().toLowerCase();
    await ctx.runMutation(
      internal.functions.academic.adminLeadershipHelpers.ensureResolvedSchoolLeadAdminRecordInternal,
      {
        schoolId: viewer.schoolId,
        updatedBy: viewer.appUserId,
      }
    );

    const existingTeacher = await ctx.runQuery(
      (internal as any).functions.academic.academicSetup.findTeacherByEmailInternal,
      {
        schoolId: viewer.schoolId,
        email: normalizedEmail,
      }
    );

    if (existingTeacher) {
      const teacher = await ctx.runQuery(
        (internal as any).functions.academic.academicSetup.getTeacherRecordInternal,
        {
          teacherId: existingTeacher._id,
          schoolId: viewer.schoolId,
        }
      );
      const auth = createAuth(ctx);
      const authContext = await auth.$context;
      const passwordHash = await authContext.password.hash(args.temporaryPassword);

      await authContext.internalAdapter.updateUser(teacher.authId, {
        name: normalizedName,
        email: normalizedEmail,
      });
      await authContext.internalAdapter.updatePassword(teacher.authId, passwordHash);
      await authContext.internalAdapter.deleteSessions(teacher.authId);

      await ctx.runMutation(
        internal.functions.academic.academicSetup.updateTeacherRecordInternal,
        {
          teacherId: teacher._id,
          schoolId: viewer.schoolId,
          name: normalizedName,
          email: normalizedEmail,
        }
      );

      await ctx.runMutation(
        internal.functions.academic.adminLeadershipHelpers.promoteTeacherToAdminInternal,
        {
          schoolId: viewer.schoolId,
          teacherUserId: teacher._id,
          managerUserId: viewer.appUserId,
        }
      );

      return {
        adminId: teacher._id,
        email: normalizedEmail,
        temporaryPassword: args.temporaryPassword,
      };
    }

    const authId = await provisionSchoolAdminAuthUser(ctx, {
      adminName: normalizedName,
      adminEmail: normalizedEmail,
      adminPassword: args.temporaryPassword,
    });

    const result: { adminUserId: Id<"users"> } = await ctx.runMutation(
      internal.functions.academic.adminLeadershipHelpers.upsertSchoolAdminRecordInternal,
      {
        schoolId: viewer.schoolId,
        adminName: normalizedName,
        adminEmail: normalizedEmail,
        adminAuthId: authId,
        managerUserId: viewer.appUserId,
        makeLead: false,
        createdBy: viewer.appUserId,
      }
    );

    return {
      adminId: result.adminUserId,
      email: normalizedEmail,
      temporaryPassword: args.temporaryPassword,
    };
  },
});

export const promoteTeacherToAdmin = mutation({
  args: {
    teacherId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    await ensureResolvedSchoolLeadAdminRecord(ctx, {
      schoolId,
      updatedBy: userId,
    });

    const target = await ctx.db.get(args.teacherId);
    if (!target || target.schoolId !== schoolId || target.role !== "teacher") {
      throw new ConvexError("Teacher not found");
    }

    if (target.isArchived) {
      throw new ConvexError("Archived teachers cannot be promoted");
    }

    await ctx.runMutation(
      internal.functions.academic.adminLeadershipHelpers.promoteTeacherToAdminInternal,
      {
        schoolId,
        teacherUserId: target._id,
        managerUserId: userId,
      }
    );

    return null;
  },
});

export const promoteSchoolAdmin = mutation({
  args: {
    adminId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    await ensureResolvedSchoolLeadAdminRecord(ctx, {
      schoolId,
      updatedBy: userId,
    });

    const target = await ctx.db.get(args.adminId);
    if (
      !target ||
      target.schoolId !== schoolId ||
      (target.role !== "admin" && target.isSchoolAdmin !== true)
    ) {
      throw new ConvexError("Admin not found");
    }

    if (target.isArchived) {
      throw new ConvexError("Archived admins cannot be promoted");
    }

    const resolvedLeadAdminUserId = await getResolvedSchoolLeadAdminUserId(
      ctx,
      schoolId
    );
    if (String(resolvedLeadAdminUserId ?? "") === String(target._id)) {
      throw new ConvexError("Lead admin cannot be promoted");
    }

    await ctx.db.patch(target._id, {
      managerUserId: userId,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const archiveSchoolAdmin = mutation({
  args: {
    adminId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    await ensureResolvedSchoolLeadAdminRecord(ctx, {
      schoolId,
      updatedBy: userId,
    });

    const target = await ctx.db.get(args.adminId);
    if (
      !target ||
      target.schoolId !== schoolId ||
      (target.role !== "admin" && target.isSchoolAdmin !== true)
    ) {
      throw new ConvexError("Admin not found");
    }

    const resolvedLeadAdminUserId = await getResolvedSchoolLeadAdminUserId(
      ctx,
      schoolId
    );
    if (String(resolvedLeadAdminUserId ?? "") === String(target._id)) {
      throw new ConvexError("Lead admin cannot be archived. Transfer leadership first.");
    }

    if (target.isArchived) {
      throw new ConvexError("Admin is already archived");
    }

    await ctx.db.patch(target._id, {
      isArchived: true,
      archivedAt: Date.now(),
      archivedBy: userId,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const transferSchoolAdminLeadership = mutation({
  args: {
    adminId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const resolvedLeadAdminUserId = await getResolvedSchoolLeadAdminUserId(
      ctx,
      schoolId
    );
    if (String(resolvedLeadAdminUserId ?? "") !== String(userId)) {
      throw new ConvexError("Lead admin access required");
    }

    let leadership = await getSchoolLeadAdmin(ctx, schoolId);
    if (!leadership) {
      await ensureResolvedSchoolLeadAdminRecord(ctx, {
        schoolId,
        updatedBy: userId,
      });
      leadership = await getSchoolLeadAdmin(ctx, schoolId);
    }

    if (!leadership) {
      throw new ConvexError("Lead admin record missing");
    }

    const target = await ctx.db.get(args.adminId);
    if (
      !target ||
      target.schoolId !== schoolId ||
      (target.role !== "admin" && target.isSchoolAdmin !== true)
    ) {
      throw new ConvexError("Admin not found");
    }

    if (target.isArchived) {
      throw new ConvexError("Archived admins cannot receive leadership");
    }

    if (String(target.managerUserId ?? "") !== String(userId)) {
      throw new ConvexError(
        "Leadership can only transfer to one of the current lead admin's direct sub-admins."
      );
    }

    await ctx.db.patch(leadership._id, {
      previousLeadAdminUserId: leadership.leadAdminUserId,
      leadAdminUserId: target._id,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return null;
  },
});
