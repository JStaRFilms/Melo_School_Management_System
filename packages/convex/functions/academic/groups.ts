import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { recordAuditEventHelper } from "./audit";
import { resolveActiveMembership, resolveLegacyViewer } from "./auth";
import {
  ensureFactoryRoleTemplateForAssignment,
  getAssignableRoleTemplateForSchool,
  requireCapability,
} from "./rbac";
import { isTrustedLegacySubjectIssuer } from "./identityResolver";

import { schoolThemeValidator } from "../foundation/brandingContract";
import {
  branchSettingChangeValidator,
  groupDefaultDomainValidator,
  groupDefaultSettingValidator,
} from "../foundation/groupDefaultsContract";
import { getOperationalOverviewHelper } from "./groupOverview";
import {
  getGroupBrandingHelper,
  previewGroupBrandingHelper,
  saveGroupBrandingHelper,
  getBranchBrandingHelper,
  saveBranchBrandingHelper,
  getGroupDomainSettingHelper,
  saveGroupDomainSettingHelper,
  previewGroupDomainSettingHelper,
  getBranchDomainSettingHelper,
  saveBranchDomainSettingHelper,
  createGroupRoleTemplateVersionHelper,
} from "./groupSettings";

type Context = QueryCtx | MutationCtx;

function groupMetadata(group: Doc<"schoolGroups">) {
  return {
    _id: group._id,
    _creationTime: group._creationTime,
    name: group.name,
    slug: group.slug,
    proprietorPersonId: group.proprietorPersonId,
    status: group.status,
    settingsVersion: group.settingsVersion,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export const getOperationalOverview = query({
  args: {
    groupId: v.id("schoolGroups"),
    branchId: v.optional(v.id("schools")),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: (ctx, args) => getOperationalOverviewHelper(ctx, args),
});

const groupBrandingArgs = {
  groupId: v.id("schoolGroups"),
  expectedVersion: v.number(),
  theme: schoolThemeValidator,
  allowBranchOverride: v.boolean(),
};
export const getGroupBranding = query({
  args: { groupId: v.id("schoolGroups") },
  handler: (ctx, args) => getGroupBrandingHelper(ctx, args.groupId),
});
export const previewGroupBranding = query({
  args: groupBrandingArgs,
  handler: (ctx, args) => previewGroupBrandingHelper(ctx, args),
});
export const saveGroupBranding = mutation({
  args: { ...groupBrandingArgs, confirmation: v.string() },
  handler: (ctx, args) => saveGroupBrandingHelper(ctx, args),
});
export const getBranchBranding = query({
  args: { groupId: v.id("schoolGroups"), schoolId: v.id("schools") },
  handler: (ctx, args) => getBranchBrandingHelper(ctx, args),
});
export const saveBranchBranding = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    expectedVersion: v.number(),
    expectedRevision: v.number(),
    confirmation: v.string(),
    change: v.union(
      v.object({ mode: v.literal("inherit") }),
      v.object({ mode: v.literal("override"), theme: schoolThemeValidator }),
    ),
  },
  handler: (ctx, args) => saveBranchBrandingHelper(ctx, args),
});

export const createGroupRoleTemplateVersion = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    name: v.string(),
    capabilities: v.array(v.string()),
    confirmation: v.string(),
  },
  handler: (ctx, args) => createGroupRoleTemplateVersionHelper(ctx, args),
});

export const getGroupDomainSetting = query({
  args: {
    groupId: v.id("schoolGroups"),
    domain: groupDefaultDomainValidator,
  },
  handler: (ctx, args) =>
    getGroupDomainSettingHelper(ctx, args.groupId, args.domain),
});
export const previewGroupDomainSetting = query({
  args: {
    groupId: v.id("schoolGroups"),
    expectedVersion: v.number(),
    allowBranchOverride: v.boolean(),
    setting: groupDefaultSettingValidator,
  },
  handler: (ctx, args) => previewGroupDomainSettingHelper(ctx, args),
});
export const saveGroupDomainSetting = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    expectedVersion: v.number(),
    allowBranchOverride: v.boolean(),
    confirmation: v.string(),
    setting: groupDefaultSettingValidator,
  },
  handler: (ctx, args) => saveGroupDomainSettingHelper(ctx, args),
});
export const getBranchDomainSetting = query({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    domain: groupDefaultDomainValidator,
  },
  handler: (ctx, args) => getBranchDomainSettingHelper(ctx, args),
});
export const saveBranchDomainSetting = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    expectedGroupVersion: v.number(),
    expectedRevision: v.number(),
    confirmation: v.string(),
    change: branchSettingChangeValidator,
  },
  handler: (ctx, args) => saveBranchDomainSettingHelper(ctx, args),
});

export async function resolveGroupPlatformOperator(ctx: Context) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  let rows = await ctx.db
    .query("platformAdmins")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .take(2);
  if (rows.length > 1)
    throw new ConvexError("Forbidden: ambiguous Platform identity");
  if (rows.length === 0 && isTrustedLegacySubjectIssuer(identity.issuer)) {
    const legacyRows = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth", (q) => q.eq("authId", identity.subject))
      .take(2);
    if (legacyRows.length > 1)
      throw new ConvexError("Forbidden: ambiguous Platform identity");
    rows = legacyRows.filter((row) => !row.authTokenIdentifier);
  }
  return rows[0] ?? null;
}

export async function isGroupPlatformOperator(ctx: Context) {
  return (await resolveGroupPlatformOperator(ctx))?.isActive === true;
}

async function currentPerson(ctx: Context) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Unauthorized: Authentication required");
  const people = await ctx.db
    .query("persons")
    .withIndex("by_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .take(2);
  if (people.length > 1)
    throw new ConvexError("Forbidden: ambiguous canonical identity");
  const person = people[0];
  if (
    person &&
    (person.status !== "active" ||
      person.identityReconciliationState === "reconciliation_required")
  )
    throw new ConvexError("Forbidden: identity requires review");
  return person ?? null;
}

async function requirePlatform(ctx: Context) {
  if (!(await isGroupPlatformOperator(ctx)))
    throw new ConvexError("Forbidden: Platform authority required");
}

export interface UserBranchSummary {
  schoolId: Id<"schools">;
  name: string;
  slug: string;
  isHeadquarters: boolean;
  status: "active" | "suspended";
  membershipRoleTitle: string | null;
  groupId: Id<"schoolGroups"> | null;
  groupName: string | null;
  groupSlug: string | null;
}

export const listUserBranches = query({
  args: {},
  handler: async (ctx): Promise<UserBranchSummary[]> => {
    const person = await currentPerson(ctx);
    let candidates: { schoolId: Id<"schools">; displayTitle?: string }[];
    if (person) {
      candidates = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_status", (q) =>
          q.eq("personId", person._id).eq("status", "active"),
        )
        .take(101);
      if (candidates.length > 100)
        throw new ConvexError(
          "Branch directory exceeds supported size; contact support",
        );
    } else {
      // Discovery historically returns no candidates for unrelated/untrusted issuers;
      // authentication and ambiguous identity failures remain terminal in the resolver.
      const legacy = await resolveLegacyViewer(ctx).catch((error: unknown) => {
        if (
          error instanceof ConvexError &&
          error.data === "Unauthorized: untrusted legacy identity issuer"
        )
          return null;
        throw error;
      });
      candidates = legacy
        ? [{ schoolId: legacy.schoolId, displayTitle: legacy.role }]
        : [];
    }
    const results: UserBranchSummary[] = [];
    for (const candidate of candidates) {
      const school = await ctx.db.get(candidate.schoolId);
      if (!school || school.status !== "active") continue;
      // Revalidate each candidate, including duplicate membership and legacy prelink checks.
      await resolveActiveMembership(ctx, school._id);
      const link = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .unique();
      const group = link ? await ctx.db.get(link.groupId) : null;
      results.push({
        schoolId: school._id,
        name: school.name,
        slug: school.slug,
        status: "active",
        isHeadquarters: link?.isHeadquarters ?? false,
        membershipRoleTitle:
          candidate.displayTitle ??
          (group?.proprietorPersonId === person?._id ? "Proprietor" : "Member"),
        groupId: group?.status === "active" ? group._id : null,
        groupName: group?.status === "active" ? group.name : null,
        groupSlug: group?.status === "active" ? group.slug : null,
      });
    }
    return results;
  },
});

async function canViewGroup(
  ctx: Context,
  group: Doc<"schoolGroups">,
  person: Doc<"persons"> | null,
) {
  if (group.proprietorPersonId === person?._id) return true;
  if (!person) return false;
  const memberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_person_and_status", (q) =>
      q.eq("personId", person._id).eq("status", "active"),
    )
    .take(101);
  if (memberships.length > 100)
    throw new ConvexError("Group access requires a bounded membership review");
  for (const membership of memberships) {
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", membership.schoolId))
      .unique();
    if (link?.groupId !== group._id) continue;
    try {
      await requireCapability(ctx, membership.schoolId, "audit.group.view");
      return true;
    } catch {
      // Another linked membership may carry the delegated capability.
    }
  }
  return false;
}

export async function getGroupOverviewHelper(
  ctx: Context,
  groupId: Id<"schoolGroups">,
) {
  const platform = await isGroupPlatformOperator(ctx);
  const person = platform ? null : await currentPerson(ctx);
  const group = await ctx.db.get(groupId);
  if (!group || (!platform && !(await canViewGroup(ctx, group, person))))
    throw new ConvexError("Forbidden: Group audit authority required");
  if (group.status !== "active") throw new ConvexError("Group is archived");
  const links = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .take(101);
  if (links.length > 100)
    throw new ConvexError("Group exceeds supported directory size");
  const branches = await Promise.all(
    links.map(async (link) => {
      const school = await ctx.db.get(link.schoolId);
      return {
        schoolId: link.schoolId,
        name: school?.name ?? "Unavailable branch",
        slug: school?.slug ?? "",
        status: school?.status ?? "unavailable",
        isHeadquarters: link.isHeadquarters,
        linkedAt: link.linkedAt,
      };
    }),
  );
  return { group: groupMetadata(group), branches };
}

export const getGroupOverview = query({
  args: { groupId: v.id("schoolGroups") },
  handler: (ctx, args) => getGroupOverviewHelper(ctx, args.groupId),
});
export const listGroupBranches = query({
  args: { groupId: v.id("schoolGroups") },
  handler: async (ctx, args) =>
    (await getGroupOverviewHelper(ctx, args.groupId)).branches,
});

export const listGroups = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const platform = await isGroupPlatformOperator(ctx);
    if (platform) {
      const page = await ctx.db.query("schoolGroups").order("desc").paginate({
        ...args.paginationOpts,
        numItems: Math.min(args.paginationOpts.numItems, 50),
      });
      return { ...page, page: page.page.map(groupMetadata) };
    }

    const person = await currentPerson(ctx);
    if (!person)
      throw new ConvexError("Forbidden: Canonical group identity required");
    const [ownedGroups, memberships] = await Promise.all([
      ctx.db
        .query("schoolGroups")
        .withIndex("by_proprietor", (q) => q.eq("proprietorPersonId", person._id))
        .take(101),
      ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_status", (q) =>
          q.eq("personId", person._id).eq("status", "active"),
        )
        .take(101),
    ]);
    if (ownedGroups.length > 100 || memberships.length > 100)
      throw new ConvexError("Group directory requires a bounded access review");
    const candidates = new Map(
      ownedGroups.map((group) => [String(group._id), group]),
    );
    for (const membership of memberships) {
      const link = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", membership.schoolId))
        .unique();
      if (!link || candidates.has(String(link.groupId))) continue;
      try {
        await requireCapability(ctx, membership.schoolId, "audit.group.view");
      } catch {
        continue;
      }
      const group = await ctx.db.get(link.groupId);
      if (group) candidates.set(String(group._id), group);
    }
    const groups = [...candidates.values()].sort(
      (left, right) => right._creationTime - left._creationTime,
    );
    const offset = args.paginationOpts.cursor
      ? Number(args.paginationOpts.cursor)
      : 0;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > groups.length)
      throw new ConvexError("Invalid group directory cursor");
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 50);
    const page = groups.slice(offset, offset + numItems).map(groupMetadata);
    const nextOffset = offset + page.length;
    return {
      page,
      isDone: nextOffset >= groups.length,
      continueCursor: String(nextOffset),
    };
  },
});

export const listLinkableSchools = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatform(ctx);
    const page = await ctx.db.query("schools").paginate({
      ...args.paginationOpts,
      numItems: Math.min(args.paginationOpts.numItems, 50),
    });
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (school) => ({
          schoolId: school._id,
          name: school.name,
          slug: school.slug,
          status: school.status,
          linked: Boolean(
            await ctx.db
              .query("schoolGroupBranches")
              .withIndex("by_school", (q) => q.eq("schoolId", school._id))
              .unique(),
          ),
        })),
      ),
    };
  },
});

type GroupManager =
  | { kind: "platform_admin"; platformAdmin: Doc<"platformAdmins"> }
  | {
      kind: "user";
      person: Doc<"persons">;
      membership: Doc<"branchMemberships">;
    };

type GroupBranch = {
  school: Doc<"schools">;
  link: Doc<"schoolGroupBranches">;
};

async function requireGroupManager(
  ctx: Context,
  group: Doc<"schoolGroups">,
): Promise<GroupManager> {
  const platformAdmin = await resolveGroupPlatformOperator(ctx);
  if (platformAdmin?.isActive)
    return { kind: "platform_admin", platformAdmin };

  const person = await currentPerson(ctx);
  if (!person || person._id !== group.proprietorPersonId)
    throw new ConvexError(
      "Forbidden: Platform or Group Proprietor authority required",
    );
  const memberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_person_and_status", (q) =>
      q.eq("personId", person._id).eq("status", "active"),
    )
    .take(101);
  if (memberships.length > 100)
    throw new ConvexError("Group authority requires a bounded membership review");
  for (const membership of memberships) {
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", membership.schoolId))
      .unique();
    if (link?.groupId === group._id)
      return { kind: "user", person, membership };
  }
  throw new ConvexError("Forbidden: Proprietor has no active group membership");
}

async function requireActiveGroupBranch(
  ctx: Context,
  groupId: Id<"schoolGroups">,
  schoolId: Id<"schools">,
): Promise<GroupBranch> {
  const [school, link] = await Promise.all([
    ctx.db.get(schoolId),
    ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .unique(),
  ]);
  if (
    !school ||
    school.status !== "active" ||
    !link ||
    link.groupId !== groupId
  )
    throw new ConvexError("School is not an active branch of this group");
  return { school, link };
}

function managerAuditFields(manager: GroupManager) {
  return manager.kind === "platform_admin"
    ? {
        actorKind: "platform_admin" as const,
        actorPlatformAdminId: manager.platformAdmin._id,
        actorEmailSnapshot: manager.platformAdmin.email,
      }
    : {
        actorKind: "user" as const,
        actorPersonId: manager.person._id,
        actorMembershipId: manager.membership._id,
        actorEmailSnapshot: manager.person.email,
      };
}

async function requireGroupAndManager(ctx: Context, groupId: Id<"schoolGroups">) {
  const group = await ctx.db.get(groupId);
  if (!group || group.status !== "active")
    throw new ConvexError("School group is not active");
  return { group, manager: await requireGroupManager(ctx, group) };
}

export const listGroupStaffCandidates = query({
  args: {
    groupId: v.id("schoolGroups"),
    sourceSchoolId: v.id("schools"),
    targetSchoolId: v.id("schools"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.paginationOpts.numItems > 50)
      throw new ConvexError("Request at most 50 staff candidates per page");
    const { group } = await requireGroupAndManager(ctx, args.groupId);
    const [source, target] = await Promise.all([
      requireActiveGroupBranch(ctx, group._id, args.sourceSchoolId),
      requireActiveGroupBranch(ctx, group._id, args.targetSchoolId),
    ]);
    if (source.school._id === target.school._id)
      throw new ConvexError("Choose two different group branches");

    const page = await ctx.db
      .query("branchMemberships")
      .withIndex("by_school_and_status", (q) =>
        q.eq("schoolId", source.school._id).eq("status", "active"),
      )
      .paginate(args.paginationOpts);
    const candidates = [];
    for (const membership of page.page) {
      const [person, sourceUser, targetMembership] = await Promise.all([
        ctx.db.get(membership.personId),
        membership.legacyUserId ? ctx.db.get(membership.legacyUserId) : null,
        ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_school", (q) =>
            q
              .eq("personId", membership.personId)
              .eq("schoolId", target.school._id),
          )
          .unique(),
      ]);
      if (
        !person ||
        person.status !== "active" ||
        !person.authTokenIdentifier ||
        person.identityReconciliationState === "reconciliation_required" ||
        !sourceUser ||
        sourceUser.isArchived ||
        sourceUser.personId !== person._id ||
        sourceUser.schoolId !== source.school._id ||
        sourceUser.authTokenIdentifier !== person.authTokenIdentifier ||
        sourceUser.role === "student" ||
        sourceUser.role === "parent" ||
        targetMembership?.status === "active"
      )
        continue;
      candidates.push({
        personId: person._id,
        name: person.name,
        email: person.email,
        sourceSchoolId: source.school._id,
        sourceSchoolName: source.school.name,
        currentRole: sourceUser.role,
        targetMembershipStatus: targetMembership?.status ?? null,
      });
    }
    return { ...page, page: candidates };
  },
});

export const listGroupAssignableRoleTemplates = query({
  args: {
    groupId: v.id("schoolGroups"),
    targetSchoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const { group } = await requireGroupAndManager(ctx, args.groupId);
    await requireActiveGroupBranch(ctx, group._id, args.targetSchoolId);
    const [globalTemplates, groupTemplates, branchTemplates] = await Promise.all([
      ctx.db
        .query("roleTemplates")
        .withIndex("by_scope_and_school", (q) => q.eq("scope", "global"))
        .take(101),
      ctx.db
        .query("roleTemplates")
        .withIndex("by_group", (q) => q.eq("groupId", group._id))
        .take(101),
      ctx.db
        .query("roleTemplates")
        .withIndex("by_scope_and_school", (q) =>
          q.eq("scope", "branch").eq("schoolId", args.targetSchoolId),
        )
        .take(101),
    ]);
    if ([globalTemplates, groupTemplates, branchTemplates].some((rows) => rows.length > 100))
      throw new ConvexError("Role template directory requires review");
    const templates = [...globalTemplates, ...groupTemplates, ...branchTemplates];
    const unique = new Map(templates.map((template) => [template._id, template]));
    const results = [];
    for (const template of unique.values()) {
      if (template.code === "proprietor") continue;
      try {
        await getAssignableRoleTemplateForSchool(
          ctx,
          template._id,
          args.targetSchoolId,
        );
      } catch {
        continue;
      }
      results.push({
        roleTemplateId: template._id,
        code: template.code,
        name: template.name,
        scope: template.scope,
      });
    }
    return results.sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const listGroupBranchStaff = query({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    if (args.paginationOpts.numItems > 50)
      throw new ConvexError("Request at most 50 staff memberships per page");
    const { group } = await requireGroupAndManager(ctx, args.groupId);
    const branch = await requireActiveGroupBranch(ctx, group._id, args.schoolId);
    const page = await ctx.db
      .query("branchMemberships")
      .withIndex("by_school_and_status", (q) =>
        q.eq("schoolId", branch.school._id).eq("status", "active"),
      )
      .paginate(args.paginationOpts);
    const staff = [];
    for (const membership of page.page) {
      const [person, user, activeMemberships] = await Promise.all([
        ctx.db.get(membership.personId),
        membership.legacyUserId ? ctx.db.get(membership.legacyUserId) : null,
        ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_status", (q) =>
            q.eq("personId", membership.personId).eq("status", "active"),
          )
          .take(2),
      ]);
      if (
        !person ||
        !user ||
        user.isArchived ||
        user.role === "student" ||
        user.role === "parent"
      )
        continue;
      staff.push({
        membershipId: membership._id,
        personId: person._id,
        name: person.name,
        email: person.email,
        role: user.role,
        displayTitle: membership.displayTitle ?? null,
        isDefaultBranch: membership.isDefaultBranch,
        isProprietor: group.proprietorPersonId === person._id,
        hasOtherBranch: activeMemberships.length > 1,
      });
    }
    return { ...page, page: staff };
  },
});

async function clearMembershipPermissionConfiguration(
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
  if ([roles, grants, restrictions].some((rows) => rows.length > 100))
    throw new ConvexError("Permission configuration requires review");
  for (const row of [...roles, ...grants, ...restrictions])
    await ctx.db.delete(row._id);
  if (ceiling) await ctx.db.delete(ceiling._id);
}

export const assignUserToBranch = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    sourceSchoolId: v.id("schools"),
    targetSchoolId: v.id("schools"),
    personId: v.id("persons"),
    role: v.union(
      v.literal("admin"),
      v.literal("teacher"),
      v.literal("staff"),
    ),
    roleTemplateId: v.optional(v.id("roleTemplates")),
    displayTitle: v.optional(v.string()),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const { group, manager } = await requireGroupAndManager(ctx, args.groupId);
    const [source, target, person] = await Promise.all([
      requireActiveGroupBranch(ctx, group._id, args.sourceSchoolId),
      requireActiveGroupBranch(ctx, group._id, args.targetSchoolId),
      ctx.db.get(args.personId),
    ]);
    if (source.school._id === target.school._id)
      throw new ConvexError("Choose two different group branches");
    if (args.confirmation !== target.school.slug)
      throw new ConvexError("Confirm the target branch slug");
    if (
      !person ||
      person.status !== "active" ||
      !person.authTokenIdentifier ||
      person.identityReconciliationState === "reconciliation_required"
    )
      throw new ConvexError("Selected identity requires review");
    const [sourceMembership, targetMembership, personUsers] = await Promise.all([
      ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", person._id).eq("schoolId", source.school._id),
        )
        .unique(),
      ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", person._id).eq("schoolId", target.school._id),
        )
        .unique(),
      ctx.db
        .query("users")
        .withIndex("by_person", (q) => q.eq("personId", person._id))
        .take(101),
    ]);
    if (personUsers.length > 100)
      throw new ConvexError("Identity projections require a bounded review");
    if (!sourceMembership || sourceMembership.status !== "active")
      throw new ConvexError("Person is not active in the selected source branch");
    if (targetMembership?.status === "active")
      return { success: true, membershipId: targetMembership._id, alreadyActive: true };

    const sourceUser = sourceMembership.legacyUserId
      ? await ctx.db.get(sourceMembership.legacyUserId)
      : null;
    if (
      !sourceUser ||
      sourceUser.isArchived ||
      sourceUser.schoolId !== source.school._id ||
      sourceUser.personId !== person._id ||
      sourceUser.authTokenIdentifier !== person.authTokenIdentifier ||
      sourceUser.role === "student" ||
      sourceUser.role === "parent"
    )
      throw new ConvexError("Source staff projection requires identity review");

    const targetUsers = personUsers.filter(
      (user) => user.schoolId === target.school._id,
    );
    if (targetUsers.length > 1)
      throw new ConvexError("Target branch has ambiguous identity projections");
    const emailConflicts = await ctx.db
      .query("users")
      .withIndex("by_school_and_email", (q) =>
        q.eq("schoolId", target.school._id).eq("email", person.email),
      )
      .take(2);
    if (emailConflicts.some((user) => user.personId !== person._id))
      throw new ConvexError("Target branch email belongs to another identity");

    const roleTemplate = args.roleTemplateId
      ? await getAssignableRoleTemplateForSchool(
          ctx,
          args.roleTemplateId,
          target.school._id,
        )
      : args.role === "admin"
        ? await ensureFactoryRoleTemplateForAssignment(ctx, "principal")
        : args.role === "staff"
          ? await ensureFactoryRoleTemplateForAssignment(
              ctx,
              "staff_administrator",
            )
          : null;
    if (roleTemplate?.code === "proprietor")
      throw new ConvexError("Proprietorship requires a separate transfer workflow");

    const now = Date.now();
    const existingTargetUser = targetUsers[0];
    const targetUserId = existingTargetUser?._id ??
      (await ctx.db.insert("users", {
        schoolId: target.school._id,
        authId: sourceUser.authId,
        authTokenIdentifier: person.authTokenIdentifier,
        personId: person._id,
        name: person.name,
        firstName: sourceUser.firstName,
        lastName: sourceUser.lastName,
        email: person.email,
        phone: sourceUser.phone,
        role: args.role,
        isSchoolAdmin: args.role === "admin",
        managerUserId: null,
        createdAt: now,
        updatedAt: now,
      }));
    if (existingTargetUser) {
      await ctx.db.patch(existingTargetUser._id, {
        authId: sourceUser.authId,
        authTokenIdentifier: person.authTokenIdentifier,
        name: person.name,
        email: person.email,
        role: args.role,
        isSchoolAdmin: args.role === "admin",
        isArchived: false,
        archivedAt: undefined,
        archivedBy: undefined,
        updatedAt: now,
      });
    }

    let membershipId: Id<"branchMemberships">;
    if (targetMembership) {
      await clearMembershipPermissionConfiguration(ctx, targetMembership._id);
      await ctx.db.patch(targetMembership._id, {
        status: "active",
        displayTitle: args.displayTitle?.trim() || undefined,
        permissionsManagedAt: now,
        isDefaultBranch: false,
        legacyUserId: targetUserId,
        updatedAt: now,
      });
      membershipId = targetMembership._id;
    } else {
      membershipId = await ctx.db.insert("branchMemberships", {
        personId: person._id,
        schoolId: target.school._id,
        status: "active",
        displayTitle: args.displayTitle?.trim() || undefined,
        permissionsManagedAt: now,
        isDefaultBranch: false,
        legacyUserId: targetUserId,
        joinedAt: now,
        updatedAt: now,
      });
    }
    if (roleTemplate) {
      await ctx.db.insert("membershipRoleAssignments", {
        membershipId,
        roleTemplateId: roleTemplate._id,
        roleTemplateKey: roleTemplate.code,
        assignedBy:
          manager.kind === "user" ? manager.person._id : undefined,
        assignedAt: now,
      });
    }
    await recordAuditEventHelper(ctx, {
      schoolId: target.school._id,
      groupId: group._id,
      ...managerAuditFields(manager),
      module: "groups",
      action: "membership.branch_assigned",
      targetType: "branchMemberships",
      targetId: membershipId,
      outcome: "success",
      safeSummary: `Assigned person ${person._id} to branch ${target.school._id} as ${args.role}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
    return { success: true, membershipId, alreadyActive: false };
  },
});

export const revokeUserBranchMembership = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    personId: v.id("persons"),
    reason: v.string(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    const { group, manager } = await requireGroupAndManager(ctx, args.groupId);
    const branch = await requireActiveGroupBranch(ctx, group._id, args.schoolId);
    if (args.confirmation !== branch.school.slug)
      throw new ConvexError("Confirm the branch slug");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 500)
      throw new ConvexError("Provide a revocation reason between 8 and 500 characters");
    if (args.personId === group.proprietorPersonId)
      throw new ConvexError("Group proprietorship requires a separate transfer workflow");

    const membership = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", args.personId).eq("schoolId", branch.school._id),
      )
      .unique();
    if (!membership || membership.status !== "active")
      throw new ConvexError("Active branch membership not found");
    if (membership.isDefaultBranch)
      throw new ConvexError("Choose another default branch before revoking this membership");
    const otherMemberships = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_status", (q) =>
        q.eq("personId", args.personId).eq("status", "active"),
      )
      .take(2);
    if (otherMemberships.length < 2)
      throw new ConvexError("The final branch must be removed through account archiving");

    const now = Date.now();
    await ctx.db.patch(membership._id, { status: "suspended", updatedAt: now });
    if (membership.legacyUserId) {
      const user = await ctx.db.get(membership.legacyUserId);
      if (user && user.schoolId === branch.school._id && user.personId === args.personId)
        await ctx.db.patch(user._id, {
          isArchived: true,
          archivedAt: now,
          updatedAt: now,
        });
    }
    await recordAuditEventHelper(ctx, {
      schoolId: branch.school._id,
      groupId: group._id,
      ...managerAuditFields(manager),
      module: "groups",
      action: "membership.branch_revoked",
      targetType: "branchMemberships",
      targetId: membership._id,
      outcome: "success",
      safeSummary: `Suspended branch membership for person ${args.personId}; reason recorded`,
      afterSummary: `Reason: ${reason}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
    return { success: true };
  },
});

export const listProprietorCandidates = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await requirePlatform(ctx);
    const users = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(101);
    if (users.length > 100)
      throw new ConvexError(
        "Administrator directory requires a bounded support review",
      );

    const admins = users.filter(
      (user) =>
        !user.isArchived &&
        (user.role === "admin" || user.isSchoolAdmin === true),
    );
    return await Promise.all(
      admins.map(async (user) => {
        const person = user.personId ? await ctx.db.get(user.personId) : null;
        const membership = person
          ? await ctx.db
              .query("branchMemberships")
              .withIndex("by_person_and_school", (q) =>
                q.eq("personId", person._id).eq("schoolId", args.schoolId),
              )
              .unique()
          : null;
        const identityReady = Boolean(
          person &&
            person.status === "active" &&
            person.authTokenIdentifier &&
            person.identityReconciliationState !==
              "reconciliation_required" &&
            membership?.status === "active" &&
            (!membership.legacyUserId || membership.legacyUserId === user._id),
        );
        return {
          userId: user._id,
          personId: identityReady ? person?._id : undefined,
          name: user.name,
          identityReady,
        };
      }),
    );
  },
});

export const createSchoolGroup = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    headquartersSchoolId: v.id("schools"),
    proprietorPersonId: v.id("persons"),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatform(ctx);
    const name = args.name.trim();
    const slug = args.slug.trim().toLowerCase();
    if (
      !name ||
      name.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      slug.length > 80
    )
      throw new ConvexError("Enter a group name and a valid lowercase slug");
    const school = await ctx.db.get(args.headquartersSchoolId);
    if (
      !school ||
      school.status !== "active" ||
      args.confirmation !== school.slug
    )
      throw new ConvexError("Confirm the active headquarters branch slug");
    const owner = await ctx.db.get(args.proprietorPersonId);
    if (
      !owner ||
      owner.status !== "active" ||
      !owner.authTokenIdentifier ||
      owner.identityReconciliationState === "reconciliation_required"
    )
      throw new ConvexError("Proprietor identity requires review");
    const identities = await ctx.db
      .query("persons")
      .withIndex("by_token_identifier", (q) =>
        q.eq("authTokenIdentifier", owner.authTokenIdentifier),
      )
      .take(2);
    const membership = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", owner._id).eq("schoolId", school._id),
      )
      .unique();
    if (identities.length !== 1 || membership?.status !== "active")
      throw new ConvexError(
        "Proprietor must have one reviewed active headquarters membership",
      );
    if (
      await ctx.db
        .query("schoolGroups")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    )
      throw new ConvexError("ALREADY_EXISTS: Group slug is already in use");
    if (
      await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", school._id))
        .first()
    )
      throw new ConvexError(
        "ALREADY_LINKED: Headquarters already belongs to a group",
      );
    const now = Date.now();
    const groupId = await ctx.db.insert("schoolGroups", {
      name,
      slug,
      proprietorPersonId: owner._id,
      status: "active",
      settingsVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    const branchLinkId = await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: school._id,
      isHeadquarters: true,
      linkedAt: now,
    });
    await recordAuditEventHelper(ctx, {
      schoolId: school._id,
      groupId,
      actorKind: "platform_admin",
      actorEmailSnapshot: "platform operator",
      module: "groups",
      action: "group.create",
      targetType: "schoolGroup",
      targetId: groupId,
      outcome: "success",
      safeSummary: `Created group ${slug}; headquarters ${school._id}; intended proprietor ${owner._id}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
    return { groupId, branchLinkId };
  },
});

export const linkBranchToGroup = mutation({
  args: {
    groupId: v.id("schoolGroups"),
    schoolId: v.id("schools"),
    isHeadquarters: v.optional(v.boolean()),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePlatform(ctx);
    const group = await ctx.db.get(args.groupId);
    const school = await ctx.db.get(args.schoolId);
    if (group?.status !== "active" || school?.status !== "active")
      throw new ConvexError("Group and target branch must be active");
    if (args.confirmation !== school.slug)
      throw new ConvexError("Confirm the target branch slug");
    if (args.isHeadquarters)
      throw new ConvexError(
        "Headquarters replacement requires separate ownership review",
      );
    const existing = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id))
      .unique();
    if (existing) {
      if (existing.groupId !== group._id)
        throw new ConvexError(
          "ALREADY_LINKED: Branch belongs to another group",
        );
      return { success: true, branchLinkId: existing._id };
    }
    const links = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_group", (q) => q.eq("groupId", group._id))
      .take(100);
    if (links.length >= 100)
      throw new ConvexError("Group exceeds supported directory size");
    const branchLinkId = await ctx.db.insert("schoolGroupBranches", {
      groupId: group._id,
      schoolId: school._id,
      isHeadquarters: false,
      linkedAt: Date.now(),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: school._id,
      groupId: group._id,
      actorKind: "platform_admin",
      actorEmailSnapshot: "platform operator",
      module: "groups",
      action: "group.branch_link",
      targetType: "schoolGroupBranches",
      targetId: branchLinkId,
      outcome: "success",
      safeSummary: `Linked branch ${school._id} to group ${group._id}; tenant records unchanged`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
    return { success: true, branchLinkId };
  },
});
