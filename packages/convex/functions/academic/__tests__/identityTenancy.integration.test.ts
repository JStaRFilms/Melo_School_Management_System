import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { resolveActiveMembership } from "../auth";

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

import { api, internal } from "../../../_generated/api";

const backfillCanonicalIdentityBatch =
  internal.functions.academic.identityMigration.backfillCanonicalIdentityBatch;
const linkSchoolToGroupInternal =
  internal.functions.academic.identityMigration.linkSchoolToGroupInternal;
const createSchoolGroupInternal =
  internal.functions.academic.identityMigration.createSchoolGroupInternal;
const createBranchMembershipInternal =
  internal.functions.academic.identityMigration.createBranchMembershipInternal;
const getActiveMembershipRef =
  api.functions.academic.auth.getActiveMembership;
const listUserBranchesRef = api.functions.academic.groups.listUserBranches;
const reconcileLegacyUserIdentity =
  internal.functions.academic.identityMigration.reconcileLegacyUserIdentity;

describe("Identity and Multi-Branch Tenancy Kernel (F2 / B-02)", () => {
  it("Positive: Single person with explicit memberships in two distinct branches successfully resolves active membership in both Branch A and Branch B", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, personId, membershipAId, membershipBId, userAId, userBId } =
      await t.run(async (ctx) => {
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

        const personId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
          email: "paula@olivecrest.test",
          name: "Paula Adebayo",
          status: "active",
          primarySchoolId: schoolA,
          createdAt: now,
          updatedAt: now,
        });

        const userAId = await ctx.db.insert("users", {
          schoolId: schoolA,
          authId: "auth-paula-ikoyi",
          authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
          personId,
          name: "Paula Adebayo",
          email: "paula@olivecrest.test",
          role: "admin",
          isSchoolAdmin: true,
          createdAt: now,
          updatedAt: now,
        });

        const userBId = await ctx.db.insert("users", {
          schoolId: schoolB,
          authId: "auth-paula-lekki",
          authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
          personId,
          name: "Paula Adebayo",
          email: "paula@olivecrest.test",
          role: "admin",
          isSchoolAdmin: true,
          createdAt: now,
          updatedAt: now,
        });

        const membershipAId = await ctx.db.insert("branchMemberships", {
          personId,
          schoolId: schoolA,
          status: "active",
          isDefaultBranch: true,
          legacyUserId: userAId,
          joinedAt: now,
          updatedAt: now,
        });

        const membershipBId = await ctx.db.insert("branchMemberships", {
          personId,
          schoolId: schoolB,
          status: "active",
          isDefaultBranch: false,
          legacyUserId: userBId,
          joinedAt: now,
          updatedAt: now,
        });

        return {
          schoolA,
          schoolB,
          personId,
          membershipAId,
          membershipBId,
          userAId,
          userBId,
        };
      });

    const paulaSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-paula",
      subject: "auth-paula-ikoyi",
      email: "paula@olivecrest.test",
    });

    // 1. Resolves Branch A active membership
    const contextA = await paulaSession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolA);
    });

    expect(contextA).toEqual({
      personId,
      membershipId: membershipAId,
      schoolId: schoolA,
      userId: userAId,
      role: "admin",
      isPlatformAdmin: false,
    });

    // Query wrapper also succeeds for Branch A
    const queryResultA = await paulaSession.query(getActiveMembershipRef, {
      schoolId: schoolA,
    });
    expect(queryResultA.membershipId).toBe(membershipAId);

    // 2. Resolves Branch B active membership
    const contextB = await paulaSession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolB);
    });

    expect(contextB).toEqual({
      personId,
      membershipId: membershipBId,
      schoolId: schoolB,
      userId: userBId,
      role: "admin",
      isPlatformAdmin: false,
    });

    // Query wrapper also succeeds for Branch B
    const queryResultB = await paulaSession.query(getActiveMembershipRef, {
      schoolId: schoolB,
    });
    expect(queryResultB.membershipId).toBe(membershipBId);
  });

  it("Negative: User with membership only in Branch A is rejected with 'Not authorized' when requesting Branch B context", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Branch Alpha",
        slug: "branch-alpha",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Branch Beta",
        slug: "branch-beta",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const personTina = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|teacher-tina",
        email: "tina@alpha.test",
        name: "Teacher Tina",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      const userTina = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "auth-tina",
        authTokenIdentifier: "https://auth.melo.test|teacher-tina",
        personId: personTina,
        name: "Teacher Tina",
        email: "tina@alpha.test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("branchMemberships", {
        personId: personTina,
        schoolId: schoolA,
        status: "active",
        isDefaultBranch: true,
        legacyUserId: userTina,
        joinedAt: now,
        updatedAt: now,
      });

      return { schoolA, schoolB };
    });

    const tinaSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|teacher-tina",
      subject: "auth-tina",
      email: "tina@alpha.test",
    });

    // Requesting own branch (School A) succeeds
    const contextA = await tinaSession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolA);
    });
    expect(contextA.schoolId).toBe(schoolA);

    // Requesting unauthorized branch (School B) fails with "Not authorized"
    await expect(
      tinaSession.run(async (ctx) => {
        return await resolveActiveMembership(ctx, schoolB);
      })
    ).rejects.toThrow("Not authorized");

    // Query wrapper also fails with "Not authorized"
    await expect(
      tinaSession.query(getActiveMembershipRef, { schoolId: schoolB })
    ).rejects.toThrow("Not authorized");
  });

  it("Negative: Linking School A and School B into a School Group does NOT automatically grant Branch A users access to Branch B without an explicit branchMemberships record", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, groupId } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Campus North",
        slug: "campus-north",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Campus South",
        slug: "campus-south",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const proprietorPerson = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|group-owner",
        email: "owner@melo-group.test",
        name: "Group Proprietor",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Create Umbrella School Group
      const groupId = await ctx.db.insert("schoolGroups", {
        name: "Melo Educational Trust",
        slug: "melo-trust",
        proprietorPersonId: proprietorPerson,
        status: "active",
        settingsVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      // Link both schools under the same School Group
      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: schoolA,
        isHeadquarters: true,
        linkedAt: now,
      });

      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: schoolB,
        isHeadquarters: false,
        linkedAt: now,
      });

      // Staff member Sam holds membership strictly in Campus North (School A)
      const personSam = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|staff-sam",
        email: "sam@north.test",
        name: "Staff Sam",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: now,
        updatedAt: now,
      });

      const userSam = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "auth-sam",
        authTokenIdentifier: "https://auth.melo.test|staff-sam",
        personId: personSam,
        name: "Staff Sam",
        email: "sam@north.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("branchMemberships", {
        personId: personSam,
        schoolId: schoolA,
        status: "active",
        isDefaultBranch: true,
        legacyUserId: userSam,
        joinedAt: now,
        updatedAt: now,
      });

      return { schoolA, schoolB, groupId };
    });

    // Verify both schools are linked to the group
    await t.run(async (ctx) => {
      const branches = await ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_group", (q) => q.eq("groupId", groupId))
        .collect();
      expect(branches.length).toBe(2);
    });

    const samSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|staff-sam",
      subject: "auth-sam",
      email: "sam@north.test",
    });

    // Access to School A succeeds
    const contextA = await samSession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolA);
    });
    expect(contextA.schoolId).toBe(schoolA);

    // Group membership does NOT grant implicit access to School B: access must be rejected!
    await expect(
      samSession.run(async (ctx) => {
        return await resolveActiveMembership(ctx, schoolB);
      })
    ).rejects.toThrow("Not authorized: User does not have an active membership in this branch");

    await expect(
      samSession.query(getActiveMembershipRef, { schoolId: schoolB })
    ).rejects.toThrow("Not authorized");
  });

  it("Dual-read compatibility: Legacy user without person row is successfully resolved via fallback", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, legacyUser } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Legacy Academy",
        slug: "legacy-academy",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Other Academy",
        slug: "other-academy",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Legacy user in users table only, without personId or branchMemberships
      const legacyUser = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "auth-legacy-larry",
        authTokenIdentifier: "https://auth.melo.test|legacy-larry",
        name: "Larry Legacy",
        email: "larry@legacy.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });

      return { schoolA, schoolB, legacyUser };
    });

    // Confirm no persons or branchMemberships records exist yet
    await t.run(async (ctx) => {
      const persons = await ctx.db.query("persons").collect();
      const memberships = await ctx.db.query("branchMemberships").collect();
      expect(persons.length).toBe(0);
      expect(memberships.length).toBe(0);
    });

    const legacySession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|legacy-larry",
      subject: "auth-legacy-larry",
      email: "larry@legacy.test",
    });

    // Resolves successfully via dual-read fallback
    const resolved = await legacySession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolA);
    });

    expect(resolved).toEqual({
      personId: undefined,
      membershipId: undefined,
      schoolId: schoolA,
      userId: legacyUser,
      role: "admin",
      isPlatformAdmin: false,
    });

    // Query wrapper also resolves
    const queryResolved = await legacySession.query(getActiveMembershipRef, {
      schoolId: schoolA,
    });
    expect(queryResolved.userId).toBe(legacyUser);

    // Negative check on School B: legacy user has no membership in School B
    await expect(
      legacySession.run(async (ctx) => {
        return await resolveActiveMembership(ctx, schoolB);
      })
    ).rejects.toThrow("Not authorized");
  });

  it("Compatibility bridge fails closed without an explicitly configured trusted issuer", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const schoolId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Subject Bridge Academy", slug: "subject-bridge", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", {
        schoolId,
        authId: "legacy-subject-only",
        name: "Legacy Subject User",
        email: "legacy-subject@test",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });
    const sameSubjectFromOtherIssuer = t.withIdentity({
      tokenIdentifier: "https://other-issuer.test|new-token",
      subject: "legacy-subject-only",
      issuer: "https://other-issuer.test",
      email: "legacy-subject@test",
    });
    await expect(sameSubjectFromOtherIssuer.run(async (ctx) => resolveActiveMembership(ctx, schoolId))).rejects.toThrow("Not authorized");

    const attacker = t.withIdentity({ tokenIdentifier: "https://auth.melo.test|attacker", subject: "other-subject", issuer: "https://auth.melo.test", email: "legacy-subject@test" });
    await expect(attacker.run(async (ctx) => resolveActiveMembership(ctx, schoolId))).rejects.toThrow("Not authorized");
  });

  it("Negative: matching email or subject under a different token does not resolve or list a legacy account", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const schoolId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Identity Boundary Academy",
        slug: "identity-boundary",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("users", {
        schoolId,
        authId: "legacy-owner",
        authTokenIdentifier: "https://auth.melo.test|legacy-owner",
        name: "Legacy Owner",
        email: "shared@identity.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });

    const unrelatedIdentity = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|unrelated-user",
      subject: "legacy-owner",
      email: "shared@identity.test",
    });

    await expect(
      unrelatedIdentity.run(async (ctx) => resolveActiveMembership(ctx, schoolId))
    ).rejects.toThrow("Not authorized");
    await expect(unrelatedIdentity.query(listUserBranchesRef, {})).resolves.toEqual([]);
  });

  it("marks users without a stable token for reconciliation and restores access only after trusted reconciliation", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const { schoolId, userId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Reconciliation Academy", slug: "reconciliation", status: "active", createdAt: now, updatedAt: now });
      const userId = await ctx.db.insert("users", { schoolId, authId: "legacy-only", name: "Legacy Only", email: "legacy-only@test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
      return { schoolId, userId };
    });

    await t.mutation(backfillCanonicalIdentityBatch, { sliceId: "MX-01-reconciliation", batchSize: 10 });
    const unresolved = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      return user?.personId ? await ctx.db.get(user.personId) : null;
    });
    expect(unresolved?.authTokenIdentifier).toBeUndefined();
    expect(unresolved?.identityReconciliationState).toBe("reconciliation_required");
    const failedRun = await t.run(async (ctx) =>
      ctx.db.query("migrationRuns").withIndex("by_slice_and_status", (q) =>
        q.eq("sliceId", "MX-01-reconciliation").eq("status", "failed")
      ).unique()
    );
    expect(failedRun?.failedCount).toBe(1);
    const issue = await t.run(async (ctx) =>
      ctx.db.query("identityMigrationIssues").withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "open")
      ).unique()
    );
    expect(issue?.code).toBe("missing_canonical_token");

    await t.mutation(reconcileLegacyUserIdentity, {
      userId,
      authTokenIdentifier: "https://auth.melo.test|legacy-only",
    });
    const reconciledSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|legacy-only",
      subject: "different-subject",
    });
    await expect(
      reconciledSession.run(async (ctx) => resolveActiveMembership(ctx, schoolId))
    ).resolves.toMatchObject({ schoolId, role: "admin" });
    const resolvedIssue = await t.run(async (ctx) =>
      ctx.db.query("identityMigrationIssues").withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "resolved")
      ).unique()
    );
    expect(resolvedIssue?.code).toBe("missing_canonical_token");
  });

  it("rejects duplicate canonical tokens and records a failed migration instead of completing", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Duplicate Token Academy", slug: "duplicate-token", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("persons", { authTokenIdentifier: "https://auth.melo.test|duplicate", email: "one@test", name: "One", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("persons", { authTokenIdentifier: "https://auth.melo.test|duplicate", email: "two@test", name: "Two", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: "legacy-duplicate", authTokenIdentifier: "https://auth.melo.test|duplicate", name: "Duplicate", email: "duplicate@test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    });
    const result = await t.mutation(backfillCanonicalIdentityBatch, { sliceId: "MX-01-duplicate", batchSize: 10 });
    expect(result.isDone).toBe(true);
    expect(result.failedCount).toBe(1);
    const issue = await t.run(async (ctx) =>
      ctx.db.query("identityMigrationIssues").withIndex("by_slice_and_status", (q) =>
        q.eq("sliceId", "MX-01-duplicate").eq("status", "open")
      ).unique()
    );
    expect(issue?.code).toBe("duplicate_canonical_token");
    const completed = await t.run(async (ctx) =>
      ctx.db.query("migrationRuns").withIndex("by_slice_and_status", (q) =>
        q.eq("sliceId", "MX-01-duplicate").eq("status", "completed")
      ).take(1)
    );
    expect(completed).toHaveLength(0);
  });

  it("rejects a legacy/canonical token mismatch and records it for reconciliation", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const { schoolId, personId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Prelink Conflict Academy", slug: "prelink-conflict", status: "active", createdAt: now, updatedAt: now });
      const personId = await ctx.db.insert("persons", { authTokenIdentifier: "https://auth.melo.test|canonical", email: "canonical@test", name: "Canonical", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: "legacy-prelink", authTokenIdentifier: "https://auth.melo.test|different", personId, name: "Legacy", email: "legacy@test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
      return { schoolId, personId };
    });
    const result = await t.mutation(backfillCanonicalIdentityBatch, { sliceId: "MX-01-prelink", batchSize: 10 });
    expect(result.failedCount).toBe(1);
    const issue = await t.run(async (ctx) =>
      ctx.db.query("identityMigrationIssues").withIndex("by_slice_and_status", (q) =>
        q.eq("sliceId", "MX-01-prelink").eq("status", "open")
      ).unique()
    );
    expect(issue).toMatchObject({ schoolId, userId: expect.any(String), code: "mismatched_prelink" });
    const person = await t.run(async (ctx) => ctx.db.get(personId));
    expect(person?.authTokenIdentifier).toBe("https://auth.melo.test|canonical");
  });

  it("persists one resumable migration state and ignores caller cursors after the run starts", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Resumable Academy", slug: "resumable-academy", status: "active", createdAt: now, updatedAt: now });
      for (const suffix of ["one", "two"]) {
        await ctx.db.insert("users", { schoolId, authId: `legacy-${suffix}`, authTokenIdentifier: `https://auth.melo.test|${suffix}`, name: suffix, email: `${suffix}@test`, role: "teacher", createdAt: now, updatedAt: now });
      }
    });
    const first = await t.mutation(backfillCanonicalIdentityBatch, { sliceId: "MX-01-resume", batchSize: 1 });
    expect(first).toMatchObject({ isDone: false, processedCount: 1, failedCount: 0 });
    const persisted = await t.run(async (ctx) => ctx.db.query("migrationRuns").withIndex("by_slice_and_status", (q) => q.eq("sliceId", "MX-01-resume").eq("status", "in_progress")).unique());
    expect(persisted?.cursor).toBeTruthy();

    const resumed = await t.mutation(backfillCanonicalIdentityBatch, { sliceId: "MX-01-resume", cursor: null, batchSize: 1 });
    expect(resumed).toMatchObject({ isDone: true, processedCount: 2, failedCount: 0 });
    const runs = await t.run(async (ctx) => ctx.db.query("migrationRuns").withIndex("by_slice_and_batch", (q) => q.eq("sliceId", "MX-01-resume")).collect());
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "completed", processedCount: 2, failedCount: 0, cursor: null });
  });

  it("Migration batch idempotency: Running backfillCanonicalIdentityBatch twice yields identical results without creating duplicate persons or duplicate branchMemberships", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA, schoolB, user1, user2, user3 } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Branch A",
        slug: "branch-a",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const schoolB = await ctx.db.insert("schools", {
        name: "Branch B",
        slug: "branch-b",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // User 1 in School A (Alice)
      const user1 = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "auth-alice-a",
        authTokenIdentifier: "https://auth.melo.test|alice",
        name: "Alice Ade",
        email: "alice@melo.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now - 3000,
        updatedAt: now - 3000,
      });

      // User 2 in School B (Same human Alice in another school)
      const user2 = await ctx.db.insert("users", {
        schoolId: schoolB,
        authId: "auth-alice-b",
        authTokenIdentifier: "https://auth.melo.test|alice",
        name: "Alice Ade",
        email: "alice@melo.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now - 2000,
        updatedAt: now - 2000,
      });

      // User 3 in School A (Bob)
      const user3 = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "auth-bob",
        authTokenIdentifier: "https://auth.melo.test|bob",
        name: "Bob Bello",
        email: "bob@melo.test",
        role: "teacher",
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });

      return { schoolA, schoolB, user1, user2, user3 };
    });

    // Verify initial state: 0 persons, 0 memberships
    await t.run(async (ctx) => {
      expect((await ctx.db.query("persons").collect()).length).toBe(0);
      expect((await ctx.db.query("branchMemberships").collect()).length).toBe(0);
    });

    // --- EXECUTION 1: First Migration Run ---
    const run1 = await t.mutation(backfillCanonicalIdentityBatch, {
      sliceId: "MX-01-test",
      batchSize: 50,
    });

    expect(run1.processedCount).toBe(3);
    expect(run1.isDone).toBe(true);

    // Verify state after run 1:
    // - Exactly 2 persons (Alice deduplicated by the shared stable token, Bob is separate)
    // - Exactly 3 branch memberships (Alice has School A and School B, Bob has School A)
    const { alicePersonId, bobPersonId } = await t.run(async (ctx) => {
      const persons = await ctx.db.query("persons").collect();
      expect(persons.length).toBe(2);

      const alicePerson = persons.find((p) => p.authTokenIdentifier === "https://auth.melo.test|alice");
      const bobPerson = persons.find((p) => p.authTokenIdentifier === "https://auth.melo.test|bob");
      expect(alicePerson).toBeDefined();
      expect(bobPerson).toBeDefined();

      const memberships = await ctx.db.query("branchMemberships").collect();
      expect(memberships.length).toBe(3);

      const aliceMemberships = memberships.filter((m) => m.personId === alicePerson!._id);
      expect(aliceMemberships.length).toBe(2);
      expect(aliceMemberships.map((m) => m.schoolId)).toContain(schoolA);
      expect(aliceMemberships.map((m) => m.schoolId)).toContain(schoolB);

      const bobMemberships = memberships.filter((m) => m.personId === bobPerson!._id);
      expect(bobMemberships.length).toBe(1);
      expect(bobMemberships[0].schoolId).toBe(schoolA);

      // Verify user.personId links
      const u1 = await ctx.db.get(user1);
      const u2 = await ctx.db.get(user2);
      const u3 = await ctx.db.get(user3);
      expect(u1?.personId).toBe(alicePerson!._id);
      expect(u2?.personId).toBe(alicePerson!._id);
      expect(u3?.personId).toBe(bobPerson!._id);

      // Identity backfill links membership only; it does not synthesize RBAC roles.
      expect((await ctx.db.query("membershipRoleAssignments").collect())).toHaveLength(0);
      expect(u3?.role).toBe("teacher");
      expect(u3?.isSchoolAdmin).not.toBe(true);

      // Verify migrationRuns telemetry
      const runs = await ctx.db
        .query("migrationRuns")
        .withIndex("by_slice_and_status", (q) =>
          q.eq("sliceId", "MX-01-test").eq("status", "completed")
        )
        .collect();
      expect(runs.length).toBe(1);
      expect(runs[0].processedCount).toBe(3);

      return {
        alicePersonId: alicePerson!._id,
        bobPersonId: bobPerson!._id,
      };
    });

    // --- EXECUTION 2: Second Migration Run (Idempotency Assertion) ---
    const run2 = await t.mutation(backfillCanonicalIdentityBatch, {
      sliceId: "MX-01-test",
      batchSize: 50,
    });

    expect(run2.processedCount).toBe(3);
    expect(run2.isDone).toBe(true);

    // Verify state after run 2:
    // - Still exactly 2 persons (ZERO duplicates)
    // - Still exactly 3 branch memberships (ZERO duplicates)
    // - User personId links unchanged
    await t.run(async (ctx) => {
      const persons = await ctx.db.query("persons").collect();
      expect(persons.length).toBe(2);

      const memberships = await ctx.db.query("branchMemberships").collect();
      expect(memberships.length).toBe(3);

      const u1 = await ctx.db.get(user1);
      const u2 = await ctx.db.get(user2);
      const u3 = await ctx.db.get(user3);
      expect(u1?.personId).toBe(alicePersonId);
      expect(u2?.personId).toBe(alicePersonId);
      expect(u3?.personId).toBe(bobPersonId);
    });
  });

  it("Canonical resolver denies suspended schools, including platform admins without a recovery policy", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const schoolId = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Suspended Branch",
        slug: "suspended-branch",
        status: "suspended",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("platformAdmins", {
        authId: "suspended-super-admin",
        authTokenIdentifier: "https://auth.melo.test|suspended-super-admin",
        email: "super@platform.test",
        name: "Super Administrator",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });

    const superSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|suspended-super-admin",
      subject: "suspended-super-admin",
      email: "super@platform.test",
    });
    await expect(
      superSession.run(async (ctx) => resolveActiveMembership(ctx, schoolId))
    ).rejects.toThrow("currently suspended");
  });

  it("Platform Super Admin bypass: active super admin can resolve any school branch context", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolA } = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", {
        name: "Sovereign Branch",
        slug: "sovereign",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("platformAdmins", {
        authId: "super-admin-auth",
        authTokenIdentifier: "https://auth.melo.test|super-admin",
        email: "super@platform.test",
        name: "Super Administrator",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      return { schoolA };
    });

    const superSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|super-admin",
      subject: "super-admin-auth",
      email: "super@platform.test",
    });

    const resolved = await superSession.run(async (ctx) => {
      return await resolveActiveMembership(ctx, schoolA);
    });

    expect(resolved.isPlatformAdmin).toBe(true);
    expect(resolved.role).toBe("super_admin");
    expect(resolved.schoolId).toBe(schoolA);
  });
});
