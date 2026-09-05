import { ConvexError } from "convex/values";
import type { EffectiveGroupBranding } from "@school/shared/group-settings";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";

type Context = QueryCtx | MutationCtx;
type Theme = NonNullable<Doc<"schools">["theme"]>;

export async function requireGroupOwner(
  ctx: Context,
  groupId: Id<"schoolGroups">,
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Forbidden: authentication required");
  const people = await ctx.db
    .query("persons")
    .withIndex("by_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .take(2);
  const person = people[0];
  const group = await ctx.db.get(groupId);
  if (
    people.length !== 1 ||
    person.status !== "active" ||
    person.identityReconciliationState === "reconciliation_required" ||
    group?.status !== "active" ||
    group.proprietorPersonId !== person._id
  ) {
    throw new ConvexError(
      "Forbidden: active canonical group proprietor required",
    );
  }
  return { group, person };
}

export async function requireBrandingBranch(
  ctx: Context,
  groupId: Id<"schoolGroups">,
  schoolId: Id<"schools">,
) {
  const auth = await requireCapability(
    ctx,
    schoolId,
    "settings.branding.manage",
  );
  if (!auth.membershipId || auth.isPlatformAdmin)
    throw new ConvexError(
      "Forbidden: explicit canonical branch membership required",
    );
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group_and_school", (q) =>
      q.eq("groupId", groupId).eq("schoolId", schoolId),
    )
    .unique();
  const group = await ctx.db.get(groupId);
  if (!link || group?.status !== "active")
    throw new ConvexError("Forbidden: active linked group required");
  return { auth, link, group };
}

export function validateTheme(theme: Theme): Theme {
  if (
    ![theme.primaryColor, theme.accentColor].every((value) =>
      /^#[0-9a-fA-F]{6}$/.test(value),
    )
  )
    throw new ConvexError("Use six-digit hex colors");
  return {
    primaryColor: theme.primaryColor.toLowerCase(),
    accentColor: theme.accentColor.toLowerCase(),
  };
}

// Caller must establish its own branch/family/public audience authority first.
// Only profile branding is resolved here, never issued report/invoice snapshots.
export async function resolveEffectiveTheme(
  ctx: Context,
  school: Doc<"schools">,
): Promise<EffectiveGroupBranding> {
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", school._id))
    .unique();
  const group = link ? await ctx.db.get(link.groupId) : null;
  const defaults =
    group?.status === "active" ? group.brandingDefault : undefined;
  const local = link?.brandingOverride;
  const groupVersion = defaults?.version ?? 0;
  const revision = local?.revision ?? 0;
  const legacyTheme = school.theme ?? {
    primaryColor: "#0f172a",
    accentColor: "#2563eb",
  };
  if (!defaults)
    return {
      theme: legacyTheme,
      source: school.theme ? "branch_legacy" : "factory",
      groupVersion,
      revision,
      mode: local?.mode ?? "legacy",
    };
  if (local?.mode === "override" && defaults.allowBranchOverride && local.theme)
    return {
      theme: local.theme,
      source: "branch_override",
      groupVersion,
      revision,
      mode: local.mode,
    };
  // Existing local branding is preserved until explicit inherit/reset. Linking is not a migration.
  if (!local && school.theme && defaults.allowBranchOverride)
    return {
      theme: school.theme,
      source: "branch_legacy",
      groupVersion,
      revision,
      mode: "legacy",
    };
  return {
    theme: defaults.theme,
    source: "group",
    groupVersion,
    revision,
    mode: local?.mode ?? "inherit",
  };
}

export async function getGroupBrandingHelper(
  ctx: Context,
  groupId: Id<"schoolGroups">,
) {
  const { group } = await requireGroupOwner(ctx, groupId);
  return {
    groupId,
    slug: group.slug,
    version: group.brandingDefault?.version ?? 0,
    defaults: group.brandingDefault ?? null,
  };
}

export async function previewGroupBrandingHelper(
  ctx: Context,
  args: {
    groupId: Id<"schoolGroups">;
    expectedVersion: number;
    theme: Theme;
    allowBranchOverride: boolean;
  },
) {
  const current = await getGroupBrandingHelper(ctx, args.groupId);
  if (args.expectedVersion !== current.version)
    throw new ConvexError("Conflict: reload the latest group version");
  return {
    ...current,
    candidate: {
      theme: validateTheme(args.theme),
      allowBranchOverride: args.allowBranchOverride,
      version: current.version + 1,
    },
    warning:
      "Profile branding only. Issued documents are not rewritten. Disabling overrides suppresses local branding until overrides are allowed again.",
  };
}

export async function saveGroupBrandingHelper(
  ctx: MutationCtx,
  args: {
    groupId: Id<"schoolGroups">;
    expectedVersion: number;
    theme: Theme;
    allowBranchOverride: boolean;
    confirmation: string;
  },
) {
  const preview = await previewGroupBrandingHelper(ctx, args);
  if (args.confirmation !== preview.slug)
    throw new ConvexError("Confirm the group slug");
  const { person } = await requireGroupOwner(ctx, args.groupId);
  const headquarters = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
    .take(101);
  if (headquarters.length > 100)
    throw new ConvexError("Group directory exceeds supported size");
  const journal = headquarters.find((link) => link.isHeadquarters);
  if (!journal) throw new ConvexError("Group headquarters requires review");
  await ctx.db.patch(args.groupId, {
    brandingDefault: preview.candidate,
    updatedAt: Date.now(),
  });
  await recordAuditEventHelper(ctx, {
    schoolId: journal.schoolId,
    groupId: args.groupId,
    actorKind: "user",
    actorEmailSnapshot: "group proprietor",
    actorPersonId: person._id,
    module: "groups",
    action: "group.branding_default",
    targetType: "schoolGroup",
    targetId: args.groupId,
    outcome: "success",
    safeSummary: `Branding default version ${preview.candidate.version}; branch overrides ${args.allowBranchOverride ? "allowed" : "disabled"}`,
    beforeSummary: preview.defaults
      ? `Version ${preview.version}: ${preview.defaults.theme.primaryColor} / ${preview.defaults.theme.accentColor}; overrides ${preview.defaults.allowBranchOverride}`
      : "No group branding default",
    afterSummary: `Version ${preview.candidate.version}: ${preview.candidate.theme.primaryColor} / ${preview.candidate.theme.accentColor}; overrides ${args.allowBranchOverride}`,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
  return preview.candidate.version;
}

export async function getBranchBrandingHelper(
  ctx: Context,
  args: { groupId: Id<"schoolGroups">; schoolId: Id<"schools"> },
) {
  const { group } = await requireBrandingBranch(
    ctx,
    args.groupId,
    args.schoolId,
  );
  const school = await ctx.db.get(args.schoolId);
  if (!school) throw new ConvexError("Branch unavailable");
  return {
    ...(await resolveEffectiveTheme(ctx, school)),
    allowBranchOverride: group.brandingDefault?.allowBranchOverride ?? false,
    defaultTheme: group.brandingDefault?.theme ?? null,
    slug: school.slug,
  };
}

export async function saveBranchBrandingHelper(
  ctx: MutationCtx,
  args: {
    groupId: Id<"schoolGroups">;
    schoolId: Id<"schools">;
    expectedVersion: number;
    expectedRevision: number;
    change: { mode: "inherit" } | { mode: "override"; theme: Theme };
    confirmation: string;
  },
) {
  const { auth, link, group } = await requireBrandingBranch(
    ctx,
    args.groupId,
    args.schoolId,
  );
  const current = await getBranchBrandingHelper(ctx, args);
  if (!group.brandingDefault)
    throw new ConvexError("Configure a group default first");
  if (
    current.groupVersion !== args.expectedVersion ||
    current.revision !== args.expectedRevision
  )
    throw new ConvexError("Conflict: reload group and branch versions");
  if (current.slug !== args.confirmation)
    throw new ConvexError("Confirm the branch slug");
  if (args.change.mode === "override" && !current.allowBranchOverride)
    throw new ConvexError("Branch overrides are disabled");
  const revision = current.revision + 1;
  await ctx.db.patch(link._id, {
    brandingOverride:
      args.change.mode === "inherit"
        ? { mode: "inherit", revision }
        : {
            mode: "override",
            theme: validateTheme(args.change.theme),
            revision,
          },
  });
  await recordAuditEventHelper(ctx, {
    schoolId: args.schoolId,
    groupId: args.groupId,
    actorKind: "user",
    actorEmailSnapshot: "branch manager",
    actorPersonId: auth.personId,
    actorMembershipId: auth.membershipId,
    module: "groups",
    action: "group.branding_override",
    targetType: "schoolGroupBranches",
    targetId: link._id,
    outcome: "success",
    safeSummary: `Branding ${args.change.mode}; revision ${revision}; group version ${current.groupVersion}`,
    beforeSummary: `Source ${current.source}; revision ${current.revision}; ${current.theme.primaryColor} / ${current.theme.accentColor}`,
    afterSummary:
      args.change.mode === "inherit"
        ? `Inherit group version ${current.groupVersion}; revision ${revision}`
        : `Branch override revision ${revision}; ${args.change.theme.primaryColor} / ${args.change.theme.accentColor}`,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
  return revision;
}
