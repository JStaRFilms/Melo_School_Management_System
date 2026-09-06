import { ConvexError } from "convex/values";
import type { EffectiveGroupBranding } from "@school/shared/group-settings";
import {
  FACTORY_NOTIFICATION_PREFERENCES,
  type BranchSettingChange,
  type BranchSettingChoice,
  type GroupDefaultDomain,
  type GroupDefaultSetting,
  validateGroupDefaultValue,
} from "../foundation/groupDefaultsContract";
import {
  latestBranchChoice,
  latestGroupDefault,
  resolveEffectiveGroupSetting,
  type EffectiveDomainSetting,
} from "./groupDefaultsResolver";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  CAPABILITY_CATALOG,
  normalizeCapability,
  requireCapability,
} from "./rbac";
import { recordAuditEventHelper } from "./audit";

type Context = QueryCtx | MutationCtx;
type Theme = NonNullable<Doc<"schools">["theme"]>;

const DOMAIN_CAPABILITY: Record<GroupDefaultDomain, string> = {
  role_templates: "staff.permissions.manage",
  report_card_template: "academic.grading_bands.manage",
  notification_preferences: "settings.general.edit",
  academic_policy: "academic.grading_bands.manage",
  calendar_template: "academic.classes.manage",
};

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

function normalizedSetting(setting: GroupDefaultSetting): GroupDefaultSetting {
  switch (setting.domain) {
    case "role_templates":
      return { domain: setting.domain, value: validateGroupDefaultValue(setting) };
    case "report_card_template":
      return { domain: setting.domain, value: validateGroupDefaultValue(setting) };
    case "notification_preferences":
      return { domain: setting.domain, value: validateGroupDefaultValue(setting) };
    case "academic_policy":
      return { domain: setting.domain, value: validateGroupDefaultValue(setting) };
    case "calendar_template":
      return { domain: setting.domain, value: validateGroupDefaultValue(setting) };
  }
}

async function requireDomainBranch(
  ctx: Context,
  groupId: Id<"schoolGroups">,
  schoolId: Id<"schools">,
  domain: GroupDefaultDomain,
) {
  const auth = await requireCapability(ctx, schoolId, DOMAIN_CAPABILITY[domain]);
  if (!auth.membershipId || auth.isPlatformAdmin || !auth.personId)
    throw new ConvexError("Forbidden: explicit canonical branch membership required");
  const [link, group, school] = await Promise.all([
    ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_group_and_school", (q) =>
        q.eq("groupId", groupId).eq("schoolId", schoolId),
      )
      .unique(),
    ctx.db.get(groupId),
    ctx.db.get(schoolId),
  ]);
  if (!link || group?.status !== "active" || school?.status !== "active")
    throw new ConvexError("Forbidden: active linked branch required");
  return { auth, personId: auth.personId, group, link, school };
}

async function validateRoleTemplateScope(
  ctx: Context,
  setting: GroupDefaultSetting | BranchSettingChange,
  scope: { groupId: Id<"schoolGroups">; schoolId?: Id<"schools"> },
) {
  if (setting.domain !== "role_templates" || !("value" in setting)) return;
  const ids = [...new Set(setting.value.templateIds)];
  if (ids.length > 30) throw new ConvexError("Use at most 30 role templates");
  for (const id of ids) {
    const template = await ctx.db.get(id);
    const valid = scope.schoolId
      ? template?.scope === "branch" && template.schoolId === scope.schoolId
      : template?.scope === "group" && template.groupId === scope.groupId;
    if (!valid)
      throw new ConvexError("Forbidden: role template belongs to another scope");
  }
}

async function localRoleTemplateSetting(ctx: Context, schoolId: Id<"schools">) {
  const rows = await ctx.db
    .query("roleTemplates")
    .withIndex("by_scope_and_school", (q) =>
      q.eq("scope", "branch").eq("schoolId", schoolId),
    )
    .take(31);
  if (rows.length > 30)
    throw new ConvexError("Role template directory requires review");
  return {
    domain: "role_templates" as const,
    value: { templateIds: rows.map((row) => row._id) },
  };
}

async function localAcademicPolicySetting(ctx: Context, schoolId: Id<"schools">) {
  const row = await ctx.db
    .query("schoolAssessmentSettings")
    .withIndex("by_school_active", (q) =>
      q.eq("schoolId", schoolId).eq("isActive", true),
    )
    .unique();
  return row
    ? {
        domain: "academic_policy" as const,
        value: { examInputMode: row.examInputMode },
      }
    : null;
}

export function resolveDomainSetting(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: "role_templates",
): Promise<EffectiveDomainSetting<"role_templates">>;
export function resolveDomainSetting(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: "report_card_template",
): Promise<EffectiveDomainSetting<"report_card_template">>;
export function resolveDomainSetting(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: "notification_preferences",
): Promise<EffectiveDomainSetting<"notification_preferences">>;
export function resolveDomainSetting(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: "academic_policy",
): Promise<EffectiveDomainSetting<"academic_policy">>;
export function resolveDomainSetting(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: "calendar_template",
): Promise<EffectiveDomainSetting<"calendar_template">>;
export function resolveDomainSetting<D extends GroupDefaultDomain>(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: D,
): Promise<EffectiveDomainSetting<D>>;
export async function resolveDomainSetting(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: GroupDefaultDomain,
): Promise<EffectiveDomainSetting<GroupDefaultDomain>> {
  switch (domain) {
    case "role_templates":
      return resolveEffectiveGroupSetting(
        ctx,
        schoolId,
        domain,
        await localRoleTemplateSetting(ctx, schoolId),
      );
    case "report_card_template":
      return resolveEffectiveGroupSetting(ctx, schoolId, domain, null);
    case "notification_preferences": {
      const effective = await resolveEffectiveGroupSetting(ctx, schoolId, domain, null);
      return {
        ...effective,
        value: effective.value ?? FACTORY_NOTIFICATION_PREFERENCES,
      };
    }
    case "academic_policy":
      return resolveEffectiveGroupSetting(
        ctx,
        schoolId,
        domain,
        await localAcademicPolicySetting(ctx, schoolId),
      );
    case "calendar_template":
      return resolveEffectiveGroupSetting(ctx, schoolId, domain, null);
  }
}

export async function createGroupRoleTemplateVersionHelper(
  ctx: MutationCtx,
  args: {
    groupId: Id<"schoolGroups">;
    name: string;
    capabilities: string[];
    confirmation: string;
  },
) {
  const { group, person } = await requireGroupOwner(ctx, args.groupId);
  const name = args.name.trim();
  if (!name || name.length > 100)
    throw new ConvexError("Role template name requires 1–100 characters");
  if (args.confirmation !== group.slug) throw new ConvexError("Confirm the group slug");
  if (args.capabilities.length > CAPABILITY_CATALOG.length * 2)
    throw new ConvexError("Too many capabilities");
  const catalog: ReadonlySet<string> = new Set(CAPABILITY_CATALOG);
  if (args.capabilities.some((capability) => !catalog.has(capability)))
    throw new ConvexError("Unknown capability");
  const capabilities = [...new Set(args.capabilities.map(normalizeCapability))].sort();
  const now = Date.now();
  const templateId = await ctx.db.insert("roleTemplates", {
    code: `group_${now}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    scope: "group",
    groupId: group._id,
    capabilities,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  });
  const journal = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .take(101);
  if (journal.length > 100 || !journal.some((link) => link.isHeadquarters))
    throw new ConvexError("Group headquarters requires review");
  const headquarters = journal.find((link) => link.isHeadquarters)!;
  await recordAuditEventHelper(ctx, {
    schoolId: headquarters.schoolId,
    groupId: group._id,
    actorKind: "user",
    actorPersonId: person._id,
    actorEmailSnapshot: "group proprietor",
    module: "groups",
    action: "group.role_template_version_created",
    targetType: "roleTemplates",
    targetId: templateId,
    outcome: "success",
    safeSummary: `Created immutable group role template '${name}' with ${capabilities.length} capabilities. No role was assigned.`,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
  return templateId;
}

export async function getGroupDomainSettingHelper(
  ctx: Context,
  groupId: Id<"schoolGroups">,
  domain: GroupDefaultDomain,
) {
  const { group } = await requireGroupOwner(ctx, groupId);
  const current = await latestGroupDefault(ctx, groupId, domain);
  const roleCandidates =
    domain === "role_templates"
      ? await ctx.db
          .query("roleTemplates")
          .withIndex("by_group", (q) => q.eq("groupId", groupId))
          .take(31)
      : [];
  if (roleCandidates.length > 30)
    throw new ConvexError("Role template directory requires review");
  return {
    groupId,
    slug: group.slug,
    domain,
    version: current?.version ?? 0,
    defaults: current ?? null,
    capabilityCatalog: domain === "role_templates" ? [...CAPABILITY_CATALOG] : [],
    roleCandidates: roleCandidates.map((template) => ({
      id: template._id,
      name: template.name,
      capabilities: template.capabilities,
    })),
  };
}

export async function previewGroupDomainSettingHelper(
  ctx: Context,
  args: {
    groupId: Id<"schoolGroups">;
    expectedVersion: number;
    allowBranchOverride: boolean;
    setting: GroupDefaultSetting;
  },
) {
  const { group } = await requireGroupOwner(ctx, args.groupId);
  const current = await latestGroupDefault(ctx, group._id, args.setting.domain);
  if ((current?.version ?? 0) !== args.expectedVersion)
    throw new ConvexError("Conflict: reload the latest group setting version");
  const setting = normalizedSetting(args.setting);
  await validateRoleTemplateScope(ctx, setting, { groupId: group._id });
  return {
    groupId: group._id,
    slug: group.slug,
    current: current ?? null,
    candidate: {
      ...setting,
      version: args.expectedVersion + 1,
      allowBranchOverride: args.allowBranchOverride,
    },
    warning:
      "This applies prospectively after explicit branch adoption. Existing assignments, counters, dates and issued reports are not rewritten.",
  };
}

export async function saveGroupDomainSettingHelper(
  ctx: MutationCtx,
  args: {
    groupId: Id<"schoolGroups">;
    expectedVersion: number;
    allowBranchOverride: boolean;
    confirmation: string;
    setting: GroupDefaultSetting;
  },
) {
  const { group, person } = await requireGroupOwner(ctx, args.groupId);
  const current = await latestGroupDefault(ctx, args.groupId, args.setting.domain);
  if ((current?.version ?? 0) !== args.expectedVersion)
    throw new ConvexError("Conflict: reload the latest group setting version");
  if (args.confirmation !== group.slug) throw new ConvexError("Confirm the group slug");
  const setting = normalizedSetting(args.setting);
  await validateRoleTemplateScope(ctx, setting, { groupId: group._id });
  const links = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", group._id))
    .take(101);
  if (links.length > 100) throw new ConvexError("Group directory exceeds supported size");
  const journal = links.find((link) => link.isHeadquarters);
  if (!journal) throw new ConvexError("Group headquarters requires review");
  const version = args.expectedVersion + 1;
  const createdAt = Date.now();
  await ctx.db.insert("groupSettingVersions", {
    groupId: group._id,
    ...setting,
    version,
    allowBranchOverride: args.allowBranchOverride,
    createdAt,
    createdBy: person._id,
  });
  await ctx.db.patch(group._id, { updatedAt: createdAt });
  await recordAuditEventHelper(ctx, {
    schoolId: journal.schoolId,
    groupId: group._id,
    actorKind: "user",
    actorPersonId: person._id,
    actorEmailSnapshot: "group proprietor",
    module: "groups",
    action: `group.${setting.domain}.default`,
    targetType: "groupSettingVersions",
    targetId: `${group._id}:${setting.domain}:${version}`,
    outcome: "success",
    safeSummary: `${setting.domain} default version ${version}; branch overrides ${args.allowBranchOverride ? "allowed" : "disabled"}. Existing records were not rewritten.`,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
  return version;
}

export async function getBranchDomainSettingHelper(
  ctx: Context,
  args: {
    groupId: Id<"schoolGroups">;
    schoolId: Id<"schools">;
    domain: GroupDefaultDomain;
  },
) {
  const { school } = await requireDomainBranch(
    ctx,
    args.groupId,
    args.schoolId,
    args.domain,
  );
  const roleCandidates =
    args.domain === "role_templates"
      ? await ctx.db
          .query("roleTemplates")
          .withIndex("by_scope_and_school", (q) =>
            q.eq("scope", "branch").eq("schoolId", args.schoolId),
          )
          .take(31)
      : [];
  if (roleCandidates.length > 30)
    throw new ConvexError("Role template directory requires review");
  return {
    ...(await resolveDomainSetting(ctx, args.schoolId, args.domain)),
    slug: school.slug,
    roleCandidates: roleCandidates.map((template) => ({
      id: template._id,
      name: template.name,
      capabilities: template.capabilities,
    })),
  };
}

export async function saveBranchDomainSettingHelper(
  ctx: MutationCtx,
  args: {
    groupId: Id<"schoolGroups">;
    schoolId: Id<"schools">;
    expectedGroupVersion: number;
    expectedRevision: number;
    confirmation: string;
    change: BranchSettingChange;
  },
) {
  const { auth, personId, group, school } = await requireDomainBranch(
    ctx,
    args.groupId,
    args.schoolId,
    args.change.domain,
  );
  const [defaults, current] = await Promise.all([
    latestGroupDefault(ctx, group._id, args.change.domain),
    latestBranchChoice(ctx, group._id, school._id, args.change.domain),
  ]);
  if (!defaults) throw new ConvexError("Configure a group default first");
  if (
    defaults.version !== args.expectedGroupVersion ||
    (current?.revision ?? 0) !== args.expectedRevision
  ) throw new ConvexError("Conflict: reload group and branch setting versions");
  if (args.confirmation !== school.slug) throw new ConvexError("Confirm the branch slug");
  if (args.change.mode === "override" && !defaults.allowBranchOverride)
    throw new ConvexError("Branch overrides are disabled");
  if (args.change.mode === "override") {
    const normalized = normalizedSetting(args.change);
    await validateRoleTemplateScope(ctx, normalized, {
      groupId: group._id,
      schoolId: school._id,
    });
  }
  const revision = args.expectedRevision + 1;
  const common = {
    groupId: group._id,
    schoolId: school._id,
    domain: args.change.domain,
    revision,
    groupVersion: defaults.version,
    createdAt: Date.now(),
    createdBy: personId,
  };
  const choice = (args.change.mode === "inherit"
    ? { ...common, mode: "inherit" }
    : {
        ...common,
        mode: "override",
        value: normalizedSetting(args.change).value,
      }) as BranchSettingChoice;
  await ctx.db.insert("branchSettingOverrides", choice);
  await recordAuditEventHelper(ctx, {
    schoolId: school._id,
    groupId: group._id,
    actorKind: "user",
    actorPersonId: auth.personId,
    actorMembershipId: auth.membershipId,
    actorEmailSnapshot: auth.role ?? "branch manager",
    module: "groups",
    action: `group.${args.change.domain}.choice`,
    targetType: "branchSettingOverrides",
    targetId: `${group._id}:${school._id}:${args.change.domain}:${revision}`,
    outcome: "success",
    safeSummary: `${args.change.domain} ${args.change.mode}; revision ${revision}; group version ${defaults.version}. Existing records were not rewritten.`,
    retentionClass: "permanent_statutory",
    alertTier: "tier1_critical",
  });
  return revision;
}
