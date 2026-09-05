import { convexTest } from "convex-test";
import "../studentEnrollment";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import {
  allocateNextAdmissionNumberHelper,
  proposeAdmissionNumberHelper,
  validatePattern,
  validateSequence,
} from "../admissionNumbers";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]),
  ).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Synthetic",
      slug: "synthetic",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2025/26",
      startDate: Date.UTC(2025, 8, 1),
      endDate: Date.UTC(2026, 7, 31),
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const policyId = await ctx.db.insert("admissionNumberPolicies", {
      schoolId,
      pattern: "{SCHOOL}-{YEAR}-{SEQ:4}",
      schoolCode: "SYN",
      campusCode: "MAIN",
      currentSequence: 1,
      resetFrequency: "continuous",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    const personId = await ctx.db.insert("persons", {
      name: "Owner",
      email: "owner@example.test",
      authTokenIdentifier: "test|owner",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const userId = await ctx.db.insert("users", {
      schoolId,
      personId,
      authId: "owner",
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    const membershipId = await ctx.db.insert("branchMemberships", {
      schoolId,
      personId,
      legacyUserId: userId,
      isDefaultBranch: true,
      status: "active",
      joinedAt: 1,
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Group",
      slug: "group",
      proprietorPersonId: personId,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      schoolId,
      groupId,
      isHeadquarters: true,
      linkedAt: 1,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "Primary 1",
      level: "Primary",
      gradeName: "Primary 1",
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      schoolId,
      sessionId,
      policyId,
      classId,
      membershipId,
      groupId,
      personId,
      userId,
    };
  });
  return { t, ...ids };
}
it("creates atomically, replays the same intent, preserves manual identifiers and requires explicit counter decisions", async () => {
  const { t, schoolId, policyId, classId } = await fixture();
  const viewer = t.withIdentity({
    subject: "owner",
    issuer: "test",
    tokenIdentifier: "test|owner",
  });
  const input = {
    firstName: "Synthetic",
    lastName: "Student",
    gender: "male",
    classId,
    admissionNumber: "",
    requestKey: "intent-one",
    numberingVersion: 1,
    numberingFormatVersion: "branch:1:0",
    numberingCounterKey: "default",
    numberingCounterVersion: 0,
  };
  const studentId = await viewer.mutation(
    api.functions.academic.studentEnrollment.createStudent,
    input,
  );
  expect(
    await viewer.mutation(
      api.functions.academic.studentEnrollment.createStudent,
      input,
    ),
  ).toBe(studentId);
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(2);
  expect(await t.run((ctx) => ctx.db.get(studentId))).toMatchObject({
    admissionNumber: "SYN-2025-0001",
    schoolId,
  });
  await expect(
    viewer.mutation(api.functions.academic.studentEnrollment.createStudent, {
      ...input,
      requestKey: "manual",
      admissionNumber: "HIST/009900",
    }),
  ).rejects.toThrow("reason");
  await viewer.mutation(
    api.functions.academic.studentEnrollment.createStudent,
    {
      ...input,
      requestKey: "manual",
      admissionNumber: "HIST/009900",
      overrideConfirmed: true,
      overrideReason: "Preserve supplied historical record",
    },
  );
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(2);
  await viewer.mutation(
    api.functions.academic.studentEnrollment.createStudent,
    {
      ...input,
      requestKey: "manual-advance",
      admissionNumber: "HIST/009901",
      overrideConfirmed: true,
      overrideReason: "Explicit reviewed counter advancement",
      advanceCounterTo: 20,
    },
  );
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(
    20,
  );
  await expect(
    t.mutation(api.functions.academic.studentEnrollment.createStudent, {
      ...input,
      admissionNumber: "DENIED",
    }),
  ).rejects.toThrow();
  const concurrent = await Promise.all(
    ["parallel-a", "parallel-b"].map((requestKey) =>
      viewer.mutation(api.functions.academic.studentEnrollment.createStudent, {
        ...input,
        requestKey,
      }),
    ),
  );
  expect(new Set(concurrent).size).toBe(2);
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(
    22,
  );
});
it("corrects an existing student only with reason and explicit version-pinned advancement", async () => {
  const { t, schoolId, classId, policyId } = await fixture();
  const viewer = t.withIdentity({
    subject: "owner",
    issuer: "test",
    tokenIdentifier: "test|owner",
  });
  const studentId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      schoolId,
      authId: "existing",
      name: "Existing Student",
      email: "existing@example.test",
      role: "student",
      createdAt: 1,
      updatedAt: 1,
    });
    return await ctx.db.insert("students", {
      schoolId,
      classId,
      userId,
      admissionNumber: "OLD-001",
      gender: "Female",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  await expect(
    viewer.mutation(api.functions.academic.studentEnrollment.updateStudent, {
      studentId,
      admissionNumber: "CORRECT-001",
    }),
  ).rejects.toThrow("reason");
  await viewer.mutation(
    api.functions.academic.studentEnrollment.updateStudent,
    {
      studentId,
      admissionNumber: "CORRECT-001",
      overrideConfirmed: true,
      overrideReason: "Registrar reviewed source register",
    },
  );
  expect(await t.run((ctx) => ctx.db.get(studentId))).toMatchObject({
    admissionNumber: "CORRECT-001",
  });
  const claims = await t.run((ctx) =>
    ctx.db
      .query("admissionNumberClaims")
      .withIndex("by_school_number", (q) => q.eq("schoolId", schoolId))
      .collect(),
  );
  expect(claims.map((item) => item.number).sort()).toEqual([
    "CORRECT-001",
    "OLD-001",
  ]);
  await viewer.mutation(
    api.functions.academic.studentEnrollment.updateStudent,
    {
      studentId,
      admissionNumber: "CORRECT-002",
      overrideConfirmed: true,
      overrideReason: "Registrar reviewed corrected archive",
      advanceCounterTo: 20,
      numberingVersion: 1,
      numberingFormatVersion: "branch:1:0",
      numberingCounterKey: "default",
      numberingCounterVersion: 0,
    },
  );
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(
    20,
  );
  await expect(
    viewer.mutation(api.functions.academic.studentEnrollment.updateStudent, {
      studentId,
      admissionNumber: "CORRECT-003",
      overrideConfirmed: true,
      overrideReason: "Registrar retried stale correction",
      advanceCounterTo: 30,
      numberingVersion: 1,
      numberingFormatVersion: "branch:1:0",
      numberingCounterKey: "default",
      numberingCounterVersion: 99,
    }),
  ).rejects.toThrow("changed");
  expect(await t.run((ctx) => ctx.db.get(studentId))).toMatchObject({
    admissionNumber: "CORRECT-002",
  });
});

it("does not infer manual override permission from the legacy admin title", async () => {
  const { t, schoolId, classId } = await fixture();
  await t.run(async (ctx) => {
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .unique();
    if (link) await ctx.db.delete(link._id);
  });
  const viewer = t.withIdentity({
    subject: "owner",
    issuer: "test",
    tokenIdentifier: "test|owner",
  });
  await expect(
    viewer.mutation(api.functions.academic.studentEnrollment.createStudent, {
      firstName: "Synthetic",
      lastName: "Student",
      gender: "male",
      classId,
      admissionNumber: "OLD/001",
      overrideConfirmed: true,
      overrideReason: "Preserve a historical identifier",
    }),
  ).rejects.toThrow("override_number");
});
it("conflicts on policy versions and rejects counter rewinds; calendar reset keeps YEAR academic", async () => {
  const { t, schoolId, policyId } = await fixture();
  const viewer = t.withIdentity({
    subject: "owner",
    issuer: "test",
    tokenIdentifier: "test|owner",
  });
  const change = {
    schoolId,
    pattern: "{SCHOOL}/{YEAR}/{SEQ:5}",
    schoolCode: "SYN",
    campusCode: "MAIN",
    expectedVersion: 1,
    confirmedNextSequence: 10,
    currentSequence: 10,
    expectedCounterVersion: 0,
  };
  await viewer.mutation(
    api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
    change,
  );
  await expect(
    viewer.mutation(
      api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
      change,
    ),
  ).rejects.toThrow("changed");
  await expect(
    viewer.mutation(
      api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
      {
        ...change,
        expectedVersion: 2,
        expectedCounterVersion: 1,
        confirmedNextSequence: 1,
        currentSequence: 1,
      },
    ),
  ).rejects.toThrow("backwards");
  await t.run((ctx) =>
    ctx.db.patch(policyId, {
      resetFrequency: "calendar",
      resetPeriod: "2000",
      currentSequence: 99,
    }),
  );
  expect(
    (
      await t.mutation(
        internal.functions.academic.admissionNumbers
          .allocateNextAdmissionNumber,
        { schoolId },
      )
    ).allocatedNumber,
  ).toBe("SYN/2025/00001");
});
it("configures named level and branch sequences with status and independent concurrent allocation", async () => {
  const { t, schoolId, policyId } = await fixture();
  const viewer = t.withIdentity({
    subject: "owner",
    issuer: "test",
    tokenIdentifier: "test|owner",
  });
  await viewer.mutation(
    api.functions.academic.admissionNumbers.configureAdmissionNumberSequence,
    {
      schoolId,
      key: "primary",
      name: "Primary intake",
      level: "Primary",
      currentSequence: 100,
      confirmedNextSequence: 100,
      resetFrequency: "continuous",
      status: "active",
      expectedConfigVersion: 0,
    },
  );
  const policy = await viewer.query(
    api.functions.academic.admissionNumbers.getAdmissionNumberPolicy,
    { schoolId, level: "PRIMARY" },
  );
  expect(policy.counter).toMatchObject({
    key: "primary",
    level: "primary",
    status: "active",
    configVersion: 1,
  });
  const results = await Promise.all(
    [1, 2].map(() =>
      t.mutation(
        internal.functions.academic.admissionNumbers
          .allocateNextAdmissionNumber,
        { schoolId, level: "Primary" },
      ),
    ),
  );
  expect(results.map((item) => item.allocatedNumber).sort()).toEqual([
    "SYN-2025-0100",
    "SYN-2025-0101",
  ]);
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(1);
  await viewer.mutation(
    api.functions.academic.admissionNumbers.configureAdmissionNumberSequence,
    {
      schoolId,
      key: "primary",
      name: "Primary intake",
      level: "Primary",
      currentSequence: 102,
      confirmedNextSequence: 102,
      resetFrequency: "continuous",
      status: "paused",
      expectedConfigVersion: 1,
    },
  );
  await expect(
    t.mutation(
      internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
      { schoolId, level: "Primary" },
    ),
  ).rejects.toThrow("paused");
  await expect(
    viewer.mutation(
      api.functions.academic.admissionNumbers.configureAdmissionNumberSequence,
      {
        schoolId,
        key: "primary",
        name: "Stale",
        level: "Primary",
        currentSequence: 102,
        confirmedNextSequence: 102,
        resetFrequency: "continuous",
        status: "active",
        expectedConfigVersion: 1,
      },
    ),
  ).rejects.toThrow("changed");
  await viewer.mutation(
    api.functions.academic.admissionNumbers.configureAdmissionNumberSequence,
    {
      schoolId,
      key: "branch-2026",
      name: "Branch 2026",
      currentSequence: 500,
      confirmedNextSequence: 500,
      resetFrequency: "session",
      status: "active",
      expectedConfigVersion: 0,
    },
  );
  await viewer.mutation(
    api.functions.academic.admissionNumbers.setDefaultAdmissionNumberSequence,
    { schoolId, key: "branch-2026", expectedPolicyVersion: 1 },
  );
  expect(
    (
      await viewer.query(
        api.functions.academic.admissionNumbers.getAdmissionNumberPolicy,
        { schoolId },
      )
    ).counter?.key,
  ).toBe("branch-2026");
  await expect(
    viewer.mutation(
      api.functions.academic.admissionNumbers.archiveAdmissionNumberSequence,
      { schoolId, key: "branch-2026", expectedConfigVersion: 1 },
    ),
  ).rejects.toThrow("another default");
});

it("inherits only an explicitly adopted group format while counters stay branch-owned", async () => {
  const { t, schoolId, groupId, personId } = await fixture();
  const viewer = t.withIdentity({
    subject: "owner",
    issuer: "test",
    tokenIdentifier: "test|owner",
  });
  const branch = await t.run(async (ctx) => {
    const branchId = await ctx.db.insert("schools", {
      name: "Branch",
      slug: "branch",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const userId = await ctx.db.insert("users", {
      schoolId: branchId,
      personId,
      authId: "owner-branch",
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("branchMemberships", {
      schoolId: branchId,
      personId,
      legacyUserId: userId,
      isDefaultBranch: false,
      status: "active",
      joinedAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      schoolId: branchId,
      groupId,
      isHeadquarters: false,
      linkedAt: 1,
    });
    await ctx.db.insert("academicSessions", {
      schoolId: branchId,
      name: "2025/26",
      startDate: Date.UTC(2025, 8, 1),
      endDate: Date.UTC(2026, 7, 31),
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const policyId = await ctx.db.insert("admissionNumberPolicies", {
      schoolId: branchId,
      pattern: "LOCAL/{SEQ:4}",
      schoolCode: "BRN",
      campusCode: "EAST",
      currentSequence: 40,
      resetFrequency: "continuous",
      version: 1,
      createdAt: 1,
      updatedAt: 1,
    });
    return { branchId, policyId };
  });
  await viewer.mutation(
    api.functions.academic.admissionNumbers.publishGroupAdmissionNumberFormat,
    {
      schoolId,
      groupId,
      expectedGroupVersion: 0,
      allowBranchOverride: true,
      confirmation: "group",
    },
  );
  expect(
    (
      await t.run((ctx) =>
        proposeAdmissionNumberHelper(ctx, { schoolId: branch.branchId }),
      )
    ).allocatedNumber,
  ).toBe("LOCAL/0040");
  await viewer.mutation(
    api.functions.academic.admissionNumbers.setAdmissionNumberFormatInheritance,
    {
      schoolId: branch.branchId,
      groupId,
      mode: "inherit",
      expectedGroupVersion: 1,
      expectedRevision: 0,
      confirmation: "branch",
    },
  );
  const inherited = await t.run((ctx) =>
    proposeAdmissionNumberHelper(ctx, { schoolId: branch.branchId }),
  );
  expect(inherited.allocatedNumber).toBe("BRN-2025-0040");
  expect(inherited.formatVersion).toContain("group:");
  await t.mutation(
    internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
    { schoolId: branch.branchId },
  );
  expect(
    (await t.run((ctx) => ctx.db.get(branch.policyId)))?.currentSequence,
  ).toBe(41);
  const source = await t.run((ctx) =>
    proposeAdmissionNumberHelper(ctx, { schoolId }),
  );
  expect(source.sequenceNumber).toBe(1);
});

it("rejects malformed tokens, excessive padding and fractional or unbounded sequences", () => {
  for (const pattern of [
    "{SEQ:0}",
    "{SEQ:100}",
    "{SEQ:4}{SEQ:4}",
    "{BAD}-{SEQ:4}",
    "{{SEQ:4}",
  ])
    expect(() => validatePattern(pattern)).toThrow();
  for (const n of [0, -1, 1.5, Infinity, 1e12])
    expect(() => validateSequence(n)).toThrow();
});
it("denies unscoped policy reads and leaves previews/abandoned forms nonmutating", async () => {
  const { t, schoolId, policyId } = await fixture();
  await expect(
    t.query(api.functions.academic.admissionNumbers.getAdmissionNumberPolicy, {
      schoolId,
    }),
  ).rejects.toThrow();
  const proposal = await t.run((ctx) =>
    proposeAdmissionNumberHelper(ctx, { schoolId }),
  );
  expect(proposal.allocatedNumber).toBe("SYN-2025-0001");
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(1);
});
it("allocates concurrent transactions uniquely and rolls back a failed transaction", async () => {
  const { t, schoolId, policyId } = await fixture();
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      t.mutation(
        internal.functions.academic.admissionNumbers
          .allocateNextAdmissionNumber,
        { schoolId },
      ),
    ),
  );
  expect(new Set(results.map((r) => r.allocatedNumber)).size).toBe(3);
  await expect(
    t.run(async (ctx) => {
      await allocateNextAdmissionNumberHelper(ctx, { schoolId });
      throw new Error("failed enrollment");
    }),
  ).rejects.toThrow("failed enrollment");
  expect((await t.run((ctx) => ctx.db.get(policyId)))?.currentSequence).toBe(4);
});
it("never reuses a claimed number after reset or format change and rejects stale versions", async () => {
  const { t, schoolId, policyId } = await fixture();
  await t.mutation(
    internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
    { schoolId },
  );
  await expect(
    t.run((ctx) =>
      allocateNextAdmissionNumberHelper(ctx, { schoolId, expectedVersion: 0 }),
    ),
  ).rejects.toThrow("changed");
  await t.run((ctx) =>
    ctx.db.patch(policyId, { currentSequence: 1, version: 2 }),
  );
  await expect(
    t.mutation(
      internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
      { schoolId },
    ),
  ).rejects.toThrow("never reused");
});
it("applies session reset using academic start year without guessing legacy advancement", async () => {
  const { t, schoolId, policyId, sessionId } = await fixture();
  await t.run((ctx) =>
    ctx.db.patch(policyId, { currentSequence: 12, resetFrequency: "session" }),
  );
  expect(
    (
      await t.mutation(
        internal.functions.academic.admissionNumbers
          .allocateNextAdmissionNumber,
        { schoolId },
      )
    ).sequenceNumber,
  ).toBe(12);
  await t.run(async (ctx) => {
    await ctx.db.patch(sessionId, { isActive: false });
    await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026/27",
      startDate: Date.UTC(2026, 8, 1),
      endDate: Date.UTC(2027, 7, 31),
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
  });
  expect(
    (
      await t.mutation(
        internal.functions.academic.admissionNumbers
          .allocateNextAdmissionNumber,
        { schoolId },
      )
    ).allocatedNumber,
  ).toBe("SYN-2026-0001");
});
