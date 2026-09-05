import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { resolveActiveMembership } from "./auth";
import { recordAuditEventHelper } from "./audit";

/**
 * Closed, typed canonical catalog of permissions across 8 domains (D-02 §3.3).
 */
export const CAPABILITY_CATALOG = [
  // Academic Domain
  "academic.curriculum.manage",
  "academic.classes.manage",
  "academic.subjects.manage",
  "academic.timetables.manage",
  "academic.grading_bands.manage",
  "academic.assessments.enter",
  "academic.assessments.adjust",
  "academic.report_cards.preview",
  "academic.report_cards.publish_final",
  // Enrollment Domain
  "enrollment.intakes.manage",
  "enrollment.applications.list",
  "enrollment.applications.view_basic",
  "enrollment.applications.view_sensitive",
  "enrollment.documents.review",
  "enrollment.decisions.record",
  "enrollment.admissions.override_number",
  // Finance Domain
  "finance.fee_plans.manage",
  "finance.invoices.issue",
  "finance.payments.record_manual",
  "finance.reports.view",
  "finance.settlements.view",
  "finance.bank_details.manage",
  // Staff & User Domain
  "staff.list.view",
  "staff.onboard",
  "staff.profiles.edit",
  "staff.assignments.manage",
  "staff.permissions.manage",
  "staff.account.suspend",
  "staff.password.reset",
  // Settings Domain
  "settings.general.view",
  "settings.general.edit",
  "settings.branding.manage",
  "settings.domains.request",
  "settings.domains.manage",
  // Assets Domain
  "assets.library.view",
  "assets.upload",
  "assets.download.standard",
  "assets.download.sensitive",
  "assets.trash.manage",
  "assets.permanent_delete",
  "assets.group_share.manage",
  // Audit Domain
  "audit.branch.view",
  "audit.group.view",
  "audit.export.csv",
  "audit.export.pdf",
  // System Domain
  "system.migration.execute",
  "system.bulk_purge",
  "system.tenant.recover",
  // Canonical Aliases & Ergonomic Shortcuts
  "audit.view",
  "staff.manage",
  "permissions.manage",
  "bank.manage",
  "finance.bank.manage",
  "academic.grading.manage",
  "export.financial",
] as const;

export type PermissionCapability = (typeof CAPABILITY_CATALOG)[number];

/**
 * Eleven sensitive capabilities with profound security, financial, or legal risk (D-02 §3.3).
 */
export const SENSITIVE_CAPABILITIES: ReadonlySet<string> = new Set([
  "staff.permissions.manage",
  "permissions.manage",
  "finance.bank_details.manage",
  "bank.manage",
  "finance.bank.manage",
  "academic.report_cards.publish_final",
  "enrollment.admissions.override_number",
  "audit.group.view",
  "audit.export.csv",
  "audit.export.pdf",
  "export.financial",
  "staff.password.reset",
  "staff.account.suspend",
  "assets.permanent_delete",
  "settings.domains.manage",
  "system.migration.execute",
  "system.bulk_purge",
  "system.tenant.recover",
]);

/**
 * Normalizes alias capabilities to their canonical D-02 names.
 */
export function normalizeCapability(cap: string): string {
  switch (cap) {
    case "audit.view":
      return "audit.branch.view";
    case "permissions.manage":
      return "staff.permissions.manage";
    case "bank.manage":
    case "finance.bank.manage":
      return "finance.bank_details.manage";
    case "academic.grading.manage":
      return "academic.grading_bands.manage";
    case "staff.manage":
      return "staff.onboard";
    case "export.financial":
      return "finance.reports.view";
    default:
      return cap;
  }
}

/**
 * Standard factory role template definitions (D-02 §3.2).
 */
export const FACTORY_ROLE_DEFINITIONS: Record<string, { name: string; description: string; capabilities: string[] }> = {
  proprietor: {
    name: "Proprietor (School Owner)",
    description: "Ultimate institutional ownership, financial accounts, group governance, root delegation, audit oversight.",
    capabilities: [...CAPABILITY_CATALOG],
  },
  principal: {
    name: "Principal / Head of School",
    description: "Operational leadership, faculty supervision, academic policy execution, student discipline, admissions overview.",
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
      "audit.branch.view",
      "audit.view",
    ],
  },
  academic_director: {
    name: "Academic Director",
    description: "Curriculum governance, timetable management, subject catalogs, grading bands, teacher allocations.",
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
    description: "CA scoring audits, score overrides, grade locks, report card remarks, final report card publishing.",
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
    description: "Student fee plans, invoicing, offline payment reconciliation, Paystack split monitoring, debt recovery.",
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
    description: "Admissions intake configuration, application triage, guardian identity verification, sequential admission number issuance.",
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
    description: "Staff directory onboarding, teacher timetable assignment, institutional email mailbox approval.",
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
  membership: Doc<"branchMemberships">
): Promise<boolean> {
  const groupLink = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", membership.schoolId))
    .first();

  if (groupLink) {
    const group = await ctx.db.get(groupLink.groupId);
    if (group && group.proprietorPersonId === membership.personId) {
      return true;
    }
  }

  // Also check if assigned proprietor role template
  const roleAssignments = await ctx.db
    .query("membershipRoleAssignments")
    .withIndex("by_membership", (q) => q.eq("membershipId", membership._id))
    .collect();

  for (const ra of roleAssignments) {
    if (ra.roleTemplateKey === "proprietor") return true;
    const template = await ctx.db.get(ra.roleTemplateId);
    if (template?.code === "proprietor") return true;
  }

  return false;
}

/**
 * Evaluates effective capabilities for a membership using the formula:
 * EffectivePermissions = ( ⋃ TemplateCapabilities ) ∪ DirectGrants ∖ DirectRestrictions
 * 
 * Returns string[] of effective capabilities.
 */
export async function evaluateEffectiveCapabilities(
  ctx: QueryCtx | MutationCtx,
  membershipId: Id<"branchMemberships">
): Promise<string[]> {
  const membership = await ctx.db.get(membershipId);
  if (!membership) {
    return [];
  }

  // 1. Proprietor bypass: School group owner holds full capability set
  const isProprietor = await isMembershipProprietor(ctx, membership);
  if (isProprietor) {
    return [...CAPABILITY_CATALOG];
  }

  const effective = new Set<string>();

  // 2. Fetch assigned role templates
  const roleAssignments = await ctx.db
    .query("membershipRoleAssignments")
    .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
    .collect();

  for (const ra of roleAssignments) {
    const template = await ctx.db.get(ra.roleTemplateId);
    if (template) {
      for (const cap of template.capabilities) {
        effective.add(cap);
      }
    } else if (ra.roleTemplateKey && FACTORY_ROLE_DEFINITIONS[ra.roleTemplateKey]) {
      for (const cap of FACTORY_ROLE_DEFINITIONS[ra.roleTemplateKey].capabilities) {
        effective.add(cap);
      }
    }
  }

  // Lockout prevention / Migration fallback (MX-03):
  // If no role assignments exist yet, check if legacy user had admin privileges
  if (roleAssignments.length === 0 && membership.legacyUserId) {
    const user = await ctx.db.get(membership.legacyUserId);
    if (user && (user.role === "admin" || user.isSchoolAdmin === true)) {
      for (const cap of FACTORY_ROLE_DEFINITIONS.principal.capabilities) {
        effective.add(cap);
      }
    }
  }

  // 3. Apply Direct Grants (+)
  const directGrants = await ctx.db
    .query("membershipDirectGrants")
    .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
    .collect();

  for (const grant of directGrants) {
    effective.add(grant.capability);
  }

  // 4. Apply Direct Restrictions (-)
  const directRestrictions = await ctx.db
    .query("membershipDirectRestrictions")
    .withIndex("by_membership", (q) => q.eq("membershipId", membershipId))
    .collect();

  for (const restriction of directRestrictions) {
    effective.delete(restriction.capability);
  }

  return Array.from(effective).sort();
}

/**
 * Backend Authoritative Capability Enforcement Helper.
 * Resolves active membership in school branch and verifies caller holds required capability.
 * Throws clean typed ConvexError 403 Forbidden on violation.
 */
export async function requireCapability(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  capability: string
) {
  const authContext = await resolveActiveMembership(ctx, schoolId);

  // Platform Super Admin Bypass for emergency support
  if (authContext.isPlatformAdmin) {
    return {
      ...authContext,
      effectiveCapabilities: [...CAPABILITY_CATALOG],
    };
  }

  if (!authContext.membershipId) {
    // If during bridge phase user is legacy admin, check baseline admin capabilities
    if (authContext.role === "admin") {
      const baseline = FACTORY_ROLE_DEFINITIONS.principal.capabilities;
      const normalized = normalizeCapability(capability);
      if (baseline.includes(capability) || baseline.includes(normalized)) {
        return {
          ...authContext,
          effectiveCapabilities: baseline,
        };
      }
    }
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Forbidden: User does not hold required capability '${capability}'`,
    });
  }

  const effectiveCapabilities = await evaluateEffectiveCapabilities(
    ctx,
    authContext.membershipId
  );

  const normalized = normalizeCapability(capability);
  const hasCapability =
    effectiveCapabilities.includes(capability) ||
    effectiveCapabilities.includes(normalized);

  if (!hasCapability) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Forbidden: User does not hold required capability '${capability}'`,
    });
  }

  return {
    ...authContext,
    effectiveCapabilities,
  };
}

/**
 * Public Query to check whether the active viewer has a capability in the target school.
 * Non-throwing query for ergonomic UI conditional rendering.
 */
export const hasViewerCapability = query({
  args: {
    schoolId: v.id("schools"),
    capability: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    try {
      await requireCapability(ctx, args.schoolId, args.capability);
      return true;
    } catch {
      return false;
    }
  },
});

/**
 * Query to inspect effective capabilities for a membership.
 * If candidate parameters are passed, returns an in-memory simulation without mutating the DB.
 */
export const previewEffectiveCapabilities = query({
  args: {
    schoolId: v.id("schools"),
    membershipId: v.id("branchMemberships"),
    candidateRoleTemplateIds: v.optional(v.array(v.id("roleTemplates"))),
    candidateDirectGrants: v.optional(v.array(v.string())),
    candidateDirectRestrictions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<string[]> => {
    const authContext = await resolveActiveMembership(ctx, args.schoolId);
    if (!authContext.isPlatformAdmin && authContext.membershipId !== args.membershipId) {
      await requireCapability(ctx, args.schoolId, "staff.list.view");
    }

    const targetMembership = await ctx.db.get(args.membershipId);
    if (!targetMembership || targetMembership.schoolId !== args.schoolId) {
      throw new ConvexError("Target membership does not exist in this branch");
    }

    const isProprietor = await isMembershipProprietor(ctx, targetMembership);
    if (isProprietor) {
      return [...CAPABILITY_CATALOG];
    }

    const effective = new Set<string>();

    // 1. Role Templates: Use candidate if provided, otherwise DB
    if (args.candidateRoleTemplateIds !== undefined) {
      for (const tId of args.candidateRoleTemplateIds) {
        const template = await ctx.db.get(tId);
        if (template) {
          for (const cap of template.capabilities) {
            effective.add(cap);
          }
        }
      }
    } else {
      const roleAssignments = await ctx.db
        .query("membershipRoleAssignments")
        .withIndex("by_membership", (q) => q.eq("membershipId", args.membershipId))
        .collect();

      for (const ra of roleAssignments) {
        const template = await ctx.db.get(ra.roleTemplateId);
        if (template) {
          for (const cap of template.capabilities) {
            effective.add(cap);
          }
        }
      }
    }

    // 2. Direct Grants: Use candidate if provided, otherwise DB
    if (args.candidateDirectGrants !== undefined) {
      for (const cap of args.candidateDirectGrants) {
        effective.add(cap);
      }
    } else {
      const grants = await ctx.db
        .query("membershipDirectGrants")
        .withIndex("by_membership", (q) => q.eq("membershipId", args.membershipId))
        .collect();

      for (const g of grants) {
        effective.add(g.capability);
      }
    }

    // 3. Direct Restrictions: Use candidate if provided, otherwise DB
    if (args.candidateDirectRestrictions !== undefined) {
      for (const cap of args.candidateDirectRestrictions) {
        effective.delete(cap);
      }
    } else {
      const restrictions = await ctx.db
        .query("membershipDirectRestrictions")
        .withIndex("by_membership", (q) => q.eq("membershipId", args.membershipId))
        .collect();

      for (const r of restrictions) {
        effective.delete(r.capability);
      }
    }

    return Array.from(effective).sort();
  },
});

/**
 * Assigns a role template to a branch membership.
 * Enforces:
 * 1. staff.permissions.manage capability
 * 2. Anti-self-edit: Manager cannot assign permissions to their own membership
 * 3. No superior edit: Cannot modify proprietor or superior authorities
 * 4. Delegation ceiling: Manager can only assign templates whose capabilities fall entirely within their ceiling
 */
export const assignRoleToMembership = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    roleTemplateId: v.id("roleTemplates"),
  },
  handler: async (ctx, args) => {
    const authContext = await requireCapability(ctx, args.schoolId, "staff.permissions.manage");

    // 1. Anti-self-edit check
    if (authContext.membershipId && authContext.membershipId === args.targetMembershipId) {
      throw new ConvexError({
        code: "ANTI_SELF_EDIT_VIOLATION",
        message: "Anti-self-edit violation: You cannot assign roles to your own membership.",
      });
    }

    const targetMembership = await ctx.db.get(args.targetMembershipId);
    if (!targetMembership || targetMembership.schoolId !== args.schoolId) {
      throw new ConvexError("Target membership not found in this branch");
    }

    const template = await ctx.db.get(args.roleTemplateId);
    if (!template) {
      throw new ConvexError("Role template not found");
    }

    // 2. Superior edit check
    const isTargetProprietor = await isMembershipProprietor(ctx, targetMembership);
    if (isTargetProprietor && !authContext.isPlatformAdmin) {
      throw new ConvexError({
        code: "SUPERIOR_EDIT_DENIED",
        message: "Forbidden: You cannot alter role assignments of the School Proprietor.",
      });
    }

    // 3. Delegation ceiling check (if caller is not proprietor or platform admin)
    const actorMembership = authContext.membershipId
      ? await ctx.db.get(authContext.membershipId)
      : null;
    const isActorProprietor = actorMembership
      ? await isMembershipProprietor(ctx, actorMembership)
      : false;

    if (!isActorProprietor && !authContext.isPlatformAdmin && authContext.membershipId) {
      const ceiling = await ctx.db
        .query("delegationCeilings")
        .withIndex("by_membership", (q) => q.eq("membershipId", authContext.membershipId!))
        .first();

      if (!ceiling) {
        throw new ConvexError({
          code: "DELEGATION_CEILING_MISSING",
          message: "Delegation ceiling violation: You have no active delegation ceiling assigned by the Proprietor.",
        });
      }

      const allowedSet = new Set(ceiling.allowedCapabilities);
      for (const cap of template.capabilities) {
        if (!allowedSet.has(cap) && !allowedSet.has(normalizeCapability(cap))) {
          throw new ConvexError({
            code: "DELEGATION_CEILING_EXCEEDED",
            message: `Delegation ceiling violation: Role contains capability '${cap}' which exceeds your delegation ceiling.`,
          });
        }
      }
    }

    // 4. Record assignment
    const existingAssignment = await ctx.db
      .query("membershipRoleAssignments")
      .withIndex("by_membership_and_role", (q) =>
        q.eq("membershipId", args.targetMembershipId).eq("roleTemplateId", args.roleTemplateId)
      )
      .first();

    const now = Date.now();
    if (!existingAssignment) {
      await ctx.db.insert("membershipRoleAssignments", {
        membershipId: args.targetMembershipId,
        roleTemplateId: args.roleTemplateId,
        roleTemplateKey: template.code,
        assignedBy: authContext.personId,
        assignedAt: now,
      });
    }

    // 5. Emit immutable audit log with Tier 1 critical alert
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.personId
        ? (await ctx.db.get(authContext.personId))?.email ?? "unknown"
        : "system",
      module: "rbac",
      action: "role_assigned",
      targetType: "branchMembership",
      targetId: args.targetMembershipId,
      outcome: "success",
      safeSummary: `Assigned role template '${template.name}' (${template.code}) to membership ${args.targetMembershipId}`,
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });

    return { success: true };
  },
});

/**
 * Grants a direct capability override to a branch membership.
 * Enforces anti-self-edit, no superior edit, and manager delegation ceiling.
 */
export const grantDirectCapability = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    capability: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requireCapability(ctx, args.schoolId, "staff.permissions.manage");

    // 1. Anti-self-edit
    if (authContext.membershipId && authContext.membershipId === args.targetMembershipId) {
      throw new ConvexError({
        code: "ANTI_SELF_EDIT_VIOLATION",
        message: "Anti-self-edit violation: You cannot grant capabilities to your own membership.",
      });
    }

    const targetMembership = await ctx.db.get(args.targetMembershipId);
    if (!targetMembership || targetMembership.schoolId !== args.schoolId) {
      throw new ConvexError("Target membership not found in this branch");
    }

    // 2. Superior edit check
    const isTargetProprietor = await isMembershipProprietor(ctx, targetMembership);
    if (isTargetProprietor && !authContext.isPlatformAdmin) {
      throw new ConvexError({
        code: "SUPERIOR_EDIT_DENIED",
        message: "Forbidden: You cannot alter direct grants of the School Proprietor.",
      });
    }

    // 3. Delegation ceiling check
    const actorMembership = authContext.membershipId
      ? await ctx.db.get(authContext.membershipId)
      : null;
    const isActorProprietor = actorMembership
      ? await isMembershipProprietor(ctx, actorMembership)
      : false;

    if (!isActorProprietor && !authContext.isPlatformAdmin && authContext.membershipId) {
      const ceiling = await ctx.db
        .query("delegationCeilings")
        .withIndex("by_membership", (q) => q.eq("membershipId", authContext.membershipId!))
        .first();

      if (!ceiling) {
        throw new ConvexError({
          code: "DELEGATION_CEILING_MISSING",
          message: "Delegation ceiling violation: You have no active delegation ceiling assigned.",
        });
      }

      const allowedSet = new Set(ceiling.allowedCapabilities);
      if (!allowedSet.has(args.capability) && !allowedSet.has(normalizeCapability(args.capability))) {
        throw new ConvexError({
          code: "DELEGATION_CEILING_EXCEEDED",
          message: `Delegation ceiling violation: Capability '${args.capability}' exceeds your allowed delegation ceiling.`,
        });
      }
    }

    // 4. Remove conflicting restriction if present
    const existingRestriction = await ctx.db
      .query("membershipDirectRestrictions")
      .withIndex("by_membership_and_cap", (q) =>
        q.eq("membershipId", args.targetMembershipId).eq("capability", args.capability)
      )
      .first();
    if (existingRestriction) {
      await ctx.db.delete(existingRestriction._id);
    }

    // 5. Insert grant if not already present
    const existingGrant = await ctx.db
      .query("membershipDirectGrants")
      .withIndex("by_membership_and_cap", (q) =>
        q.eq("membershipId", args.targetMembershipId).eq("capability", args.capability)
      )
      .first();

    const now = Date.now();
    if (!existingGrant) {
      await ctx.db.insert("membershipDirectGrants", {
        membershipId: args.targetMembershipId,
        capability: args.capability,
        grantedBy: authContext.personId,
        grantedAt: now,
        reason: args.reason,
      });
    }

    // 6. Emit immutable audit log with Tier 1 critical alert
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.personId
        ? (await ctx.db.get(authContext.personId))?.email ?? "unknown"
        : "system",
      module: "rbac",
      action: "direct_grant_configured",
      targetType: "branchMembership",
      targetId: args.targetMembershipId,
      outcome: "success",
      safeSummary: `Granted direct capability '${args.capability}' to membership ${args.targetMembershipId}${args.reason ? ` (Reason: ${args.reason})` : ""}`,
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });

    return { success: true };
  },
});

/**
 * Restricts a capability for a branch membership, subtracting it from role templates.
 * Enforces anti-self-edit, no superior edit, and manager delegation ceiling.
 */
export const restrictDirectCapability = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    capability: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await requireCapability(ctx, args.schoolId, "staff.permissions.manage");

    // 1. Anti-self-edit
    if (authContext.membershipId && authContext.membershipId === args.targetMembershipId) {
      throw new ConvexError({
        code: "ANTI_SELF_EDIT_VIOLATION",
        message: "Anti-self-edit violation: You cannot place direct restrictions on your own membership.",
      });
    }

    const targetMembership = await ctx.db.get(args.targetMembershipId);
    if (!targetMembership || targetMembership.schoolId !== args.schoolId) {
      throw new ConvexError("Target membership not found in this branch");
    }

    // 2. Superior edit check
    const isTargetProprietor = await isMembershipProprietor(ctx, targetMembership);
    if (isTargetProprietor && !authContext.isPlatformAdmin) {
      throw new ConvexError({
        code: "SUPERIOR_EDIT_DENIED",
        message: "Forbidden: You cannot alter restrictions of the School Proprietor.",
      });
    }

    // 3. Delegation ceiling check
    const actorMembership = authContext.membershipId
      ? await ctx.db.get(authContext.membershipId)
      : null;
    const isActorProprietor = actorMembership
      ? await isMembershipProprietor(ctx, actorMembership)
      : false;

    if (!isActorProprietor && !authContext.isPlatformAdmin && authContext.membershipId) {
      const ceiling = await ctx.db
        .query("delegationCeilings")
        .withIndex("by_membership", (q) => q.eq("membershipId", authContext.membershipId!))
        .first();

      if (!ceiling) {
        throw new ConvexError({
          code: "DELEGATION_CEILING_MISSING",
          message: "Delegation ceiling violation: You have no active delegation ceiling assigned.",
        });
      }

      const allowedSet = new Set(ceiling.allowedCapabilities);
      if (!allowedSet.has(args.capability) && !allowedSet.has(normalizeCapability(args.capability))) {
        throw new ConvexError({
          code: "DELEGATION_CEILING_EXCEEDED",
          message: `Delegation ceiling violation: Capability '${args.capability}' exceeds your delegation ceiling.`,
        });
      }
    }

    // 4. Remove conflicting grant if present
    const existingGrant = await ctx.db
      .query("membershipDirectGrants")
      .withIndex("by_membership_and_cap", (q) =>
        q.eq("membershipId", args.targetMembershipId).eq("capability", args.capability)
      )
      .first();
    if (existingGrant) {
      await ctx.db.delete(existingGrant._id);
    }

    // 5. Insert restriction if not already present
    const existingRestriction = await ctx.db
      .query("membershipDirectRestrictions")
      .withIndex("by_membership_and_cap", (q) =>
        q.eq("membershipId", args.targetMembershipId).eq("capability", args.capability)
      )
      .first();

    const now = Date.now();
    if (!existingRestriction) {
      await ctx.db.insert("membershipDirectRestrictions", {
        membershipId: args.targetMembershipId,
        capability: args.capability,
        restrictedBy: authContext.personId,
        restrictedAt: now,
        reason: args.reason,
      });
    }

    // 6. Emit immutable audit log
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.personId
        ? (await ctx.db.get(authContext.personId))?.email ?? "unknown"
        : "system",
      module: "rbac",
      action: "direct_restriction_configured",
      targetType: "branchMembership",
      targetId: args.targetMembershipId,
      outcome: "success",
      safeSummary: `Restricted direct capability '${args.capability}' for membership ${args.targetMembershipId}${args.reason ? ` (Reason: ${args.reason})` : ""}`,
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });

    return { success: true };
  },
});

/**
 * Sets or updates a manager's delegation ceiling.
 * Strictly restricted to School Proprietor or Platform Super Admin.
 */
export const setDelegationCeiling = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    allowedCapabilities: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const authContext = await resolveActiveMembership(ctx, args.schoolId);

    // Verify actor is Proprietor or Platform Super Admin
    let isAuthorized = authContext.isPlatformAdmin;
    if (!isAuthorized && authContext.membershipId) {
      const actorMembership = await ctx.db.get(authContext.membershipId);
      if (actorMembership) {
        isAuthorized = await isMembershipProprietor(ctx, actorMembership);
      }
    }

    if (!isAuthorized) {
      throw new ConvexError({
        code: "PROPRIETOR_AUTHORITY_REQUIRED",
        message: "Forbidden: Only the School Proprietor can configure delegation ceilings.",
      });
    }

    const targetMembership = await ctx.db.get(args.targetMembershipId);
    if (!targetMembership || targetMembership.schoolId !== args.schoolId) {
      throw new ConvexError("Target membership not found in this branch");
    }

    const existingCeiling = await ctx.db
      .query("delegationCeilings")
      .withIndex("by_membership", (q) => q.eq("membershipId", args.targetMembershipId))
      .first();

    const now = Date.now();
    if (existingCeiling) {
      await ctx.db.patch(existingCeiling._id, {
        allowedCapabilities: args.allowedCapabilities,
        updatedBy: authContext.personId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("delegationCeilings", {
        membershipId: args.targetMembershipId,
        allowedCapabilities: args.allowedCapabilities,
        updatedBy: authContext.personId,
        updatedAt: now,
      });
    }

    // Emit Tier 1 Critical alert for ceiling expansion
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.personId
        ? (await ctx.db.get(authContext.personId))?.email ?? "proprietor"
        : "system",
      module: "rbac",
      action: "delegation_ceiling_updated",
      targetType: "branchMembership",
      targetId: args.targetMembershipId,
      outcome: "success",
      safeSummary: `Updated delegation ceiling for membership ${args.targetMembershipId} with ${args.allowedCapabilities.length} capabilities`,
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });

    return { success: true };
  },
});
