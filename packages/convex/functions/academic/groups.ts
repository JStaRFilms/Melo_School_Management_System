import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";
import { resolveActiveMembership } from "./auth";
import { isMembershipProprietor, FACTORY_ROLE_DEFINITIONS } from "./rbac";

/**
 * Summary representation of a branch membership for the active switcher UI.
 */
export interface UserBranchSummary {
  schoolId: Id<"schools">;
  name: string;
  slug: string;
  isHeadquarters: boolean;
  status: "active" | "suspended";
  membershipRoleTitle: string | null;
  groupName: string | null;
  groupSlug: string | null;
}

/**
 * Resolves the canonical person record for the current authenticated user identity.
 */
async function resolveCurrentPerson(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"persons"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const tokenIdentifier = identity.tokenIdentifier;
  if (tokenIdentifier) {
    const people = await ctx.db
      .query("persons")
      .withIndex("by_token_identifier", (q) =>
        q.eq("authTokenIdentifier", tokenIdentifier)
      )
      .take(2);
    if (people.length > 1) {
      throw new ConvexError("Unauthorized: ambiguous canonical identity");
    }
    if (people[0]) return people[0];
  }

  return null;
}

/**
 * Resolves a human-friendly role title for a branch membership.
 */
async function resolveMembershipRoleTitle(
  ctx: QueryCtx | MutationCtx,
  membership: Doc<"branchMemberships">
): Promise<string> {
  // 1. Explicit display title on membership record
  if (membership.displayTitle) {
    return membership.displayTitle;
  }

  // 2. Check if proprietor
  const isProprietor = await isMembershipProprietor(ctx, membership);
  if (isProprietor) {
    return "Proprietor";
  }

  // 3. Check role assignments
  const roleAssignments = await ctx.db
    .query("membershipRoleAssignments")
    .withIndex("by_membership", (q) => q.eq("membershipId", membership._id))
    .collect();

  for (const ra of roleAssignments) {
    if (ra.roleTemplateKey && FACTORY_ROLE_DEFINITIONS[ra.roleTemplateKey]) {
      return FACTORY_ROLE_DEFINITIONS[ra.roleTemplateKey].name;
    }
    const template = await ctx.db.get(ra.roleTemplateId);
    if (template?.name) {
      return template.name;
    }
  }

  // 4. Legacy user role fallback
  if (membership.legacyUserId) {
    const legacyUser = await ctx.db.get(membership.legacyUserId);
    if (legacyUser?.role) {
      return legacyUser.role.charAt(0).toUpperCase() + legacyUser.role.slice(1);
    }
  }

  return "Member";
}

/**
 * Returns all school branches where the authenticated user holds an active membership,
 * enriched with school group and headquarters metadata.
 */
export const listUserBranches = query({
  args: {},
  handler: async (ctx): Promise<UserBranchSummary[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required");
    }

    const tokenIdentifier = identity.tokenIdentifier;
    // 1. Resolve canonical person
    const person = await resolveCurrentPerson(ctx);

    let memberships: Doc<"branchMemberships">[] = [];

    if (person) {
      memberships = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_status", (q) =>
          q.eq("personId", person._id).eq("status", "active")
        )
        .collect();
    }

    // 2. Fallback to legacy users table if no active canonical memberships found
    if (memberships.length === 0) {
      const allUsers = await ctx.db.query("users").collect();
      const matchingUsers = allUsers.filter(
        (u) =>
          !u.isArchived &&
          tokenIdentifier && u.authTokenIdentifier === tokenIdentifier
      );
      const duplicateSchools = new Set<string>();
      for (const user of matchingUsers) {
        const schoolKey = String(user.schoolId);
        if (duplicateSchools.has(schoolKey)) {
          throw new ConvexError("Unauthorized: ambiguous canonical identity link");
        }
        duplicateSchools.add(schoolKey);
      }

      const results: UserBranchSummary[] = [];
      for (const u of matchingUsers) {
        const school = await ctx.db.get(u.schoolId);
        if (!school) continue;

        const groupBranch = await ctx.db
          .query("schoolGroupBranches")
          .withIndex("by_school", (q) => q.eq("schoolId", school._id))
          .first();

        let group: Doc<"schoolGroups"> | null = null;
        if (groupBranch) {
          group = await ctx.db.get(groupBranch.groupId);
        }

        const roleTitle = u.role
          ? u.role.charAt(0).toUpperCase() + u.role.slice(1)
          : "Member";

        results.push({
          schoolId: school._id,
          name: school.name,
          slug: school.slug,
          isHeadquarters: groupBranch?.isHeadquarters ?? false,
          status:
            school.status === "suspended" ? "suspended" : "active",
          membershipRoleTitle: roleTitle,
          groupName: group?.name ?? null,
          groupSlug: group?.slug ?? null,
        });
      }
      return results;
    }

    // 3. Transform memberships to UserBranchSummary
    const branchSummaries: UserBranchSummary[] = [];

    for (const membership of memberships) {
      const school = await ctx.db.get(membership.schoolId);
      if (!school) continue;

      // Group linking lookup
      const groupBranch = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .first();

      let group: Doc<"schoolGroups"> | null = null;
      if (groupBranch) {
        group = await ctx.db.get(groupBranch.groupId);
      }

      const roleTitle = await resolveMembershipRoleTitle(ctx, membership);

      branchSummaries.push({
        schoolId: school._id,
        name: school.name,
        slug: school.slug,
        isHeadquarters: groupBranch?.isHeadquarters ?? false,
        status:
          school.status === "suspended" ? "suspended" : "active",
        membershipRoleTitle: roleTitle,
        groupName: group?.name ?? null,
        groupSlug: group?.slug ?? null,
      });
    }

    return branchSummaries;
  },
});

/**
 * Shared helper for resolving group overview and member branches.
 */
export async function getGroupOverviewHelper(
  ctx: QueryCtx,
  groupId: Id<"schoolGroups">
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized: Authentication required");
  }

  const group = await ctx.db.get(groupId);
  if (!group) {
    throw new ConvexError("School group not found");
  }

  // Check platform admin bypass
  const tokenIdentifier = identity.tokenIdentifier;
  let isPlatformAdmin = false;
  if (tokenIdentifier) {
    const pa = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", tokenIdentifier)
      )
      .first();
    if (pa?.isActive) isPlatformAdmin = true;
  }
  const person = await resolveCurrentPerson(ctx);

  // Verify caller is proprietor or platform admin or has active membership in a group branch
  let isAuthorized = isPlatformAdmin;
  if (!isAuthorized && person && group.proprietorPersonId === person._id) {
    isAuthorized = true;
  }

  const branchLinks = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

  if (!isAuthorized && person) {
    for (const link of branchLinks) {
      const mem = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", person._id).eq("schoolId", link.schoolId)
        )
        .first();
      if (mem && mem.status === "active") {
        isAuthorized = true;
        break;
      }
    }
  }

  if (!isAuthorized) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Forbidden: Only authorized group proprietors may view group overview",
    });
  }

  const branches = await Promise.all(
    branchLinks.map(async (link) => {
      const school = await ctx.db.get(link.schoolId);
      return {
        schoolId: link.schoolId,
        name: school?.name ?? "Unknown Campus",
        slug: school?.slug ?? "",
        status: (school?.status === "suspended" ? "suspended" : "active") as
          | "active"
          | "suspended",
        isHeadquarters: link.isHeadquarters,
        linkedAt: link.linkedAt,
      };
    })
  );

  return {
    group,
    branches,
  };
}

/**
 * Returns detailed overview of a school group and its member branches.
 * Authorized for group proprietors, platform super admins, and group branch leaders.
 */
export const getGroupOverview = query({
  args: {
    groupId: v.id("schoolGroups"),
  },
  handler: async (ctx, args) => {
    return await getGroupOverviewHelper(ctx, args.groupId);
  },
});

/**
 * Returns all branches in a group for authorized group proprietors/directors.
 */
export const listGroupBranches = query({
  args: {
    groupId: v.id("schoolGroups"),
  },
  handler: async (ctx, args) => {
    const overview = await getGroupOverviewHelper(ctx, args.groupId);
    return overview.branches;
  },
});

/**
 * Creates a new school group and designates an initial headquarters branch.
 * Emits an append-only audit event.
 */
export const createSchoolGroup = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    headquartersSchoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required");
    }

    // Authorize caller against headquarters school
    const authContext = await resolveActiveMembership(
      ctx,
      args.headquartersSchoolId
    );

    const membership = authContext.membershipId
      ? await ctx.db.get(authContext.membershipId)
      : null;
    if (
      !authContext.isPlatformAdmin &&
      (!membership || !(await isMembershipProprietor(ctx, membership)))
    ) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Forbidden: Insufficient privileges to create school group",
      });
    }

    const hqSchool = await ctx.db.get(args.headquartersSchoolId);
    if (!hqSchool) {
      throw new ConvexError("Headquarters school not found");
    }

    // Verify slug uniqueness
    const existingGroup = await ctx.db
      .query("schoolGroups")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existingGroup) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: `School group with slug '${args.slug}' already exists`,
      });
    }

    // Verify HQ school is not already linked to another group
    const existingLink = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.headquartersSchoolId))
      .first();

    if (existingLink) {
      throw new ConvexError({
        code: "ALREADY_LINKED",
        message: "Headquarters school is already linked to a school group",
      });
    }

    // Resolve proprietor person
    let proprietorPersonId = authContext.personId;
    if (!proprietorPersonId) {
      const person = await resolveCurrentPerson(ctx);
      proprietorPersonId = person?._id;
    }

    if (!proprietorPersonId) {
      throw new ConvexError(
        "Cannot create school group without a canonical person identity"
      );
    }

    const now = Date.now();
    const groupId = await ctx.db.insert("schoolGroups", {
      name: args.name,
      slug: args.slug,
      proprietorPersonId,
      status: "active",
      settingsVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    const branchLinkId = await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: args.headquartersSchoolId,
      isHeadquarters: true,
      linkedAt: now,
    });

    // Record statutory audit event
    await recordAuditEventHelper(ctx, {
      schoolId: args.headquartersSchoolId,
      groupId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: identity.email ?? "unknown",
      module: "groups",
      action: "group.create",
      targetType: "schoolGroup",
      targetId: groupId,
      outcome: "success",
      safeSummary: `Created school group "${args.name}" (${args.slug}) with headquarters at ${hqSchool.name}`,
      retentionClass: "permanent_statutory",
    });

    return {
      groupId,
      branchLinkId,
    };
  },
});

/**
 * Links an additional branch to a school group.
 * Emits an append-only audit event.
 */
export const linkBranchToGroup = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    isHeadquarters: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new ConvexError("School group not found");
    }

    const targetSchool = await ctx.db.get(args.schoolId);
    if (!targetSchool) {
      throw new ConvexError("Target branch school not found");
    }

    // Authorize caller: must be platform admin OR group proprietor
    const tokenIdentifier = identity.tokenIdentifier;
    let isPlatformAdmin = false;
    if (tokenIdentifier) {
      const pa = await ctx.db
        .query("platformAdmins")
        .withIndex("by_auth_token_identifier", (q) =>
          q.eq("authTokenIdentifier", tokenIdentifier)
        )
        .first();
      if (pa?.isActive) isPlatformAdmin = true;
    }
    const person = await resolveCurrentPerson(ctx);
    const isProprietor = person && group.proprietorPersonId === person._id;

    if (!isPlatformAdmin && !isProprietor) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Forbidden: Only authorized group proprietors can link branches",
      });
    }

    // Verify branch is not already linked to another group
    const existingLink = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    if (existingLink && existingLink.groupId !== args.groupId) {
      throw new ConvexError({
        code: "ALREADY_LINKED",
        message: "Branch is already linked to another school group",
      });
    }

    // If making this branch headquarters, unmark any previous headquarters
    if (args.isHeadquarters) {
      const existingBranches = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
        .collect();

      for (const b of existingBranches) {
        if (b.isHeadquarters && b.schoolId !== args.schoolId) {
          await ctx.db.patch(b._id, { isHeadquarters: false });
        }
      }
    }

    const now = Date.now();
    let branchLinkId: Id<"schoolGroupBranches">;

    if (existingLink) {
      branchLinkId = existingLink._id;
      if (
        args.isHeadquarters !== undefined &&
        existingLink.isHeadquarters !== args.isHeadquarters
      ) {
        await ctx.db.patch(existingLink._id, {
          isHeadquarters: args.isHeadquarters,
        });
      }
    } else {
      branchLinkId = await ctx.db.insert("schoolGroupBranches", {
        groupId: args.groupId,
        schoolId: args.schoolId,
        isHeadquarters: args.isHeadquarters ?? false,
        linkedAt: now,
      });
    }

    // Resolve membership context for audit
    let actorMembershipId: Id<"branchMemberships"> | undefined;
    if (person) {
      const mem = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", person._id).eq("schoolId", args.schoolId)
        )
        .first();
      actorMembershipId = mem?._id;
    }

    // Record audit event
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      groupId: args.groupId,
      actorKind: isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: person?._id,
      actorMembershipId,
      actorEmailSnapshot: identity.email ?? "unknown",
      module: "groups",
      action: "group.branch_link",
      targetType: "schoolGroupBranches",
      targetId: branchLinkId,
      outcome: "success",
      safeSummary: `Linked branch "${targetSchool.name}" to school group "${group.name}" (isHeadquarters: ${Boolean(args.isHeadquarters)})`,
      retentionClass: "permanent_statutory",
    });

    return {
      success: true,
      branchLinkId,
    };
  },
});
