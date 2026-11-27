import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
  resolveActiveMembership,
} from "./auth";
import { getTeacherArchiveBlockers } from "./archiveGuardrails";
import { recordAuditEventHelper } from "./audit";
import {
  getContextCapabilities,
  isPermissionManaged,
  normalizeCapability,
} from "./rbac";
import { getActiveSession } from "./sessionScope";
import { getReadableUserName, resolveStoredUserNameFields } from "./studentNameCompat";

type ReadCtx = QueryCtx | MutationCtx;

const transferModeValidator = v.union(
  v.literal("permanent_move"),
  v.literal("shared_assignment"),
);

const targetRoleValidator = v.literal("teacher");

const assignmentHandoffValidator = v.union(
  v.object({ mode: v.literal("none") }),
  v.object({
    mode: v.literal("reassign"),
    replacementTeacherId: v.id("users"),
  }),
  v.object({ mode: v.literal("unassign_confirmed") }),
);

export async function hasActiveFamilyLinksInSchool(
  ctx: ReadCtx,
  schoolId: Id<"schools">,
  userId: Id<"users">,
): Promise<boolean> {
  const links = await ctx.db
    .query("familyMembers")
    .withIndex("by_parent_user", (q) => q.eq("parentUserId", userId))
    .take(25);
  for (const link of links) {
    if (link.schoolId !== schoolId) continue;
    const family = await ctx.db.get(link.familyId);
    if (!family || family.schoolId !== schoolId) continue;
    return true;
  }
  return false;
}

export async function clearMembershipPermissionRows(
  ctx: MutationCtx,
  membershipId: Id<"branchMemberships">,
) {
  const [roles, grants, restrictions, ceiling] = await Promise.all([
    ctx.db
      .query("membershipRoleAssignments")
      .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
      .take(101),
    ctx.db
      .query("membershipDirectGrants")
      .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
      .take(101),
    ctx.db
      .query("membershipDirectRestrictions")
      .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
      .take(101),
    ctx.db
      .query("delegationCeilings")
      .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
      .unique(),
  ]);
  if ([roles, grants, restrictions].some((rows) => rows.length > 100)) {
    throw new ConvexError("Permission configuration requires review");
  }
  for (const row of [...roles, ...grants, ...restrictions]) {
    await ctx.db.delete(row._id);
  }
  if (ceiling) await ctx.db.delete(ceiling._id);
}

async function resolveSchoolGroup(ctx: ReadCtx, schoolId: Id<"schools">) {
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  if (!link) return null;
  const group = await ctx.db.get(link.groupId);
  if (!group || group.status !== "active") return null;
  return { group, link };
}

async function hasSchoolStaffTransferAuthority(
  ctx: ReadCtx,
  schoolId: Id<"schools">,
  requiredCapabilities: readonly string[],
): Promise<{
  authorized: boolean;
  userId?: Id<"users">;
  personId?: Id<"persons">;
  membershipId?: Id<"branchMemberships">;
}> {
  try {
    const context = await resolveActiveMembership(ctx, schoolId);
    if (context.isPlatformAdmin || !context.userId) {
      return { authorized: false };
    }
    const user = await ctx.db.get(context.userId);
    if (!user || user.isArchived || user.schoolId !== schoolId) {
      return { authorized: false };
    }
    // S16: Enforce the exact same school-admin + capability authority for direct cutover as destination acceptance.
    await assertAdminForSchool(ctx, user._id, schoolId, user.role);
    const managed = await isPermissionManaged(ctx, context);
    if (managed) {
      const caps = await getContextCapabilities(ctx, context);
      const allowed = requiredCapabilities.some((required) =>
        caps.some((cap) => normalizeCapability(cap) === normalizeCapability(required)),
      );
      if (!allowed) return { authorized: false };
    }
    return {
      authorized: true,
      userId: user._id,
      personId: context.personId,
      membershipId: context.membershipId,
    };
  } catch {
    return { authorized: false };
  }
}

async function applySourceAssignmentHandoff(
  ctx: MutationCtx,
  args: {
    sourceSchoolId: Id<"schools">;
    teacherId: Id<"users">;
    actorUserId: Id<"users">;
    handoff?:
      | { mode: "none" }
      | { mode: "reassign"; replacementTeacherId: Id<"users"> }
      | { mode: "unassign_confirmed" };
  },
): Promise<{
  handoffMode: "none_needed" | "reassigned" | "unassigned";
  reassignedToTeacherId?: Id<"users">;
  blockers: string[];
}> {
  const blockers = await getTeacherArchiveBlockers(ctx, {
    schoolId: args.sourceSchoolId,
    teacherId: args.teacherId,
  });
  if (blockers.length === 0) {
    return { handoffMode: "none_needed", blockers: [] };
  }
  if (!args.handoff || args.handoff.mode === "none") {
    throw new ConvexError(
      `This teacher has active assignments (${blockers.slice(0, 3).join(", ")}). Reassign or confirm unassigning them before completing a permanent move.`,
    );
  }

  const now = Date.now();
  const [activeSession, classes, classSubjects, teacherAssignments, subjects] =
    await Promise.all([
      getActiveSession(ctx, args.sourceSchoolId),
      ctx.db
        .query("classes")
        .withIndex("by_school", (q) => q.eq("schoolId", args.sourceSchoolId))
        .collect(),
      ctx.db
        .query("classSubjects")
        .withIndex("by_school", (q) => q.eq("schoolId", args.sourceSchoolId))
        .collect(),
      ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
        .collect(),
      ctx.db
        .query("subjects")
        .withIndex("by_school", (q) => q.eq("schoolId", args.sourceSchoolId))
        .collect(),
    ]);

  const activeClassIds = new Set(
    classes.filter((c) => !c.isArchived).map((c) => String(c._id)),
  );
  const activeSubjectIds = new Set(
    subjects.filter((s) => !s.isArchived).map((s) => String(s._id)),
  );
  const activeSessionFormRows = activeSession
    ? await ctx.db
        .query("classSessionFormTeachers")
        .withIndex("by_teacher_and_session", (q) =>
          q.eq("formTeacherId", args.teacherId).eq("sessionId", activeSession._id),
        )
        .collect()
    : [];

  if (args.handoff.mode === "reassign") {
    const replacementId = args.handoff.replacementTeacherId;
    if (replacementId === args.teacherId) {
      throw new ConvexError("Select a different active teacher for reassignment");
    }
    const replacement = await ctx.db.get(replacementId);
    if (
      !replacement ||
      replacement.schoolId !== args.sourceSchoolId ||
      replacement.isArchived ||
      (replacement.role !== "teacher" &&
        replacement.role !== "admin" &&
        replacement.isSchoolAdmin !== true)
    ) {
      throw new ConvexError(
        "Replacement teacher must be an active teacher or school administrator in the source branch",
      );
    }

    for (const assignment of teacherAssignments) {
      if (
        assignment.schoolId !== args.sourceSchoolId ||
        !activeClassIds.has(String(assignment.classId)) ||
        !activeSubjectIds.has(String(assignment.subjectId))
      ) {
        continue;
      }
      const existing = await ctx.db
        .query("teacherAssignments")
        .withIndex("by_teacher_and_class_and_subject", (q) =>
          q
            .eq("teacherId", replacementId)
            .eq("classId", assignment.classId)
            .eq("subjectId", assignment.subjectId),
        )
        .unique();
      if (existing) {
        await ctx.db.delete(assignment._id);
      } else {
        await ctx.db.patch(assignment._id, {
          teacherId: replacementId,
          updatedAt: now,
        });
      }
    }

    for (const offering of classSubjects) {
      if (
        offering.teacherId === args.teacherId &&
        activeClassIds.has(String(offering.classId)) &&
        activeSubjectIds.has(String(offering.subjectId))
      ) {
        await ctx.db.patch(offering._id, {
          teacherId: replacementId,
          updatedAt: now,
        });
      }
    }

    for (const formRow of activeSessionFormRows) {
      if (
        formRow.schoolId === args.sourceSchoolId &&
        activeClassIds.has(String(formRow.classId))
      ) {
        await ctx.db.patch(formRow._id, {
          formTeacherId: replacementId,
          updatedBy: args.actorUserId,
          updatedAt: now,
        });
      }
    }

    for (const classDoc of classes) {
      if (!classDoc.isArchived && classDoc.formTeacherId === args.teacherId) {
        await ctx.db.patch(classDoc._id, {
          formTeacherId: replacementId,
          updatedAt: now,
        });
      }
    }

    return {
      handoffMode: "reassigned",
      reassignedToTeacherId: replacementId,
      blockers,
    };
  }

  // mode === "unassign_confirmed"
  for (const assignment of teacherAssignments) {
    if (
      assignment.schoolId === args.sourceSchoolId &&
      activeClassIds.has(String(assignment.classId)) &&
      activeSubjectIds.has(String(assignment.subjectId))
    ) {
      await ctx.db.delete(assignment._id);
    }
  }
  for (const offering of classSubjects) {
    if (
      offering.teacherId === args.teacherId &&
      activeClassIds.has(String(offering.classId)) &&
      activeSubjectIds.has(String(offering.subjectId))
    ) {
      await ctx.db.patch(offering._id, {
        teacherId: undefined,
        updatedAt: now,
      });
    }
  }
  for (const formRow of activeSessionFormRows) {
    if (
      formRow.schoolId === args.sourceSchoolId &&
      activeClassIds.has(String(formRow.classId))
    ) {
      await ctx.db.delete(formRow._id);
    }
  }
  for (const classDoc of classes) {
    if (!classDoc.isArchived && classDoc.formTeacherId === args.teacherId) {
      await ctx.db.patch(classDoc._id, {
        formTeacherId: undefined,
        updatedAt: now,
      });
    }
  }

  return { handoffMode: "unassigned", blockers };
}

async function executeBranchTransferCutover(
  ctx: MutationCtx,
  args: {
    group: Doc<"schoolGroups">;
    sourceSchool: Doc<"schools">;
    destinationSchool: Doc<"schools">;
    person: Doc<"persons">;
    sourceUser: Doc<"users">;
    sourceMembership: Doc<"branchMemberships">;
    mode: "permanent_move" | "shared_assignment";
    targetRole: "teacher";
    targetDisplayTitle?: string;
    actorUserId: Id<"users">;
    actorPersonId?: Id<"persons">;
    actorMembershipId?: Id<"branchMemberships">;
    actorEmail: string;
    handoff?:
      | { mode: "none" }
      | { mode: "reassign"; replacementTeacherId: Id<"users"> }
      | { mode: "unassign_confirmed" };
    reason?: string;
  },
) {
  const {
    group,
    sourceSchool,
    destinationSchool,
    person,
    sourceUser,
    sourceMembership,
    mode,
    targetRole,
  } = args;

  if (person._id === group.proprietorPersonId && mode === "permanent_move") {
    throw new ConvexError("Group proprietorship requires a separate transfer workflow");
  }
  if (
    person.status !== "active" ||
    !person.authTokenIdentifier ||
    person.identityReconciliationState === "reconciliation_required"
  ) {
    throw new ConvexError("Selected teacher identity requires review before transfer");
  }
  if (
    sourceUser.isArchived ||
    sourceUser.role !== "teacher" ||
    sourceUser.schoolId !== sourceSchool._id ||
    sourceUser.personId !== person._id ||
    sourceUser.authTokenIdentifier !== person.authTokenIdentifier
  ) {
    throw new ConvexError("Source teacher record requires identity review or is no longer an active teacher");
  }
  if (
    sourceMembership.status !== "active" ||
    sourceMembership.schoolId !== sourceSchool._id ||
    sourceMembership.personId !== person._id ||
    sourceMembership.legacyUserId !== sourceUser._id
  ) {
    throw new ConvexError("Teacher does not have an active matching membership in the source branch");
  }

  const [destMembership, personUsers, emailConflicts] = await Promise.all([
    ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", person._id).eq("schoolId", destinationSchool._id),
      )
      .unique(),
    ctx.db
      .query("users")
      .withIndex("by_person", (q) => q.eq("personId", person._id))
      .take(101),
    ctx.db
      .query("users")
      .withIndex("by_school_and_email", (q) =>
        q.eq("schoolId", destinationSchool._id).eq("email", person.email),
      )
      .take(2),
  ]);

  if (personUsers.length > 100) {
    throw new ConvexError("Identity projections require a bounded review");
  }
  if (emailConflicts.some((user) => user.personId !== person._id)) {
    throw new ConvexError("Destination branch already uses this email for another account");
  }

  const destUsers = personUsers.filter(
    (user) => user.schoolId === destinationSchool._id,
  );
  if (destUsers.length > 1) {
    throw new ConvexError("Destination branch has ambiguous identity projections");
  }

  let handoffOutcome: {
    handoffMode: "none_needed" | "reassigned" | "unassigned";
    reassignedToTeacherId?: Id<"users">;
    blockers: string[];
  } = { handoffMode: "none_needed", blockers: [] };

  if (mode === "permanent_move") {
    handoffOutcome = await applySourceAssignmentHandoff(ctx, {
      sourceSchoolId: sourceSchool._id,
      teacherId: sourceUser._id,
      actorUserId: args.actorUserId,
      handoff: args.handoff,
    });
  }

  // S2: Teacher branch transfers strictly grant teacher access, preserve grants on active memberships,
  // and refuse to silently reactivate inactive destination memberships that carry prior privileges.
  const now = Date.now();
  if (
    (person.credentialResetLock && person.credentialResetLock.expiresAt > now) ||
    (sourceUser.credentialOperationLock &&
      sourceUser.credentialOperationLock.expiresAt > now)
  ) {
    throw new ConvexError(
      "An account credential update is currently in progress. Retry the branch transfer in a moment.",
    );
  }
  const existingDestUser = destUsers[0];
  if (destMembership && destMembership.status !== "active") {
    const [destRoles, destGrants, destRestrictions, destCeiling] = await Promise.all([
      ctx.db
        .query("membershipRoleAssignments")
        .withIndex("by_membership", (q) => q.eq("membershipId", destMembership._id))
        .take(1),
      ctx.db
        .query("membershipDirectGrants")
        .withIndex("by_membership", (q) => q.eq("membershipId", destMembership._id))
        .take(1),
      ctx.db
        .query("membershipDirectRestrictions")
        .withIndex("by_membership", (q) => q.eq("membershipId", destMembership._id))
        .take(1),
      ctx.db
        .query("delegationCeilings")
        .withIndex("by_membership", (q) => q.eq("membershipId", destMembership._id))
        .unique(),
    ]);
    const hadPriorPrivileges =
      destMembership.permissionsManagedAt !== undefined ||
      destRoles.length > 0 ||
      destGrants.length > 0 ||
      destRestrictions.length > 0 ||
      Boolean(destCeiling) ||
      existingDestUser?.role === "admin" ||
      existingDestUser?.isSchoolAdmin === true;
    if (hadPriorPrivileges) {
      throw new ConvexError(
        "Destination branch has an inactive privileged membership that requires explicit permission review before reactivation",
      );
    }
  }
  const preserveExistingDestPrivileges = Boolean(
    destMembership?.status === "active" &&
      existingDestUser &&
      !existingDestUser.isArchived &&
      (existingDestUser.role === "admin" || existingDestUser.isSchoolAdmin === true),
  );
  const destUserId =
    existingDestUser?._id ??
    (await ctx.db.insert("users", {
      schoolId: destinationSchool._id,
      authId: sourceUser.authId,
      authTokenIdentifier: person.authTokenIdentifier,
      personId: person._id,
      ...resolveStoredUserNameFields({
        fallbackName: sourceUser.name,
        fallbackFirstName: sourceUser.firstName,
        fallbackMiddleName: sourceUser.middleName,
        fallbackLastName: sourceUser.lastName,
      }),
      email: person.email,
      phone: sourceUser.phone,
      role: targetRole,
      isSchoolAdmin: false,
      managerUserId: null,
      createdAt: now,
      updatedAt: now,
    }));

  if (existingDestUser) {
    await ctx.db.patch(existingDestUser._id, {
      authId: sourceUser.authId,
      authTokenIdentifier: person.authTokenIdentifier,
      email: person.email,
      ...(preserveExistingDestPrivileges
        ? {}
        : { role: targetRole, isSchoolAdmin: false }),
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: now,
    });
  }

  const otherActiveMemberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_person_and_status", (q) =>
      q.eq("personId", person._id).eq("status", "active"),
    )
    .take(101);
  const otherDefaultExists = otherActiveMemberships.some(
    (m) => m._id !== sourceMembership._id && m.isDefaultBranch,
  );
  const destBecomesDefault =
    mode === "permanent_move" &&
    (sourceMembership.isDefaultBranch || !otherDefaultExists);

  const normalizedTitle = args.targetDisplayTitle?.trim() || "Teacher";

  let destMembershipId: Id<"branchMemberships">;
  if (destMembership) {
    await ctx.db.patch(destMembership._id, {
      status: "active",
      displayTitle:
        preserveExistingDestPrivileges && destMembership.displayTitle
          ? destMembership.displayTitle
          : normalizedTitle,
      isDefaultBranch: destBecomesDefault || destMembership.isDefaultBranch,
      legacyUserId: destUserId,
      updatedAt: now,
    });
    destMembershipId = destMembership._id;
  } else {
    destMembershipId = await ctx.db.insert("branchMemberships", {
      personId: person._id,
      schoolId: destinationSchool._id,
      status: "active",
      displayTitle: normalizedTitle,
      isDefaultBranch: destBecomesDefault,
      legacyUserId: destUserId,
      joinedAt: now,
      updatedAt: now,
    });
  }

  let preservedParentAccess = false;
  if (mode === "permanent_move") {
    if (destBecomesDefault) {
      await ctx.db.patch(sourceMembership._id, {
        isDefaultBranch: false,
        updatedAt: now,
      });
      if (person.primarySchoolId === sourceSchool._id) {
        await ctx.db.patch(person._id, {
          primarySchoolId: destinationSchool._id,
          updatedAt: now,
        });
      }
    }

    preservedParentAccess = await hasActiveFamilyLinksInSchool(
      ctx,
      sourceSchool._id,
      sourceUser._id,
    );
    if (preservedParentAccess) {
      // Teacher is also a parent in the source branch: revoke staff access while keeping Family Portal active.
      await clearMembershipPermissionRows(ctx, sourceMembership._id);
      await ctx.db.patch(sourceMembership._id, {
        displayTitle: undefined,
        isDefaultBranch: false,
        updatedAt: now,
      });
      await ctx.db.patch(sourceUser._id, {
        role: "parent",
        isSchoolAdmin: false,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(sourceMembership._id, {
        status: "suspended",
        isDefaultBranch: false,
        updatedAt: now,
      });
      await ctx.db.patch(sourceUser._id, {
        isArchived: true,
        archivedAt: now,
        archivedBy: args.actorUserId,
        updatedAt: now,
      });
    }
  }

  const summarySuffix = args.reason?.trim() ? `; reason: ${args.reason.trim()}` : "";
  await Promise.all([
    recordAuditEventHelper(ctx, {
      schoolId: sourceSchool._id,
      groupId: group._id,
      actorKind: "user",
      actorPersonId: args.actorPersonId,
      actorMembershipId: args.actorMembershipId,
      actorEmailSnapshot: args.actorEmail,
      module: "staff",
      action:
        mode === "permanent_move"
          ? "staff.branch_transfer_out"
          : "staff.branch_shared_out",
      targetType: "branchMemberships",
      targetId: sourceMembership._id,
      outcome: "success",
      safeSummary: `${mode === "permanent_move" ? "Moved" : "Shared"} person ${person._id} to branch ${destinationSchool._id}${preservedParentAccess ? " (parent portal access retained in source branch)" : ""}${summarySuffix}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    }),
    recordAuditEventHelper(ctx, {
      schoolId: destinationSchool._id,
      groupId: group._id,
      actorKind: "user",
      actorPersonId: args.actorPersonId,
      actorMembershipId: args.actorMembershipId,
      actorEmailSnapshot: args.actorEmail,
      module: "staff",
      action:
        mode === "permanent_move"
          ? "staff.branch_transfer_in"
          : "staff.branch_shared_in",
      targetType: "branchMemberships",
      targetId: destMembershipId,
      outcome: "success",
      safeSummary: `Granted ${targetRole} membership to person ${person._id} from branch ${sourceSchool._id}${summarySuffix}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    }),
  ]);

  return {
    destinationUserId: destUserId,
    destinationMembershipId: destMembershipId,
    handoffOutcome,
    preservedParentAccess,
  };
}

export const listEligibleTransferBranches = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: ["staff.assignments.manage", "staff.onboard"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const groupInfo = await resolveSchoolGroup(ctx, actor.schoolId);
    if (!groupInfo) {
      return { inGroup: false, groupId: null, groupName: null, branches: [] };
    }

    const { group } = groupInfo;
    const links = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .take(101);
    if (links.length > 100) {
      throw new ConvexError("Group branch directory requires review");
    }

    const actorUser = await ctx.db.get(actor.userId);
    const isProprietor = Boolean(
      actorUser?.personId && group.proprietorPersonId === actorUser.personId,
    );

    const branches = [];
    for (const link of links) {
      if (link.schoolId === actor.schoolId) continue;
      const school = await ctx.db.get(link.schoolId);
      if (!school || school.status !== "active") continue;
      const destAuth = isProprietor
        ? { authorized: true }
        : await hasSchoolStaffTransferAuthority(ctx, school._id, ["staff.onboard"]);
      branches.push({
        schoolId: school._id,
        name: school.name,
        slug: school.slug,
        isHeadquarters: link.isHeadquarters,
        canCompleteDirectly: destAuth.authorized,
      });
    }

    return {
      inGroup: true,
      groupId: group._id,
      groupName: group.name,
      branches: branches.sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
});

export const getTeacherTransferPreflight = query({
  args: {
    teacherId: v.id("users"),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: ["staff.assignments.manage", "staff.onboard"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const teacher = await ctx.db.get(args.teacherId);
    if (
      !teacher ||
      teacher.schoolId !== actor.schoolId ||
      teacher.isArchived ||
      teacher.role !== "teacher"
    ) {
      throw new ConvexError("Teacher not found");
    }

    const [blockers, hasFamilyLinks, groupInfo, allSchoolUsers] = await Promise.all([
      getTeacherArchiveBlockers(ctx, {
        schoolId: actor.schoolId,
        teacherId: teacher._id,
      }),
      hasActiveFamilyLinksInSchool(ctx, actor.schoolId, teacher._id),
      resolveSchoolGroup(ctx, actor.schoolId),
      ctx.db
        .query("users")
        .withIndex("by_school", (q) => q.eq("schoolId", actor.schoolId))
        .take(500),
    ]);

    const replacementTeachers = allSchoolUsers
      .filter(
        (u) =>
          u._id !== teacher._id &&
          !u.isArchived &&
          (u.role === "teacher" || u.role === "admin" || u.isSchoolAdmin === true),
      )
      .map((u) => ({
        userId: u._id,
        name: getReadableUserName(u).displayName,
        role: u.role,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const activeBranchIds: Id<"schools">[] = [];
    const pendingDestinationIds: Id<"schools">[] = [];
    let canonicalReady = false;
    // S3: Restrict pre-flight branch/transfer visibility strictly to branches in the requesting school's group.
    const groupBranchIds = new Set<string>();
    if (groupInfo) {
      const groupLinks = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_group", (q) => q.eq("groupId", groupInfo.group._id))
        .take(101);
      for (const link of groupLinks) {
        groupBranchIds.add(String(link.schoolId));
      }
    }
    if (teacher.personId) {
      const person = await ctx.db.get(teacher.personId);
      canonicalReady = Boolean(
        person &&
          person.status === "active" &&
          person.authTokenIdentifier &&
          person.identityReconciliationState !== "reconciliation_required" &&
          teacher.authTokenIdentifier === person.authTokenIdentifier,
      );
      if (person && groupInfo) {
        const [memberships, pending] = await Promise.all([
          ctx.db
            .query("branchMemberships")
            .withIndex("by_person_and_status", (q) =>
              q.eq("personId", person._id).eq("status", "active"),
            )
            .take(101),
          ctx.db
            .query("staffBranchTransfers")
            .withIndex("by_person_and_status", (q) =>
              q.eq("personId", person._id).eq("status", "pending_acceptance"),
            )
            .take(50),
        ]);
        for (const m of memberships) {
          if (groupBranchIds.has(String(m.schoolId))) {
            activeBranchIds.push(m.schoolId);
          }
        }
        for (const t of pending) {
          if (
            t.groupId === groupInfo.group._id &&
            groupBranchIds.has(String(t.destinationSchoolId))
          ) {
            pendingDestinationIds.push(t.destinationSchoolId);
          }
        }
      }
    }

    return {
      teacherId: teacher._id,
      inGroup: Boolean(groupInfo),
      canonicalReady,
      activeAssignmentBlockers: blockers,
      hasActiveFamilyLinks: hasFamilyLinks,
      activeBranchIds,
      pendingDestinationIds,
      replacementTeachers,
    };
  },
});

export const listTeacherBranchTransfers = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: ["staff.assignments.manage", "staff.onboard", "staff.list.view"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const [outgoing, incoming] = await Promise.all([
      ctx.db
        .query("staffBranchTransfers")
        .withIndex("by_source_school_and_status", (q) =>
          q
            .eq("sourceSchoolId", actor.schoolId)
            .eq("status", "pending_acceptance"),
        )
        .take(50),
      ctx.db
        .query("staffBranchTransfers")
        .withIndex("by_destination_school_and_status", (q) =>
          q
            .eq("destinationSchoolId", actor.schoolId)
            .eq("status", "pending_acceptance"),
        )
        .take(50),
    ]);

    const hydrate = async (row: Doc<"staffBranchTransfers">) => {
      const [sourceSchool, destSchool, person] = await Promise.all([
        ctx.db.get(row.sourceSchoolId),
        ctx.db.get(row.destinationSchoolId),
        ctx.db.get(row.personId),
      ]);
      return {
        transferId: row._id,
        mode: row.mode,
        targetRole: row.targetRole,
        targetDisplayTitle: row.targetDisplayTitle ?? null,
        status: row.status,
        personName: person?.name ?? "Staff member",
        personEmail: person?.email ?? "",
        sourceSchoolId: row.sourceSchoolId,
        sourceSchoolName: sourceSchool?.name ?? "Source branch",
        destinationSchoolId: row.destinationSchoolId,
        destinationSchoolName: destSchool?.name ?? "Destination branch",
        assignmentHandoffMode: row.assignmentHandoffMode ?? null,
        assignmentSummary: row.assignmentSummary ?? [],
        reason: row.reason ?? null,
        createdAt: row.createdAt,
      };
    };

    return {
      outgoing: await Promise.all(outgoing.map(hydrate)),
      incoming: await Promise.all(incoming.map(hydrate)),
    };
  },
});

export const initiateTeacherBranchTransfer = mutation({
  args: {
    sourceSchoolId: v.optional(v.id("schools")),
    destinationSchoolId: v.id("schools"),
    teacherId: v.id("users"),
    mode: transferModeValidator,
    targetRole: v.optional(targetRoleValidator),
    targetDisplayTitle: v.optional(v.string()),
    assignmentHandoff: v.optional(assignmentHandoffValidator),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.sourceSchoolId,
      capability: ["staff.assignments.manage", "staff.onboard"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const sourceSchoolId = actor.schoolId;
    if (sourceSchoolId === args.destinationSchoolId) {
      throw new ConvexError("Choose a different destination branch");
    }

    const [sourceGroupInfo, destGroupInfo, sourceSchool, destSchool, actorUser] =
      await Promise.all([
        resolveSchoolGroup(ctx, sourceSchoolId),
        resolveSchoolGroup(ctx, args.destinationSchoolId),
        ctx.db.get(sourceSchoolId),
        ctx.db.get(args.destinationSchoolId),
        ctx.db.get(actor.userId),
      ]);

    if (
      !sourceGroupInfo ||
      !destGroupInfo ||
      sourceGroupInfo.group._id !== destGroupInfo.group._id ||
      !sourceSchool ||
      sourceSchool.status !== "active" ||
      !destSchool ||
      destSchool.status !== "active"
    ) {
      throw new ConvexError(
        "Both branches must be active members of the same school group",
      );
    }

    const group = sourceGroupInfo.group;
    const teacher = await ctx.db.get(args.teacherId);
    if (
      !teacher ||
      teacher.schoolId !== sourceSchoolId ||
      teacher.isArchived ||
      teacher.role !== "teacher"
    ) {
      throw new ConvexError("Active teacher not found in this branch");
    }
    if (!teacher.personId) {
      throw new ConvexError(
        "This teacher account must be linked to a canonical identity before moving across branches",
      );
    }

    const [person, sourceMembership, existingDestMembership, existingPending] =
      await Promise.all([
        ctx.db.get(teacher.personId),
        ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_school", (q) =>
            q.eq("personId", teacher.personId!).eq("schoolId", sourceSchoolId),
          )
          .unique(),
        ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_school", (q) =>
            q
              .eq("personId", teacher.personId!)
              .eq("schoolId", args.destinationSchoolId),
          )
          .unique(),
        ctx.db
          .query("staffBranchTransfers")
          .withIndex("by_person_and_status", (q) =>
            q.eq("personId", teacher.personId!).eq("status", "pending_acceptance"),
          )
          .take(20),
      ]);

    if (!person || !sourceMembership || sourceMembership.status !== "active") {
      throw new ConvexError("Active source branch membership not found");
    }
    if (
      args.mode === "shared_assignment" &&
      existingDestMembership?.status === "active"
    ) {
      throw new ConvexError("Teacher is already active in the destination branch");
    }
    if (
      existingPending.some(
        (t) => t.destinationSchoolId === args.destinationSchoolId,
      )
    ) {
      throw new ConvexError(
        "A pending branch transfer for this teacher to that branch already exists",
      );
    }

    const targetRole = args.targetRole ?? "teacher";
    const actorContext = await resolveActiveMembership(ctx, sourceSchoolId);
    const isProprietor = Boolean(
      actorContext.personId && group.proprietorPersonId === actorContext.personId,
    );
    const destAuth = isProprietor
      ? { authorized: true }
      : await hasSchoolStaffTransferAuthority(ctx, args.destinationSchoolId, [
          "staff.onboard",
        ]);
    const canCompleteDirectly = destAuth.authorized;
    const now = Date.now();
    const trimmedReason = args.reason?.trim() || undefined;

    if (canCompleteDirectly) {
      const result = await executeBranchTransferCutover(ctx, {
        group,
        sourceSchool,
        destinationSchool: destSchool,
        person,
        sourceUser: teacher,
        sourceMembership,
        mode: args.mode,
        targetRole,
        targetDisplayTitle: args.targetDisplayTitle,
        actorUserId: actor.userId,
        actorPersonId: actorContext.personId,
        actorMembershipId: actorContext.membershipId,
        actorEmail: actorUser?.email ?? "school-admin",
        handoff: args.assignmentHandoff,
        reason: trimmedReason,
      });

      const transferId = await ctx.db.insert("staffBranchTransfers", {
        groupId: group._id,
        sourceSchoolId,
        destinationSchoolId: args.destinationSchoolId,
        personId: person._id,
        sourceUserId: teacher._id,
        sourceMembershipId: sourceMembership._id,
        mode: args.mode,
        targetRole,
        targetDisplayTitle: args.targetDisplayTitle?.trim() || undefined,
        status: "completed",
        assignmentHandoffMode: result.handoffOutcome.handoffMode,
        reassignedToTeacherId: result.handoffOutcome.reassignedToTeacherId,
        assignmentSummary: result.handoffOutcome.blockers,
        initiatedByUserId: actor.userId,
        initiatedByPersonId: actorContext.personId,
        acceptedByUserId: actor.userId,
        acceptedByPersonId: actorContext.personId,
        reason: trimmedReason,
        destinationUserId: result.destinationUserId,
        destinationMembershipId: result.destinationMembershipId,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return {
        transferId,
        status: "completed" as const,
        preservedParentAccess: result.preservedParentAccess,
      };
    }

    // Two-step handshake: validate source blockers/handoff choice upfront without cutting off source yet.
    const blockers =
      args.mode === "permanent_move"
        ? await getTeacherArchiveBlockers(ctx, {
            schoolId: sourceSchoolId,
            teacherId: teacher._id,
          })
        : [];
    let handoffMode: "none_needed" | "reassigned" | "unassigned" = "none_needed";
    let reassignedToTeacherId: Id<"users"> | undefined;
    if (args.mode === "permanent_move" && blockers.length > 0) {
      if (!args.assignmentHandoff || args.assignmentHandoff.mode === "none") {
        throw new ConvexError(
          `Select how to handle active assignments (${blockers.slice(0, 3).join(", ")}) before requesting a permanent move.`,
        );
      }
      if (args.assignmentHandoff.mode === "reassign") {
        const replacement = await ctx.db.get(
          args.assignmentHandoff.replacementTeacherId,
        );
        if (
          !replacement ||
          replacement.schoolId !== sourceSchoolId ||
          replacement.isArchived ||
          replacement._id === teacher._id ||
          (replacement.role !== "teacher" &&
            replacement.role !== "admin" &&
            replacement.isSchoolAdmin !== true)
        ) {
          throw new ConvexError(
            "Select an active replacement teacher in the source branch",
          );
        }
        handoffMode = "reassigned";
        reassignedToTeacherId = replacement._id;
      } else {
        handoffMode = "unassigned";
      }
    }

    const transferId = await ctx.db.insert("staffBranchTransfers", {
      groupId: group._id,
      sourceSchoolId,
      destinationSchoolId: args.destinationSchoolId,
      personId: person._id,
      sourceUserId: teacher._id,
      sourceMembershipId: sourceMembership._id,
      mode: args.mode,
      targetRole,
      targetDisplayTitle: args.targetDisplayTitle?.trim() || undefined,
      status: "pending_acceptance",
      assignmentHandoffMode: handoffMode,
      reassignedToTeacherId,
      assignmentSummary: blockers,
      initiatedByUserId: actor.userId,
      initiatedByPersonId: actorContext.personId,
      reason: trimmedReason,
      createdAt: now,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: sourceSchoolId,
      groupId: group._id,
      actorKind: "user",
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmailSnapshot: actorUser?.email ?? "school-admin",
      module: "staff",
      action: "staff.branch_transfer_initiated",
      targetType: "staffBranchTransfers",
      targetId: transferId,
      outcome: "success",
      safeSummary: `Requested ${args.mode} for person ${person._id} from branch ${sourceSchoolId} to branch ${args.destinationSchoolId} pending destination approval`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });

    return {
      transferId,
      status: "pending_acceptance" as const,
      preservedParentAccess: false,
    };
  },
});

export const acceptTeacherBranchTransfer = mutation({
  args: {
    transferId: v.id("staffBranchTransfers"),
    schoolId: v.optional(v.id("schools")),
    targetRole: v.optional(targetRoleValidator),
    targetDisplayTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer || transfer.status !== "pending_acceptance") {
      throw new ConvexError("Pending branch transfer not found");
    }

    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId ?? transfer.destinationSchoolId,
      capability: "staff.onboard",
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    if (actor.schoolId !== transfer.destinationSchoolId) {
      throw new ConvexError("Only an authorized administrator of the destination branch can accept this transfer");
    }

    const [group, sourceSchool, destSchool, person, sourceUser, sourceMembership, actorUser] =
      await Promise.all([
        ctx.db.get(transfer.groupId),
        ctx.db.get(transfer.sourceSchoolId),
        ctx.db.get(transfer.destinationSchoolId),
        ctx.db.get(transfer.personId),
        ctx.db.get(transfer.sourceUserId),
        ctx.db.get(transfer.sourceMembershipId),
        ctx.db.get(actor.userId),
      ]);

    if (
      !group ||
      group.status !== "active" ||
      !sourceSchool ||
      sourceSchool.status !== "active" ||
      !destSchool ||
      destSchool.status !== "active" ||
      !person ||
      !sourceUser ||
      !sourceMembership
    ) {
      throw new ConvexError("Transfer prerequisites are no longer active");
    }

    const actorContext = await resolveActiveMembership(
      ctx,
      transfer.destinationSchoolId,
    );
    const handoff =
      transfer.assignmentHandoffMode === "reassigned" &&
      transfer.reassignedToTeacherId
        ? {
            mode: "reassign" as const,
            replacementTeacherId: transfer.reassignedToTeacherId,
          }
        : transfer.assignmentHandoffMode === "unassigned"
          ? { mode: "unassign_confirmed" as const }
          : { mode: "none" as const };

    const result = await executeBranchTransferCutover(ctx, {
      group,
      sourceSchool,
      destinationSchool: destSchool,
      person,
      sourceUser,
      sourceMembership,
      mode: transfer.mode,
      targetRole: "teacher",
      targetDisplayTitle: args.targetDisplayTitle ?? transfer.targetDisplayTitle,
      actorUserId: actor.userId,
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmail: actorUser?.email ?? "school-admin",
      handoff,
      reason: transfer.reason,
    });

    const now = Date.now();
    await ctx.db.patch(transfer._id, {
      status: "completed",
      targetRole: "teacher",
      targetDisplayTitle:
        args.targetDisplayTitle?.trim() || transfer.targetDisplayTitle,
      acceptedByUserId: actor.userId,
      acceptedByPersonId: actorContext.personId,
      destinationUserId: result.destinationUserId,
      destinationMembershipId: result.destinationMembershipId,
      assignmentHandoffMode: result.handoffOutcome.handoffMode,
      assignmentSummary: result.handoffOutcome.blockers,
      completedAt: now,
      updatedAt: now,
    });

    return {
      transferId: transfer._id,
      status: "completed" as const,
      preservedParentAccess: result.preservedParentAccess,
    };
  },
});

export const cancelTeacherBranchTransfer = mutation({
  args: {
    transferId: v.id("staffBranchTransfers"),
    schoolId: v.optional(v.id("schools")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer || transfer.status !== "pending_acceptance") {
      throw new ConvexError("Pending branch transfer not found");
    }

    const targetSchoolId = args.schoolId ?? transfer.sourceSchoolId;
    const isSource = targetSchoolId === transfer.sourceSchoolId;
    const isDestination = targetSchoolId === transfer.destinationSchoolId;
    if (!isSource && !isDestination) {
      throw new ConvexError("Cross-school access denied");
    }

    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: targetSchoolId,
      capability: ["staff.assignments.manage", "staff.onboard"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const [actorContext, actorUser] = await Promise.all([
      resolveActiveMembership(ctx, actor.schoolId),
      ctx.db.get(actor.userId),
    ]);
    const nextStatus = isSource ? "cancelled" : "rejected";
    const now = Date.now();
    await ctx.db.patch(transfer._id, {
      status: nextStatus,
      cancelledByUserId: actor.userId,
      reason: args.reason?.trim() || transfer.reason,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: actor.schoolId,
      groupId: transfer.groupId,
      actorKind: "user",
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmailSnapshot: actorUser?.email ?? "school-admin",
      module: "staff",
      action:
        nextStatus === "cancelled"
          ? "staff.branch_transfer_cancelled"
          : "staff.branch_transfer_rejected",
      targetType: "staffBranchTransfers",
      targetId: transfer._id,
      outcome: "success",
      safeSummary: `${nextStatus === "cancelled" ? "Cancelled" : "Rejected"} branch transfer ${transfer._id} from branch ${transfer.sourceSchoolId} to branch ${transfer.destinationSchoolId}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });

    return { transferId: transfer._id, status: nextStatus };
  },
});

export const setDefaultBranch = mutation({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");

    const people = await ctx.db
      .query("persons")
      .withIndex("by_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .take(2);
    if (people.length !== 1) {
      throw new ConvexError("Canonical identity required to change default school");
    }
    const person = people[0];
    if (
      person.status !== "active" ||
      person.identityReconciliationState === "reconciliation_required"
    ) {
      throw new ConvexError("Account requires review before changing default school");
    }

    const memberships = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_status", (q) =>
        q.eq("personId", person._id).eq("status", "active"),
      )
      .take(101);
    if (memberships.length > 100) {
      throw new ConvexError("Membership directory exceeds supported bounds");
    }

    const target = memberships.find((m) => m.schoolId === args.schoolId);
    if (!target) {
      throw new ConvexError("You do not have an active membership in that school");
    }
    const targetSchool = await ctx.db.get(args.schoolId);
    if (!targetSchool || targetSchool.status !== "active") {
      throw new ConvexError("Selected school is not active");
    }

    const now = Date.now();
    for (const membership of memberships) {
      const shouldBeDefault = membership._id === target._id;
      if (membership.isDefaultBranch !== shouldBeDefault) {
        await ctx.db.patch(membership._id, {
          isDefaultBranch: shouldBeDefault,
          updatedAt: now,
        });
      }
    }
    await ctx.db.patch(person._id, {
      primarySchoolId: args.schoolId,
      updatedAt: now,
    });

    return { schoolId: args.schoolId };
  },
});
