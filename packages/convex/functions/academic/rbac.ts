import { ConvexError, v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { resolveActiveMembership, type ActiveMembershipContext } from "./auth";
import { recordAuditEventHelper } from "./audit";
import { resolveEffectiveGroupSetting } from "./groupDefaultsResolver";

/**
 * Closed, typed canonical catalog of permissions across 8 domains (D-02 §3.3).
 */
export { CAPABILITY_CATALOG, SENSITIVE_CAPABILITIES, TEACHER_PLANNING_CAPABILITIES, normalizeCapability, type PermissionCapability } from "../../../shared/src/capability-contract";
import { CAPABILITY_CATALOG, normalizeCapability } from "../../../shared/src/capability-contract";

/**
 * Standard factory role template definitions (D-02 §3.2).
 */
export const FACTORY_ROLE_DEFINITIONS: Record<
  string,
  { name: string; description: string; capabilities: string[] }
> = {
  proprietor: {
    name: "Proprietor (School Owner)",
    description:
      "Ultimate institutional ownership, financial accounts, group governance, root delegation, audit oversight.",
    capabilities: [...CAPABILITY_CATALOG],
  },
  principal: {
    name: "Principal / Head of School",
    description:
      "Operational leadership, faculty supervision, academic policy execution, student discipline, admissions overview.",
    capabilities: [
      "academic.curriculum.manage",
      "academic.classes.manage",
      "academic.subjects.manage",
      "academic.timetables.manage",
      "academic.grading_bands.manage",
      "academic.assessments.enter",
      "academic.assessments.adjust",
      "academic.report_cards.preview",
      "enrollment.intakes.manage",
      "enrollment.applications.list",
      "enrollment.applications.view_basic",
      "enrollment.applications.view_sensitive",
      "enrollment.documents.review",
      "enrollment.decisions.record",
      "staff.list.view",
      "staff.onboard",
      "staff.profiles.edit",
      "staff.assignments.manage",
      "staff.manage",
      "settings.general.view",
      "settings.general.edit",
      "settings.branding.manage",
      "assets.library.view",
      "assets.upload",
      "assets.download.standard",
      "assets.trash.manage",
      "assets.metadata.edit",
      "assets.archive.manage",
      "assets.restore",
      "assets.holds.apply",
      "audit.branch.view",
      "audit.view",
    ],
  },
  academic_director: {
    name: "Academic Director",
    description:
      "Curriculum governance, timetable management, subject catalogs, grading bands, teacher allocations.",
    capabilities: [
      "academic.curriculum.manage",
      "academic.classes.manage",
      "academic.subjects.manage",
      "academic.timetables.manage",
      "academic.grading_bands.manage",
      "academic.assessments.enter",
      "academic.assessments.adjust",
      "academic.report_cards.preview",
      "staff.assignments.manage",
    ],
  },
  exam_officer: {
    name: "Examination Officer",
    description:
      "CA scoring audits, score overrides, grade locks, report card remarks, final report card publishing.",
    capabilities: [
      "academic.assessments.enter",
      "academic.assessments.adjust",
      "academic.report_cards.preview",
      "academic.report_cards.publish_final",
      "academic.grading_bands.manage",
    ],
  },
  bursar: {
    name: "Bursar / Finance Officer",
    description:
      "Student fee plans, invoicing, offline payment reconciliation, Paystack split monitoring, debt recovery.",
    capabilities: [
      "finance.fee_plans.manage",
      "finance.invoices.issue",
      "finance.payments.record_manual",
      "finance.reports.view",
      "finance.settlements.view",
      "export.financial",
    ],
  },
  registrar: {
    name: "Registrar / Admissions Officer",
    description:
      "Admissions intake configuration, application triage, guardian identity verification, sequential admission number issuance.",
    capabilities: [
      "enrollment.intakes.manage",
      "enrollment.applications.list",
      "enrollment.applications.view_basic",
      "enrollment.applications.view_sensitive",
      "enrollment.documents.review",
      "enrollment.decisions.record",
    ],
  },
  staff_administrator: {
    name: "Staff Administrator",
    description:
      "Staff directory onboarding, teacher timetable assignment, institutional email mailbox approval.",
    capabilities: [
      "staff.list.view",
      "staff.onboard",
      "staff.profiles.edit",
      "staff.assignments.manage",
      "settings.domains.request",
      "staff.manage",
    ],
  },
};

/**
 * Checks if a membership belongs to the School Group Proprietor.
 */
export async function isMembershipProprietor(
  ctx: QueryCtx | MutationCtx,
  membership: Doc<"branchMemberships">,
): Promise<boolean> {
  const groupLink = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", membership.schoolId))
    .first();

  if (groupLink) {
    const group = await ctx.db.get(groupLink.groupId);
    if (
      group?.status === "active" &&
      group.proprietorPersonId === membership.personId
    ) {
      return true;
    }
  }

  // Also check if assigned proprietor role template
  const roleAssignments = await ctx.db
    .query("membershipRoleAssignments")
    .withIndex("by_membership", (q) => q.eq("membershipId", membership._id))
    .take(101);
  if (roleAssignments.length > 100)
    throw new ConvexError("Permission configuration requires review");

  for (const ra of roleAssignments) {
    const template = await ctx.db.get(ra.roleTemplateId);
    if (template?.code === "proprietor") {
      await templateForSchool(ctx, template._id, membership.schoolId);
      return true;
    }
    // Preserve explicitly reviewed historical ownership, never create it from a title.
    if (!template && ra.roleTemplateKey === "proprietor") return true;
  }

  return false;
}

type Context = QueryCtx | MutationCtx;
type Candidate = {
  candidateRoleTemplateIds?: Id<"roleTemplates">[];
  candidateDirectGrants?: string[];
  candidateDirectRestrictions?: string[];
};

function canonicalCapabilities(values: string[]) {
  if (values.length > CAPABILITY_CATALOG.length * 2)
    throw new ConvexError("Too many capabilities");
  const catalog: ReadonlySet<string> = new Set(CAPABILITY_CATALOG);
  if (values.some((value) => !catalog.has(value)))
    throw new ConvexError("Unknown capability");
  return [...new Set(values.map(normalizeCapability))].sort();
}

async function templateForSchool(
  ctx: Context,
  id: Id<"roleTemplates">,
  schoolId: Id<"schools">,
) {
  const template = await ctx.db.get(id);
  if (!template) throw new ConvexError("Role template not found");
  const link =
    template.scope === "group"
      ? await ctx.db
          .query("schoolGroupBranches")
          .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
          .unique()
      : null;
  if (
    (template.scope === "branch" && template.schoolId !== schoolId) ||
    (template.scope === "group" && (!link || link.groupId !== template.groupId))
  )
    throw new ConvexError("Forbidden: template belongs to another scope");
  return template;
}

async function assertTemplatesAvailableForAssignment(
  ctx: Context,
  schoolId: Id<"schools">,
  templates: Doc<"roleTemplates">[],
) {
  const local = await ctx.db
    .query("roleTemplates")
    .withIndex("by_scope_and_school", (q) =>
      q.eq("scope", "branch").eq("schoolId", schoolId),
    )
    .take(101);
  if (local.length > 100)
    throw new ConvexError("Role template directory requires review");
  const effective = await resolveEffectiveGroupSetting(
    ctx,
    schoolId,
    "role_templates",
    {
      domain: "role_templates",
      value: { templateIds: local.map((template) => template._id) },
    },
  );
  const available = new Set(effective.value?.templateIds ?? []);
  if (
    templates.some(
      (template) => template.scope !== "global" && !available.has(template._id),
    )
  ) throw new ConvexError("Role template is not available under the branch setting");
}

async function permissionRows(
  ctx: Context,
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
    throw new ConvexError(
      "Permission configuration exceeds supported size; review required",
    );
  return { roles, grants, restrictions, ceiling };
}

/** Configuration, including a later-cleared configuration, terminates role-only compatibility. */
export async function isPermissionManaged(ctx: Context, context: ActiveMembershipContext) {
  if (context.isPlatformAdmin) return true;
  if (!context.membershipId) return false;
  const membership = await ctx.db.get(context.membershipId);
  const rows = await permissionRows(ctx, context.membershipId);
  return membership?.permissionsManagedAt !== undefined || Boolean(rows.roles.length || rows.grants.length || rows.restrictions.length || rows.ceiling);
}

/** Candidate and persisted evaluation share legacy fallback, scope, alias and restriction logic. */
export async function evaluateEffectiveCapabilities(
  ctx: Context,
  membershipId: Id<"branchMemberships">,
  candidate: Candidate = {},
): Promise<string[]> {
  const membership = await ctx.db.get(membershipId);
  if (!membership || membership.status !== "active") return [];
  const [person, school] = await Promise.all([
    ctx.db.get(membership.personId),
    ctx.db.get(membership.schoolId),
  ]);
  if (
    !person ||
    person.status !== "active" ||
    person.identityReconciliationState === "reconciliation_required" ||
    !school ||
    school.status === "suspended"
  )
    return [];
  if (await isMembershipProprietor(ctx, membership))
    return [...CAPABILITY_CATALOG];
  const rows = await permissionRows(ctx, membershipId);
  const effective = new Set<string>();
  const ids =
    candidate.candidateRoleTemplateIds ??
    rows.roles.map((r) => r.roleTemplateId);
  if (ids.length > 100) throw new ConvexError("Too many templates");
  for (const id of ids) {
    const template = await ctx.db.get(id);
    if (template) {
      await templateForSchool(ctx, id, membership.schoolId);
      for (const cap of canonicalCapabilities(template.capabilities))
        effective.add(cap);
    } else if (candidate.candidateRoleTemplateIds !== undefined)
      throw new ConvexError("Role template not found");
    else {
      const key = rows.roles.find(
        (r) => r.roleTemplateId === id,
      )?.roleTemplateKey;
      for (const cap of canonicalCapabilities(
        key ? (FACTORY_ROLE_DEFINITIONS[key]?.capabilities ?? []) : [],
      ))
        effective.add(cap);
    }
  }
  // Only untouched compatibility accounts retain the historical principal baseline.
  // A persisted management marker prevents clearing configuration from restoring it.
  if (ids.length === 0 && membership.legacyUserId &&
      membership.permissionsManagedAt === undefined && rows.roles.length === 0 &&
      rows.grants.length === 0 && rows.restrictions.length === 0 && !rows.ceiling &&
      Object.keys(candidate).length === 0) {
    const user = await ctx.db.get(membership.legacyUserId);
    if (
      user &&
      user.schoolId === membership.schoolId &&
      !user.isArchived &&
      (user.role === "admin" || user.isSchoolAdmin === true)
    ) {
      for (const cap of canonicalCapabilities(
        FACTORY_ROLE_DEFINITIONS.principal.capabilities,
      ))
        effective.add(cap);
    }
  }
  for (const cap of canonicalCapabilities(
    candidate.candidateDirectGrants ?? rows.grants.map((g) => g.capability),
  ))
    effective.add(cap);
  for (const cap of canonicalCapabilities(
    candidate.candidateDirectRestrictions ??
      rows.restrictions.map((r) => r.capability),
  ))
    effective.delete(cap);
  return [...effective].sort();
}

export async function getContextCapabilities(
  ctx: Context,
  context: ActiveMembershipContext,
): Promise<string[]> {
  // Platform governance is authorized by its own endpoints, never tenant RBAC.
  if (context.isPlatformAdmin) return [];
  if (context.membershipId)
    return evaluateEffectiveCapabilities(ctx, context.membershipId);
  const legacy = context.userId ? await ctx.db.get(context.userId) : null;
  if (legacy && (legacy.role === "admin" || legacy.isSchoolAdmin === true))
    return FACTORY_ROLE_DEFINITIONS.principal.capabilities;
  return [];
}

export async function requireCapability(
  ctx: Context,
  schoolId: Id<"schools">,
  capability: string,
) {
  const authContext = await resolveActiveMembership(ctx, schoolId);
  const effectiveCapabilities = await getContextCapabilities(ctx, authContext);
  if (
    !effectiveCapabilities.some(
      (c) => normalizeCapability(c) === normalizeCapability(capability),
    )
  )
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Forbidden: User does not hold required capability '${capability}'`,
    });
  return { ...authContext, effectiveCapabilities };
}

export const hasViewerCapability = query({
  args: { schoolId: v.id("schools"), capability: v.string() },
  handler: async (ctx, args) => {
    try {
      await requireCapability(ctx, args.schoolId, args.capability);
      return true;
    } catch {
      return false;
    }
  },
});

export const previewEffectiveCapabilities = query({
  args: {
    schoolId: v.id("schools"),
    membershipId: v.id("branchMemberships"),
    candidateRoleTemplateIds: v.optional(v.array(v.id("roleTemplates"))),
    candidateDirectGrants: v.optional(v.array(v.string())),
    candidateDirectRestrictions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const auth = await resolveActiveMembership(ctx, args.schoolId);
    if (auth.isPlatformAdmin || auth.membershipId !== args.membershipId)
      await requireCapability(ctx, args.schoolId, "staff.permissions.manage");
    const target = await ctx.db.get(args.membershipId);
    if (!target || target.schoolId !== args.schoolId)
      throw new ConvexError("Target membership does not exist in this branch");
    return evaluateEffectiveCapabilities(ctx, args.membershipId, args);
  },
});

async function managementAuthority(ctx: Context, schoolId: Id<"schools">) {
  const auth = await requireCapability(
    ctx,
    schoolId,
    "staff.permissions.manage",
  );
  const actor = auth.membershipId ? await ctx.db.get(auth.membershipId) : null;
  const owner = Boolean(actor && (await isMembershipProprietor(ctx, actor)));
  const ceiling = actor
    ? await ctx.db
        .query("delegationCeilings")
        .withIndex("by_membership", (q) => q.eq("membershipId", actor._id))
        .unique()
    : null;
  return {
    ...auth,
    owner,
    ceiling: ceiling
      ? canonicalCapabilities(ceiling.allowedCapabilities)
      : null,
  };
}

async function editableTarget(
  ctx: Context,
  schoolId: Id<"schools">,
  id: Id<"branchMemberships">,
) {
  const auth = await managementAuthority(ctx, schoolId);
  const target = await ctx.db.get(id);
  if (!target || target.schoolId !== schoolId || target.status !== "active")
    throw new ConvexError("Target membership not found in this branch");
  if (auth.membershipId === id || auth.personId === target.personId)
    throw new ConvexError(
      "Anti-self-edit violation: You cannot edit your own permissions",
    );
  const person = await ctx.db.get(target.personId);
  if (
    !person ||
    person.status !== "active" ||
    person.identityReconciliationState === "reconciliation_required"
  )
    throw new ConvexError("Target identity requires review");
  const platform = person.authTokenIdentifier
    ? await ctx.db
        .query("platformAdmins")
        .withIndex("by_auth_token_identifier", (q) =>
          q.eq("authTokenIdentifier", person.authTokenIdentifier),
        )
        .take(2)
    : [];
  if (await isMembershipProprietor(ctx, target))
    throw new ConvexError(
      "Forbidden: You cannot alter direct grants of the School Proprietor; ownership recovery requires separate evidence",
    );
  if (platform.length)
    throw new ConvexError("Forbidden: Platform identity is protected");
  const caps = canonicalCapabilities(
    await evaluateEffectiveCapabilities(ctx, id),
  );
  if (!auth.owner) {
    if (!auth.ceiling)
      throw new ConvexError(
        "Delegation ceiling violation: no explicit ceiling assigned",
      );
    if (
      caps.includes("staff.permissions.manage") ||
      caps.some((c) => !auth.ceiling?.includes(c))
    )
      throw new ConvexError(
        "Forbidden: Target holds superior or peer authority",
      );
  }
  return { auth, target };
}

export async function assertPermissionManagementTargetForLegacyUser(
  ctx: Context,
  schoolId: Id<"schools">,
  userId: Id<"users">,
) {
  const actorContext = await resolveActiveMembership(ctx, schoolId);
  if (!(await isPermissionManaged(ctx, actorContext))) return;

  const memberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_legacy_user", (q) => q.eq("legacyUserId", userId))
    .take(2);
  if (memberships.length > 1)
    throw new ConvexError("Target identity requires review");
  const membership = memberships[0];
  if (membership) {
    if (membership.schoolId !== schoolId)
      throw new ConvexError("Target membership not found in this branch");
    await editableTarget(ctx, schoolId, membership._id);
    return;
  }

  // An unmigrated admin retains historical role-only authority outside the
  // managed capability model. Only the proprietor may alter that peer authority.
  const auth = await managementAuthority(ctx, schoolId);
  if (!auth.owner)
    throw new ConvexError(
      "Forbidden: Unmigrated administrator authority requires proprietor review",
    );
}

function assertDelegable(
  auth: Awaited<ReturnType<typeof managementAuthority>>,
  capabilities: string[],
) {
  const caps = canonicalCapabilities(capabilities);
  if (auth.owner) return;
  if (
    !auth.ceiling ||
    caps.some(
      (c) => c === "staff.permissions.manage" || !auth.ceiling?.includes(c),
    )
  )
    throw new ConvexError(
      "Delegation ceiling violation: capability exceeds proprietor-defined authority",
    );
}

async function auditChange(
  ctx: MutationCtx,
  auth: Awaited<ReturnType<typeof managementAuthority>>,
  targetId: string,
  action: string,
  reason?: string,
  changes?: { beforeSummary?: string; afterSummary: string },
) {
  await recordAuditEventHelper(ctx, {
    schoolId: auth.schoolId,
    actorKind: "user",
    actorPersonId: auth.personId,
    actorMembershipId: auth.membershipId,
    actorEmailSnapshot:
      (await ctx.auth.getUserIdentity())?.email ?? "authenticated operator",
    module: "rbac",
    action,
    beforeSummary: changes?.beforeSummary,
    afterSummary: changes?.afterSummary,
    targetType:
      action === "role_template_version_created"
        ? "roleTemplate"
        : "branchMembership",
    targetId,
    outcome: "success",
    safeSummary: `${action}: target ${targetId}${reason ? `; reason: ${reason.slice(0, 240)}` : ""}`,
    alertTier: "tier1_critical",
    retentionClass: "permanent_statutory",
  });
}

export const getPermissionWorkspace = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const auth = await managementAuthority(ctx, args.schoolId);
    const members = await ctx.db
      .query("branchMemberships")
      .withIndex("by_school_and_status", (q) =>
        q.eq("schoolId", args.schoolId).eq("status", "active"),
      )
      .take(101);
    const global = await ctx.db
      .query("roleTemplates")
      .withIndex("by_scope_and_school", (q) =>
        q.eq("scope", "global").eq("schoolId", undefined),
      )
      .take(101);
    const branch = await ctx.db
      .query("roleTemplates")
      .withIndex("by_scope_and_school", (q) =>
        q.eq("scope", "branch").eq("schoolId", args.schoolId),
      )
      .take(101);
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();
    const effectiveRoleTemplates = await resolveEffectiveGroupSetting(
      ctx,
      args.schoolId,
      "role_templates",
      { domain: "role_templates", value: { templateIds: branch.map((row) => row._id) } },
    );
    const effectiveTemplateRows = await Promise.all(
      (effectiveRoleTemplates.value?.templateIds ?? []).map((id) => ctx.db.get(id)),
    );
    const availableTemplates = effectiveTemplateRows.filter(
      (row): row is Doc<"roleTemplates"> => Boolean(row),
    );
    if ([members, global, branch].some((rows) => rows.length > 100))
      throw new ConvexError(
        "Directory exceeds supported size; bounded support review required",
      );
    return {
      catalog: canonicalCapabilities([...CAPABILITY_CATALOG]),
      factoryTemplates: Object.entries(FACTORY_ROLE_DEFINITIONS).map(
        ([code, value]) => ({
          code,
          ...value,
          capabilities: canonicalCapabilities(value.capabilities),
        }),
      ),
      templates: [...global, ...availableTemplates],
      templateGovernance: {
        source: effectiveRoleTemplates.source,
        mode: effectiveRoleTemplates.mode,
        groupVersion: effectiveRoleTemplates.groupVersion,
        revision: effectiveRoleTemplates.revision,
      },
      canConfigureTemplates: auth.owner,
      ceiling: auth.ceiling,
      members: await Promise.all(
        members.map(async (m) => ({
          membershipId: m._id,
          personId: m.personId,
          name: (await ctx.db.get(m.personId))?.name ?? "Unavailable person",
          displayTitle: m.displayTitle ?? "",
          isSelf: m._id === auth.membershipId,
        })),
      ),
    };
  },
});

export const getMemberPermissionConfiguration = query({
  args: { schoolId: v.id("schools"), membershipId: v.id("branchMemberships") },
  handler: async (ctx, args) => {
    await managementAuthority(ctx, args.schoolId);
    const member = await ctx.db.get(args.membershipId);
    if (!member || member.schoolId !== args.schoolId)
      throw new ConvexError("Target membership not found in this branch");
    const rows = await permissionRows(ctx, member._id);
    let editable = true;
    try {
      await editableTarget(ctx, args.schoolId, member._id);
    } catch {
      editable = false;
    }
    return {
      revision: member.updatedAt,
      displayTitle: member.displayTitle ?? "",
      roleTemplateIds: rows.roles.map((r) => r.roleTemplateId),
      grants: canonicalCapabilities(rows.grants.map((g) => g.capability)),
      restrictions: canonicalCapabilities(
        rows.restrictions.map((r) => r.capability),
      ),
      ceiling: rows.ceiling
        ? canonicalCapabilities(rows.ceiling.allowedCapabilities)
        : [],
      effective: await evaluateEffectiveCapabilities(ctx, member._id),
      editable,
      legacyBaseline: Boolean(member.legacyUserId) && member.permissionsManagedAt === undefined &&
        rows.roles.length === 0 && rows.grants.length === 0 && rows.restrictions.length === 0 && !rows.ceiling,
    };
  },
});

export const saveMemberPermissions = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    expectedRevision: v.number(),
    displayTitle: v.string(),
    roleTemplateIds: v.array(v.id("roleTemplates")),
    grants: v.array(v.string()),
    restrictions: v.array(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { auth, target } = await editableTarget(
      ctx,
      args.schoolId,
      args.targetMembershipId,
    );
    if (target.updatedAt !== args.expectedRevision)
      throw new ConvexError(
        "CONFLICT: Access changed since preview. Reload and review again.",
      );
    if (
      args.reason.trim().length < 8 ||
      args.reason.length > 240 ||
      args.displayTitle.length > 100 ||
      args.roleTemplateIds.length > 30
    )
      throw new ConvexError(
        "Provide a concise reason (8–240 characters), title and at most 30 templates",
      );
    const grants = canonicalCapabilities(args.grants),
      restrictions = canonicalCapabilities(args.restrictions);
    if (grants.some((c) => restrictions.includes(c)))
      throw new ConvexError(
        "A capability cannot be both granted and restricted",
      );
    const templates = await Promise.all(
      [...new Set(args.roleTemplateIds)].map((id) =>
        templateForSchool(ctx, id, args.schoolId),
      ),
    );
    await assertTemplatesAvailableForAssignment(ctx, args.schoolId, templates);
    if (templates.some((t) => t.code === "proprietor"))
      throw new ConvexError(
        "Ownership assignment requires separate reviewed recovery",
      );
    assertDelegable(auth, [
      ...grants,
      ...restrictions,
      ...templates.flatMap((t) => t.capabilities),
    ]);
    const previous = await permissionRows(ctx, target._id);
    // Removal can restore restricted rights or the legacy baseline; evaluate the full resulting set too.
    assertDelegable(auth, [
      ...previous.grants.map((g) => g.capability),
      ...previous.restrictions.map((r) => r.capability),
      ...(await evaluateEffectiveCapabilities(ctx, target._id, {
        candidateRoleTemplateIds: args.roleTemplateIds,
        candidateDirectGrants: grants,
        candidateDirectRestrictions: restrictions,
      })),
    ]);
    for (const row of [
      ...previous.roles,
      ...previous.grants,
      ...previous.restrictions,
    ])
      await ctx.db.delete(row._id);
    const now = Math.max(Date.now(), target.updatedAt + 1);
    for (const template of templates)
      await ctx.db.insert("membershipRoleAssignments", {
        membershipId: target._id,
        roleTemplateId: template._id,
        roleTemplateKey: template.code,
        assignedBy: auth.personId,
        assignedAt: now,
      });
    for (const capability of grants)
      await ctx.db.insert("membershipDirectGrants", {
        membershipId: target._id,
        capability,
        grantedBy: auth.personId,
        grantedAt: now,
        reason: args.reason.trim(),
      });
    for (const capability of restrictions)
      await ctx.db.insert("membershipDirectRestrictions", {
        membershipId: target._id,
        capability,
        restrictedBy: auth.personId,
        restrictedAt: now,
        reason: args.reason.trim(),
      });
    await ctx.db.patch(target._id, {
      displayTitle: args.displayTitle.trim(),
      permissionsManagedAt: target.permissionsManagedAt ?? now,
      updatedAt: now,
    });
    await auditChange(
      ctx,
      auth,
      target._id,
      "permissions_configuration_saved",
      args.reason.trim(),
      {
        beforeSummary: JSON.stringify({
          templates: previous.roles.map((r) => r.roleTemplateId),
          grants: previous.grants.map((g) => g.capability),
          restrictions: previous.restrictions.map((r) => r.capability),
        }),
        afterSummary: JSON.stringify({
          templates: args.roleTemplateIds,
          grants,
          restrictions,
          titleChanged: target.displayTitle !== args.displayTitle.trim(),
        }),
      },
    );
    return { success: true };
  },
});

/** Template revisions are new branch-scoped records, never an implicit bulk access change. */
export const createRoleTemplateVersion = mutation({
  args: {
    schoolId: v.id("schools"),
    name: v.string(),
    capabilities: v.array(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await managementAuthority(ctx, args.schoolId);
    if (!auth.owner)
      throw new ConvexError(
        "Forbidden: Proprietor authority required to configure templates",
      );
    if (
      !args.name.trim() ||
      args.name.length > 100 ||
      args.reason.trim().length < 8 ||
      args.reason.length > 240
    )
      throw new ConvexError("Provide a template name and review reason");
    const capabilities = canonicalCapabilities(args.capabilities);
    const now = Date.now();
    const templateId = await ctx.db.insert("roleTemplates", {
      name: args.name.trim(),
      code: `custom_${now}`,
      scope: "branch",
      schoolId: args.schoolId,
      capabilities,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    await auditChange(
      ctx,
      auth,
      templateId,
      "role_template_version_created",
      args.reason.trim(),
      { afterSummary: JSON.stringify({ templateId, capabilities }) },
    );
    return { templateId };
  },
});

// Existing public single-change contracts use the same authority checks as the editor.
export const assignRoleToMembership = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    roleTemplateId: v.id("roleTemplates"),
  },
  handler: async (ctx, args) => {
    const { auth, target } = await editableTarget(
      ctx,
      args.schoolId,
      args.targetMembershipId,
    );
    const template = await templateForSchool(
      ctx,
      args.roleTemplateId,
      args.schoolId,
    );
    await assertTemplatesAvailableForAssignment(ctx, args.schoolId, [template]);
    if (template.code === "proprietor")
      throw new ConvexError(
        "Ownership assignment requires separate reviewed recovery",
      );
    assertDelegable(auth, template.capabilities);
    const existing = await ctx.db
      .query("membershipRoleAssignments")
      .withIndex("by_membership_and_role", (q) =>
        q.eq("membershipId", target._id).eq("roleTemplateId", template._id),
      )
      .unique();
    if (existing) return { success: true };
    await ctx.db.insert("membershipRoleAssignments", {
      membershipId: target._id,
      roleTemplateId: template._id,
      roleTemplateKey: template.code,
      assignedBy: auth.personId,
      assignedAt: Date.now(),
    });
    await ctx.db.patch(target._id, {
      permissionsManagedAt: target.permissionsManagedAt ?? Date.now(),
      updatedAt: Math.max(Date.now(), target.updatedAt + 1),
    });
    await auditChange(ctx, auth, target._id, "role_assigned", undefined, {
      afterSummary: `Assigned template ${template._id} (${template.code})`,
    });
    return { success: true };
  },
});

const directArgs = {
  schoolId: v.id("schools"),
  targetMembershipId: v.id("branchMemberships"),
  capability: v.string(),
  reason: v.optional(v.string()),
};
async function setDirect(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    targetMembershipId: Id<"branchMemberships">;
    capability: string;
    reason?: string;
  },
  restrict: boolean,
) {
  const { auth, target } = await editableTarget(
    ctx,
    args.schoolId,
    args.targetMembershipId,
  );
  const [capability] = canonicalCapabilities([args.capability]);
  assertDelegable(auth, [capability]);
  const rows = await permissionRows(ctx, target._id);
  for (const row of [...rows.grants, ...rows.restrictions])
    if (normalizeCapability(row.capability) === capability)
      await ctx.db.delete(row._id);
  if (restrict)
    await ctx.db.insert("membershipDirectRestrictions", {
      membershipId: target._id,
      capability,
      restrictedBy: auth.personId,
      restrictedAt: Date.now(),
      reason: args.reason?.slice(0, 240),
    });
  else
    await ctx.db.insert("membershipDirectGrants", {
      membershipId: target._id,
      capability,
      grantedBy: auth.personId,
      grantedAt: Date.now(),
      reason: args.reason?.slice(0, 240),
    });
  await ctx.db.patch(target._id, {
    permissionsManagedAt: target.permissionsManagedAt ?? Date.now(),
    updatedAt: Math.max(Date.now(), target.updatedAt + 1),
  });
  await auditChange(
    ctx,
    auth,
    target._id,
    restrict ? "direct_restriction_configured" : "direct_grant_configured",
    args.reason,
    { afterSummary: `${capability}: ${restrict ? "restricted" : "granted"}` },
  );
  return { success: true };
}
export const grantDirectCapability = mutation({
  args: directArgs,
  handler: (ctx, args) => setDirect(ctx, args, false),
});
export const restrictDirectCapability = mutation({
  args: directArgs,
  handler: (ctx, args) => setDirect(ctx, args, true),
});

export const setDelegationCeiling = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    allowedCapabilities: v.array(v.string()),
    expectedRevision: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { auth, target } = await editableTarget(
      ctx,
      args.schoolId,
      args.targetMembershipId,
    );
    if (
      args.expectedRevision !== undefined &&
      args.expectedRevision !== target.updatedAt
    )
      throw new ConvexError("CONFLICT: Access changed since preview");
    if (
      args.reason !== undefined &&
      (args.reason.trim().length < 8 || args.reason.length > 240)
    )
      throw new ConvexError("Provide a concise review reason");
    if (!auth.owner)
      throw new ConvexError(
        "Forbidden: Only the School Proprietor can configure delegation ceilings",
      );
    const allowedCapabilities = canonicalCapabilities(args.allowedCapabilities);
    // Manager authority itself is never delegable, even when explicitly requested in a ceiling.
    if (allowedCapabilities.includes("staff.permissions.manage"))
      throw new ConvexError(
        "Permission-manager authority cannot be delegated through a ceiling",
      );
    const existing = await ctx.db
      .query("delegationCeilings")
      .withIndex("by_membership", (q) => q.eq("membershipId", target._id))
      .unique();
    const value = {
      allowedCapabilities,
      updatedBy: auth.personId,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else
      await ctx.db.insert("delegationCeilings", {
        membershipId: target._id,
        ...value,
      });
    await ctx.db.patch(target._id, {
      permissionsManagedAt: target.permissionsManagedAt ?? Date.now(),
      updatedAt: Math.max(Date.now(), target.updatedAt + 1),
    });
    await auditChange(
      ctx,
      auth,
      target._id,
      "delegation_ceiling_updated",
      args.reason,
      {
        beforeSummary: JSON.stringify(existing?.allowedCapabilities ?? []),
        afterSummary: JSON.stringify(allowedCapabilities),
      },
    );
    return { success: true };
  },
});
