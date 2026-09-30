import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { TENANT_SCHOOL_TABLES } from "../tenantPurgeManifest";
import { TENANT_STORAGE_TABLES } from "../tenantPurgeAction";
import { ADMISSIONS_GUARDIAN_REFERENCE_TABLES, ALL_DUPLICATION_TABLES, SCHOOL_PURGE_TABLES } from "../branchSplitV2";
import { DEMO_SCHOOL_TABLES } from "../seed";

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
const cascadeClass = makeFunctionReference<"mutation">("functions/academic/branchSplitV2:cascadeDeleteWrongBranchData");

it("registers admissions and administrator-email records in tenant lifecycle boundaries", () => {
  expect(TENANT_SCHOOL_TABLES).toEqual(expect.arrayContaining(["admissionsDocumentUploadIntents", "admissionsDocumentAccessGrants", "admissionsRetentionPolicies", "schoolAdminEmailUpdateReservations"]));
  expect(SCHOOL_PURGE_TABLES).toEqual(expect.arrayContaining(["admissionsDocumentUploadIntents", "admissionsDocumentAccessGrants", "admissionsRetentionPolicies", "schoolAdminEmailUpdateReservations", "schoolEnrollmentCounts"]));
  expect(ADMISSIONS_GUARDIAN_REFERENCE_TABLES).toContain("admissionsDocumentAccessGrants");
  expect(TENANT_STORAGE_TABLES).toContain("admissionsDocumentUploadIntents");
  const narrativeTables = ["classSessionReportModes", "narrativeReportDrafts", "issuedNarrativeReports"];
  for (const table of narrativeTables) {
    expect(TENANT_SCHOOL_TABLES).toContain(table);
    expect(SCHOOL_PURGE_TABLES).toContain(table);
    expect(DEMO_SCHOOL_TABLES).toContain(table);
  }
  expect(ALL_DUPLICATION_TABLES).toContain("classSessionReportModes");
  expect(ALL_DUPLICATION_TABLES).not.toContain("narrativeReportDrafts");
  expect(ALL_DUPLICATION_TABLES).not.toContain("issuedNarrativeReports");
});

it("drains over 100 narrative drafts before deleting a wrong-branch class", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const ruga = await ctx.db.insert("schools", { name: "Ruga", slug: "obhis-ruga", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("schools", { name: "Fedrah", slug: "obhis-fedrah", status: "active", createdAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId: ruga, name: "Wrong branch", level: "Y1", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId: ruga, name: "2025", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId: ruga, sessionId, name: "First", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const actorId = await ctx.db.insert("users", { schoolId: ruga, authId: "ruga-actor", email: "ruga-actor@test.invalid", name: "Actor", role: "admin", createdAt: 1, updatedAt: 1 });
    const subjectId = await ctx.db.insert("subjects", { schoolId: ruga, name: "Art", code: "ART", createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId: ruga, classId, userId: actorId, admissionNumber: "001", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("classSessionReportModes", { schoolId: ruga, classId, sessionId, mode: "narrative", updatedAt: 1, updatedBy: actorId });
    return { ruga, classId, sessionId, termId, actorId, subjectId, studentId };
  });
  for (let batch = 0; batch < 2; batch++) await t.run(async ctx => {
    for (let i = 0; i < 55; i++) await ctx.db.insert("narrativeReportDrafts", { schoolId: ids.ruga,
      classId: ids.classId, studentId: ids.studentId, sessionId: ids.sessionId, termId: ids.termId,
      subjectId: ids.subjectId, comment: `draft-${batch}-${i}`, updatedAt: 1, updatedBy: ids.actorId });
  });
  const first = await t.mutation(cascadeClass, { target: "ruga" }) as { done: boolean };
  expect(first.done).toBe(false);
  expect(await t.run(ctx => ctx.db.get(ids.classId))).not.toBeNull();
  let done = false;
  for (let retry = 0; retry < 10 && !done; retry++) {
    const result = await t.mutation(cascadeClass, { target: "ruga" }) as { done: boolean };
    done = result.done;
  }
  expect(done).toBe(true);
  expect(await t.run(ctx => ctx.db.get(ids.classId))).toBeNull();
  expect(await t.run(ctx => ctx.db.query("narrativeReportDrafts").withIndex("by_school", q => q.eq("schoolId", ids.ruga)).take(1))).toEqual([]);
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
    const narrativeIds = [];
    for (const schoolId of [target, retained]) {
      const classId = await ctx.db.insert("classes", { schoolId, name: "Narrative", level: "Y2", createdAt: 1, updatedAt: 1 });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
      const actorId = await ctx.db.insert("users", { schoolId, authId: `actor-${schoolId}`, name: "Actor", email: `actor-${schoolId}@test.invalid`, role: "admin", createdAt: 1, updatedAt: 1 });
      const studentId = await ctx.db.insert("students", { schoolId, classId, userId: actorId, admissionNumber: `ST-${schoolId}`, createdAt: 1, updatedAt: 1 });
      const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Music", code: "MUS", createdAt: 1, updatedAt: 1 });
      const modeId = await ctx.db.insert("classSessionReportModes", { schoolId, classId, sessionId, mode: "narrative", updatedAt: 1, updatedBy: actorId });
      const draftId = await ctx.db.insert("narrativeReportDrafts", { schoolId, classId, studentId, sessionId, termId, subjectId, comment: "Draft", updatedAt: 1, updatedBy: actorId });
      const issuedId = await ctx.db.insert("issuedNarrativeReports", { schoolId, classId, studentId, sessionId, termId, issuedAt: 1, issuedBy: actorId,
        snapshot: { schoolName: "School", studentName: "Student", admissionNumber: "001", className: "Y2", sessionName: "2025", termName: "First",
          subjects: [{ subjectId, name: "Music", order: 0, comment: "Issued" }] } });
      narrativeIds.push({ modeId, draftId, issuedId });
    }
    return {
      target,
      retained,
      narrativeIds,
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
    narrative: await Promise.all(fixture.narrativeIds.map(async ids => ({
      mode: await ctx.db.get(ids.modeId), draft: await ctx.db.get(ids.draftId), issued: await ctx.db.get(ids.issuedId),
    }))),
  }));
  expect(state.target).toBeNull();
  expect(state.retained).not.toBeNull();
  expect(state.retainedClasses).toHaveLength(2);
  expect(state.narrative[0]).toEqual({ mode: null, draft: null, issued: null });
  expect(state.narrative[1].mode).not.toBeNull();
  expect(state.narrative[1].draft).not.toBeNull();
  expect(state.narrative[1].issued).not.toBeNull();
  expect(state.membership).toBeNull();
  expect(state.reservation).toBeNull();
  expect(state.grant).toBeNull();
  expect(state.targetFingerprint).toBeNull();
  expect(state.retainedFingerprint).not.toBeNull();
});
