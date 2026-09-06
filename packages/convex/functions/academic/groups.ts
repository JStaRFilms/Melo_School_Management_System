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
import { isTrustedLegacySubjectIssuer } from "./identityResolver";

import { schoolThemeValidator } from "../foundation/brandingContract";
import { getOperationalOverviewHelper } from "./groupOverview";
import {
  getGroupBrandingHelper,
  previewGroupBrandingHelper,
  saveGroupBrandingHelper,
  getBranchBrandingHelper,
  saveBranchBrandingHelper,
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
        groupName: group?.status === "active" ? group.name : null,
        groupSlug: group?.status === "active" ? group.slug : null,
      });
    }
    return results;
  },
});

export async function getGroupOverviewHelper(
  ctx: Context,
  groupId: Id<"schoolGroups">,
) {
  const platform = await isGroupPlatformOperator(ctx);
  const person = platform ? null : await currentPerson(ctx);
  const group = await ctx.db.get(groupId);
  if (!group || (!platform && group.proprietorPersonId !== person?._id))
    throw new ConvexError(
      "Forbidden: Only authorized group proprietors may view group overview",
    );
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
    const person = platform ? null : await currentPerson(ctx);
    if (!platform && !person)
      throw new ConvexError(
        "Forbidden: Canonical proprietor identity required",
      );
    const source = platform
      ? ctx.db.query("schoolGroups")
      : ctx.db
          .query("schoolGroups")
          .withIndex("by_proprietor", (q) =>
            q.eq("proprietorPersonId", person!._id),
          );
    const page = await source.order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.min(args.paginationOpts.numItems, 50),
    });
    return { ...page, page: page.page.map(groupMetadata) };
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

export const listProprietorCandidates = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await requirePlatform(ctx);
    const memberships = await ctx.db
      .query("branchMemberships")
      .withIndex("by_school_and_status", (q) =>
        q.eq("schoolId", args.schoolId).eq("status", "active"),
      )
      .take(101);
    if (memberships.length > 100)
      throw new ConvexError(
        "Candidate directory requires a bounded support review",
      );
    const people = await Promise.all(
      memberships.map((m) => ctx.db.get(m.personId)),
    );
    return people
      .filter((p): p is Doc<"persons"> =>
        Boolean(
          p &&
          p.status === "active" &&
          p.authTokenIdentifier &&
          p.identityReconciliationState !== "reconciliation_required",
        ),
      )
      .map((p) => ({ personId: p._id, name: p.name }));
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
