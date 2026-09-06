import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import type { Id } from "../../../_generated/dataModel";
import { FACTORY_DEFAULT_GRADING_BANDS } from "@school/shared/exam-recording";

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

async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const now = 1;
    const schoolId = await ctx.db.insert("schools", {
      name: "Review School",
      slug: "review-school",
      createdAt: now,
      updatedAt: now,
    });
    const otherSchoolId = await ctx.db.insert("schools", {
      name: "Other School",
      slug: "other-school",
      createdAt: now,
      updatedAt: now,
    });
    const actorUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "reviewer",
      authTokenIdentifier: "test|reviewer",
      name: "Review Owner",
      email: "reviewer@example.test",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });
    const personId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|reviewer",
      identityReconciliationState: "resolved",
      email: "reviewer@example.test",
      name: "Review Owner",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });
    const membershipId = await ctx.db.insert("branchMemberships", {
      personId,
      schoolId,
      status: "active",
      permissionsManagedAt: now,
      isDefaultBranch: true,
      legacyUserId: actorUserId,
      joinedAt: now,
      updatedAt: now,
    });
    for (const capability of [
      "system.migration.execute",
      "enrollment.admissions.override_number",
    ]) {
      await ctx.db.insert("membershipDirectGrants", {
        membershipId,
        capability,
        grantedAt: now,
      });
    }
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "JSS 1A",
      level: "JSS 1",
      createdAt: now,
      updatedAt: now,
    });
    const otherClassId = await ctx.db.insert("classes", {
      schoolId: otherSchoolId,
      name: "Foreign",
      level: "1",
      createdAt: now,
      updatedAt: now,
    });
    const familyId = await ctx.db.insert("families", {
      schoolId,
      name: "Reviewed Family",
      createdBy: actorUserId,
      updatedBy: actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const otherFamilyId = await ctx.db.insert("families", {
      schoolId: otherSchoolId,
      name: "Foreign Family",
      createdBy: actorUserId,
      updatedBy: actorUserId,
      createdAt: now,
      updatedAt: now,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026/2027",
      startDate: Date.UTC(2026, 8, 1),
      endDate: Date.UTC(2027, 6, 1),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First",
      startDate: Date.UTC(2026, 8, 1),
      endDate: Date.UTC(2026, 11, 1),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const subjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "Mathematics",
      code: "MATH",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("schoolAssessmentSettings", {
      schoolId,
      examInputMode: "raw40",
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examContributionMax: 40,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: actorUserId,
    });
    for (const band of FACTORY_DEFAULT_GRADING_BANDS) {
      await ctx.db.insert("gradingBands", {
        schoolId,
        gradeLetter: band.gradeLetter,
        minScore: band.minScore,
        maxScore: band.maxScore,
        gradePoints: band.gradePoints,
        remark: band.remark,
        colorHex: band.colorHex,
        isActive: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
        updatedBy: actorUserId,
      });
    }
    const policyId = await ctx.db.insert("admissionNumberPolicies", {
      schoolId,
      version: 1,
      resetPeriod: "continuous",
      pattern: "{SCHOOL}/{YEAR}/{SEQ:4}",
      schoolCode: "SCH",
      campusCode: "MAIN",
      currentSequence: 10,
      resetFrequency: "continuous",
      createdAt: now,
      updatedAt: now,
    });
    const studentUserIds: Id<"users">[] = [];
    for (let index = 0; index < 4; index += 1) {
      studentUserIds.push(
        await ctx.db.insert("users", {
          schoolId,
          authId: `existing-student-identity-${index}`,
          name: `Student Identity ${index}`,
          email: `student${index}@example.test`,
          role: "student",
          createdAt: now,
          updatedAt: now,
        }),
      );
    }
    return {
      schoolId,
      otherSchoolId,
      actorUserId,
      personId,
      membershipId,
      classId,
      otherClassId,
      familyId,
      otherFamilyId,
      sessionId,
      termId,
      subjectId,
      policyId,
      studentUserIds,
    };
  });
  return {
    t,
    session: t.withIdentity({
      subject: "reviewer",
      tokenIdentifier: "test|reviewer",
    }),
    ...data,
  };
}

async function createWorkspace(
  f: Awaited<ReturnType<typeof fixture>>,
  name = "Reviewed import",
) {
  return await f.session.mutation(
    api.functions.academic.migrationWorkspace.createWorkspace,
    {
      schoolId: f.schoolId,
      name,
      mode: "school_admin",
    },
  );
}

async function stageStudent(
  f: Awaited<ReturnType<typeof fixture>>,
  workspaceId: Id<"importWorkspaces">,
  rowNumber: number,
  admissionNumber?: string,
) {
  await f.session.mutation(
    api.functions.academic.migrationIngest.stageRecordsBatch,
    {
      schoolId: f.schoolId,
      workspaceId,
      records: [
        {
          rowNumber,
          rawPayload: { ignoredSecretCopy: "not persisted" },
          entityType: "student",
          parsedData: {
            firstName: `Student${rowNumber}`,
            lastName: "Reviewed",
            admissionNumber,
            gender: "Female",
            className: "untrusted class label",
          },
        },
      ],
    },
  );
  const records = await f.session.query(
    api.functions.academic.migrationWorkspace.getWorkspaceRecords,
    {
      schoolId: f.schoolId,
      workspaceId,
      limit: 1000,
    },
  );
  return records.find((record) => record.rowNumber === rowNumber)!;
}

async function stageGrade(
  f: Awaited<ReturnType<typeof fixture>>,
  workspaceId: Id<"importWorkspaces">,
  scores: { ca1: number; ca2: number; exam: number },
) {
  await f.session.mutation(
    api.functions.academic.migrationIngest.stageRecordsBatch,
    {
      schoolId: f.schoolId,
      workspaceId,
      records: [{
        rowNumber: 1,
        rawPayload: {},
        entityType: "grade_record",
        parsedData: {
          firstName: "Student",
          lastName: "Reviewed",
          gender: "Female",
          className: "Reviewed class",
          subjectName: "Mathematics",
          ...scores,
        },
      }],
    },
  );
  return (
    await f.session.query(api.functions.academic.migrationWorkspace.getWorkspaceRecords, {
      schoolId: f.schoolId,
      workspaceId,
      limit: 10,
    })
  )[0];
}

async function reviewGrade(
  f: Awaited<ReturnType<typeof fixture>>,
  recordId: Id<"stagedImportRecords">,
  overrides: Partial<{
    selectedStudentId: Id<"students">;
    selectedClassId: Id<"classes">;
    selectedSubjectId: Id<"subjects">;
    selectedSessionId: Id<"academicSessions">;
    selectedTermId: Id<"academicTerms">;
  }> = {},
) {
  return f.session.mutation(api.functions.academic.migrationAutosave.reviewStagedRecord, {
    schoolId: f.schoolId,
    recordId,
    expectedRowRevision: 1,
    resolutionAction: "create_new",
    selectedClassId: f.classId,
    selectedSubjectId: f.subjectId,
    selectedSessionId: f.sessionId,
    selectedTermId: f.termId,
    ...overrides,
  });
}

async function createExistingStudent(f: Awaited<ReturnType<typeof fixture>>) {
  return f.t.run(ctx => ctx.db.insert("students", {
    schoolId: f.schoolId,
    classId: f.classId,
    userId: f.studentUserIds[0],
    admissionNumber: `GRADE-${Math.random()}`,
    gender: "Female",
    enrollmentStatus: "active",
    createdAt: 1,
    updatedAt: 1,
  }));
}

async function approveAll(
  f: Awaited<ReturnType<typeof fixture>>,
  workspaceId: Id<"importWorkspaces">,
  batchSize = 1,
) {
  let done = false;
  while (!done) {
    const result = await f.session.mutation(
      api.functions.academic.migrationMerge.approveImportWorkspace,
      {
        schoolId: f.schoolId,
        workspaceId,
        batchSize,
      },
    );
    done = result.done;
  }
}

async function commitAll(
  f: Awaited<ReturnType<typeof fixture>>,
  workspaceId: Id<"importWorkspaces">,
  batchSize = 1,
) {
  const receipts: string[] = [];
  let done = false;
  while (!done) {
    const result = await f.session.mutation(
      api.functions.academic.migrationMerge.commitImportWorkspace,
      {
        schoolId: f.schoolId,
        workspaceId,
        batchSize,
      },
    );
    if (result.receiptId) receipts.push(result.receiptId);
    done = result.done;
  }
  return receipts;
}

describe("R1 reviewed import remediation", () => {
  it("hard-fails legacy public commit and import-local numbering until a plan is approved", async () => {
    const f = await fixture();
    await expect(
      f.session.mutation(
        api.functions.academic.migrationWorkspace.createWorkspace,
        {
          schoolId: f.schoolId,
          name: "Unsafe seed",
          mode: "school_admin",
          admissionNumberPrefix: "LOCAL/",
          nextAdmissionSequence: 1,
        },
      ),
    ).rejects.toThrow("Import-local numbering is disabled");
    const workspaceId = await createWorkspace(f);
    await stageStudent(f, workspaceId, 1);
    await stageStudent(f, workspaceId, 1);
    const staged = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 10 },
    );
    const summary = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceSummary,
      { schoolId: f.schoolId, workspaceId },
    );
    expect(staged).toHaveLength(1);
    expect(summary.totalRecords).toBe(1);
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.bulkResolveAdmissionNumbers,
        {
          schoolId: f.schoolId,
          workspaceId,
        },
      ),
    ).rejects.toThrow("Import-local numbering is disabled");
    await expect(
      f.session.mutation(
        api.functions.academic.migrationMerge.commitImportWorkspace,
        {
          schoolId: f.schoolId,
          workspaceId,
        },
      ),
    ).rejects.toThrow("disabled until every row");
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(0);
  });

  it("allows a malformed row only as an explicit audited ignore outcome", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f);
    await f.session.mutation(
      api.functions.academic.migrationIngest.stageRecordsBatch,
      {
        schoolId: f.schoolId,
        workspaceId,
        records: [
          {
            rowNumber: 1,
            rawPayload: {},
            entityType: "student",
            parsedData: {
              firstName: "",
              lastName: "",
              gender: "Unspecified",
              className: "",
            },
          },
        ],
      },
    );
    const record = (
      await f.session.query(
        api.functions.academic.migrationWorkspace.getWorkspaceRecords,
        { schoolId: f.schoolId, workspaceId, limit: 10 },
      )
    )[0];
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        expectedRowRevision: 1,
        resolutionAction: "ignore",
      },
    );
    await approveAll(f, workspaceId);
    await commitAll(f, workspaceId);
    const outcome = (
      await f.session.query(
        api.functions.academic.migrationWorkspace.getWorkspaceRecords,
        { schoolId: f.schoolId, workspaceId, limit: 10 },
      )
    )[0];
    expect(outcome.commitOutcome).toBe("ignored");
    expect(outcome.commitReceiptId).toBeTruthy();
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(0);
  });

  it("creates only with reviewed existing identities/classes and allocates exact H4 proposals transactionally", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f);
    const first = await stageStudent(f, workspaceId, 1);
    const second = await stageStudent(f, workspaceId, 2);
    for (const [record, selectedUserId] of [
      [first, f.studentUserIds[0]],
      [second, f.studentUserIds[1]],
    ] as const) {
      await f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        {
          schoolId: f.schoolId,
          recordId: record._id,
          expectedRowRevision: record.rowRevision ?? 1,
          resolutionAction: "create_new",
          selectedClassId: f.classId,
          selectedUserId,
          selectedFamilyId: f.familyId,
          admissionNumberMode: "official_generated",
          expectedNumberPolicyVersion: 1,
          expectedNumberFormatVersion: "branch:1:0",
          expectedNumberCounterKey: "default",
          expectedNumberCounterVersion: 0,
        },
      );
    }
    await approveAll(f, workspaceId, 1);
    const planned = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 1000 },
    );
    expect(planned.map((record) => record.proposedAdmissionNumber)).toEqual([
      "SCH/2026/0010",
      "SCH/2026/0011",
    ]);
    const receipts = await commitAll(f, workspaceId, 1);
    expect(receipts).toHaveLength(2);
    const students = await f.t.run((ctx) =>
      ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
        .collect(),
    );
    expect(students.map((student) => student.admissionNumber)).toEqual([
      "SCH/2026/0010",
      "SCH/2026/0011",
    ]);
    expect(students.map((student) => student.userId)).toEqual([
      f.studentUserIds[0],
      f.studentUserIds[1],
    ]);
    expect(
      await f.t.run(
        async (ctx) => (await ctx.db.get(f.policyId))?.currentSequence,
      ),
    ).toBe(12);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("classes")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(1);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("users")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(5);
    const replay = await f.session.mutation(
      api.functions.academic.migrationMerge.commitImportWorkspace,
      { schoolId: f.schoolId, workspaceId },
    );
    expect(replay.alreadyCommitted).toBe(true);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(2);
    const rows = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 1000 },
    );
    expect(rows.every((row) => row.commitReceiptId && row.isCommitted)).toBe(
      true,
    );
  });

  it("reopens only incomplete rows after a partial receipt and replans stale H4 numbers without replay", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f);
    const first = await stageStudent(f, workspaceId, 1);
    const second = await stageStudent(f, workspaceId, 2);
    for (const [record, selectedUserId] of [
      [first, f.studentUserIds[0]],
      [second, f.studentUserIds[1]],
    ] as const) {
      await f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        {
          schoolId: f.schoolId,
          recordId: record._id,
          expectedRowRevision: 1,
          resolutionAction: "create_new",
          selectedClassId: f.classId,
          selectedUserId,
          admissionNumberMode: "official_generated",
          expectedNumberPolicyVersion: 1,
          expectedNumberFormatVersion: "branch:1:0",
          expectedNumberCounterKey: "default",
          expectedNumberCounterVersion: 0,
        },
      );
    }
    await approveAll(f, workspaceId, 1);
    const firstBatch = await f.session.mutation(
      api.functions.academic.migrationMerge.commitImportWorkspace,
      { schoolId: f.schoolId, workspaceId, batchSize: 1 },
    );
    expect(firstBatch.done).toBe(false);
    const before = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 10 },
    );
    const firstReceipt = before[0].commitReceiptId;
    await f.t.run((ctx) => ctx.db.patch(f.policyId, { currentSequence: 12 }));
    await expect(
      f.session.mutation(
        api.functions.academic.migrationMerge.commitImportWorkspace,
        { schoolId: f.schoolId, workspaceId, batchSize: 1 },
      ),
    ).rejects.toThrow("changed; repeat approval");
    const reopen = await f.session.mutation(
      api.functions.academic.migrationMerge.reopenIncompleteImportReview,
      { schoolId: f.schoolId, workspaceId },
    );
    expect(reopen.firstIncompleteRow).toBe(2);
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.patchStagedRecord,
        {
          schoolId: f.schoolId,
          recordId: before[0]._id,
          parsedDataPatch: { firstName: "Replay" },
        },
      ),
    ).rejects.toThrow("immutable");
    await approveAll(f, workspaceId, 1);
    const replanned = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 10 },
    );
    expect(replanned[1].proposedAdmissionNumber).toBe("SCH/2026/0012");
    await commitAll(f, workspaceId, 1);
    const after = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 10 },
    );
    expect(after[0].commitReceiptId).toBe(firstReceipt);
    expect(after.map((row) => row.commitOutcome)).toEqual([
      "created",
      "created",
    ]);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(2);
  });

  it("plans independent level and branch counters together and rejects stale commit", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert("admissionNumberSequences", {
        schoolId: f.schoolId,
        key: "jss",
        name: "Junior secondary",
        level: "jss 1",
        currentSequence: 700,
        resetFrequency: "continuous",
        resetPeriod: "continuous",
        status: "active",
        configVersion: 1,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const primaryClassId = await f.t.run((ctx) =>
      ctx.db.insert("classes", {
        schoolId: f.schoolId,
        name: "Primary 1",
        level: "Primary 1",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const workspaceId = await createWorkspace(f);
    const record = await stageStudent(f, workspaceId, 1);
    const branchRecord = await stageStudent(f, workspaceId, 2);
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        expectedRowRevision: 1,
        resolutionAction: "create_new",
        selectedClassId: f.classId,
        selectedUserId: f.studentUserIds[0],
        admissionNumberMode: "official_generated",
        expectedNumberPolicyVersion: 1,
        expectedNumberFormatVersion: "branch:1:0",
        expectedNumberCounterKey: "jss",
        expectedNumberCounterVersion: 1,
      },
    );
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: branchRecord._id,
        expectedRowRevision: 1,
        resolutionAction: "create_new",
        selectedClassId: primaryClassId,
        selectedUserId: f.studentUserIds[1],
        admissionNumberMode: "official_generated",
        expectedNumberPolicyVersion: 1,
        expectedNumberFormatVersion: "branch:1:0",
        expectedNumberCounterKey: "default",
        expectedNumberCounterVersion: 0,
      },
    );
    await approveAll(f, workspaceId, 2);
    const planned = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 10 },
    );
    expect(planned.map((item) => item.proposedAdmissionNumber)).toEqual([
      "SCH/2026/0700",
      "SCH/2026/0010",
    ]);
    await f.t.run(async (ctx) => {
      const sequence = await ctx.db
        .query("admissionNumberSequences")
        .withIndex("by_school_and_key", (q) =>
          q.eq("schoolId", f.schoolId).eq("key", "jss"),
        )
        .unique();
      if (sequence)
        await ctx.db.patch(sequence._id, {
          configVersion: 2,
          status: "paused",
        });
    });
    await expect(
      f.session.mutation(
        api.functions.academic.migrationMerge.commitImportWorkspace,
        { schoolId: f.schoolId, workspaceId },
      ),
    ).rejects.toThrow("changed");
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(0);
  });

  it("rejects accidental collisions and permits only explicit same-tenant merge", async () => {
    const f = await fixture();
    const existingStudentId = await f.t.run((ctx) =>
      ctx.db.insert("students", {
        schoolId: f.schoolId,
        classId: f.classId,
        userId: f.studentUserIds[0],
        admissionNumber: "HIST-001",
        gender: "Female",
        enrollmentStatus: "active",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const foreignStudentId = await f.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        schoolId: f.otherSchoolId,
        authId: "foreign",
        name: "Foreign",
        email: "foreign@example.test",
        role: "student",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("students", {
        schoolId: f.otherSchoolId,
        classId: f.otherClassId,
        userId,
        admissionNumber: "FOREIGN-1",
        gender: "Male",
        enrollmentStatus: "active",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const workspaceId = await createWorkspace(f);
    const record = await stageStudent(f, workspaceId, 1, "HIST-001");
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        {
          schoolId: f.schoolId,
          recordId: record._id,
          expectedRowRevision: record.rowRevision ?? 1,
          resolutionAction: "create_new",
          selectedClassId: f.classId,
          selectedUserId: f.studentUserIds[1],
          admissionNumberMode: "supplied",
          manualNumberConfirmed: true,
          manualNumberReason: "Reviewed historical identifier",
        },
      ),
    ).rejects.toThrow("already assigned");
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        {
          schoolId: f.schoolId,
          recordId: record._id,
          expectedRowRevision: record.rowRevision ?? 1,
          resolutionAction: "merge_existing",
          selectedStudentId: foreignStudentId,
        },
      ),
    ).rejects.toThrow("outside this school");
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        expectedRowRevision: record.rowRevision ?? 1,
        resolutionAction: "merge_existing",
        selectedStudentId: existingStudentId,
      },
    );
    await approveAll(f, workspaceId);
    await commitAll(f, workspaceId);
    const students = await f.t.run((ctx) =>
      ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
        .collect(),
    );
    expect(students).toHaveLength(1);
    const outcome = (
      await f.session.query(
        api.functions.academic.migrationWorkspace.getWorkspaceRecords,
        { schoolId: f.schoolId, workspaceId, limit: 10 },
      )
    )[0];
    expect(outcome).toMatchObject({
      commitOutcome: "merged",
      committedStudentId: existingStudentId,
    });
  });

  it("revalidates a post-approval collision and never silently binds the new row", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f);
    const record = await stageStudent(f, workspaceId, 1, "RACE-001");
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        expectedRowRevision: 1,
        resolutionAction: "create_new",
        selectedClassId: f.classId,
        selectedUserId: f.studentUserIds[0],
        admissionNumberMode: "supplied",
        manualNumberConfirmed: true,
        manualNumberReason: "Historical source reviewed before race",
      },
    );
    await approveAll(f, workspaceId);
    const concurrentStudentId = await f.t.run((ctx) =>
      ctx.db.insert("students", {
        schoolId: f.schoolId,
        classId: f.classId,
        userId: f.studentUserIds[1],
        admissionNumber: "RACE-001",
        gender: "Female",
        enrollmentStatus: "active",
        createdAt: 2,
        updatedAt: 2,
      }),
    );
    await expect(
      f.session.mutation(
        api.functions.academic.migrationMerge.commitImportWorkspace,
        { schoolId: f.schoolId, workspaceId },
      ),
    ).rejects.toThrow("already assigned");
    const students = await f.t.run((ctx) =>
      ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
        .collect(),
    );
    expect(students).toHaveLength(1);
    expect(students[0]._id).toBe(concurrentStudentId);
    const unchanged = (
      await f.session.query(
        api.functions.academic.migrationWorkspace.getWorkspaceRecords,
        { schoolId: f.schoolId, workspaceId, limit: 10 },
      )
    )[0];
    expect(unchanged.isCommitted).toBe(false);
    expect(unchanged.committedStudentId).toBeUndefined();
  });

  it("preserves supplied history and advances the official counter only by exact reviewed choice", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f);
    const record = await stageStudent(f, workspaceId, 1, "LEGACY-A-77");
    const generatedRecord = await stageStudent(f, workspaceId, 2);
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        expectedRowRevision: record.rowRevision ?? 1,
        resolutionAction: "create_new",
        selectedClassId: f.classId,
        selectedUserId: f.studentUserIds[0],
        admissionNumberMode: "supplied",
        manualNumberConfirmed: true,
        manualNumberReason: "Historical register source reviewed",
        advanceCounterTo: 50,
        expectedNumberPolicyVersion: 1,
        expectedNumberFormatVersion: "branch:1:0",
        expectedNumberCounterKey: "default",
        expectedNumberCounterVersion: 0,
      },
    );
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: generatedRecord._id,
        expectedRowRevision: 1,
        resolutionAction: "create_new",
        selectedClassId: f.classId,
        selectedUserId: f.studentUserIds[1],
        admissionNumberMode: "official_generated",
        expectedNumberPolicyVersion: 1,
        expectedNumberFormatVersion: "branch:1:0",
        expectedNumberCounterKey: "default",
        expectedNumberCounterVersion: 0,
      },
    );
    await approveAll(f, workspaceId, 1);
    const planned = await f.session.query(
      api.functions.academic.migrationWorkspace.getWorkspaceRecords,
      { schoolId: f.schoolId, workspaceId, limit: 10 },
    );
    expect(planned[1].proposedAdmissionNumber).toBe("SCH/2026/0050");
    await commitAll(f, workspaceId, 1);
    const students = await f.t.run((ctx) =>
      ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
        .collect(),
    );
    expect(students.map((student) => student.admissionNumber)).toEqual([
      "LEGACY-A-77",
      "SCH/2026/0050",
    ]);
    expect(
      await f.t.run(
        async (ctx) => (await ctx.db.get(f.policyId))?.currentSequence,
      ),
    ).toBe(51);
    const audit = await f.t.run((ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_school_and_timestamp", (q) =>
          q.eq("schoolId", f.schoolId),
        )
        .collect(),
    );
    expect(
      audit.some(
        (event) =>
          event.action === "admission_number.override" &&
          event.safeSummary.includes("explicit next 50"),
      ),
    ).toBe(true);
    expect(
      audit.some(
        (event) =>
          event.action === "reviewed_import.plan_approved" &&
          event.actorKind === "user" &&
          event.actorPersonId === f.personId &&
          event.actorMembershipId === f.membershipId,
      ),
    ).toBe(true);
    expect(
      audit.some(
        (event) =>
          event.action === "reviewed_import.batch_commit" &&
          event.actorKind === "user",
      ),
    ).toBe(true);
  });

  it("rejects foreign placement/family, missing explicit mapping, stale review and changed numbering", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f);
    const record = await stageStudent(f, workspaceId, 1);
    const base = {
      schoolId: f.schoolId,
      recordId: record._id,
      expectedRowRevision: record.rowRevision ?? 1,
      resolutionAction: "create_new" as const,
      selectedUserId: f.studentUserIds[0],
      admissionNumberMode: "official_generated" as const,
      expectedNumberPolicyVersion: 1,
      expectedNumberFormatVersion: "branch:1:0",
      expectedNumberCounterKey: "default",
      expectedNumberCounterVersion: 0,
    };
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        base,
      ),
    ).rejects.toThrow("existing class");
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        { ...base, selectedClassId: f.otherClassId },
      ),
    ).rejects.toThrow("outside this school");
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        {
          ...base,
          selectedClassId: f.classId,
          selectedFamilyId: f.otherFamilyId,
        },
      ),
    ).rejects.toThrow("family is outside");
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      { ...base, selectedClassId: f.classId },
    );
    await approveAll(f, workspaceId);
    await f.t.run((ctx) => ctx.db.patch(f.policyId, { currentSequence: 11 }));
    await expect(
      f.session.mutation(
        api.functions.academic.migrationMerge.commitImportWorkspace,
        { schoolId: f.schoolId, workspaceId },
      ),
    ).rejects.toThrow("changed; repeat approval");
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(0);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("admissionNumberClaims")
          .withIndex("by_school_number", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(0);
    await f.session.mutation(
      api.functions.academic.migrationAutosave.patchStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        parsedDataPatch: { firstName: "Corrected" },
      },
    );
    await expect(
      f.session.mutation(
        api.functions.academic.migrationMerge.commitImportWorkspace,
        { schoolId: f.schoolId, workspaceId },
      ),
    ).rejects.toThrow("disabled until every row");
  });

  it("requires explicit grade mappings and applies reviewed raw40 policy snapshots", async () => {
    const f = await fixture();
    const existingStudentId = await f.t.run((ctx) =>
      ctx.db.insert("students", {
        schoolId: f.schoolId,
        classId: f.classId,
        userId: f.studentUserIds[0],
        admissionNumber: "GRADE-1",
        gender: "Female",
        enrollmentStatus: "active",
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    const workspaceId = await createWorkspace(f);
    await f.session.mutation(
      api.functions.academic.migrationIngest.stageRecordsBatch,
      {
        schoolId: f.schoolId,
        workspaceId,
        records: [
          {
            rowNumber: 1,
            rawPayload: {},
            entityType: "grade_record",
            parsedData: {
              firstName: "Student",
              lastName: "One",
              gender: "Female",
              className: "Invented class",
              subjectName: "Invented subject",
              ca1: 10,
              ca2: 10,
              exam: 40,
            },
          },
        ],
      },
    );
    const record = (
      await f.session.query(
        api.functions.academic.migrationWorkspace.getWorkspaceRecords,
        { schoolId: f.schoolId, workspaceId, limit: 10 },
      )
    )[0];
    await expect(
      f.session.mutation(
        api.functions.academic.migrationAutosave.reviewStagedRecord,
        {
          schoolId: f.schoolId,
          recordId: record._id,
          expectedRowRevision: 1,
          resolutionAction: "create_new",
          selectedStudentId: existingStudentId,
        },
      ),
    ).rejects.toThrow(
      "requires existing student, class, subject, session, and term",
    );
    await f.session.mutation(
      api.functions.academic.migrationAutosave.reviewStagedRecord,
      {
        schoolId: f.schoolId,
        recordId: record._id,
        expectedRowRevision: 1,
        resolutionAction: "create_new",
        selectedStudentId: existingStudentId,
        selectedClassId: f.classId,
        selectedSubjectId: f.subjectId,
        selectedSessionId: f.sessionId,
        selectedTermId: f.termId,
      },
    );
    await approveAll(f, workspaceId);
    await commitAll(f, workspaceId);
    const assessments = await f.t.run((ctx) =>
      ctx.db
        .query("assessmentRecords")
        .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
        .collect(),
    );
    expect(assessments).toHaveLength(1);
    expect(assessments[0]).toMatchObject({
      examRawScore: 40,
      examScaledScore: 40,
      total: 60,
      examInputModeSnapshot: "raw40",
      examRawMaxSnapshot: 40,
      assessmentPolicySnapshot: { examInputMode: "raw40" },
      gradingPolicySnapshot: { version: 1 },
    });
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("classes")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(1);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("subjects")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(1);
  });

  it("rejects a same-school grade mapping when the student has no selected-class relationship", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    const otherClassId = await f.t.run(ctx => ctx.db.insert("classes", {
      schoolId: f.schoolId,
      name: "JSS 2B",
      level: "JSS 2",
      createdAt: 1,
      updatedAt: 1,
    }));
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 10, ca2: 10, exam: 40 });
    await expect(reviewGrade(f, record._id, {
      selectedStudentId: studentId,
      selectedClassId: otherClassId,
    })).rejects.toThrow("no reviewed student-class relationship");
  });

  it("scales raw60 reviewed imports with the canonical scoring helper", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    await f.t.run(async ctx => {
      const settings = await ctx.db.query("schoolAssessmentSettings").withIndex("by_school_active", q => q.eq("schoolId", f.schoolId).eq("isActive", true)).unique();
      if (!settings) throw new Error("missing settings");
      await ctx.db.patch(settings._id, { examInputMode: "raw60_scaled_to_40" });
    });
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 10, ca2: 10, exam: 60 });
    await reviewGrade(f, record._id, { selectedStudentId: studentId });
    await approveAll(f, workspaceId);
    await commitAll(f, workspaceId);
    const assessment = await f.t.run(ctx => ctx.db.query("assessmentRecords").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).unique());
    expect(assessment).toMatchObject({
      examRawScore: 60,
      examScaledScore: 40,
      total: 60,
      examInputModeSnapshot: "raw60_scaled_to_40",
      examRawMaxSnapshot: 60,
    });
  });

  it("uses the configured grading band and persists its reviewed snapshot", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    await f.t.run(async ctx => {
      const bands = await ctx.db.query("gradingBands").withIndex("by_school_active", q => q.eq("schoolId", f.schoolId).eq("isActive", true)).take(100);
      for (const band of bands) await ctx.db.patch(band._id, { isActive: false });
      await ctx.db.insert("gradingBands", {
        schoolId: f.schoolId,
        minScore: 0,
        maxScore: 100,
        gradeLetter: "REVIEWED",
        remark: "Configured result",
        isActive: true,
        version: 2,
        createdAt: 2,
        updatedAt: 2,
        updatedBy: f.actorUserId,
      });
    });
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 20, ca2: 20, exam: 40 });
    await reviewGrade(f, record._id, { selectedStudentId: studentId });
    await approveAll(f, workspaceId);
    await commitAll(f, workspaceId);
    const assessment = await f.t.run(ctx => ctx.db.query("assessmentRecords").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).unique());
    expect(assessment).toMatchObject({
      gradeLetter: "REVIEWED",
      remark: "Configured result",
      gradingPolicySnapshot: {
        version: 2,
        bands: [{ gradeLetter: "REVIEWED", minScore: 0, maxScore: 100 }],
      },
    });
  });

  it("rejects reviewed imports for derived aggregate subjects", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    await f.t.run(ctx => ctx.db.insert("classSubjectAggregations", {
      schoolId: f.schoolId,
      classId: f.classId,
      umbrellaSubjectId: f.subjectId,
      strategy: "raw_combined_normalized",
      reportDisplayMode: "umbrella_only",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: f.actorUserId,
    }));
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 10, ca2: 10, exam: 40 });
    await expect(reviewGrade(f, record._id, { selectedStudentId: studentId })).rejects.toThrow("derived aggregate subject");
  });

  it("rejects an out-of-range imported total through canonical score validation", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 20, ca2: 20, exam: 100 });
    await expect(reviewGrade(f, record._id, { selectedStudentId: studentId })).rejects.toThrow("Exam score must be between 0 and 40");
  });

  it("fails closed when reviewed scoring policy changes before commit", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 10, ca2: 10, exam: 40 });
    await reviewGrade(f, record._id, { selectedStudentId: studentId });
    await approveAll(f, workspaceId);
    await f.t.run(async ctx => {
      const settings = await ctx.db.query("schoolAssessmentSettings").withIndex("by_school_active", q => q.eq("schoolId", f.schoolId).eq("isActive", true)).unique();
      if (!settings) throw new Error("missing settings");
      await ctx.db.patch(settings._id, { examInputMode: "raw60_scaled_to_40" });
    });
    await expect(commitAll(f, workspaceId)).rejects.toThrow("policy evidence changed");
    expect(await f.t.run(ctx => ctx.db.query("assessmentRecords").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(1))).toEqual([]);
  });

  it("fails closed for inactive or archived terms in the active session after policy changes between terms", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    await f.t.run(async ctx => {
      await ctx.db.patch(f.termId, { isActive: false });
      await ctx.db.insert("academicTerms", {
        schoolId: f.schoolId,
        sessionId: f.sessionId,
        name: "Second",
        startDate: Date.UTC(2027, 0, 1),
        endDate: Date.UTC(2027, 3, 1),
        isActive: true,
        createdAt: 2,
        updatedAt: 2,
      });
      const settings = await ctx.db.query("schoolAssessmentSettings").withIndex("by_school_active", q => q.eq("schoolId", f.schoolId).eq("isActive", true)).unique();
      if (!settings) throw new Error("missing settings");
      await ctx.db.patch(settings._id, { examInputMode: "raw60_scaled_to_40", updatedAt: 2 });
    });
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 10, ca2: 10, exam: 40 });
    const selection = {
      selectedStudentId: studentId,
      selectedTermId: f.termId,
    };
    await expect(reviewGrade(f, record._id, selection)).rejects.toThrow("historical scoring policy evidence is unavailable");

    await f.t.run(ctx => ctx.db.patch(f.termId, { isActive: true, isArchived: true }));
    await expect(reviewGrade(f, record._id, selection)).rejects.toThrow("historical scoring policy evidence is unavailable");
  });

  it("fails closed when historical relationship exists but historical scoring policy evidence is unavailable", async () => {
    const f = await fixture();
    const studentId = await createExistingStudent(f);
    const historical = await f.t.run(async ctx => {
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId: f.schoolId,
        name: "2025/2026",
        startDate: 1,
        endDate: 2,
        isActive: false,
        createdAt: 1,
        updatedAt: 1,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId: f.schoolId,
        sessionId,
        name: "Historical term",
        startDate: 1,
        endDate: 2,
        isActive: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("studentSubjectSelections", {
        schoolId: f.schoolId,
        studentId,
        classId: f.classId,
        subjectId: f.subjectId,
        sessionId,
        createdAt: 1,
        updatedAt: 1,
      });
      return { sessionId, termId };
    });
    const workspaceId = await createWorkspace(f);
    const record = await stageGrade(f, workspaceId, { ca1: 10, ca2: 10, exam: 40 });
    await expect(reviewGrade(f, record._id, {
      selectedStudentId: studentId,
      selectedSessionId: historical.sessionId,
      selectedTermId: historical.termId,
    })).rejects.toThrow("historical scoring policy evidence is unavailable");
  });

  it("processes more than 1,000 reviewed ignored rows in bounded receipt-backed batches", async () => {
    const f = await fixture();
    const workspaceId = await createWorkspace(f, "Large reviewed ignore");
    for (let offset = 0; offset < 1001; offset += 50) {
      await f.t.run(async (ctx) => {
        for (
          let index = offset;
          index < Math.min(offset + 50, 1001);
          index += 1
        ) {
          await ctx.db.insert("stagedImportRecords", {
            workspaceId,
            schoolId: f.schoolId,
            rowNumber: index + 1,
            entityType: "student",
            rawPayload: {},
            parsedData: {
              firstName: `Ignored${index}`,
              lastName: "Row",
              gender: "Unspecified",
              className: "Not used",
            },
            validationStatus: "valid",
            validationErrors: [],
            isResolved: true,
            resolutionAction: "ignore",
            reviewStatus: "approved",
            rowRevision: 1,
            reviewedRowRevision: 1,
            isCommitted: false,
            updatedAt: 1,
          });
        }
      });
    }
    await f.t.run((ctx) =>
      ctx.db.patch(workspaceId, {
        totalRecords: 1001,
        validRecords: 1001,
        warningRecords: 0,
        errorRecords: 0,
        status: "reviewing",
      }),
    );
    await approveAll(f, workspaceId, 50);
    const receipts = await commitAll(f, workspaceId, 50);
    expect(receipts).toHaveLength(21);
    const committed = await f.t.run((ctx) =>
      ctx.db
        .query("stagedImportRecords")
        .withIndex("by_workspaceId_and_isCommitted", (q) =>
          q.eq("workspaceId", workspaceId).eq("isCommitted", true),
        )
        .collect(),
    );
    expect(committed).toHaveLength(1001);
    expect(new Set(committed.map((row) => row.commitReceiptId)).size).toBe(21);
    expect(
      await f.t.run((ctx) =>
        ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
          .collect(),
      ),
    ).toHaveLength(0);
  });
});
