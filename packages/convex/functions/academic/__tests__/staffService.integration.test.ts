import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import type { FunctionArgs } from "convex/server";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const service = api.functions.academic.academicSetup;
const ownerIdentity = { subject: "owner", issuer: "https://auth.test", tokenIdentifier: "https://auth.test|owner" };
const page = { numItems: 100, cursor: null };

async function fixture(role: "teacher" | "admin" | "staff" = "staff", canonical = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Branch A", slug: "branch-a", status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Branch B", slug: "branch-b", status: "active", createdAt: 1, updatedAt: 1 });
    const ownerPersonId = await ctx.db.insert("persons", { authTokenIdentifier: ownerIdentity.tokenIdentifier, name: "Owner", email: "owner@test.invalid", status: "active", identityReconciliationState: "resolved", createdAt: 1, updatedAt: 1 });
    const ownerId = await ctx.db.insert("users", { schoolId, personId: ownerPersonId, authId: "owner", authTokenIdentifier: ownerIdentity.tokenIdentifier, name: "Owner", email: "owner@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 });
    const ownerMembershipId = await ctx.db.insert("branchMemberships", { schoolId, personId: ownerPersonId, legacyUserId: ownerId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    const ownerTemplate = await ctx.db.insert("roleTemplates", { code: "proprietor", name: "Proprietor", scope: "global", capabilities: ["staff.permissions.manage"], isSystem: true, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("membershipRoleAssignments", { membershipId: ownerMembershipId, roleTemplateId: ownerTemplate, assignedAt: 1 });
    await ctx.db.insert("schoolAdminLeadership", { schoolId, leadAdminUserId: ownerId, createdAt: 1, updatedAt: 1, updatedBy: ownerId });
    const identity = { subject: "employee", issuer: "https://auth.test", tokenIdentifier: "https://auth.test|employee" };
    const personId = canonical ? await ctx.db.insert("persons", { authTokenIdentifier: identity.tokenIdentifier, name: "Employee", email: "employee@test.invalid", status: "active", identityReconciliationState: "resolved", createdAt: 2, updatedAt: 2 }) : undefined;
    const userId = await ctx.db.insert("users", { schoolId, personId, authId: "employee", authTokenIdentifier: identity.tokenIdentifier, name: "Employee", email: "employee@test.invalid", role, createdAt: 2, updatedAt: 2 });
    const membershipId = personId ? await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: userId, displayTitle: "Employee", status: "active", isDefaultBranch: true, permissionsManagedAt: 2, joinedAt: 2, updatedAt: 2 }) : undefined;
    const otherUserId = personId ? await ctx.db.insert("users", { schoolId: otherSchoolId, personId, authId: "employee", authTokenIdentifier: identity.tokenIdentifier, name: "Employee", email: "employee@test.invalid", role, createdAt: 2, updatedAt: 2 }) : undefined;
    const otherMembershipId = personId ? await ctx.db.insert("branchMemberships", { schoolId: otherSchoolId, personId, legacyUserId: otherUserId, status: "active", isDefaultBranch: false, permissionsManagedAt: 2, joinedAt: 2, updatedAt: 2 }) : undefined;
    if (membershipId) await ctx.db.insert("membershipDirectGrants", { membershipId, capability: "staff.list.view", grantedAt: 2, reason: "Previous reviewed access" });
    return { schoolId, otherSchoolId, ownerId, ownerPersonId, ownerMembershipId, userId, personId, membershipId, otherMembershipId, otherUserId, identity };
  });
  const actor = t.withIdentity(ownerIdentity);
  const depart = (extra: Partial<FunctionArgs<typeof service.transitionStaffService>> = {}) => actor.mutation(service.transitionStaffService, { schoolId: ids.schoolId, userId: ids.userId, action: "depart", reason: "Employment ended", expectedRevision: 0, operationKey: "depart-1", effectiveDay: "2026-01-01", ...extra });
  async function review(revision = 1, replace = false) {
    const previous = await actor.query(service.previewStaffRehirePermissions, { schoolId: ids.schoolId, userId: ids.userId });
    const decision = { mode: replace ? "replace" as const : "retain" as const, displayTitle: previous.previous.displayTitle,
      roleTemplateIds: replace ? [] : previous.previous.roleTemplateIds, grants: replace ? [] : previous.previous.grants, restrictions: replace ? [] : previous.previous.restrictions };
    const preview = await actor.query(service.previewStaffRehirePermissions, { schoolId: ids.schoolId, userId: ids.userId, decision });
    return actor.mutation(service.confirmStaffRehireReview, { schoolId: ids.schoolId, userId: ids.userId, expectedRevision: revision, operationKey: `review-${revision}`, reason: "Reviewed previous access", decision, expectedPermissionState: preview.permissionState });
  }
  const rehire = (reviewId: Id<"staffServiceEvents">, revision = 2, key = "rehire-1") => actor.mutation(service.transitionStaffService, { schoolId: ids.schoolId, userId: ids.userId, action: "rehire", reason: "Returning to service", effectiveDay: "2026-02-01", expectedRevision: revision, operationKey: key, reviewedEventId: reviewId });
  return { t, ids, actor, depart, review, rehire };
}

afterEach(() => { vi.unstubAllEnvs(); });

describe("staff service registered functions", () => {
  for (const role of ["teacher", "admin", "staff"] as const) {
    it(`${role}: branch-local departure, authorized reviewed same-identity rehire and repeated periods`, async () => {
      const f = await fixture(role);
      const before = await f.t.run(ctx => ctx.db.get(f.ids.userId));
      const first = await f.depart();
      expect(first.status).toBe("departed");
      await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).rejects.toThrow();
      await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.otherSchoolId })).resolves.toMatchObject({ userId: f.ids.otherUserId });
      expect((await f.t.run(ctx => ctx.db.get(f.ids.personId!)))?.status).toBe("active");
      const previous = await f.actor.query(service.previewStaffRehirePermissions, { schoolId: f.ids.schoolId, userId: f.ids.userId });
      expect(previous.previous.grants).toEqual(["staff.list.view"]);
      expect(previous.previous.effective).toContain("staff.list.view");
      const review = await f.review();
      await f.rehire(review.eventId);
      const after = await f.t.run(ctx => ctx.db.get(f.ids.userId));
      expect(after).toMatchObject({ authId: before?.authId, authTokenIdentifier: before?.authTokenIdentifier, personId: before?.personId, employmentStatus: "active", serviceRevision: 3 });
      expect((await f.t.run(ctx => ctx.db.get(f.ids.membershipId!)))?.permissionsManagedAt).toBe(2);
      await f.depart({ expectedRevision: 3, operationKey: "depart-2", effectiveDay: "2026-02-02" });
      const review2 = await f.review(4);
      await expect(f.rehire(review2.eventId, 5, "rehire-2")).rejects.toThrow(/precedes/);
      await f.actor.mutation(service.transitionStaffService, { schoolId: f.ids.schoolId, userId: f.ids.userId, action: "rehire", reason: "Returning again", effectiveDay: "2026-03-01", expectedRevision: 5, operationKey: "rehire-2-corrected", reviewedEventId: review2.eventId });
      const periods = await f.actor.query(service.getStaffServicePeriods, { schoolId: f.ids.schoolId, userId: f.ids.userId, paginationOpts: page });
      expect(periods.page).toHaveLength(3);
      expect(periods.page.filter(p => p.endDay)).toHaveLength(2);
      expect(periods.page.find(p => p.startProvenance === "legacy_unknown")?.startDay).toBeUndefined();
      expect((await f.actor.query(service.getStaffServiceHistory, { schoolId: f.ids.schoolId, userId: f.ids.userId, paginationOpts: page })).page.filter(e => e.type === "access_reviewed")).toHaveLength(2);
    }, 60000);
  }

  it("joins teacher and genuine generic staff through registered canonical provisioning records; admin joins canonically too", async () => {
    const f = await fixture();
    vi.stubEnv("CONVEX_SITE_URL", "https://auth.test");
    for (const role of ["teacher", "staff"] as const) {
      const userId = await f.t.mutation(internal.functions.academic.academicSetup.createTeacherRecordInternal, { schoolId: f.ids.schoolId, name: `New ${role}`, email: `${role}@test.invalid`, authId: `new-${role}`, role, joiningDay: "2026-01-01", createdBy: f.ids.ownerId });
      expect(await f.t.run(ctx => ctx.db.get(userId))).toMatchObject({ role, employmentStatus: "active", serviceRevision: 1, authTokenIdentifier: `https://auth.test|new-${role}` });
      const periods = await f.actor.query(service.getStaffServicePeriods, { schoolId: f.ids.schoolId, userId, paginationOpts: page });
      expect(periods.page[0]).toMatchObject({ startDay: "2026-01-01", startProvenance: "recorded", roleAtStart: role });
    }
    const { adminUserId } = await f.t.mutation(internal.functions.academic.adminLeadershipHelpers.upsertSchoolAdminRecordInternal, { schoolId: f.ids.schoolId, adminName: "New Admin", adminEmail: "new-admin@test.invalid", adminAuthId: "new-admin", managerUserId: f.ids.ownerId, makeLead: false, createdBy: f.ids.ownerId });
    const user = await f.t.run(ctx => ctx.db.get(adminUserId));
    expect(user).toMatchObject({ role: "admin", employmentStatus: "active", serviceRevision: 1, serviceEffectiveDay: new Date().toISOString().slice(0, 10) });
    expect(user?.personId).toBeDefined();
    const history = await f.actor.query(service.getStaffServiceHistory, { schoolId: f.ids.schoolId, userId: adminUserId, paginationOpts: page });
    expect(history.page[0]).toMatchObject({ type: "joined", actorUserId: f.ids.ownerId, afterStatus: "active" });
  });

  it("records a genuine initial-admin bootstrap joining once without inventing canonical legacy metadata", async () => {
    const t = convexTest(schema, modules);
    const args = { schoolName: "Initial School", schoolSlug: "initial-school", adminName: "Initial Admin", adminEmail: "initial@test.invalid", adminAuthId: "initial-admin" };
    const first = await t.mutation(internal.functions.academic.bootstrap.bootstrapSchoolAdminInternal, args);
    await t.mutation(internal.functions.academic.bootstrap.bootstrapSchoolAdminInternal, args);
    const facts = await t.run(async ctx => ({ user: await ctx.db.get(first.adminUserId), events: await ctx.db.query("staffServiceEvents").collect(), periods: await ctx.db.query("staffServicePeriods").collect() }));
    expect(facts.user).toMatchObject({ employmentStatus: "active", serviceRevision: 1 });
    expect(facts.user?.authTokenIdentifier).toBeUndefined();
    expect(facts.events).toHaveLength(1);
    expect(facts.events[0]).toMatchObject({ type: "joined", role: "admin" });
    expect(facts.periods).toHaveLength(1);
    expect(facts.periods[0]).toMatchObject({ startProvenance: "recorded", startDay: new Date().toISOString().slice(0, 10), roleAtStart: "admin" });
  });

  it("bootstrap cannot bypass departed service or replace an existing admin identity", async () => {
    const f = await fixture("admin");
    const args = { schoolName: "Branch A", schoolSlug: "branch-a", adminName: "Changed", adminEmail: "employee@test.invalid", adminAuthId: "replacement" };
    await expect(f.t.mutation(internal.functions.academic.bootstrap.bootstrapSchoolAdminInternal, args)).rejects.toThrow(/identity cannot be replaced/);
    await f.depart();
    const before = await f.t.run(ctx => ctx.db.get(f.ids.userId));
    await expect(f.t.mutation(internal.functions.academic.bootstrap.bootstrapSchoolAdminInternal, { ...args, adminAuthId: "employee" })).rejects.toThrow(/departed/);
    expect(await f.t.run(ctx => ctx.db.get(f.ids.userId))).toEqual(before);
  });

  it("same-key old replay after return makes no writes; altered payload and stale new state reject", async () => {
    const f = await fixture();
    const original = await f.depart();
    await expect(f.depart({ reason: "Different reason" })).rejects.toThrow(/different intent/);
    await f.rehire((await f.review()).eventId);
    expect(await f.depart()).toEqual(original);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.employmentStatus).toBe("active");
    await expect(f.depart({ operationKey: "stale-new" })).rejects.toThrow(/CONFLICT/);
    expect((await f.actor.query(service.getStaffServiceHistory, { schoolId: f.ids.schoolId, userId: f.ids.userId, paginationOpts: page })).page).toHaveLength(3);
  });

  it("legacy teacher/admin/generic departure denies compatibility and returning access requires permission review", async () => {
    for (const role of ["teacher", "admin", "staff"] as const) {
      const f = await fixture(role, false);
      await f.depart();
      await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).rejects.toThrow();
      expect(await f.t.withIdentity(f.ids.identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: f.ids.schoolId })).toEqual({ membership: null, capabilities: [] });
      expect(await f.t.withIdentity(f.ids.identity).query(api.functions.auth.getViewerContext, {})).toBeNull();
      await expect(f.actor.mutation(service.transitionStaffService, { schoolId: f.ids.schoolId, userId: f.ids.userId, action: "rehire", expectedRevision: 1, operationKey: "unchecked", reason: "No access review" })).rejects.toThrow(/review/);
      await f.rehire((await f.review()).eventId);
      expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.employmentStatus).toBe("active");
    }
  });

  it("reviewed replacement preserves permission evidence and the no-fallback marker", async () => {
    const f = await fixture("admin");
    await f.depart();
    const review = await f.review(1, true);
    await f.rehire(review.eventId);
    const evidence = await f.t.run(ctx => ctx.db.get(review.eventId));
    expect(evidence?.previousPermissions?.grants).toEqual(["staff.list.view"]);
    expect(evidence?.proposedPermissions?.effective).toEqual([]);
    expect(evidence?.permissionState).toContain("Previous reviewed access");
    expect(await f.t.withIdentity(f.ids.identity).query(api.functions.academic.rbac.previewEffectiveCapabilities, { schoolId: f.ids.schoolId, membershipId: f.ids.membershipId! })).toEqual([]);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.membershipId!)))?.permissionsManagedAt).toBe(2);
  });

  it("revoked grants between review and return invalidate the review, and cannot fall back to admin permissions", async () => {
    const f = await fixture("admin");
    await f.depart(); const review = await f.review();
    await f.t.run(async ctx => {
      const grant = await ctx.db.query("membershipDirectGrants").withIndex("by_membership", q => q.eq("membershipId", f.ids.membershipId!)).unique();
      if (grant) await ctx.db.delete(grant._id);
    });
    await expect(f.rehire(review.eventId)).rejects.toThrow(/CONFLICT/);
    const preview = await f.actor.query(service.previewStaffRehirePermissions, { schoolId: f.ids.schoolId, userId: f.ids.userId });
    expect(preview.previous.effective).toEqual([]);
  });

  for (const restriction of ["global_suspension", "global_archive", "reconciliation", "revoked_membership", "independent_revision", "user_archive"] as const) {
    it(`rehire cannot undo ${restriction}`, async () => {
      const f = await fixture(); await f.depart(); const review = await f.review();
      await f.t.run(async ctx => {
        if (restriction === "global_suspension") await ctx.db.patch(f.ids.personId!, { status: "suspended" });
        if (restriction === "global_archive") await ctx.db.patch(f.ids.personId!, { status: "archived" });
        if (restriction === "reconciliation") await ctx.db.patch(f.ids.personId!, { identityReconciliationState: "reconciliation_required" });
        if (restriction === "revoked_membership") await ctx.db.patch(f.ids.membershipId!, { lifecycleSuspendedByEventId: undefined });
        if (restriction === "independent_revision") await ctx.db.patch(f.ids.membershipId!, { updatedAt: Date.now() + 1 });
        if (restriction === "user_archive") await ctx.db.patch(f.ids.userId, { isArchived: true });
      });
      await expect(f.rehire(review.eventId)).rejects.toThrow();
      expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.employmentStatus).toBe("departed");
    });
  }

  it("independently suspended branch departure records service but does not claim or restore revoked access", async () => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.patch(f.ids.membershipId!, { status: "suspended", updatedAt: 3 }));
    await f.depart();
    expect((await f.t.run(ctx => ctx.db.get(f.ids.membershipId!)))?.lifecycleSuspendedByEventId).toBeUndefined();
    await expect(f.review()).rejects.toThrow(/Independent/);
  });

  it("rejects tenant/capability denial, self, resolved lead, proprietor and direct reports", async () => {
    const f = await fixture();
    await expect(f.depart({ schoolId: f.ids.otherSchoolId })).rejects.toThrow();
    await expect(f.t.withIdentity(f.ids.identity).mutation(service.transitionStaffService, { schoolId: f.ids.schoolId, userId: f.ids.userId, action: "depart", reason: "Self departure", expectedRevision: 0, operationKey: "self" })).rejects.toThrow();
    await expect(f.depart({ userId: f.ids.ownerId })).rejects.toThrow(/own departure|leadership|Proprietor/);
    await f.t.run(async ctx => { await ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: "report", name: "Report", email: "report@test.invalid", role: "staff", managerUserId: f.ids.userId, createdAt: 3, updatedAt: 3 }); });
    await expect(f.depart()).rejects.toThrow(/direct reports/);
  });

  for (const role of ["teacher", "admin", "staff"] as const) {
    it(`${role} teaching/form links block departure, preserving attribution`, async () => {
      const f = await fixture(role);
      const classId = await f.t.run(ctx => ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "Primary 1", level: "Primary", formTeacherId: f.ids.userId, createdAt: 1, updatedAt: 1 }));
      await expect(f.depart()).rejects.toThrow(/form teacher/);
      expect((await f.t.run(ctx => ctx.db.get(classId)))?.formTeacherId).toBe(f.ids.userId);
      expect((await f.actor.query(service.getStaffServiceHistory, { schoolId: f.ids.schoolId, userId: f.ids.userId, paginationOpts: page })).page).toEqual([]);
    });
  }

  it("validates dates, reasons, revisions and default context without inventing legacy starts", async () => {
    const f = await fixture();
    for (const effectiveDay of ["2026-02-30", "2999-01-01", "not-a-date"]) await expect(f.depart({ effectiveDay })).rejects.toThrow();
    await expect(f.depart({ reason: " " })).rejects.toThrow(/reason/);
    await expect(f.depart({ expectedRevision: 1.5 })).rejects.toThrow(/revision/);
    const result = await f.depart({ effectiveDay: undefined });
    const event = await f.t.run(ctx => ctx.db.get(result.eventId));
    expect(event?.effectiveDay).toBe(new Date().toISOString().slice(0, 10));
    expect(event?.sessionId).toBeUndefined(); expect(event?.termId).toBeUndefined();
    expect(event?.recordedAt).toBeGreaterThan(0);
  });

  it("archive/restore does not rehire departed teacher, admin or generic staff", async () => {
    for (const role of ["teacher", "admin", "staff"] as const) {
      const f = await fixture(role); await f.depart();
      if (role === "teacher") {
        await f.actor.mutation(service.archiveTeacher, { teacherId: f.ids.userId }); await f.actor.mutation(service.restoreTeacher, { teacherId: f.ids.userId });
      } else if (role === "admin") {
        await f.actor.mutation(api.functions.academic.adminLeadership.archiveSchoolAdmin, { adminId: f.ids.userId }); await f.actor.mutation(api.functions.academic.adminLeadership.restoreSchoolAdmin, { adminId: f.ids.userId });
      } else {
        await f.actor.mutation(service.setStaffAccountArchive, { schoolId: f.ids.schoolId, userId: f.ids.userId, archived: true });
        const audit = await f.actor.query(api.functions.academic.archiveRecords.listArchivedRecords, {});
        expect(audit.summary.archivedStaff).toBe(1);
        expect(audit.records.find(record => record.recordId === f.ids.userId)).toMatchObject({ type: "staff", detailFields: expect.arrayContaining([{ label: "Service status", value: "departed" }]) });
        await f.actor.mutation(service.setStaffAccountArchive, { schoolId: f.ids.schoolId, userId: f.ids.userId, archived: false });
      }
      expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.employmentStatus).toBe("departed");
      expect((await f.t.run(ctx => ctx.db.get(f.ids.personId!)))?.status).toBe("active");
      expect((await f.t.run(ctx => ctx.db.get(f.ids.membershipId!)))?.status).toBe("suspended");
      await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).rejects.toThrow();
    }
  });

  it("role demotion, promotion, admin upsert and email-linked creation cannot bypass departure", async () => {
    const f = await fixture("admin"); await f.depart();
    await expect(f.actor.mutation(api.functions.academic.adminLeadership.demoteAdminToTeacher, { adminId: f.ids.userId })).rejects.toThrow(/departed/);
    await expect(f.actor.mutation(api.functions.academic.adminLeadership.promoteSchoolAdmin, { adminId: f.ids.userId })).rejects.toThrow(/departed/);
    await expect(f.t.mutation(internal.functions.academic.adminLeadershipHelpers.upsertSchoolAdminRecordInternal, { schoolId: f.ids.schoolId, adminName: "Replacement", adminEmail: "employee@test.invalid", adminAuthId: "second-identity", managerUserId: f.ids.ownerId, makeLead: false, createdBy: f.ids.ownerId })).rejects.toThrow(/departed/);
    vi.stubEnv("CONVEX_SITE_URL", "https://auth.test");
    await expect(f.t.mutation(internal.functions.academic.academicSetup.createTeacherRecordInternal, { schoolId: f.ids.schoolId, name: "Replacement", email: "employee@test.invalid", authId: "second-identity", role: "staff" })).rejects.toThrow(/already exists/);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.authId).toBe("employee");
  });

  it("branch assignment cannot bypass rehire, and another branch remains discoverable", async () => {
    const f = await fixture();
    const groupId = await f.t.run(async ctx => {
      const groupId = await ctx.db.insert("schoolGroups", { name: "Group", slug: "group", proprietorPersonId: f.ids.ownerPersonId, status: "active", createdAt: 1, updatedAt: 1 });
      for (const schoolId of [f.ids.schoolId, f.ids.otherSchoolId]) await ctx.db.insert("schoolGroupBranches", { schoolId, groupId, isHeadquarters: schoolId === f.ids.schoolId, linkedAt: 1 });
      return groupId;
    });
    const overviewArgs = { groupId, branchId: f.ids.schoolId, startDate: 0, endDate: 1000 };
    const before = await f.actor.query(api.functions.academic.groups.getOperationalOverview, overviewArgs);
    expect(before.branches[0].metrics.find(m => m.key === "staffing")?.value).toBe(2);
    await f.depart();
    const after = await f.actor.query(api.functions.academic.groups.getOperationalOverview, overviewArgs);
    expect(after.branches[0].metrics.find(m => m.key === "staffing")?.value).toBe(1);
    const candidates = await f.actor.query(api.functions.academic.groups.listGroupStaffCandidates, { groupId, sourceSchoolId: f.ids.otherSchoolId, targetSchoolId: f.ids.schoolId, paginationOpts: { numItems: 50, cursor: null } });
    expect(candidates.page).toEqual([]);
    await expect(f.actor.mutation(api.functions.academic.groups.assignUserToBranch, { groupId, sourceSchoolId: f.ids.otherSchoolId, targetSchoolId: f.ids.schoolId, personId: f.ids.personId!, role: "staff", confirmation: "branch-a" })).rejects.toThrow(/departed/);
    expect((await f.t.withIdentity(f.ids.identity).query(api.functions.academic.groups.listUserBranches, {})).map(b => b.schoolId)).toEqual([f.ids.otherSchoolId]);
    // Even an independent active membership patch cannot turn service state into active employment.
    await f.t.run(ctx => ctx.db.patch(f.ids.membershipId!, { status: "active" }));
    await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).rejects.toThrow(/departed/);
    expect((await f.t.withIdentity(f.ids.identity).query(api.functions.academic.groups.listUserBranches, {})).map(b => b.schoolId)).toEqual([f.ids.otherSchoolId]);
    expect((await f.t.withIdentity(f.ids.identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: f.ids.schoolId })).membership).toBeNull();
  });

  it("permission review requires permission-management authority and rejects changed preview state", async () => {
    const f = await fixture(); await f.depart();
    const manager = await f.t.run(async ctx => {
      const token = "https://auth.test|manager";
      const personId = await ctx.db.insert("persons", { authTokenIdentifier: token, name: "Manager", email: "manager@test.invalid", status: "active", createdAt: 3, updatedAt: 3 });
      const userId = await ctx.db.insert("users", { schoolId: f.ids.schoolId, personId, authTokenIdentifier: token, authId: "manager", name: "Manager", email: "manager@test.invalid", role: "admin", createdAt: 3, updatedAt: 3 });
      const membershipId = await ctx.db.insert("branchMemberships", { schoolId: f.ids.schoolId, personId, legacyUserId: userId, status: "active", permissionsManagedAt: 3, isDefaultBranch: true, joinedAt: 3, updatedAt: 3 });
      await ctx.db.insert("membershipDirectGrants", { membershipId, capability: "staff.onboard", grantedAt: 3 });
      return { token, membershipId };
    });
    const actor = f.t.withIdentity({ subject: "manager", issuer: "https://auth.test", tokenIdentifier: manager.token });
    const preview = await f.actor.query(service.previewStaffRehirePermissions, { schoolId: f.ids.schoolId, userId: f.ids.userId });
    const decision = { mode: "retain" as const, displayTitle: preview.previous.displayTitle, roleTemplateIds: preview.previous.roleTemplateIds, grants: preview.previous.grants, restrictions: preview.previous.restrictions };
    await expect(actor.mutation(service.confirmStaffRehireReview, { schoolId: f.ids.schoolId, userId: f.ids.userId, expectedRevision: 1, operationKey: "spoofed", reason: "Spoofed review intent", decision, expectedPermissionState: preview.permissionState })).rejects.toThrow(/staff.permissions.manage/);
    await expect(f.actor.mutation(service.confirmStaffRehireReview, { schoolId: f.ids.schoolId, userId: f.ids.userId, expectedRevision: 1, operationKey: "wrong-preview", reason: "Review prior permissions", decision, expectedPermissionState: "unchecked-boolean-substitute" })).rejects.toThrow(/CONFLICT/);
    await f.t.run(async ctx => {
      await ctx.db.insert("membershipDirectGrants", { membershipId: manager.membershipId, capability: "staff.permissions.manage", grantedAt: 3 });
      await ctx.db.insert("delegationCeilings", { membershipId: manager.membershipId, allowedCapabilities: ["staff.list.view"], updatedAt: 3 });
    });
    await expect(actor.query(service.previewStaffRehirePermissions, { schoolId: f.ids.schoolId, userId: f.ids.userId, decision: { ...decision, mode: "replace", grants: ["finance.payments.record_manual"] } })).rejects.toThrow(/ceiling/);
    const review = await f.review();
    await expect(actor.mutation(service.transitionStaffService, { schoolId: f.ids.schoolId, userId: f.ids.userId, action: "rehire", expectedRevision: 2, operationKey: "other-actor", reason: "Use someone else's review", reviewedEventId: review.eventId })).rejects.toThrow(/authorized review/);
  });

  it("active role changes preserve service and canonical identity fields", async () => {
    const f = await fixture("teacher", false);
    const legacyAdmin = await f.t.run(ctx => ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: "legacy-admin", authTokenIdentifier: "https://auth.test|legacy-admin", name: "Legacy Admin", email: "legacy-admin@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 }));
    const legacyActor = f.t.withIdentity({ subject: "legacy-admin", issuer: "https://auth.test", tokenIdentifier: "https://auth.test|legacy-admin" });
    await f.t.run(ctx => ctx.db.patch(f.ids.userId, { serviceRevision: 7, serviceEffectiveDay: "2026-01-01" }));
    await legacyActor.mutation(api.functions.academic.adminLeadership.promoteTeacherToAdmin, { teacherId: f.ids.userId });
    expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.serviceRevision).toBe(7);
    await legacyActor.mutation(api.functions.academic.adminLeadership.demoteAdminToTeacher, { adminId: f.ids.userId });
    expect(await f.t.run(ctx => ctx.db.get(f.ids.userId))).toMatchObject({ role: "teacher", serviceRevision: 7, serviceEffectiveDay: "2026-01-01", authId: "employee" });
    expect(legacyAdmin).toBeDefined();
  });

  it("active teacher archive cannot erase independent branch or global restrictions", async () => {
    const f = await fixture("teacher");
    await f.t.run(async ctx => { await ctx.db.patch(f.ids.membershipId!, { status: "suspended" }); await ctx.db.patch(f.ids.personId!, { status: "suspended" }); });
    await f.actor.mutation(service.archiveTeacher, { teacherId: f.ids.userId });
    await f.actor.mutation(service.restoreTeacher, { teacherId: f.ids.userId });
    expect((await f.t.run(ctx => ctx.db.get(f.ids.membershipId!)))?.status).toBe("suspended");
    expect((await f.t.run(ctx => ctx.db.get(f.ids.personId!)))?.status).toBe("suspended");
    await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).rejects.toThrow();
    expect((await f.t.withIdentity(f.ids.identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: f.ids.schoolId })).membership).toBeNull();
  });

  it("reviewed import rejects a departed generic staff identity as a student target", async () => {
    const f = await fixture(); await f.depart();
    const classId = await f.t.run(ctx => ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "Primary 1", level: "Primary", createdAt: 1, updatedAt: 1 }));
    const workspaceId = await f.actor.mutation(api.functions.academic.migrationWorkspace.createWorkspace, { schoolId: f.ids.schoolId, name: "Staff bypass check", mode: "school_admin" });
    await f.actor.mutation(api.functions.academic.migrationIngest.stageRecordsBatch, { schoolId: f.ids.schoolId, workspaceId, records: [{ rowNumber: 1, rawPayload: {}, entityType: "student", parsedData: { firstName: "Test", lastName: "Pupil", admissionNumber: "S001", gender: "Female", className: "Primary 1" } }] });
    const records = await f.actor.query(api.functions.academic.migrationWorkspace.getWorkspaceRecords, { schoolId: f.ids.schoolId, workspaceId, limit: 10 });
    await expect(f.actor.mutation(api.functions.academic.migrationAutosave.reviewStagedRecord, { schoolId: f.ids.schoolId, recordId: records[0]._id, expectedRowRevision: records[0].rowRevision ?? 1, resolutionAction: "create_new", selectedClassId: classId, selectedUserId: f.ids.userId })).rejects.toThrow(/active student user/);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.employmentStatus).toBe("departed");
  });

  it("self, resolved leadership and proprietor guards apply independently of title", async () => {
    const self = await fixture("staff");
    await self.t.run(ctx => ctx.db.insert("membershipDirectGrants", { membershipId: self.ids.membershipId!, capability: "staff.account.suspend", grantedAt: 2 }));
    await expect(self.t.withIdentity(self.ids.identity).mutation(service.transitionStaffService, { schoolId: self.ids.schoolId, userId: self.ids.userId, action: "depart", expectedRevision: 0, operationKey: "self-authorized", reason: "Self departure" })).rejects.toThrow(/own departure/);
    const lead = await fixture("admin");
    await lead.t.run(async ctx => { const leadership = await ctx.db.query("schoolAdminLeadership").withIndex("by_school", q => q.eq("schoolId", lead.ids.schoolId)).unique(); if (leadership) await ctx.db.patch(leadership._id, { leadAdminUserId: lead.ids.userId }); });
    await expect(lead.depart()).rejects.toThrow(/leadership/);
    const proprietor = await fixture("staff");
    await proprietor.t.run(async ctx => { const template = await ctx.db.query("roleTemplates").withIndex("by_code", q => q.eq("code", "proprietor")).unique(); if (template) await ctx.db.insert("membershipRoleAssignments", { membershipId: proprietor.ids.membershipId!, roleTemplateId: template._id, assignedAt: 2 }); });
    await expect(proprietor.depart()).rejects.toThrow(/Proprietor/);
  });

  for (const role of ["staff", "admin"] as const) {
    it(`${role} current teaching and session-form links block departure without deleting attribution`, async () => {
      const f = await fixture(role);
      const ids = await f.t.run(async ctx => {
        const sessionId = await ctx.db.insert("academicSessions", { schoolId: f.ids.schoolId, name: "2026/2027", isActive: true, startDate: 0, endDate: 1000, createdAt: 1, updatedAt: 1 });
        const classId = await ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "Primary 1", level: "Primary", createdAt: 1, updatedAt: 1 });
        const subjectId = await ctx.db.insert("subjects", { schoolId: f.ids.schoolId, name: "Mathematics", code: "MAT", createdAt: 1, updatedAt: 1 });
        const offeringId = await ctx.db.insert("classSubjects", { schoolId: f.ids.schoolId, classId, subjectId, teacherId: f.ids.userId, createdAt: 1, updatedAt: 1 });
        const assignmentId = await ctx.db.insert("teacherAssignments", { schoolId: f.ids.schoolId, classId, subjectId, teacherId: f.ids.userId, createdAt: 1, updatedAt: 1 });
        const formId = await ctx.db.insert("classSessionFormTeachers", { schoolId: f.ids.schoolId, classId, sessionId, formTeacherId: f.ids.userId, createdAt: 1, updatedAt: 1, updatedBy: f.ids.ownerId });
        return { offeringId, assignmentId, formId };
      });
      await expect(f.depart()).rejects.toThrow(/Mathematics/);
      expect((await f.t.run(ctx => ctx.db.get(ids.offeringId)))?.teacherId).toBe(f.ids.userId);
      expect((await f.t.run(ctx => ctx.db.get(ids.assignmentId)))?.teacherId).toBe(f.ids.userId);
      expect((await f.t.run(ctx => ctx.db.get(ids.formId)))?.formTeacherId).toBe(f.ids.userId);
    });
  }

  it("records actual current academic context and same-day ordered evidence", async () => {
    const f = await fixture();
    const ids = await f.t.run(async ctx => {
      const sessionId = await ctx.db.insert("academicSessions", { schoolId: f.ids.schoolId, name: "Current session", isActive: true, startDate: 0, endDate: 1000, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId, name: "Current term", isActive: true, startDate: 0, endDate: 100, createdAt: 1, updatedAt: 1 });
      return { sessionId, termId };
    });
    const departure = await f.depart({ effectiveDay: "2026-02-01" });
    expect(await f.t.run(ctx => ctx.db.get(departure.eventId))).toMatchObject({ ...ids, sessionName: "Current session", termName: "Current term" });
    await f.rehire((await f.review()).eventId);
    const periods = await f.actor.query(service.getStaffServicePeriods, { schoolId: f.ids.schoolId, userId: f.ids.userId, paginationOpts: page });
    expect(periods.page.find(p => p.startProvenance === "legacy_unknown")?.endDay).toBe("2026-02-01");
    expect(periods.page.find(p => p.startProvenance === "recorded")?.startDay).toBe("2026-02-01");
  });

  it("compatibility grants, including revocations, are reviewed evidence and never silently replaced", async () => {
    const f = await fixture();
    const grantId = await f.t.run(ctx => ctx.db.insert("schoolCapabilityGrants", { schoolId: f.ids.schoolId, userId: f.ids.userId, capability: "settings.manage", scope: "school", grantedByUserId: f.ids.ownerId, reason: "Prior compatibility access", isBreakGlass: false, createdAt: 2 }));
    await f.depart();
    const preview = await f.actor.query(service.previewStaffRehirePermissions, { schoolId: f.ids.schoolId, userId: f.ids.userId });
    expect(preview.previous.compatibilityGrants[0]).toMatchObject({ grantId, capability: "settings.manage" });
    await expect(f.review(1, true)).rejects.toThrow(/compatibility grants/);
    const review = await f.review();
    await f.t.run(ctx => ctx.db.patch(grantId, { revokedAt: 3, revokedByUserId: f.ids.ownerId }));
    await expect(f.rehire(review.eventId)).rejects.toThrow(/CONFLICT/);
    const newReview = await f.review(2);
    await f.rehire(newReview.eventId, 3);
    expect((await f.t.withIdentity(f.ids.identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: f.ids.schoolId })).capabilities).toEqual([]);
    const evidence = await f.t.run(ctx => ctx.db.get(newReview.eventId));
    expect(evidence?.previousPermissions?.compatibilityGrants[0].revokedAt).toBe(3);
  });

  it("trusted prelinked legacy staff keep the same person and membership on reviewed return", async () => {
    const f = await fixture("staff", false);
    vi.stubEnv("LEGACY_SUBJECT_TRUSTED_ISSUER", "https://auth.test");
    const ids = await f.t.run(async ctx => {
      const personId = await ctx.db.insert("persons", { name: "Prelinked Employee", email: "employee@test.invalid", status: "active", createdAt: 2, updatedAt: 2 });
      await ctx.db.patch(f.ids.userId, { personId, authTokenIdentifier: undefined });
      const membershipId = await ctx.db.insert("branchMemberships", { personId, schoolId: f.ids.schoolId, legacyUserId: f.ids.userId, status: "active", permissionsManagedAt: 2, isDefaultBranch: true, joinedAt: 2, updatedAt: 2 });
      return { personId, membershipId };
    });
    await f.depart();
    await expect(f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).rejects.toThrow();
    await f.rehire((await f.review()).eventId);
    expect(await f.t.withIdentity(f.ids.identity).query(api.functions.academic.auth.getActiveMembership, { schoolId: f.ids.schoolId })).toMatchObject(ids);
    expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.authTokenIdentifier).toBeUndefined();
  });

  it("registered group revocation stays independent of service and blocks later reviewed rehire", async () => {
    const f = await fixture();
    const groupId = await f.t.run(async ctx => {
      const groupId = await ctx.db.insert("schoolGroups", { name: "Group", slug: "group", proprietorPersonId: f.ids.ownerPersonId, status: "active", createdAt: 1, updatedAt: 1 });
      for (const schoolId of [f.ids.schoolId, f.ids.otherSchoolId]) await ctx.db.insert("schoolGroupBranches", { schoolId, groupId, isHeadquarters: schoolId === f.ids.schoolId, linkedAt: 1 });
      await ctx.db.patch(f.ids.membershipId!, { isDefaultBranch: false });
      await ctx.db.patch(f.ids.otherMembershipId!, { isDefaultBranch: true });
      return groupId;
    });
    await f.actor.mutation(api.functions.academic.groups.revokeUserBranchMembership, { groupId, schoolId: f.ids.schoolId, personId: f.ids.personId!, reason: "Independent access removal", confirmation: "branch-a" });
    expect((await f.t.run(ctx => ctx.db.get(f.ids.userId)))?.employmentStatus).toBeUndefined();
    await f.actor.mutation(service.setStaffAccountArchive, { schoolId: f.ids.schoolId, userId: f.ids.userId, archived: false });
    await f.depart({ expectedRevision: 1 });
    await expect(f.review(2)).rejects.toThrow(/Independent/);
  });

  it("departed targets are discoverable independently and absent from active teacher selectors", async () => {
    const f = await fixture("teacher"); await f.depart();
    expect(await f.actor.query(service.listTeachers, {})).toEqual([]);
    const active = await f.actor.query(service.listStaffServiceDirectory, { schoolId: f.ids.schoolId, status: "active", role: "teacher", paginationOpts: page });
    const departed = await f.actor.query(service.listStaffServiceDirectory, { schoolId: f.ids.schoolId, status: "departed", role: "teacher", paginationOpts: page });
    expect(active.page).toEqual([]); expect(departed.page[0]).toMatchObject({ userId: f.ids.userId, status: "departed", revision: 1 });
  });
});
