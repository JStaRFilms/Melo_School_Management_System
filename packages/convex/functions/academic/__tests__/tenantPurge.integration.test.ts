import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { TENANT_SCHOOL_TABLES } from "../tenantPurgeManifest";
import { TENANT_STORAGE_TABLES } from "../tenantPurgeAction";
import { ADMISSIONS_GUARDIAN_REFERENCE_TABLES, SCHOOL_PURGE_TABLES } from "../branchSplitV2";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);

const purgeBatch = makeFunctionReference<"mutation">(
  "functions/academic/tenantPurge:purgeTenantBatchInternal",
);

it("refuses to split or purge a school with an invalid locked scoring scan", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Source", slug: "olive-blessed", status: "active", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Session", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const updatedBy = await ctx.db.insert("users", { schoolId, authId: "admin", name: "Admin", email: "admin@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 });
    const policy = { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 };
    await ctx.db.insert("sessionScoringRegradeJobs", { schoolId, sessionId, phase: "invalid", policy, before: policy,
      expectedVersion: 0, scanned: 1, batchSize: 40, invalidCount: 1, invalidExamples: [], updated: 0,
      startedAt: 1, updatedAt: 1, updatedBy });
    return schoolId;
  });
  const split = makeFunctionReference<"mutation">("functions/academic/branchSplitV2:initBranchSplit");
  await expect(t.mutation(split, {})).rejects.toThrow(/Finish or cancel the session scoring job/);
  await expect(t.mutation(purgeBatch, { schoolId, schoolSlug: "olive-blessed" }))
    .rejects.toThrow(/Complete or cancel the session scoring job/);
  expect(await t.run(ctx => ctx.db.get(schoolId))).toMatchObject({ status: "active" });
});

it("registers admissions and administrator-email records in tenant lifecycle boundaries", () => {
  expect(TENANT_SCHOOL_TABLES).toEqual(expect.arrayContaining(["admissionsDocumentUploadIntents", "admissionsDocumentAccessGrants", "admissionsRetentionPolicies", "schoolAdminEmailUpdateReservations"]));
  expect(SCHOOL_PURGE_TABLES).toEqual(expect.arrayContaining(["admissionsDocumentUploadIntents", "admissionsDocumentAccessGrants", "admissionsRetentionPolicies", "schoolAdminEmailUpdateReservations", "schoolEnrollmentCounts"]));
  expect(ADMISSIONS_GUARDIAN_REFERENCE_TABLES).toContain("admissionsDocumentAccessGrants");
  expect(TENANT_STORAGE_TABLES).toContain("admissionsDocumentUploadIntents");
});

it("purges only the exact development tenant in bounded dependency order", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const target = await ctx.db.insert("schools", {
      name: "Disposable School",
      slug: "disposable-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const retained = await ctx.db.insert("schools", {
      name: "Retained School",
      slug: "retained-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classes", {
      schoolId: target,
      name: "Target class",
      level: "Y1",
      createdAt: 1,
      updatedAt: 1,
    });
    const personId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|disposable-admin",
      email: "disposable-admin@test.invalid",
      name: "Disposable Admin",
      status: "active",
      primarySchoolId: target,
      createdAt: 1,
      updatedAt: 1,
    });
    const userId = await ctx.db.insert("users", {
      schoolId: target,
      authId: "disposable-admin",
      authTokenIdentifier: "test|disposable-admin",
      personId,
      email: "disposable-admin@test.invalid",
      name: "Disposable Admin",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    const reservationId = await ctx.db.insert("schoolAdminEmailUpdateReservations", {
      schoolId: target,
      userId,
      authId: "disposable-admin",
      expectedEmail: "disposable-admin@test.invalid",
      newEmail: "updated-admin@test.invalid",
      actorEmail: "platform-admin@test.invalid",
      status: "reserved",
      createdAt: 1,
      updatedAt: 1,
    });
    const membershipId = await ctx.db.insert("branchMemberships", {
      personId,
      schoolId: target,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: userId,
      joinedAt: 1,
      updatedAt: 1,
    });
    const grantId = await ctx.db.insert("membershipDirectGrants", {
      membershipId,
      capability: "school.settings.manage",
      grantedAt: 1,
    });
    await ctx.db.insert("classes", {
      schoolId: retained,
      name: "Retained class",
      level: "Y1",
      createdAt: 1,
      updatedAt: 1,
    });
    const targetFingerprintId = await ctx.db.insert("knowledgeMaterialFileFingerprints", {
      schoolId: target,
      sha256: "a".repeat(64),
      status: "reserved",
      createdAt: 1,
      updatedAt: 1,
    });
    const retainedFingerprintId = await ctx.db.insert("knowledgeMaterialFileFingerprints", {
      schoolId: retained,
      sha256: "b".repeat(64),
      status: "reserved",
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      target,
      retained,
      membershipId,
      reservationId,
      grantId,
      targetFingerprintId,
      retainedFingerprintId,
    };
  });

  await expect(t.mutation(purgeBatch, {
    schoolId: fixture.target,
    schoolSlug: "wrong-school",
  })).rejects.toThrow("exact slug");

  let complete = false;
  for (let batch = 0; batch < 20 && !complete; batch += 1) {
    const result = await t.mutation(purgeBatch, {
      schoolId: fixture.target,
      schoolSlug: "disposable-school",
    }) as { complete: boolean };
    complete = result.complete;
  }
  expect(complete).toBe(true);
  const state = await t.run(async (ctx) => ({
    target: await ctx.db.get(fixture.target),
    retained: await ctx.db.get(fixture.retained),
    retainedClasses: await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", fixture.retained)).take(10),
    membership: await ctx.db.get(fixture.membershipId),
    reservation: await ctx.db.get(fixture.reservationId),
    grant: await ctx.db.get(fixture.grantId),
    targetFingerprint: await ctx.db.get(fixture.targetFingerprintId),
    retainedFingerprint: await ctx.db.get(fixture.retainedFingerprintId),
  }));
  expect(state.target).toBeNull();
  expect(state.retained).not.toBeNull();
  expect(state.retainedClasses).toHaveLength(1);
  expect(state.membership).toBeNull();
  expect(state.reservation).toBeNull();
  expect(state.grant).toBeNull();
  expect(state.targetFingerprint).toBeNull();
  expect(state.retainedFingerprint).not.toBeNull();
});
