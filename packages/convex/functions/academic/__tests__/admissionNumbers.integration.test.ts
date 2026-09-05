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
    return { schoolId, sessionId, policyId, classId, membershipId };
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
