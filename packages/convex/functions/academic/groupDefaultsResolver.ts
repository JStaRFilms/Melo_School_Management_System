import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type {
  AcademicPolicy,
  BranchSettingChoice,
  CalendarTemplate,
  GroupDefaultDomain,
  GroupDefaultSetting,
  GroupDefaultVersion,
  NotificationPreferences,
  ReportCardTemplate,
  RoleTemplateDefault,
} from "../foundation/groupDefaultsContract";

type Context = QueryCtx | MutationCtx;
type DomainValueMap = {
  role_templates: RoleTemplateDefault;
  report_card_template: ReportCardTemplate;
  notification_preferences: NotificationPreferences;
  academic_policy: AcademicPolicy;
  calendar_template: CalendarTemplate;
};
type SettingFor<D extends GroupDefaultDomain> = Extract<
  GroupDefaultSetting,
  { domain: D }
>;
type VersionFor<D extends GroupDefaultDomain> = Extract<
  GroupDefaultVersion,
  { domain: D }
>;
type ChoiceFor<D extends GroupDefaultDomain> = Extract<
  BranchSettingChoice,
  { domain: D }
>;

export type EffectiveDomainSetting<D extends GroupDefaultDomain> = {
  domain: D;
  value: DomainValueMap[D] | null;
  source: "factory" | "branch_legacy" | "group" | "branch_override";
  mode: "legacy" | "inherit" | "override";
  groupId: Id<"schoolGroups"> | null;
  groupVersion: number;
  revision: number;
  allowBranchOverride: boolean;
};

export async function latestGroupDefault<D extends GroupDefaultDomain>(
  ctx: Context,
  groupId: Id<"schoolGroups">,
  domain: D,
): Promise<VersionFor<D> | null> {
  const row = await ctx.db
    .query("groupSettingVersions")
    .withIndex("by_group_and_domain_and_version", (q) =>
      q.eq("groupId", groupId).eq("domain", domain),
    )
    .order("desc")
    .first();
  if (row && row.domain !== domain)
    throw new ConvexError("Group setting domain mismatch");
  return row as VersionFor<D> | null;
}

export async function latestBranchChoice<D extends GroupDefaultDomain>(
  ctx: Context,
  groupId: Id<"schoolGroups">,
  schoolId: Id<"schools">,
  domain: D,
): Promise<ChoiceFor<D> | null> {
  const row = await ctx.db
    .query("branchSettingOverrides")
    .withIndex("by_group_and_school_and_domain_and_revision", (q) =>
      q.eq("groupId", groupId).eq("schoolId", schoolId).eq("domain", domain),
    )
    .order("desc")
    .first();
  if (row && row.domain !== domain)
    throw new ConvexError("Branch setting domain mismatch");
  return row as ChoiceFor<D> | null;
}

/** Caller establishes audience authority. Linking alone never opts a branch in. */
export async function resolveEffectiveGroupSetting<
  D extends GroupDefaultDomain,
>(
  ctx: Context,
  schoolId: Id<"schools">,
  domain: D,
  local: SettingFor<D> | null,
): Promise<EffectiveDomainSetting<D>> {
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  const group = link ? await ctx.db.get(link.groupId) : null;
  if (!link || group?.status !== "active") {
    return {
      domain,
      value: (local?.value ?? null) as DomainValueMap[D] | null,
      source: local ? "branch_legacy" : "factory",
      mode: "legacy",
      groupId: null,
      groupVersion: 0,
      revision: 0,
      allowBranchOverride: false,
    };
  }
  const [defaults, choice] = await Promise.all([
    latestGroupDefault(ctx, group._id, domain),
    latestBranchChoice(ctx, group._id, schoolId, domain),
  ]);
  if (!defaults) {
    return {
      domain,
      value: (local?.value ?? null) as DomainValueMap[D] | null,
      source: local ? "branch_legacy" : "factory",
      mode: choice?.mode ?? "legacy",
      groupId: group._id,
      groupVersion: 0,
      revision: choice?.revision ?? 0,
      allowBranchOverride: false,
    };
  }
  if (choice?.mode === "override" && defaults.allowBranchOverride) {
    return {
      domain,
      value: choice.value as DomainValueMap[D],
      source: "branch_override",
      mode: "override",
      groupId: group._id,
      groupVersion: defaults.version,
      revision: choice.revision,
      allowBranchOverride: true,
    };
  }
  if (choice?.mode === "inherit" || choice?.mode === "override") {
    return {
      domain,
      value: defaults.value as DomainValueMap[D],
      source: "group",
      mode: "inherit",
      groupId: group._id,
      groupVersion: defaults.version,
      revision: choice.revision,
      allowBranchOverride: defaults.allowBranchOverride,
    };
  }
  return {
    domain,
    value: (local?.value ?? null) as DomainValueMap[D] | null,
    source: local ? "branch_legacy" : "factory",
    mode: "legacy",
    groupId: group._id,
    groupVersion: defaults.version,
    revision: 0,
    allowBranchOverride: defaults.allowBranchOverride,
  };
}
