import { internalMutation, type QueryCtx, type MutationCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { normalizePersonName } from "@school/shared/name-format";
import { assertStaffActive, recordStaffServiceEvent } from "./staffService";

type Context = QueryCtx | MutationCtx;

export async function getSchoolLeadAdmin(ctx: Context, schoolId: Id<"schools">) {
  return await ctx.db
    .query("schoolAdminLeadership")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
}

export async function getSchoolAdminRows(ctx: Context, schoolId: Id<"schools">) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .filter((q) =>
      q.or(q.eq(q.field("role"), "admin"), q.eq(q.field("isSchoolAdmin"), true))
    )
    .take(1001);
  if (rows.length > 1000) throw new ConvexError("School leadership directory requires bounded review");
  return rows;
}

export async function ensureSchoolLeadAdminRecord(
  ctx: MutationCtx,
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
  ctx: Context,
  schoolId: Id<"schools">
) {
  const existing = await getSchoolLeadAdmin(ctx, schoolId);
  if (existing) {
    const lead = await ctx.db.get(existing.leadAdminUserId);
    return lead && !lead.isArchived && lead.employmentStatus !== "departed" ? existing.leadAdminUserId : null;
  }

  const admins = await getSchoolAdminRows(ctx, schoolId);
  const candidates = admins.filter((admin) => !admin.isArchived && admin.employmentStatus !== "departed");

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
  ctx: MutationCtx,
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
    adminEmail: v.string(),
    adminAuthId: v.string(),
    managerUserId: v.union(v.id("users"), v.null()),
    makeLead: v.boolean(),
    createdBy: v.id("users"),
    joiningDay: v.optional(v.string()),
  },
  returns: v.object({
    adminUserId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const normalizedName = normalizePersonName(args.adminName);
    const normalizedEmail = args.adminEmail.trim().toLowerCase();
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_school_and_email", (q) => q.eq("schoolId", args.schoolId).eq("email", normalizedEmail))
      .unique();

    const leadership = await getSchoolLeadAdmin(ctx, args.schoolId);
    const existingAdminIsLead =
      !!existingAdmin &&
      !!leadership &&
      String(leadership.leadAdminUserId) === String(existingAdmin._id);

    if (existingAdmin) {
      assertStaffActive(existingAdmin);
      if (existingAdmin.isArchived) throw new ConvexError("Restore the archived account separately");
      if (existingAdmin.role !== "admin" || existingAdmin.authId !== args.adminAuthId)
        throw new ConvexError("Existing identity cannot be replaced through admin creation");
      await ctx.db.patch(existingAdmin._id, {
        name: normalizedName,
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

    const issuer = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
    if (!issuer) throw new ConvexError("Authentication issuer is not configured");
    const authTokenIdentifier = `${issuer}|${args.adminAuthId}`;
    const [people, tokenUsers] = await Promise.all([
      ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", authTokenIdentifier)).take(2),
      ctx.db.query("users").withIndex("by_auth_token_identifier", q => q.eq("authTokenIdentifier", authTokenIdentifier)).take(2),
    ]);
    if (people.length || tokenUsers.length) throw new ConvexError("Authentication identity is already linked; use the existing branch assignment path");
    const personId = await ctx.db.insert("persons", {
      authTokenIdentifier, identityReconciliationState: "resolved", name: normalizedName, email: normalizedEmail,
      status: "active", primarySchoolId: args.schoolId, createdAt: now, updatedAt: now,
    });
    const adminUserId = await ctx.db.insert("users", {
      schoolId: args.schoolId,
      authId: args.adminAuthId,
      authTokenIdentifier, personId,
      name: normalizedName,
      email: normalizedEmail,
      role: "admin",
      isSchoolAdmin: true,
      managerUserId: args.makeLead ? null : args.managerUserId,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("branchMemberships", {
      personId, schoolId: args.schoolId, status: "active", displayTitle: "School Admin",
      isDefaultBranch: true, legacyUserId: adminUserId, joinedAt: now, updatedAt: now,
    });
    const joinedAdmin = await ctx.db.get(adminUserId);
    if (!joinedAdmin) throw new ConvexError("Admin record not found after joining");
    await recordStaffServiceEvent(ctx, joinedAdmin, { type: "joined", reason: "New school admin joining", actorUserId: args.createdBy, effectiveDay: args.joiningDay });
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

    assertStaffActive(teacher);
    if (teacher.isArchived) {
      throw new ConvexError("Archived teachers cannot be promoted");
    }

    await ctx.db.patch(teacher._id, {
      isSchoolAdmin: true,
      managerUserId: args.managerUserId,
      updatedAt: Date.now(),
    });

    return {
      adminUserId: teacher._id,
    };
  },
});
