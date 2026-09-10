import { internalMutation, internalQuery } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import {
  TENANT_SCHOOL_TABLES,
  tenantSchoolTableValidator,
} from "./tenantPurgeManifest";
import { storageIdsOnRow } from "./seed";

const BATCH_SIZE = 50;
const INVENTORY_LIMIT = 1_001;

async function requireExactSchool(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  schoolSlug: string,
) {
  const school = await ctx.db.get(schoolId);
  if (!school || school.slug !== schoolSlug) {
    throw new ConvexError("School ID and exact slug do not identify the same target");
  }
  return school;
}

export const inspectTenantTargetInternal = internalQuery({
  args: { schoolId: v.id("schools"), schoolSlug: v.string() },
  returns: v.object({
    schoolId: v.id("schools"),
    schoolName: v.string(),
    schoolSlug: v.string(),
    status: v.string(),
    totalSchools: v.number(),
    logoStorageId: v.optional(v.id("_storage")),
  }),
  handler: async (ctx, args) => {
    const school = await requireExactSchool(ctx, args.schoolId, args.schoolSlug);
    const schools = await ctx.db.query("schools").take(101);
    if (schools.length > 100) throw new ConvexError("School inventory exceeds the supported bound");
    return {
      schoolId: school._id,
      schoolName: school.name,
      schoolSlug: school.slug,
      status: school.status ?? "active",
      totalSchools: schools.length,
      logoStorageId: school.logoStorageId,
    };
  },
});

export const inspectTenantTableInternal = internalQuery({
  args: {
    schoolId: v.id("schools"),
    schoolSlug: v.string(),
    tableName: tenantSchoolTableValidator,
  },
  returns: v.object({ count: v.number(), truncated: v.boolean() }),
  handler: async (ctx, args) => {
    await requireExactSchool(ctx, args.schoolId, args.schoolSlug);
    const rows = await ctx.db
      .query(args.tableName)
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(INVENTORY_LIMIT);
    return { count: Math.min(rows.length, 1_000), truncated: rows.length > 1_000 };
  },
});

export const verifyTenantTableEmptyInternal = internalQuery({
  args: { schoolId: v.id("schools"), tableName: tenantSchoolTableValidator },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.query(args.tableName)
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).first();
    return row === null;
  },
});

export const verifyTenantSpecialRefsInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  returns: v.object({ schoolExists: v.boolean(), residualSpecialRefs: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const checks = await Promise.all([
      ctx.db.query("studentTransfers").withIndex("by_source_school", (q) => q.eq("sourceSchoolId", args.schoolId)).first(),
      ctx.db.query("studentTransfers").withIndex("by_destination_school", (q) => q.eq("destinationSchoolId", args.schoolId)).first(),
      ctx.db.query("assetBranchShares").withIndex("by_owner", (q) => q.eq("ownerSchoolId", args.schoolId)).first(),
      ctx.db.query("assetBranchShares").withIndex("by_recipient", (q) => q.eq("recipientSchoolId", args.schoolId)).first(),
      ctx.db.query("migrationState").withIndex("by_source_school", (q) => q.eq("sourceSchoolId", args.schoolId)).first(),
      ctx.db.query("migrationState").withIndex("by_target_school", (q) => q.eq("targetSchoolId", args.schoolId)).first(),
      ctx.db.query("branchSettingOverrides").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).first(),
      ctx.db.query("roleTemplates").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).first(),
    ]);
    const labels = ["transfer source", "transfer destination", "owned asset share", "received asset share", "migration source", "migration target", "branch override", "branch role"];
    return {
      schoolExists: (await ctx.db.get(args.schoolId)) !== null,
      residualSpecialRefs: labels.filter((_label, index) => checks[index] !== null),
    };
  },
});

export const collectTenantStorageInternal = internalQuery({
  args: {
    schoolId: v.id("schools"),
    schoolSlug: v.string(),
    tableName: tenantSchoolTableValidator,
  },
  returns: v.array(v.id("_storage")),
  handler: async (ctx, args) => {
    await requireExactSchool(ctx, args.schoolId, args.schoolSlug);
    const rows = await ctx.db.query(args.tableName)
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(INVENTORY_LIMIT);
    if (rows.length > 1_000) throw new ConvexError(`Storage inventory for ${args.tableName} exceeds the supported bound`);
    return [...new Set(rows.flatMap((row) => storageIdsOnRow(row)).map(String))]
      .map((storageId) => storageId as Id<"_storage">);
  },
});

export const collectRetainedStorageInternal = internalQuery({
  args: {
    deletedSchoolId: v.id("schools"),
    candidateStorageIds: v.array(v.id("_storage")),
    tableName: tenantSchoolTableValidator,
  },
  returns: v.array(v.id("_storage")),
  handler: async (ctx, args) => {
    const candidates = new Set(args.candidateStorageIds.map(String));
    if (!candidates.size) return [];
    const schools = await ctx.db.query("schools").take(101);
    if (schools.length > 100) throw new ConvexError("School inventory exceeds the supported bound");
    const retained = new Set<string>();
    for (const school of schools) {
      if (school._id === args.deletedSchoolId) continue;
      const rows = await ctx.db.query(args.tableName)
        .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(INVENTORY_LIMIT);
      if (rows.length > 1_000) throw new ConvexError(`Retained storage inventory for ${args.tableName} exceeds the supported bound`);
      for (const storageId of rows.flatMap((row) => storageIdsOnRow(row))) {
        if (candidates.has(String(storageId))) retained.add(String(storageId));
      }
    }
    return [...retained].map((storageId) => storageId as Id<"_storage">);
  },
});

export const collectRetainedSchoolLogosInternal = internalQuery({
  args: { deletedSchoolId: v.id("schools"), candidateStorageIds: v.array(v.id("_storage")) },
  returns: v.array(v.id("_storage")),
  handler: async (ctx, args) => {
    const candidates = new Set(args.candidateStorageIds.map(String));
    const schools = await ctx.db.query("schools").take(101);
    if (schools.length > 100) throw new ConvexError("School inventory exceeds the supported bound");
    return schools
      .filter((school) => school._id !== args.deletedSchoolId && school.logoStorageId && candidates.has(String(school.logoStorageId)))
      .map((school) => school.logoStorageId as Id<"_storage">);
  },
});

export const collectTenantIdentityInternal = internalQuery({
  args: { schoolId: v.id("schools"), schoolSlug: v.string() },
  returns: v.object({
    authCandidates: v.array(v.object({ authId: v.string(), email: v.string() })),
    personIds: v.array(v.id("persons")),
    groupIds: v.array(v.id("schoolGroups")),
    guardianIds: v.array(v.id("admissionsGuardians")),
  }),
  handler: async (ctx, args) => {
    await requireExactSchool(ctx, args.schoolId, args.schoolSlug);
    const [users, memberships, links, purchases, entitlements, applications] = await Promise.all([
      ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(1_001),
      ctx.db.query("branchMemberships").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(1_001),
      ctx.db.query("schoolGroupBranches").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(101),
      ctx.db.query("admissionsPurchaseAttempts").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(1_001),
      ctx.db.query("admissionsEntitlements").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(1_001),
      ctx.db.query("admissionsApplications").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).take(1_001),
    ]);
    if ([users, memberships, purchases, entitlements, applications].some((rows) => rows.length > 1_000) || links.length > 100) {
      throw new ConvexError("Tenant identity inventory exceeds the supported bound");
    }
    const authCandidates = new Map<string, { authId: string; email: string }>();
    const personIds = new Set<Id<"persons">>();
    for (const user of users) {
      if (user.authId) authCandidates.set(user.authId, { authId: user.authId, email: user.email });
      if (user.personId) personIds.add(user.personId);
    }
    for (const membership of memberships) personIds.add(membership.personId);
    const guardianIds = new Set<Id<"admissionsGuardians">>();
    for (const row of [...purchases, ...entitlements, ...applications]) guardianIds.add(row.guardianId);
    return {
      authCandidates: [...authCandidates.values()],
      personIds: [...personIds],
      groupIds: links.map((link) => link.groupId),
      guardianIds: [...guardianIds],
    };
  },
});

export const purgeTenantBatchInternal = internalMutation({
  args: { schoolId: v.id("schools"), schoolSlug: v.string() },
  returns: v.object({
    complete: v.boolean(),
    deletedCount: v.number(),
    tableName: v.optional(v.string()),
    storageIds: v.array(v.id("_storage")),
  }),
  handler: async (ctx, args) => {
    const school = await requireExactSchool(ctx, args.schoolId, args.schoolSlug);
    if (school.status !== "suspended") {
      await ctx.db.patch(school._id, { status: "suspended", updatedAt: Date.now() });
    }

    const sourceTransfers = await ctx.db.query("studentTransfers")
      .withIndex("by_source_school", (q) => q.eq("sourceSchoolId", school._id)).take(BATCH_SIZE);
    if (sourceTransfers.length) {
      for (const row of sourceTransfers) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: sourceTransfers.length, tableName: "studentTransfers:source", storageIds: [] };
    }
    const destinationTransfers = await ctx.db.query("studentTransfers")
      .withIndex("by_destination_school", (q) => q.eq("destinationSchoolId", school._id)).take(BATCH_SIZE);
    if (destinationTransfers.length) {
      for (const row of destinationTransfers) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: destinationTransfers.length, tableName: "studentTransfers:destination", storageIds: [] };
    }
    const ownedShares = await ctx.db.query("assetBranchShares")
      .withIndex("by_owner", (q) => q.eq("ownerSchoolId", school._id)).take(BATCH_SIZE);
    if (ownedShares.length) {
      for (const row of ownedShares) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: ownedShares.length, tableName: "assetBranchShares:owner", storageIds: [] };
    }
    const receivedShares = await ctx.db.query("assetBranchShares")
      .withIndex("by_recipient", (q) => q.eq("recipientSchoolId", school._id)).take(BATCH_SIZE);
    if (receivedShares.length) {
      for (const row of receivedShares) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: receivedShares.length, tableName: "assetBranchShares:recipient", storageIds: [] };
    }

    const invoices = await ctx.db.query("subscriptionInvoices")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(10);
    for (const invoice of invoices) {
      const rows = await ctx.db.query("subscriptionInvoiceStudents")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id)).take(BATCH_SIZE);
      if (rows.length) {
        for (const row of rows) await ctx.db.delete(row._id);
        return { complete: false, deletedCount: rows.length, tableName: "subscriptionInvoiceStudents", storageIds: [] };
      }
    }

    const requests = await ctx.db.query("usageExceptionRequests")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(BATCH_SIZE);
    for (const request of requests) {
      const decision = await ctx.db.query("usageExceptionDecisions")
        .withIndex("by_request", (q) => q.eq("requestId", request._id)).unique();
      if (decision) {
        await ctx.db.delete(decision._id);
        return { complete: false, deletedCount: 1, tableName: "usageExceptionDecisions", storageIds: [] };
      }
    }

    const attempts = await ctx.db.query("usageOperationAttempts")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(BATCH_SIZE);
    for (const attempt of attempts) {
      const rows = await ctx.db.query("usageOperationTransitions")
        .withIndex("by_attempt", (q) => q.eq("attemptId", attempt._id)).take(BATCH_SIZE);
      if (rows.length) {
        for (const row of rows) await ctx.db.delete(row._id);
        return { complete: false, deletedCount: rows.length, tableName: "usageOperationTransitions", storageIds: [] };
      }
    }

    const memberships = await ctx.db.query("branchMemberships")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(BATCH_SIZE);
    for (const membership of memberships) {
      const assignments = await ctx.db.query("membershipRoleAssignments")
        .withIndex("by_membership", (q) => q.eq("membershipId", membership._id)).take(BATCH_SIZE);
      if (assignments.length) {
        for (const row of assignments) await ctx.db.delete(row._id);
        return { complete: false, deletedCount: assignments.length, tableName: "membershipRoleAssignments", storageIds: [] };
      }
      const grants = await ctx.db.query("membershipDirectGrants")
        .withIndex("by_membership", (q) => q.eq("membershipId", membership._id)).take(BATCH_SIZE);
      if (grants.length) {
        for (const row of grants) await ctx.db.delete(row._id);
        return { complete: false, deletedCount: grants.length, tableName: "membershipDirectGrants", storageIds: [] };
      }
      const restrictions = await ctx.db.query("membershipDirectRestrictions")
        .withIndex("by_membership", (q) => q.eq("membershipId", membership._id)).take(BATCH_SIZE);
      if (restrictions.length) {
        for (const row of restrictions) await ctx.db.delete(row._id);
        return { complete: false, deletedCount: restrictions.length, tableName: "membershipDirectRestrictions", storageIds: [] };
      }
      const ceilings = await ctx.db.query("delegationCeilings")
        .withIndex("by_membership", (q) => q.eq("membershipId", membership._id)).take(BATCH_SIZE);
      if (ceilings.length) {
        for (const row of ceilings) await ctx.db.delete(row._id);
        return { complete: false, deletedCount: ceilings.length, tableName: "delegationCeilings", storageIds: [] };
      }
    }

    const overrides = await ctx.db.query("branchSettingOverrides")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(BATCH_SIZE);
    if (overrides.length) {
      for (const row of overrides) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: overrides.length, tableName: "branchSettingOverrides", storageIds: [] };
    }
    const branchRoles = await ctx.db.query("roleTemplates")
      .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(BATCH_SIZE);
    if (branchRoles.length) {
      for (const role of branchRoles) {
        const assignments = await ctx.db.query("membershipRoleAssignments")
          .withIndex("by_role", (q) => q.eq("roleTemplateId", role._id)).take(1);
        if (assignments.length) throw new ConvexError("Role assignment remained after branch membership cleanup");
        await ctx.db.delete(role._id);
      }
      return { complete: false, deletedCount: branchRoles.length, tableName: "roleTemplates", storageIds: [] };
    }

    const sourceMigrations = await ctx.db.query("migrationState")
      .withIndex("by_source_school", (q) => q.eq("sourceSchoolId", school._id)).take(BATCH_SIZE);
    if (sourceMigrations.length) {
      for (const row of sourceMigrations) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: sourceMigrations.length, tableName: "migrationState:source", storageIds: [] };
    }
    const targetMigrations = await ctx.db.query("migrationState")
      .withIndex("by_target_school", (q) => q.eq("targetSchoolId", school._id)).take(BATCH_SIZE);
    if (targetMigrations.length) {
      for (const row of targetMigrations) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: targetMigrations.length, tableName: "migrationState:target", storageIds: [] };
    }

    for (const tableName of TENANT_SCHOOL_TABLES) {
      const rows = await ctx.db.query(tableName)
        .withIndex("by_school", (q) => q.eq("schoolId", school._id)).take(BATCH_SIZE);
      if (!rows.length) continue;
      const storageIds = rows.flatMap((row) => storageIdsOnRow(row));
      for (const row of rows) await ctx.db.delete(row._id);
      return { complete: false, deletedCount: rows.length, tableName, storageIds };
    }

    const storageIds = school.logoStorageId ? [school.logoStorageId] : [];
    await ctx.db.delete(school._id);
    return { complete: true, deletedCount: 1, tableName: "schools", storageIds };
  },
});

export const reconcileTenantPeopleInternal = internalMutation({
  args: { deletedSchoolId: v.id("schools"), personIds: v.array(v.id("persons")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let changed = 0;
    for (const personId of args.personIds) {
      const person = await ctx.db.get(personId);
      if (!person) continue;
      const [memberships, users, proprietorGroup] = await Promise.all([
        ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) => q.eq("personId", personId)).take(2),
        ctx.db.query("users").withIndex("by_person", (q) => q.eq("personId", personId)).take(2),
        ctx.db.query("schoolGroups").withIndex("by_proprietor", (q) => q.eq("proprietorPersonId", personId)).first(),
      ]);
      if (!memberships.length && !users.length && !proprietorGroup) {
        await ctx.db.delete(personId);
        changed += 1;
      } else if (person.primarySchoolId === args.deletedSchoolId) {
        const replacementSchoolId = memberships[0]?.schoolId ?? users[0]?.schoolId;
        await ctx.db.patch(personId, { primarySchoolId: replacementSchoolId, updatedAt: Date.now() });
        changed += 1;
      }
    }
    return changed;
  },
});

export const purgeOrphanAdmissionsGuardiansInternal = internalMutation({
  args: { guardianIds: v.array(v.id("admissionsGuardians")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const guardianId of args.guardianIds) {
      const guardian = await ctx.db.get(guardianId);
      if (!guardian) continue;
      const [purchase, entitlement, application] = await Promise.all([
        ctx.db.query("admissionsPurchaseAttempts").withIndex("by_guardian_and_created_at", (q) => q.eq("guardianId", guardianId)).first(),
        ctx.db.query("admissionsEntitlements").withIndex("by_guardian_and_state_and_created_at", (q) => q.eq("guardianId", guardianId)).first(),
        ctx.db.query("admissionsApplications").withIndex("by_guardian_and_updated_at", (q) => q.eq("guardianId", guardianId)).first(),
      ]);
      if (!purchase && !entitlement && !application) {
        await ctx.db.delete(guardianId);
        deleted += 1;
      }
    }
    return deleted;
  },
});

export const purgeOrphanTenantGroupsInternal = internalMutation({
  args: { groupIds: v.array(v.id("schoolGroups")) },
  returns: v.number(),
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const groupId of args.groupIds) {
      const group = await ctx.db.get(groupId);
      if (!group) continue;
      const remainingBranch = await ctx.db.query("schoolGroupBranches")
        .withIndex("by_group", (q) => q.eq("groupId", groupId)).first();
      if (remainingBranch) continue;
      const pools = await ctx.db.query("usageGroupPools").withIndex("by_group", (q) => q.eq("groupId", groupId)).take(101);
      const versions = await ctx.db.query("groupSettingVersions").withIndex("by_group_and_domain_and_version", (q) => q.eq("groupId", groupId)).take(101);
      const roles = await ctx.db.query("roleTemplates").withIndex("by_group", (q) => q.eq("groupId", groupId)).take(101);
      if (pools.length > 100 || versions.length > 100 || roles.length > 100) {
        throw new ConvexError("Orphan group cleanup exceeds the supported bound");
      }
      for (const pool of pools) {
        const allocations = await ctx.db.query("usageBranchPoolAllocations")
          .withIndex("by_pool", (q) => q.eq("poolId", pool._id)).take(101);
        if (allocations.length > 100) throw new ConvexError("Orphan group pool cleanup exceeds the supported bound");
        for (const allocation of allocations) await ctx.db.delete(allocation._id);
        await ctx.db.delete(pool._id);
      }
      for (const version of versions) await ctx.db.delete(version._id);
      for (const role of roles) {
        const assignment = await ctx.db.query("membershipRoleAssignments")
          .withIndex("by_role", (q) => q.eq("roleTemplateId", role._id)).first();
        if (assignment) throw new ConvexError("Orphan group role remains assigned");
        await ctx.db.delete(role._id);
      }
      await ctx.db.delete(groupId);
      deleted += 1;
    }
    return deleted;
  },
});

export const isAuthCandidateRetainedInternal = internalQuery({
  args: { authId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const [platform, user] = await Promise.all([
      ctx.db.query("platformAdmins").withIndex("by_auth", (q) => q.eq("authId", args.authId)).first(),
      ctx.db.query("users").withIndex("by_auth", (q) => q.eq("authId", args.authId)).first(),
    ]);
    return Boolean(platform || user);
  },
});
