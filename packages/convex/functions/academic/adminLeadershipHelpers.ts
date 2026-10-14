import { internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { resolveStoredUserNameFields } from "./studentNameCompat";

type SchoolAdminRow = {
  _id: Id<"users">;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  role: "teacher" | "admin";
  isSchoolAdmin?: boolean;
  managerUserId?: Id<"users"> | null;
  isArchived?: boolean;
  createdAt: number;
};

export async function getSchoolLeadAdmin(ctx: any, schoolId: Id<"schools">) {
  return await ctx.db
    .query("schoolAdminLeadership")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .unique();
}

export async function getSchoolAdminRows(ctx: any, schoolId: Id<"schools">) {
  return (await ctx.db
    .query("users")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .filter((q: any) =>
      q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("isSchoolAdmin"), true))
    )
    .collect()) as SchoolAdminRow[];
}

export async function ensureSchoolLeadAdminRecord(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    leadAdminUserId: Id<"users">;
    updatedBy: Id<"users">;
  }
) {
  const now = Date.now();
  const existing = await getSchoolLeadAdmin(ctx, args.schoolId);

  if (existing) {
    await ctx.db.patch(existing._id, {
      previousLeadAdminUserId: existing.leadAdminUserId,
      leadAdminUserId: args.leadAdminUserId,
      updatedAt: now,
      updatedBy: args.updatedBy,
    });
    return existing._id;
  }

  return await ctx.db.insert("schoolAdminLeadership", {
    schoolId: args.schoolId,
    leadAdminUserId: args.leadAdminUserId,
    createdAt: now,
    updatedAt: now,
    updatedBy: args.updatedBy,
  });
}

export async function getResolvedSchoolLeadAdminUserId(
  ctx: any,
  schoolId: Id<"schools">
) {
  const existing = await getSchoolLeadAdmin(ctx, schoolId);
  if (existing) {
    return existing.leadAdminUserId;
  }

  const admins = await getSchoolAdminRows(ctx, schoolId);
  const activeAdmins = admins.filter((admin) => !admin.isArchived);
  const candidates = activeAdmins.length > 0 ? activeAdmins : admins;

  if (candidates.length === 0) {
    return null;
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }

    return a.name.localeCompare(b.name);
  });

  return sortedCandidates[0]._id;
}

export async function ensureResolvedSchoolLeadAdminRecord(
  ctx: any,
  args: {
    schoolId: Id<"schools">;
    updatedBy: Id<"users">;
  }
) {
  const leadAdminUserId = await getResolvedSchoolLeadAdminUserId(
    ctx,
    args.schoolId
  );

  if (!leadAdminUserId) {
    return null;
  }

  return await ensureSchoolLeadAdminRecord(ctx, {
    schoolId: args.schoolId,
    leadAdminUserId,
    updatedBy: args.updatedBy,
  });
}

export const ensureSchoolLeadAdminInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    leadAdminUserId: v.id("users"),
    updatedBy: v.id("users"),
  },
  returns: v.id("schoolAdminLeadership"),
  handler: async (ctx, args) => {
    return await ensureSchoolLeadAdminRecord(ctx, args);
  },
});

export const ensureResolvedSchoolLeadAdminRecordInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    updatedBy: v.id("users"),
  },
  returns: v.union(v.id("schoolAdminLeadership"), v.null()),
  handler: async (ctx, args) => {
    return await ensureResolvedSchoolLeadAdminRecord(ctx, args);
  },
});

export const upsertSchoolAdminRecordInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    adminName: v.string(),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.string()),
    adminEmail: v.string(),
    adminAuthId: v.string(),
    credentialOperationId: v.optional(v.string()),
    managerUserId: v.union(v.id("users"), v.null()),
    makeLead: v.boolean(),
    createdBy: v.id("users"),
  },
  returns: v.object({
    adminUserId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const normalizedEmail = args.adminEmail.trim().toLowerCase();
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_school", (q: any) => q.eq("schoolId", args.schoolId))
      .filter((q: any) =>
        q.and(q.eq(q.field("role"), "admin"), q.eq(q.field("email"), normalizedEmail))
      )
      .unique();

    const nameFields = resolveStoredUserNameFields({ name: args.adminName, firstName: args.firstName, middleName: args.middleName, lastName: args.lastName,
      fallbackName: existingAdmin?.name, fallbackFirstName: existingAdmin?.firstName, fallbackMiddleName: existingAdmin?.middleName, fallbackLastName: existingAdmin?.lastName });
    const leadership = await getSchoolLeadAdmin(ctx, args.schoolId);
    const existingAdminIsLead =
      !!existingAdmin &&
      !!leadership &&
      String(leadership.leadAdminUserId) === String(existingAdmin._id);

    if (existingAdmin) {
      await ctx.db.patch(existingAdmin._id, {
        authId: args.adminAuthId,
        ...(args.credentialOperationId ? { lastCredentialOperation: { operationId: args.credentialOperationId, kind: "reset" as const, committedAt: now } } : {}),
        ...nameFields,
        email: normalizedEmail,
        role: "admin",
        isSchoolAdmin: true,
        managerUserId: args.makeLead || existingAdminIsLead ? null : args.managerUserId,
        isArchived: false,
        updatedAt: now,
      });

      if (args.makeLead || existingAdminIsLead) {
        await ensureSchoolLeadAdminRecord(ctx, {
          schoolId: args.schoolId,
          leadAdminUserId: existingAdmin._id,
          updatedBy: args.createdBy,
        });
      }

      return { adminUserId: existingAdmin._id };
    }

    const adminUserId = await ctx.db.insert("users", {
      schoolId: args.schoolId,
      authId: args.adminAuthId,
      ...(args.credentialOperationId ? { lastCredentialOperation: { operationId: args.credentialOperationId, kind: "ready" as const, committedAt: now } } : {}),
      ...nameFields,
      email: normalizedEmail,
      role: "admin",
      isSchoolAdmin: true,
      managerUserId: args.makeLead ? null : args.managerUserId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    if (args.makeLead) {
      await ensureSchoolLeadAdminRecord(ctx, {
        schoolId: args.schoolId,
        leadAdminUserId: adminUserId,
        updatedBy: args.createdBy,
      });
    }

    return { adminUserId };
  },
});

export const promoteTeacherToAdminInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    teacherUserId: v.id("users"),
    credentialOperationId: v.optional(v.string()),
    managerUserId: v.union(v.id("users"), v.null()),
  },
  returns: v.object({
    adminUserId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherUserId);
    if (
      !teacher ||
      teacher.schoolId !== args.schoolId ||
      teacher.role !== "teacher"
    ) {
      throw new ConvexError("Teacher not found");
    }

    if (teacher.isArchived) {
      throw new ConvexError("Archived teachers cannot be promoted");
    }

    await ctx.db.patch(teacher._id, {
      ...(args.credentialOperationId ? { lastCredentialOperation: { operationId: args.credentialOperationId, kind: "reset" as const, committedAt: Date.now() } } : {}),
      isSchoolAdmin: true,
      managerUserId: args.managerUserId,
      updatedAt: Date.now(),
    });

    return {
      adminUserId: teacher._id,
    };
  },
});
