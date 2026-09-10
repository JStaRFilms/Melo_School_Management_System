import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { resolveActiveMembership } from "../auth";
import type { UserBranchSummary } from "../groups";
import { api } from "../../../_generated/api";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob([
  "../../../**/*.ts",
  "!../../../**/*.test.ts",
]);
const modules = Object.fromEntries(
  Object.entries(rawModules).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const groupsApi = api.functions.academic.groups;
const listUserBranchesRef = groupsApi.listUserBranches;
const getGroupOverviewRef = groupsApi.getGroupOverview;
const listGroupBranchesRef = groupsApi.listGroupBranches;
const createSchoolGroupRef = groupsApi.createSchoolGroup;
const linkBranchToGroupRef = groupsApi.linkBranchToGroup;
const listGroupStaffCandidatesRef = groupsApi.listGroupStaffCandidates;
const assignUserToBranchRef = groupsApi.assignUserToBranch;
const revokeUserBranchMembershipRef = groupsApi.revokeUserBranchMembership;

describe("Task B-04 / M3: School Group Operations and Branch Switcher (F2/H2)", () => {
  it("1. Multi-branch user querying listUserBranches receives all active branch memberships with accurate group and HQ metadata", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, schoolC, personId, groupA } = await t.run(
      async (ctx) => {
        const schoolA = await ctx.db.insert("schools", {
          name: "Olive Crest Ikoyi",
          slug: "olive-ikoyi",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        const schoolB = await ctx.db.insert("schools", {
          name: "Olive Crest Lekki",
          slug: "olive-lekki",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        const schoolC = await ctx.db.insert("schools", {
          name: "Olive Crest Abuja",
          slug: "olive-abuja",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        const personId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
          email: "paula@olivecrest.test",
          name: "Paula Adebayo",
          status: "active",
          primarySchoolId: schoolA,
          createdAt: now,
          updatedAt: now,
        });

        const groupA = await ctx.db.insert("schoolGroups", {
          name: "Olive Crest Schools Group",
          slug: "olive-crest-group",
          proprietorPersonId: personId,
          status: "active",
          settingsVersion: 1,
          createdAt: now,
          updatedAt: now,
        });

        // Link School A as HQ
        await ctx.db.insert("schoolGroupBranches", {
          groupId: groupA,
          schoolId: schoolA,
          isHeadquarters: true,
          linkedAt: now,
        });

        // Link School B as non-HQ branch
        await ctx.db.insert("schoolGroupBranches", {
          groupId: groupA,
          schoolId: schoolB,
          isHeadquarters: false,
          linkedAt: now,
        });

        // Active membership in School A with custom displayTitle
        await ctx.db.insert("branchMemberships", {
          personId,
          schoolId: schoolA,
          status: "active",
          displayTitle: "Proprietress",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });

        // Active membership in School B without custom displayTitle (resolved via proprietor check)
        await ctx.db.insert("branchMemberships", {
          personId,
          schoolId: schoolB,
          status: "active",
          isDefaultBranch: false,
          joinedAt: now,
          updatedAt: now,
        });

        // Suspended membership in School C (must NOT appear in active list)
        await ctx.db.insert("branchMemberships", {
          personId,
          schoolId: schoolC,
          status: "suspended",
          isDefaultBranch: false,
          joinedAt: now,
          updatedAt: now,
        });

        return { schoolA, schoolB, schoolC, personId, groupA };
      }
    );

    const paulaSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-paula",
      subject: "auth-paula",
      email: "paula@olivecrest.test",
    });

    const branches: UserBranchSummary[] = await paulaSession.query(
      listUserBranchesRef,
      {}
    );

    expect(branches).toHaveLength(2);

    const branchA = branches.find((b) => b.schoolId === schoolA);
    const branchB = branches.find((b) => b.schoolId === schoolB);
    const branchC = branches.find((b) => b.schoolId === schoolC);

    expect(branchA).toBeDefined();
    expect(branchA).toMatchObject({
      schoolId: schoolA,
      name: "Olive Crest Ikoyi",
      slug: "olive-ikoyi",
      isHeadquarters: true,
      status: "active",
      membershipRoleTitle: "Proprietress",
      groupName: "Olive Crest Schools Group",
      groupSlug: "olive-crest-group",
    });

    expect(branchB).toBeDefined();
    expect(branchB).toMatchObject({
      schoolId: schoolB,
      name: "Olive Crest Lekki",
      slug: "olive-lekki",
      isHeadquarters: false,
      status: "active",
      membershipRoleTitle: "Proprietor",
      groupName: "Olive Crest Schools Group",
      groupSlug: "olive-crest-group",
    });

    // Suspended branch C must not be in list
    expect(branchC).toBeUndefined();
    await t.run(ctx => ctx.db.patch(personId, { status: "suspended" }));
    await expect(paulaSession.query(listUserBranchesRef, {})).rejects.toThrow("Forbidden");
    await expect(paulaSession.query(getGroupOverviewRef, { groupId: groupA })).rejects.toThrow("Forbidden");
  });

  it("2. Cross-branch isolation: Linking Branch A and Branch B into a school group does NOT allow Branch A queries to access Branch B data", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Olive Crest Ikoyi",
        slug: "olive-ikoyi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Olive Crest Lekki",
        slug: "olive-lekki",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const proprietorPerson = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
        email: "paula@olivecrest.test",
        name: "Paula Adebayo",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      const group = await ctx.db.insert("schoolGroups", {
        name: "Olive Crest Schools Group",
        slug: "olive-crest-group",
        proprietorPersonId: proprietorPerson,
        status: "active",
        settingsVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      // Both schools are linked under the same umbrella group
      await ctx.db.insert("schoolGroupBranches", {
        groupId: group,
        schoolId: schoolA,
        isHeadquarters: true,
        linkedAt: now,
      });

      await ctx.db.insert("schoolGroupBranches", {
        groupId: group,
        schoolId: schoolB,
        isHeadquarters: false,
        linkedAt: now,
      });

      // Alice is a teacher assigned ONLY to Branch A
      const alicePerson = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|teacher-alice",
        email: "alice@olivecrest.test",
        name: "Alice Okafor",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("branchMemberships", {
        personId: alicePerson,
        schoolId: schoolA,
        status: "active",
        displayTitle: "Lead Science Teacher",
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });

      return { schoolA, schoolB, alicePerson };
    });

    const aliceSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|teacher-alice",
      subject: "auth-alice",
      email: "alice@olivecrest.test",
    });

    // 1. Alice successfully resolves Branch A
    const contextA = await aliceSession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolA);
    });
    expect(contextA.schoolId).toBe(schoolA);

    // 2. Alice is strictly rejected when attempting to access Branch B
    await expect(
      aliceSession.run(async (ctx) => {
        return await resolveActiveMembership(ctx, schoolB);
      })
    ).rejects.toThrow("Not authorized: User does not have an active membership in this branch");

    // 3. Alice's listUserBranches only contains Branch A
    const aliceBranches: UserBranchSummary[] = await aliceSession.query(
      listUserBranchesRef,
      {}
    );
    expect(aliceBranches).toHaveLength(1);
    expect(aliceBranches[0].schoolId).toBe(schoolA);
  });

  it("3. Group creation and branch linking accurately records schoolGroups, schoolGroupBranches, and emits audit events", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, bobPersonId } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Emerald Heights Ikoyi",
        slug: "emerald-ikoyi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Emerald Heights Victoria Island",
        slug: "emerald-vi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const bobPersonId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|proprietor-bob",
        email: "bob@emerald.test",
        name: "Bob Emerald",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      const bobUser = await ctx.db.insert("users", {
        schoolId: schoolA,
        personId: bobPersonId,
        authId: "auth-bob",
        authTokenIdentifier: "https://auth.melo.test|proprietor-bob",
        name: "Bob Emerald",
        email: "bob@emerald.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });

      const bobMembershipId = await ctx.db.insert("branchMemberships", {
        personId: bobPersonId,
        schoolId: schoolA,
        status: "active",
        legacyUserId: bobUser,
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });
      const proprietorRoleTemplateId = await ctx.db.insert("roleTemplates", {
        code: "proprietor",
        name: "Proprietor",
        scope: "branch",
        schoolId: schoolA,
        capabilities: [],
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("membershipRoleAssignments", {
        membershipId: bobMembershipId,
        roleTemplateId: proprietorRoleTemplateId,
        roleTemplateKey: "proprietor",
        assignedAt: now,
      });

      await ctx.db.insert("platformAdmins", { authId: "operator", authTokenIdentifier: "https://auth.melo.test|operator", email: "operator@example.test", name: "Platform operator", isActive: true, createdAt: now, updatedAt: now });
      return { schoolA, schoolB, bobPersonId };
    });

    const bobSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-bob",
      subject: "auth-bob",
      email: "bob@emerald.test",
    });

    const operator = t.withIdentity({ tokenIdentifier: "https://auth.melo.test|operator" });
    await expect(bobSession.mutation(createSchoolGroupRef, { name: "Denied", slug: "denied", headquartersSchoolId: schoolA, proprietorPersonId: bobPersonId, confirmation: "emerald-ikoyi" })).rejects.toThrow("Forbidden");
    const originalSchools = await t.run(async ctx => [await ctx.db.get(schoolA), await ctx.db.get(schoolB)]);
    // Platform explicitly selects Bob, never itself.
    const { groupId, branchLinkId } = await operator.mutation(
      createSchoolGroupRef,
      {
        name: "Emerald Heights Educational Group",
        slug: "emerald-group",
        headquartersSchoolId: schoolA,
        proprietorPersonId: bobPersonId,
        confirmation: "emerald-ikoyi",
      }
    );

    expect(groupId).toBeDefined();
    expect(branchLinkId).toBeDefined();

    // Verify schoolGroups record
    const groupDoc = await t.run(async (ctx) => {
      return await ctx.db.get(groupId);
    });
    expect(groupDoc).toMatchObject({
      name: "Emerald Heights Educational Group",
      slug: "emerald-group",
      proprietorPersonId: bobPersonId,
      status: "active",
      settingsVersion: 1,
    });

    // Verify schoolGroupBranches for HQ
    const hqLinkDoc = await t.run(async (ctx) => {
      return await ctx.db.get(branchLinkId);
    });
    expect(hqLinkDoc).toMatchObject({
      groupId,
      schoolId: schoolA,
      isHeadquarters: true,
    });

    // Verify audit event for group.create
    const createAuditEvents = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_school_and_timestamp", (q) => q.eq("schoolId", schoolA))
        .filter((q) => q.eq(q.field("action"), "group.create"))
        .collect();
    });
    expect(createAuditEvents).toHaveLength(1);
    expect(createAuditEvents[0]).toMatchObject({
      module: "groups",
      action: "group.create",
      outcome: "success",
      targetType: "schoolGroup",
      targetId: groupId,
      groupId,
    });

    // 2. Link Branch B to Group
    await expect(bobSession.mutation(linkBranchToGroupRef, { groupId, schoolId: schoolB, confirmation: "emerald-vi" })).rejects.toThrow("Forbidden");
    const linkResult = await operator.mutation(linkBranchToGroupRef, {
      groupId,
      schoolId: schoolB,
      isHeadquarters: false,
      confirmation: "emerald-vi",
    });
    expect(await operator.mutation(linkBranchToGroupRef, { groupId, schoolId: schoolB, confirmation: "emerald-vi" })).toEqual(linkResult);
    await expect(operator.mutation(createSchoolGroupRef, { name: "Duplicate", slug: "emerald-group", headquartersSchoolId: schoolA, proprietorPersonId: bobPersonId, confirmation: "emerald-ikoyi" })).rejects.toThrow("ALREADY_EXISTS");

    expect(linkResult.success).toBe(true);
    expect(linkResult.branchLinkId).toBeDefined();

    // Verify branch B is linked in schoolGroupBranches
    const branchBLink = await t.run(async (ctx) => {
      return await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_group_and_school", (q) =>
          q.eq("groupId", groupId).eq("schoolId", schoolB)
        )
        .first();
    });
    expect(branchBLink).toMatchObject({
      groupId,
      schoolId: schoolB,
      isHeadquarters: false,
    });

    // Verify audit event for group.branch_link
    const linkAuditEvents = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_school_and_timestamp", (q) => q.eq("schoolId", schoolB))
        .filter((q) => q.eq(q.field("action"), "group.branch_link"))
        .collect();
    });
    expect(linkAuditEvents).toHaveLength(1);
    expect(linkAuditEvents[0]).toMatchObject({
      module: "groups",
      action: "group.branch_link",
      outcome: "success",
      groupId,
    });

    // 3. Query group overview
    const overview = await bobSession.query(getGroupOverviewRef, { groupId });
    expect(overview.group.name).toBe("Emerald Heights Educational Group");
    expect(overview.branches).toHaveLength(2);
    expect(overview.branches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ schoolId: schoolA, isHeadquarters: true }),
        expect.objectContaining({ schoolId: schoolB, isHeadquarters: false }),
      ])
    );

    // 4. Query listGroupBranches
    const groupBranches = await bobSession.query(listGroupBranchesRef, {
      groupId,
    });
    expect(groupBranches).toHaveLength(2);
    expect(await t.run(async ctx => [await ctx.db.get(schoolA), await ctx.db.get(schoolB)])).toEqual(originalSchools);
  });

  it("4. Platform assigns an existing group person to another branch and the proprietor can revoke that access", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const fixture = await t.run(async (ctx) => {
      const headquartersId = await ctx.db.insert("schools", {
        name: "Meridian Headquarters",
        slug: "meridian-hq",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const branchId = await ctx.db.insert("schools", {
        name: "Meridian Riverside",
        slug: "meridian-riverside",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const proprietorId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|meridian-owner",
        email: "owner@meridian.test",
        name: "Meridian Owner",
        status: "active",
        primarySchoolId: headquartersId,
        createdAt: now,
        updatedAt: now,
      });
      const staffPersonId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|meridian-staff",
        email: "staff@meridian.test",
        name: "Ada Staff",
        status: "active",
        primarySchoolId: headquartersId,
        createdAt: now,
        updatedAt: now,
      });
      const proprietorUserId = await ctx.db.insert("users", {
        schoolId: headquartersId,
        personId: proprietorId,
        authId: "owner-auth",
        authTokenIdentifier: "https://auth.melo.test|meridian-owner",
        name: "Meridian Owner",
        email: "owner@meridian.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      const staffUserId = await ctx.db.insert("users", {
        schoolId: headquartersId,
        personId: staffPersonId,
        authId: "staff-auth",
        authTokenIdentifier: "https://auth.melo.test|meridian-staff",
        name: "Ada Staff",
        email: "staff@meridian.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("branchMemberships", {
        personId: proprietorId,
        schoolId: headquartersId,
        status: "active",
        legacyUserId: proprietorUserId,
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("branchMemberships", {
        personId: staffPersonId,
        schoolId: headquartersId,
        status: "active",
        legacyUserId: staffUserId,
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });
      const groupId = await ctx.db.insert("schoolGroups", {
        name: "Meridian Group",
        slug: "meridian-group",
        proprietorPersonId: proprietorId,
        status: "active",
        settingsVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: headquartersId,
        isHeadquarters: true,
        linkedAt: now,
      });
      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: branchId,
        isHeadquarters: false,
        linkedAt: now,
      });
      await ctx.db.insert("platformAdmins", {
        authId: "operator-auth",
        authTokenIdentifier: "https://auth.melo.test|operator-assign",
        email: "operator@meridian.test",
        name: "Platform Operator",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return {
        headquartersId,
        branchId,
        proprietorId,
        staffPersonId,
        groupId,
      };
    });

    const operator = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|operator-assign",
      subject: "operator-auth",
    });
    const proprietor = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|meridian-owner",
      subject: "owner-auth",
    });
    const staff = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|meridian-staff",
      subject: "staff-auth",
    });
    const paginationOpts = { numItems: 25, cursor: null };
    const candidates = await operator.query(listGroupStaffCandidatesRef, {
      groupId: fixture.groupId,
      sourceSchoolId: fixture.headquartersId,
      targetSchoolId: fixture.branchId,
      paginationOpts,
    });
    expect(candidates.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          personId: fixture.staffPersonId,
          currentRole: "admin",
          targetMembershipStatus: null,
        }),
      ]),
    );

    await expect(
      staff.mutation(assignUserToBranchRef, {
        groupId: fixture.groupId,
        sourceSchoolId: fixture.headquartersId,
        targetSchoolId: fixture.branchId,
        personId: fixture.staffPersonId,
        role: "admin",
        confirmation: "meridian-riverside",
      }),
    ).rejects.toThrow("Platform or Group Proprietor");

    const assignment = await operator.mutation(assignUserToBranchRef, {
      groupId: fixture.groupId,
      sourceSchoolId: fixture.headquartersId,
      targetSchoolId: fixture.branchId,
      personId: fixture.staffPersonId,
      role: "admin",
      displayTitle: "Branch Administrator",
      confirmation: "meridian-riverside",
    });
    expect(assignment.alreadyActive).toBe(false);
    expect(
      await operator.mutation(assignUserToBranchRef, {
        groupId: fixture.groupId,
        sourceSchoolId: fixture.headquartersId,
        targetSchoolId: fixture.branchId,
        personId: fixture.staffPersonId,
        role: "admin",
        confirmation: "meridian-riverside",
      }),
    ).toMatchObject({ alreadyActive: true, membershipId: assignment.membershipId });

    const branches = await staff.query(listUserBranchesRef, {});
    expect(branches.map((branch) => branch.schoolId)).toEqual(
      expect.arrayContaining([fixture.headquartersId, fixture.branchId]),
    );
    const persisted = await t.run(async (ctx) => ({
      membership: await ctx.db.get(assignment.membershipId),
      targetUsers: await ctx.db
        .query("users")
        .withIndex("by_person", (q) => q.eq("personId", fixture.staffPersonId))
        .collect(),
      roles: await ctx.db
        .query("membershipRoleAssignments")
        .withIndex("by_membership", (q) => q.eq("membershipId", assignment.membershipId))
        .collect(),
      factoryRoles: await ctx.db
        .query("roleTemplates")
        .withIndex("by_code", (q) => q.eq("code", "principal"))
        .collect(),
      audits: await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q.eq("module", "groups").eq("action", "membership.branch_assigned"),
        )
        .collect(),
    }));
    expect(persisted.membership).toMatchObject({
      personId: fixture.staffPersonId,
      schoolId: fixture.branchId,
      status: "active",
      isDefaultBranch: false,
    });
    expect(persisted.targetUsers).toHaveLength(2);
    expect(persisted.roles).toHaveLength(1);
    expect(persisted.factoryRoles).toEqual([
      expect.objectContaining({ scope: "global", isSystem: true }),
    ]);
    expect(persisted.audits).toHaveLength(1);

    await proprietor.mutation(revokeUserBranchMembershipRef, {
      groupId: fixture.groupId,
      schoolId: fixture.branchId,
      personId: fixture.staffPersonId,
      reason: "Assignment is no longer required",
      confirmation: "meridian-riverside",
    });
    expect(await staff.query(listUserBranchesRef, {})).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get(assignment.membershipId))).toMatchObject({
      status: "suspended",
    });
  });

  it("5. Unauthorized users cannot create groups or link branches", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, group, proprietorPerson } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Sunrise Academy",
        slug: "sunrise-main",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Sunrise Branch",
        slug: "sunrise-branch",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const proprietorPerson = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|proprietor-sam",
        email: "sam@sunrise.test",
        name: "Sam Proprietor",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      const group = await ctx.db.insert("schoolGroups", {
        name: "Sunrise Educational System",
        slug: "sunrise-group",
        proprietorPersonId: proprietorPerson,
        status: "active",
        settingsVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      // Charlie is an administrator but not a proprietor.
      const charliePerson = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|teacher-charlie",
        email: "charlie@sunrise.test",
        name: "Charlie Teacher",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      const charlieUser = await ctx.db.insert("users", {
        schoolId: schoolA,
        personId: charliePerson,
        authId: "auth-charlie",
        authTokenIdentifier: "https://auth.melo.test|teacher-charlie",
        name: "Charlie Teacher",
        email: "charlie@sunrise.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("branchMemberships", {
        personId: charliePerson,
        schoolId: schoolA,
        status: "active",
        legacyUserId: charlieUser,
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });

      return { schoolA, schoolB, group, proprietorPerson };
    });

    const charlieSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|teacher-charlie",
      subject: "auth-charlie",
      email: "charlie@sunrise.test",
    });

    await expect(charlieSession.query(getGroupOverviewRef, { groupId: group })).rejects.toThrow("Forbidden");
    // Charlie attempts to create a school group -> MUST be rejected
    await expect(
      charlieSession.mutation(createSchoolGroupRef, {
        name: "Charlie Rogue Group",
        slug: "charlie-rogue",
        headquartersSchoolId: schoolA,
        proprietorPersonId: proprietorPerson,
        confirmation: "sunrise-main",
      })
    ).rejects.toThrow("Forbidden");

    // Charlie attempts to link a branch to Sam's group -> MUST be rejected
    await expect(
      charlieSession.mutation(linkBranchToGroupRef, {
        groupId: group,
        schoolId: schoolB,
        isHeadquarters: false,
        confirmation: "sunrise-branch",
      })
    ).rejects.toThrow("Forbidden");
  });
});
