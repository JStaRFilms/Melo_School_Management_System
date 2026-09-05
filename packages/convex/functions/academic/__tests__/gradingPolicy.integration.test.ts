import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { validateContiguousScoreRanges } from "../gradingBands";
import {
  FACTORY_DEFAULT_GRADING_BANDS,
  reportCardReviewKey,
} from "@school/shared/exam-recording";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]),
  ).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const endpoints = api.functions.academic.gradingBands;
const bands = FACTORY_DEFAULT_GRADING_BANDS.map(
  ({ gradeLetter, minScore, maxScore, remark, colorHex, gradePoints }) => ({
    gradeLetter,
    minScore,
    maxScore,
    remark,
    colorHex,
    gradePoints,
  }),
);
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "School",
      slug: "school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherId = await ctx.db.insert("schools", {
      name: "Other",
      slug: "other",
      status: "active",
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
      groupId,
      schoolId,
      isHeadquarters: true,
      linkedAt: 1,
    });
    return { schoolId, otherId, groupId, membershipId, userId };
  });
  return {
    t,
    viewer: t.withIdentity({
      subject: "owner",
      issuer: "test",
      tokenIdentifier: "test|owner",
    }),
    ...ids,
  };
}
it("uses one six-band preset and rejects gaps, overlap, duplicate labels and fractional ranges", () => {
  expect(bands.map((b) => b.gradeLetter)).toEqual([
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
  ]);
  expect(() => validateContiguousScoreRanges(bands)).not.toThrow();
  for (const change of [
    { minScore: 76 },
    { minScore: 74 },
    { minScore: 75.5 },
    { gradeLetter: "B" },
  ])
    expect(() =>
      validateContiguousScoreRanges(
        bands.map((b, i) => (i === 0 ? { ...b, ...change } : b)),
      ),
    ).toThrow();
});
it("persists light hue through both adapters, preserves omitted colors and enforces version and scope", async () => {
  const { t, viewer, schoolId, otherId, membershipId } = await fixture();
  await expect(
    t.query(endpoints.getGradingBands, { schoolId }),
  ).rejects.toThrow();
  await expect(
    viewer.query(endpoints.getGradingBands, { schoolId: otherId }),
  ).rejects.toThrow();
  const candidate = bands.map((b, i) =>
    i === 0 ? { ...b, colorHex: "#ffffaa" } : b,
  );
  await viewer.mutation(endpoints.saveGradingBands, {
    schoolId,
    bands: candidate,
    expectedVersion: 0,
  });
  expect(
    await viewer.query(endpoints.getActiveGradingBands, { schoolId }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        gradeLetter: "A",
        colorHex: "#ffffaa",
        version: 1,
      }),
    ]),
  );
  await expect(
    viewer.mutation(endpoints.updateGradingBands, {
      schoolId,
      bands,
      expectedVersion: 0,
    }),
  ).rejects.toThrow("Policy changed");
  await expect(
    viewer.mutation(endpoints.saveGradingBands, {
      schoolId,
      bands: [
        {
          minScore: 0,
          maxScore: 100,
          gradeLetter: "X",
          remark: "Pass",
          colorHex: "#ggffff",
        },
      ],
    }),
  ).rejects.toThrow("hex");
  await viewer.mutation(endpoints.updateGradingBands, {
    schoolId,
    bands: candidate.map(({ colorHex: _color, ...b }) => b),
    expectedVersion: 1,
  });
  expect(await viewer.query(endpoints.getGradingBands, { schoolId })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ colorHex: "#ffffaa", version: 2 }),
    ]),
  );
  await t.run((ctx) => ctx.db.patch(membershipId, { status: "archived" }));
  await expect(
    viewer.mutation(endpoints.saveGradingBands, { schoolId, bands }),
  ).rejects.toThrow();
});
it("only explicitly inherits immutable group versions and rejects forbidden overrides", async () => {
  const { t, viewer, schoolId, groupId } = await fixture();
  await viewer.mutation(endpoints.saveGradingBands, { schoolId, bands });
  await viewer.mutation(endpoints.publishGroupGradingDefault, {
    schoolId,
    groupId,
    allowBranchOverride: true,
    confirmation: "group",
  });
  await viewer.mutation(endpoints.saveGradingBands, {
    schoolId,
    bands: bands.map((b) => ({ ...b, colorHex: "#abcdef" })),
  });
  expect(
    (await viewer.query(endpoints.getActiveGradingBands, { schoolId }))[0]
      .version,
  ).toBe(2);
  await viewer.mutation(endpoints.setGradingInheritance, {
    schoolId,
    mode: "inherit",
  });
  expect(
    (await viewer.query(endpoints.getActiveGradingBands, { schoolId }))[0]
      .version,
  ).toBe(1);
  await expect(
    viewer.mutation(endpoints.saveGradingBands, { schoolId, bands }),
  ).rejects.toThrow("override");
  await viewer.mutation(endpoints.setGradingInheritance, {
    schoolId,
    mode: "override",
  });
  expect(
    (await viewer.query(endpoints.getActiveGradingBands, { schoolId }))[0]
      .version,
  ).toBe(2);
  await t.run((ctx) =>
    ctx.db.patch(groupId, {
      gradingDefault: { schoolId, version: 1, allowBranchOverride: false },
    }),
  );
  await expect(
    viewer.mutation(endpoints.saveGradingBands, { schoolId, bands }),
  ).rejects.toThrow("disabled");
  expect(
    (await viewer.query(endpoints.getActiveGradingBands, { schoolId }))[0]
      .version,
  ).toBe(1);
});

it("preserves certified outputs after policy and score edits; old reports never use today's thresholds", async () => {
  const { t, viewer, schoolId, userId } = await fixture();
  await viewer.mutation(endpoints.saveGradingBands, { schoolId, bands });
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "Primary 1",
      level: "Primary",
      createdAt: 1,
      updatedAt: 1,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "Current",
      startDate: now - 10000,
      endDate: now + 100000,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First Term",
      startDate: now - 10000,
      endDate: now + 100000,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const subjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "Mathematics",
      code: "MTH",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classSubjects", {
      schoolId,
      classId,
      subjectId,
      createdAt: 1,
      updatedAt: 1,
    });
    const studentUser = await ctx.db.insert("users", {
      schoolId,
      authId: "student",
      name: "Student",
      email: "student@example.test",
      role: "student",
      createdAt: 1,
      updatedAt: 1,
    });
    const studentId = await ctx.db.insert("students", {
      schoolId,
      classId,
      userId: studentUser,
      admissionNumber: "TEST-001",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("studentSubjectSelections", {
      schoolId,
      classId,
      subjectId,
      studentId,
      sessionId,
      createdAt: 1,
      updatedAt: 1,
    });
    const recordId = await ctx.db.insert("assessmentRecords", {
      schoolId,
      classId,
      subjectId,
      studentId,
      sessionId,
      termId,
      ca1: 20,
      ca2: 20,
      ca3: 20,
      examRawScore: 20,
      examScaledScore: 20,
      total: 80,
      gradeLetter: "A",
      remark: "Excellent",
      examInputModeSnapshot: "raw40",
      examRawMaxSnapshot: 40,
      status: "draft",
      enteredBy: userId,
      updatedBy: userId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { classId, studentId, sessionId, termId, recordId };
  });
  const args = {
    studentId: ids.studentId,
    sessionId: ids.sessionId,
    termId: ids.termId,
    classId: ids.classId,
  };
  const reportApi = api.functions.academic.reportCards;
  const preview = await viewer.query(reportApi.getStudentReportCard, args);
  expect(preview.gradingPolicy?.source).toBe("current");
  const reviewedKey = reportCardReviewKey(preview);
  await expect(
    viewer.mutation(reportApi.certifyStudentReportCard, {
      ...args,
      confirmation: "TEST-001",
      reviewedKey: "stale",
    }),
  ).rejects.toThrow("changed since review");
  await expect(
    viewer.mutation(reportApi.certifyStudentReportCard, {
      ...args,
      confirmation: "wrong",
      reviewedKey,
    }),
  ).rejects.toThrow("Confirm");
  const issuedAt = await viewer.mutation(reportApi.certifyStudentReportCard, {
    ...args,
    confirmation: "TEST-001",
    reviewedKey,
  });
  const issued = await viewer.query(reportApi.getStudentReportCard, args);
  expect(issued.gradingPolicy).toMatchObject({
    source: "snapshot",
    version: 1,
  });
  expect(issued.certifiedAt).toBe(issuedAt);
  await viewer.mutation(endpoints.saveGradingBands, {
    schoolId,
    bands: [
      {
        minScore: 0,
        maxScore: 100,
        gradeLetter: "CUSTOM",
        remark: "New",
        colorHex: "#ffffaa",
      },
    ],
  });
  await t.run((ctx) =>
    ctx.db.patch(ids.recordId, { total: 12, gradeLetter: "F" }),
  );
  expect(await viewer.query(reportApi.getStudentReportCard, args)).toEqual(
    issued,
  );
  expect(
    await viewer.mutation(reportApi.certifyStudentReportCard, {
      ...args,
      confirmation: "TEST-001",
      reviewedKey,
    }),
  ).toBe(issuedAt);
  // An old report with no issued snapshot is a separate historical term, not a rewritten issued document.
  const oldTerm = await t.run(async (ctx) => {
    const oldTerm = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId: ids.sessionId,
      name: "Historical",
      startDate: 1,
      endDate: 2,
      isActive: false,
      createdAt: 1,
      updatedAt: 1,
    });
    const original = await ctx.db.get(ids.recordId);
    if (!original) throw new Error("Missing fixture record");
    const { _id, _creationTime, ...record } = original;
    await ctx.db.insert("assessmentRecords", {
      ...record,
      termId: oldTerm,
      total: 80,
      gradeLetter: "OLD",
      remark: "Recorded remark",
    });
    return oldTerm;
  });
  const historical = await viewer.query(reportApi.getStudentReportCard, {
    ...args,
    termId: oldTerm,
  });
  expect(historical.gradingPolicy).toMatchObject({
    source: "historical_missing",
    bands: [],
  });
  expect(historical.results[0]).toMatchObject({
    total: 80,
    gradeLetter: "OLD",
    remark: "Recorded remark",
  });
  await expect(
    viewer.mutation(reportApi.certifyStudentReportCard, {
      ...args,
      termId: oldTerm,
      confirmation: "TEST-001",
      reviewedKey: reportCardReviewKey(historical),
    }),
  ).rejects.toThrow("Historical");
});
