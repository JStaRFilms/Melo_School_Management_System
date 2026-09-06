import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import type { Doc, Id } from "../../../_generated/dataModel";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

// Verification guideline compliance: supports standard relative globbing

// Monorepo root resolution for convex-test in nested test directories
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

const transfersApi = api.functions.academic.transfers;
const initiateStudentTransferRef = transfersApi.initiateStudentTransfer;
const authorizeSourceReleaseRef = transfersApi.authorizeSourceRelease;
const acceptDestinationTransferRef = transfersApi.acceptDestinationTransfer;
const rejectOrCancelTransferRef = transfersApi.rejectOrCancelTransfer;
const getTransferRef = transfersApi.getTransfer;
const listTransfersBySchoolRef = transfersApi.listTransfersBySchool;
const listTransfersByGroupRef = transfersApi.listTransfersByGroup;
const getStudentTransferHistoryRef = transfersApi.getStudentTransferHistory;
const portalApi = api.functions.portal;

interface TestHarness {
  schoolA: Id<"schools">;
  schoolB: Id<"schools">;
  schoolC: Id<"schools">;
  groupA: Id<"schoolGroups">;
  groupB: Id<"schoolGroups">;
  adminAIdentity: { tokenIdentifier: string; subject: string; email: string };
  adminBIdentity: { tokenIdentifier: string; subject: string; email: string };
  unauthorizedIdentity: {
    tokenIdentifier: string;
    subject: string;
    email: string;
  };
  classAId: Id<"classes">;
  classBId: Id<"classes">;
  studentId: Id<"students">;
  studentUserId: Id<"users">;
  adminAUserId: Id<"users">;
  adminBMembershipId: Id<"branchMemberships">;
}

async function setupTestHarness(
  t: ReturnType<typeof convexTest>,
): Promise<TestHarness> {
  const now = Date.now();
  return await t.run(async (ctx) => {
    // 1. Create Schools
    const schoolA = await ctx.db.insert("schools", {
      name: "Olive Crest Lekki",
      slug: "olive-lekki",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const schoolB = await ctx.db.insert("schools", {
      name: "Olive Crest Ikoyi",
      slug: "olive-ikoyi",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const schoolC = await ctx.db.insert("schools", {
      name: "Cedarwood Academy Ikeja",
      slug: "cedarwood-ikeja",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create School Groups
    const proprietorPersonA = await ctx.db.insert("persons", {
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
      proprietorPersonId: proprietorPersonA,
      status: "active",
      settingsVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    const proprietorPersonB = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|proprietor-charles",
      email: "charles@cedarwood.test",
      name: "Charles Obi",
      status: "active",
      primarySchoolId: schoolC,
      createdAt: now,
      updatedAt: now,
    });

    const groupB = await ctx.db.insert("schoolGroups", {
      name: "Cedarwood Group",
      slug: "cedarwood-group",
      proprietorPersonId: proprietorPersonB,
      status: "active",
      settingsVersion: 1,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Link Schools to Groups
    // School A and School B belong to Group A
    await ctx.db.insert("schoolGroupBranches", {
      groupId: groupA,
      schoolId: schoolA,
      isHeadquarters: true,
      linkedAt: now,
    });

    await ctx.db.insert("schoolGroupBranches", {
      groupId: groupA,
      schoolId: schoolB,
      isHeadquarters: false,
      linkedAt: now,
    });

    // School C belongs to Group B
    await ctx.db.insert("schoolGroupBranches", {
      groupId: groupB,
      schoolId: schoolC,
      isHeadquarters: true,
      linkedAt: now,
    });

    // 4. Create Admin Users and Person Memberships
    // Admin A for School A
    const adminAPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|admin-lekki",
      email: "principal.lekki@olivecrest.test",
      name: "Mrs. Folashade Coker",
      status: "active",
      primarySchoolId: schoolA,
      createdAt: now,
      updatedAt: now,
    });

    const adminAUser = await ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "auth-admin-lekki",
      authTokenIdentifier: "https://auth.melo.test|admin-lekki",
      personId: adminAPerson,
      name: "Mrs. Folashade Coker",
      email: "principal.lekki@olivecrest.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("branchMemberships", {
      personId: adminAPerson,
      schoolId: schoolA,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminAUser,
      joinedAt: now,
      updatedAt: now,
    });

    // Admin B for School B
    const adminBPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|admin-ikoyi",
      email: "principal.ikoyi@olivecrest.test",
      name: "Mr. Babatunde Sanusi",
      status: "active",
      primarySchoolId: schoolB,
      createdAt: now,
      updatedAt: now,
    });

    const adminBUser = await ctx.db.insert("users", {
      schoolId: schoolB,
      authId: "auth-admin-ikoyi",
      authTokenIdentifier: "https://auth.melo.test|admin-ikoyi",
      personId: adminBPerson,
      name: "Mr. Babatunde Sanusi",
      email: "principal.ikoyi@olivecrest.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    const adminBMembershipId = await ctx.db.insert("branchMemberships", {
      personId: adminBPerson,
      schoolId: schoolB,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminBUser,
      joinedAt: now,
      updatedAt: now,
    });

    // Unauthorized outsider
    const unauthorizedPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|outsider-dan",
      email: "dan@outsider.test",
      name: "Dan Stranger",
      status: "active",
      primarySchoolId: schoolC,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("users", {
      schoolId: schoolC,
      authId: "auth-dan-outsider",
      authTokenIdentifier: "https://auth.melo.test|outsider-dan",
      personId: unauthorizedPerson,
      name: "Dan Stranger",
      email: "dan@outsider.test",
      role: "student",
      createdAt: now,
      updatedAt: now,
    });

    // 5. Create Classes
    const classAId = await ctx.db.insert("classes", {
      schoolId: schoolA,
      name: "Basic 5 Emerald",
      level: "Basic 5",
      createdAt: now,
      updatedAt: now,
    });

    const classBId = await ctx.db.insert("classes", {
      schoolId: schoolB,
      name: "JSS 1 Sapphire",
      level: "JSS1",
      createdAt: now,
      updatedAt: now,
    });

    // 6. Create Student in School A
    const studentPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|student-seun",
      email: "seun.adeyemi@family.test",
      name: "Oluwaseun Adeyemi",
      status: "active",
      primarySchoolId: schoolA,
      createdAt: now,
      updatedAt: now,
    });

    const studentUserId = await ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "auth-student-seun",
      authTokenIdentifier: "https://auth.melo.test|student-seun",
      personId: studentPerson,
      name: "Oluwaseun Adeyemi",
      email: "seun.adeyemi@family.test",
      role: "student",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("branchMemberships", {
      personId: studentPerson,
      schoolId: schoolA,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: studentUserId,
      joinedAt: now,
      updatedAt: now,
    });

    const studentId = await ctx.db.insert("students", {
      schoolId: schoolA,
      classId: classAId,
      userId: studentUserId,
      admissionNumber: "OBC-LEK-BAS5-2026-0001",
      gender: "male",
      dateOfBirth: new Date("2014-05-12").getTime(),
      guardianName: "Engr. Dapo Adeyemi",
      guardianPhone: "+2348012345678",
      enrollmentStatus: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Destination numbering must be explicitly configured; production allocation never invents codes/session.
    await ctx.db.insert("academicSessions", {
      schoolId: schoolB,
      name: "2026/27",
      startDate: Date.UTC(2026, 8, 1),
      endDate: Date.UTC(2027, 7, 31),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("admissionNumberPolicies", {
      schoolId: schoolB,
      pattern: "{SCHOOL}-{CAMPUS}-{LEVEL}-{YEAR}-{SEQ:4}",
      schoolCode: "OBC",
      campusCode: "IKY",
      currentSequence: 1,
      resetFrequency: "continuous",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return {
      schoolA,
      schoolB,
      schoolC,
      groupA,
      groupB,
      adminAIdentity: {
        tokenIdentifier: "https://auth.melo.test|admin-lekki",
        subject: "auth-admin-lekki",
        email: "principal.lekki@olivecrest.test",
      },
      adminBIdentity: {
        tokenIdentifier: "https://auth.melo.test|admin-ikoyi",
        subject: "auth-admin-ikoyi",
        email: "principal.ikoyi@olivecrest.test",
      },
      unauthorizedIdentity: {
        tokenIdentifier: "https://auth.melo.test|outsider-dan",
        subject: "auth-dan-outsider",
        email: "dan@outsider.test",
      },
      classAId,
      classBId,
      studentId,
      studentUserId,
      adminAUserId: adminAUser,
      adminBMembershipId,
    };
  });
}

async function reviewedNumbering(
  t: ReturnType<typeof convexTest>,
  identity: TestHarness["adminAIdentity"],
  schoolId: Id<"schools">,
  classId: Id<"classes">,
) {
  const proposal = await t.withIdentity(identity).query(
    transfersApi.previewTransferNumber,
    { schoolId, classId },
  );
  if (!proposal.available) throw new Error(proposal.message);
  return {
    expectedPolicyVersion: proposal.policyVersion,
    expectedFormatVersion: proposal.formatVersion,
    expectedCounterKey: proposal.counterKey,
    expectedCounterVersion: proposal.counterVersion,
    expectedAdmissionNumber: proposal.allocatedNumber,
    expectedSequenceNumber: proposal.sequenceNumber,
  };
}

describe("Task B-09 / M8: Within-Group Transfer Foundation & Verification (F4/MX-15)", () => {
  it("1. Positive: Two-phase commit (Initiate -> Release -> Accept) cleanly transfers student to destination branch, assigns class & admission number, preserving historical source tenancy", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);
    const now = Date.now();

    // Attach historical records at source school (School A) to test immutability
    const historicalInvoiceId = await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId: harness.schoolA,
        name: "2025/2026",
        startDate: now - 100000,
        endDate: now + 100000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const termId = await ctx.db.insert("academicTerms", {
        schoolId: harness.schoolA,
        sessionId,
        name: "Term 3",
        startDate: now - 50000,
        endDate: now + 50000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const feePlanId = await ctx.db.insert("feePlans", {
        schoolId: harness.schoolA,
        name: "Basic 5 Fee Plan",
        currency: "NGN",
        lineItems: [
          {
            id: "tuition",
            label: "Tuition",
            amount: 120000,
            category: "tuition",
            order: 0,
          },
        ],
        installmentPolicy: {
          enabled: false,
          installmentCount: 1,
          intervalDays: 30,
          firstDueDays: 14,
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: harness.adminAUserId,
        updatedBy: harness.adminAUserId,
      });

      return await ctx.db.insert("studentInvoices", {
        schoolId: harness.schoolA,
        classId: harness.classAId,
        studentId: harness.studentId,
        sessionId,
        termId,
        feePlanId,
        feePlanNameSnapshot: "Basic 5 Fee Plan",
        invoiceNumber: "INV-LEK-2026-0042",
        currency: "NGN",
        lineItems: [],
        installmentSchedule: [],
        subtotal: 120000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 120000,
        amountPaid: 60000,
        balanceDue: 60000,
        status: "partially_paid",
        dueDate: now + 86400000,
        issuedAt: now,
        issuedBy: harness.adminAUserId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const adminA = t.withIdentity(harness.adminAIdentity);
    const adminB = t.withIdentity(harness.adminBIdentity);

    const sourceHistory = await t.run(async (ctx) => {
      const invoice = await ctx.db.get(historicalInvoiceId);
      if (!invoice) throw new Error("Missing invoice fixture");
      const subjectId = await ctx.db.insert("subjects", {
        schoolId: harness.schoolA,
        name: "Mathematics",
        code: "MATH",
        createdAt: now,
        updatedAt: now,
      });
      const context = {
        schoolId: harness.schoolA,
        studentId: harness.studentId,
        classId: harness.classAId,
        sessionId: invoice.sessionId,
        termId: invoice.termId,
        createdAt: now,
        updatedAt: now,
        updatedBy: harness.adminAUserId,
      };
      const attendanceId = await ctx.db.insert(
        "reportCardAttendanceStudentValues",
        { ...context, timesPresent: 72 },
      );
      const scoreId = await ctx.db.insert("historicalTermTotals", {
        ...context,
        subjectId,
        total: 87,
        source: "manual_backfill",
      });
      return {
        attendanceId,
        scoreId,
        attendance: await ctx.db.get(attendanceId),
        score: await ctx.db.get(scoreId),
        invoice,
      };
    });

    // --- Phase 1 Step 1: Initiate Transfer ---
    const initiateResult = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "signed_hardcopy_and_sms_otp",
      academicHistorySummary:
        "Completed Basic 5 with Grade A in Mathematics and English",
      attendanceSummaryPct: 97.5,
      medicalNotes: "Asthma - carries emergency inhaler",
    });

    expect(initiateResult.status).toBe("initiated");
    expect(initiateResult.studentName).toBe("Oluwaseun Adeyemi");
    const transferId: Id<"studentTransfers"> = initiateResult.transferId;

    // Verify initiated transfer state in DB
    const transferAfterInit = await t.run(async (ctx) => {
      return (await ctx.db.get(transferId)) as Doc<"studentTransfers"> | null;
    });
    expect(transferAfterInit?.status).toBe("initiated");
    expect(transferAfterInit?.groupId).toEqual(harness.groupA);
    expect(transferAfterInit?.guardianConsentRecorded).toBe(true);
    expect(transferAfterInit?.portableRecordPackage?.studentName).toBe(
      "Oluwaseun Adeyemi",
    );
    expect(transferAfterInit?.portableRecordPackage?.attendanceSummaryPct).toBe(
      97.5,
    );
    expect(
      transferAfterInit?.portableRecordPackage?.medicalNotes,
    ).toBeUndefined();

    // Verify audit event written for initiation
    const initiateAudit = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q
            .eq("module", "enrollment")
            .eq("action", "student_transfer.initiate"),
        )
        .first();
    });
    expect(initiateAudit).not.toBeNull();
    expect(initiateAudit?.outcome).toBe("success");

    // --- Phase 1 Step 2: Source Branch Release ---
    const releaseResult = await adminA.mutation(authorizeSourceReleaseRef, {
      transferId,
      sourceReleaseNote:
        "Principal sign-off approved. Academic dossier cleared for inter-branch relocation.",
    });

    expect(releaseResult.status).toBe("source_released");

    const transferAfterRelease = await t.run(async (ctx) => {
      return (await ctx.db.get(transferId)) as Doc<"studentTransfers"> | null;
    });
    expect(transferAfterRelease?.status).toBe("source_released");
    expect(transferAfterRelease?.sourceReleaseNote).toContain(
      "Principal sign-off approved",
    );
    expect(transferAfterRelease?.sourceReleasedAt).toBeTypeOf("number");

    // Verify audit event written for source release
    const releaseAudit = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q
            .eq("module", "enrollment")
            .eq("action", "student_transfer.source_release"),
        )
        .first();
    });
    expect(releaseAudit).not.toBeNull();
    expect(releaseAudit?.outcome).toBe("success");

    // --- Phase 2: Destination Branch Acceptance ---
    const numbering = await reviewedNumbering(t, harness.adminBIdentity, harness.schoolB, harness.classBId);
    const acceptResult = await adminB.mutation(acceptDestinationTransferRef, {
      transferId,
      destinationClassId: harness.classBId,
      ...numbering,
    });

    expect(acceptResult.status).toBe("completed");
    expect(acceptResult.destinationAdmissionNumber).toBeDefined();

    // Verify transfer record is completed
    const transferFinal = await t.run(async (ctx) => {
      return (await ctx.db.get(transferId)) as Doc<"studentTransfers"> | null;
    });
    expect(transferFinal?.status).toBe("completed");
    expect(transferFinal?.destinationClassId).toEqual(harness.classBId);
    expect(transferFinal?.destinationAcceptedAt).toBeTypeOf("number");

    // The source row remains source-scoped for historical records; acceptance creates a new destination context.
    const sourceStudent = await t.run(async (ctx) =>
      ctx.db.get(harness.studentId),
    );
    const destinationStudent = await t.run(async (ctx) =>
      ctx.db.get(acceptResult.destinationStudentId),
    );
    expect(sourceStudent?.schoolId).toEqual(harness.schoolA);
    expect(sourceStudent?.classId).toEqual(harness.classAId);
    expect(sourceStudent?.enrollmentStatus).toBe("transferred_out");
    expect(destinationStudent?.schoolId).toEqual(harness.schoolB);
    expect(destinationStudent?.classId).toEqual(harness.classBId);
    expect(destinationStudent?.admissionNumber).toBe(
      acceptResult.destinationAdmissionNumber,
    );
    expect(destinationStudent?.enrollmentStatus).toBe("active");

    // Immutability Check (MX-15 §4): Source branch historical records retain sourceSchoolId
    const historicalInvoice = await t.run(async (ctx) => {
      return await ctx.db.get(historicalInvoiceId);
    });
    expect(historicalInvoice?.schoolId).toEqual(harness.schoolA);
    expect(historicalInvoice?.studentId).toEqual(harness.studentId);
    expect(historicalInvoice?.balanceDue).toBe(60000);
    expect(historicalInvoice).toEqual(sourceHistory.invoice);
    expect(
      await t.run((ctx) => ctx.db.get(sourceHistory.attendanceId)),
    ).toEqual(sourceHistory.attendance);
    expect(await t.run((ctx) => ctx.db.get(sourceHistory.scoreId))).toEqual(
      sourceHistory.score,
    );

    const destinationHistory = await adminB.query(
      getStudentTransferHistoryRef,
      {
        studentId: acceptResult.destinationStudentId,
      },
    );
    expect(destinationHistory).toHaveLength(1);
    expect(destinationHistory[0]._id).toBe(transferId);

    // Verify audit event recorded at Destination Branch
    const destinationAudit = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q
            .eq("module", "enrollment")
            .eq("action", "student_transfer.destination_accept"),
        )
        .first();
    });
    expect(destinationAudit).not.toBeNull();
    expect(destinationAudit?.outcome).toBe("success");
    expect(destinationAudit?.safeSummary).toContain(
      "Accepted transfer for student Oluwaseun Adeyemi",
    );
  });

  it("2. Negative: Attempting transfer between schools in different groups is strictly rejected (Cross-Group Gate)", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);

    const adminA = t.withIdentity(harness.adminAIdentity);

    // Attempt transfer between School A (Group A) and School C (Group B)
    await expect(
      adminA.mutation(initiateStudentTransferRef, {
        sourceSchoolId: harness.schoolA,
        destinationSchoolId: harness.schoolC,
        studentId: harness.studentId,
        guardianConsentRecorded: true,
        guardianConsentMethod: "written_parental_consent",
      }),
    ).rejects.toThrow(
      "Cross-group transfers are not permitted. Transferee schools must belong to the same verified school group.",
    );
  });

  it("3. Negative: Attempting to accept before source release is rejected (Two-Phase Commit Gate)", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);

    const adminA = t.withIdentity(harness.adminAIdentity);
    const adminB = t.withIdentity(harness.adminBIdentity);

    // 1. Initiate transfer (status is "initiated")
    const { transferId } = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "in_person_declaration",
    });

    // 2. Destination Admin attempts to accept BEFORE source branch release
    await expect(
      adminB.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: harness.classBId,
      }),
    ).rejects.toThrow(
      "Cannot accept transfer: transfer is in status 'initiated', expected 'source_released'",
    );
  });

  it("4. Privacy verification: Sensitive safeguarding notes, disciplinary incidents, and parent debt balances are strictly omitted from portable transfer record", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);
    const now = Date.now();

    // Attach sensitive safeguarding notes and outstanding family debt to student at source school
    await t.run(async (ctx) => {
      // 1. Inject private sensitive safeguarding and disciplinary records into student record
      await ctx.db.patch(harness.studentId, {
        customAttributes: {
          safeguardingNotes:
            "CONFIDENTIAL_DSL_REPORT: Statutory social services child welfare referral",
          childProtectionFlag: true,
          disciplinaryRecords: "Suspended 3 days for altercation with student",
          familyFinancialDispute:
            "Parent defaulted on term 2 tuition balance of ₦180,000",
        },
      });

      // 2. Add an outstanding overdue invoice in source branch
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId: harness.schoolA,
        name: "2025/2026",
        startDate: now - 10000,
        endDate: now + 10000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const termId = await ctx.db.insert("academicTerms", {
        schoolId: harness.schoolA,
        sessionId,
        name: "Term 2",
        startDate: now - 5000,
        endDate: now + 5000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const feePlanId = await ctx.db.insert("feePlans", {
        schoolId: harness.schoolA,
        name: "Tuition Fee Plan",
        currency: "NGN",
        lineItems: [
          {
            id: "tuition",
            label: "Tuition",
            amount: 180000,
            category: "tuition",
            order: 0,
          },
        ],
        installmentPolicy: {
          enabled: false,
          installmentCount: 1,
          intervalDays: 30,
          firstDueDays: 14,
        },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: harness.adminAUserId,
        updatedBy: harness.adminAUserId,
      });

      await ctx.db.insert("studentInvoices", {
        schoolId: harness.schoolA,
        classId: harness.classAId,
        studentId: harness.studentId,
        sessionId,
        termId,
        feePlanId,
        feePlanNameSnapshot: "Tuition Fee Plan",
        invoiceNumber: "DEBT-INV-001",
        currency: "NGN",
        lineItems: [],
        installmentSchedule: [],
        subtotal: 180000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 180000,
        amountPaid: 0,
        balanceDue: 180000,
        status: "overdue",
        dueDate: now - 10000,
        issuedAt: now - 20000,
        issuedBy: harness.adminAUserId,
        notes: "Severely overdue family fee arrears",
        createdAt: now,
        updatedAt: now,
      });
    });

    const adminA = t.withIdentity(harness.adminAIdentity);

    // Initiate student transfer
    const { transferId } = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "biometric_portal_verification",
      academicHistorySummary: "Completed Basic 5 coursework; honors in Science",
      attendanceSummaryPct: 98.0,
      medicalNotes: "Allergic to amoxicillin",
    });

    // Inspect compiled portableRecordPackage
    const transferRecord = await t.run(async (ctx) => {
      return (await ctx.db.get(
        transferId as Id<"studentTransfers">,
      )) as Doc<"studentTransfers"> | null;
    });

    expect(transferRecord).not.toBeNull();
    const pkg = transferRecord?.portableRecordPackage;
    expect(pkg).toBeDefined();

    // 1. Assert absolute absence of prohibited fields
    expect(pkg).not.toHaveProperty("safeguardingNotes");
    expect(pkg).not.toHaveProperty("childProtectionFlag");
    expect(pkg).not.toHaveProperty("disciplinaryRecords");
    expect(pkg).not.toHaveProperty("familyFinancialDispute");
    expect(pkg).not.toHaveProperty("balanceDue");
    expect(pkg).not.toHaveProperty("overdueBalance");
    expect(pkg).not.toHaveProperty("invoices");
    expect(pkg).not.toHaveProperty("debtHistory");

    // 2. Assert serialized payload does not leak confidential tokens or debt amounts
    const serializedPackage = JSON.stringify(pkg);
    expect(serializedPackage).not.toContain("CONFIDENTIAL");
    expect(serializedPackage).not.toContain("social services");
    expect(serializedPackage).not.toContain("Suspended");
    expect(serializedPackage).not.toContain("180,000");
    expect(serializedPackage).not.toContain("180000");
    expect(serializedPackage).not.toContain("overdue");
    expect(serializedPackage).not.toContain("fee arrears");

    // 3. Assert permitted, necessary portable data is present and intact
    expect(pkg?.studentName).toBe("Oluwaseun Adeyemi");
    expect(pkg?.gender).toBe("male");
    expect(pkg?.dateOfBirth).toBe("2014-05-12");
    expect(pkg?.academicHistorySummary).toBe(
      "Completed Basic 5 coursework; honors in Science",
    );
    expect(pkg?.attendanceSummaryPct).toBe(98.0);
    expect(pkg?.medicalNotes).toBeUndefined();
  });

  it("5. Transfer detail, list, group, and history queries deny unauthenticated and cross-tenant callers", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);
    const adminA = t.withIdentity(harness.adminAIdentity);
    const outsider = t.withIdentity(harness.unauthorizedIdentity);
    const { transferId } = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "signed_form",
    });

    await expect(t.query(getTransferRef, { transferId })).rejects.toThrow(
      /Not authorized|Forbidden/,
    );
    await expect(
      t.query(listTransfersBySchoolRef, { schoolId: harness.schoolA }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(
      t.query(listTransfersByGroupRef, { groupId: harness.groupA }),
    ).rejects.toThrow(/Not authorized|Forbidden/);
    await expect(
      t.query(getStudentTransferHistoryRef, { studentId: harness.studentId }),
    ).rejects.toThrow(/UNAUTHENTICATED/);
    await expect(
      outsider.query(getTransferRef, { transferId }),
    ).rejects.toThrow(/Not authorized|Forbidden/);
    await expect(
      outsider.query(listTransfersBySchoolRef, { schoolId: harness.schoolA }),
    ).rejects.toThrow(/Not authorized|Forbidden/);

    const sourceView = await adminA.query(getTransferRef, { transferId });
    expect(
      sourceView && "destinationAdmissionNumber" in sourceView
        ? sourceView.destinationAdmissionNumber
        : undefined,
    ).toBeUndefined();
  });

  it("6. Manual destination admission number supports explicit reviewed counter advance and exact replay", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);
    const adminA = t.withIdentity(harness.adminAIdentity);
    const adminB = t.withIdentity(harness.adminBIdentity);
    const { transferId } = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "signed_form",
    });
    await adminA.mutation(authorizeSourceReleaseRef, { transferId });

    await expect(
      adminB.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: harness.classBId,
        admissionNumberOverride: "IKY-2026-0001",
        admissionNumberOverrideConfirmed: true,
        admissionNumberOverrideReason: "Registrar correction",
      }),
    ).rejects.toThrow("enrollment.admissions.override_number");

    const levelCounterId = await t.run(async (ctx) => {
      await ctx.db.insert("membershipDirectGrants", {
        membershipId: harness.adminBMembershipId,
        capability: "enrollment.admissions.override_number",
        grantedAt: Date.now(),
        reason: "Transfer admissions registrar",
      });
      await ctx.db.insert("membershipDirectGrants", {
        membershipId: harness.adminBMembershipId,
        capability: "enrollment.intakes.manage",
        grantedAt: Date.now(),
        reason:
          "Managed transfer authority is explicit, not the legacy admin role",
      });
      return await ctx.db.insert("admissionNumberSequences", {
        schoolId: harness.schoolB,
        key: "jss1",
        name: "JSS 1 admissions",
        level: "jss1",
        currentSequence: 7,
        resetFrequency: "continuous",
        resetPeriod: "continuous",
        status: "active",
        configVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      adminB.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: harness.classBId,
        admissionNumberOverride: "IKY-2026-0001",
        admissionNumberOverrideConfirmed: true,
      }),
    ).rejects.toThrow("requires a reason");

    const numbering = await reviewedNumbering(t, harness.adminBIdentity, harness.schoolB, harness.classBId);
    expect(numbering.expectedCounterKey).toBe("jss1");
    const acceptance = {
      transferId,
      destinationClassId: harness.classBId,
      admissionNumberOverride: "IKY-2026-0001",
      admissionNumberOverrideConfirmed: true,
      admissionNumberOverrideReason: "Registrar correction",
      advanceCounterTo: 10,
      ...numbering,
    };
    const accepted = await adminB.mutation(acceptDestinationTransferRef, acceptance);
    expect(await adminB.mutation(acceptDestinationTransferRef, acceptance)).toEqual(accepted);
    expect(accepted.destinationAdmissionNumber).toBe("IKY-2026-0001");
    const manualClaims = await t.run((ctx) =>
      ctx.db.query("admissionNumberClaims").collect(),
    );
    expect(manualClaims).toHaveLength(1);
    const counters = await t.run(async (ctx) => ({
      reviewedLevel: await ctx.db.get(levelCounterId),
      defaultPolicy: await ctx.db.query("admissionNumberPolicies").first(),
    }));
    expect(counters.reviewedLevel?.currentSequence).toBe(10);
    expect(counters.defaultPolicy?.currentSequence).toBe(1);
    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q
            .eq("module", "enrollment")
            .eq("action", "student_transfer.destination_accept"),
        )
        .first(),
    );
    expect(audit?.safeSummary).toContain(
      "confirmed manual override: Registrar correction",
    );
  });

  it("7. Additional Gates: Guardian consent requirement and transfer cancellation/rejection lifecycle", async () => {
    const t = convexTest(schema, modules);
    const harness = await setupTestHarness(t);

    const adminA = t.withIdentity(harness.adminAIdentity);
    const adminB = t.withIdentity(harness.adminBIdentity);

    // Gate A: Missing guardian consent is rejected
    await expect(
      adminA.mutation(initiateStudentTransferRef, {
        sourceSchoolId: harness.schoolA,
        destinationSchoolId: harness.schoolB,
        studentId: harness.studentId,
        guardianConsentRecorded: false,
        guardianConsentMethod: "none",
      }),
    ).rejects.toThrow(
      "Guardian consent must be explicitly recorded prior to initiating transfer",
    );

    // Gate B: Valid initiation followed by source branch cancellation
    const { transferId: transfer1 } = await adminA.mutation(
      initiateStudentTransferRef,
      {
        sourceSchoolId: harness.schoolA,
        destinationSchoolId: harness.schoolB,
        studentId: harness.studentId,
        guardianConsentRecorded: true,
        guardianConsentMethod: "in_person_verbal",
      },
    );

    const cancelResult = await adminA.mutation(rejectOrCancelTransferRef, {
      transferId: transfer1,
      reason: "Family relocated to a different state; transfer aborted.",
    });
    expect(cancelResult.status).toBe("cancelled");

    const cancelledTransfer = await t.run(async (ctx) => {
      return (await ctx.db.get(
        transfer1 as Id<"studentTransfers">,
      )) as Doc<"studentTransfers"> | null;
    });
    expect(cancelledTransfer?.status).toBe("cancelled");
    expect(cancelledTransfer?.cancellationReason).toContain("Family relocated");

    // Student remains active at source school
    const studentAfterCancel = await t.run(async (ctx) => {
      return await ctx.db.get(harness.studentId);
    });
    expect(studentAfterCancel?.schoolId).toEqual(harness.schoolA);
    expect(studentAfterCancel?.enrollmentStatus).toBe("active");

    // Cannot accept a cancelled transfer
    await expect(
      adminB.mutation(acceptDestinationTransferRef, {
        transferId: transfer1,
        destinationClassId: harness.classBId,
      }),
    ).rejects.toThrow(
      "Cannot accept transfer: transfer is in status 'cancelled', expected 'source_released'",
    );

    // Gate C: Valid initiation & source release followed by destination branch rejection
    const { transferId: transfer2 } = await adminA.mutation(
      initiateStudentTransferRef,
      {
        sourceSchoolId: harness.schoolA,
        destinationSchoolId: harness.schoolB,
        studentId: harness.studentId,
        guardianConsentRecorded: true,
        guardianConsentMethod: "portal_submission",
      },
    );

    await adminA.mutation(authorizeSourceReleaseRef, {
      transferId: transfer2,
      sourceReleaseNote: "Released for relocation.",
    });

    const rejectResult = await adminB.mutation(rejectOrCancelTransferRef, {
      transferId: transfer2,
      reason: "Class capacity reached in target cohort for 2026/2027.",
    });
    expect(rejectResult.status).toBe("rejected");

    const rejectedTransfer = await t.run(async (ctx) => {
      return (await ctx.db.get(
        transfer2 as Id<"studentTransfers">,
      )) as Doc<"studentTransfers"> | null;
    });
    expect(rejectedTransfer?.status).toBe("rejected");
    expect(rejectedTransfer?.cancellationReason).toContain(
      "Class capacity reached",
    );

    // Student remains active at source school
    const studentAfterReject = await t.run(async (ctx) => {
      return await ctx.db.get(harness.studentId);
    });
    expect(studentAfterReject?.schoolId).toEqual(harness.schoolA);
    expect(studentAfterReject?.enrollmentStatus).toBe("active");
  });
});

describe("U6 routed workflow contracts", () => {
  it("rejects stale format/counter intent and replays exact reviewed acceptance atomically", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const source = t.withIdentity(h.adminAIdentity);
    const destination = t.withIdentity(h.adminBIdentity);
    const proposal = {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Signed form reference 123",
      requestKey: "stable-intent",
      proposalClassName: "JSS 1",
      proposalSessionName: "2026/27",
    };
    const first = await source.mutation(initiateStudentTransferRef, proposal);
    expect(await source.mutation(initiateStudentTransferRef, proposal)).toEqual(
      first,
    );
    await expect(
      source.mutation(initiateStudentTransferRef, {
        ...proposal,
        proposalClassName: "Changed",
      }),
    ).rejects.toThrow("different proposal");
    await expect(
      source.mutation(initiateStudentTransferRef, {
        ...proposal,
        requestKey: "new-intent",
      }),
    ).rejects.toThrow("active transfer");
    await expect(
      destination.mutation(authorizeSourceReleaseRef, {
        transferId: first.transferId,
      }),
    ).rejects.toThrow();
    const release = {
      transferId: first.transferId,
      sourceReleaseNote: "Reviewed consent",
    };
    expect(await source.mutation(authorizeSourceReleaseRef, release)).toEqual(
      await source.mutation(authorizeSourceReleaseRef, release),
    );
    await expect(
      source.mutation(acceptDestinationTransferRef, {
        transferId: first.transferId,
        destinationClassId: h.classBId,
      }),
    ).rejects.toThrow();
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        transferId: first.transferId,
        destinationClassId: h.classAId,
      }),
    ).rejects.toThrow("Destination class");
    const args = {
      transferId: first.transferId,
      destinationClassId: h.classBId,
      ...(await reviewedNumbering(t, h.adminBIdentity, h.schoolB, h.classBId)),
    };
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        ...args,
        expectedPolicyVersion: 9,
      }),
    ).rejects.toThrow();
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        ...args,
        expectedFormatVersion: "stale-format",
      }),
    ).rejects.toThrow("changed");
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        ...args,
        expectedCounterVersion: 9,
      }),
    ).rejects.toThrow("changed");
    const [accepted, replay] = await Promise.all([
      destination.mutation(acceptDestinationTransferRef, args),
      destination.mutation(acceptDestinationTransferRef, args),
    ]);
    expect(replay).toEqual(accepted);
    expect(await source.mutation(initiateStudentTransferRef, proposal)).toEqual(
      first,
    );
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        ...args,
        admissionNumberOverride: "NEW",
      }),
    ).rejects.toThrow("Cannot accept");
    const rows = await t.run(async (ctx) => ({
      students: await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", h.schoolB))
        .collect(),
      claims: await ctx.db.query("admissionNumberClaims").collect(),
      policy: await ctx.db.query("admissionNumberPolicies").first(),
      destinationMemberships: await ctx.db
        .query("branchMemberships")
        .withIndex("by_school_and_status", (q) =>
          q.eq("schoolId", h.schoolB).eq("status", "active"),
        )
        .collect(),
      audits: await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q
            .eq("module", "enrollment")
            .eq("action", "student_transfer.destination_accept"),
        )
        .collect(),
    }));
    expect(rows.students).toHaveLength(1);
    expect(rows.claims).toHaveLength(1);
    expect(rows.policy?.currentSequence).toBe(2);
    expect(rows.audits).toHaveLength(1);
    expect(rows.destinationMemberships).toHaveLength(2);
    expect(rows.students[0].guardianPhone).toBeUndefined();
    const sourceView = await source.query(getTransferRef, {
      transferId: first.transferId,
    });
    expect(sourceView).not.toHaveProperty("acceptanceIntent");
    expect(sourceView).not.toHaveProperty("destinationSessionId");
  });

  it("selectors expose only same-group names and own rosters; sessions, group and source state are rechecked", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const source = t.withIdentity(h.adminAIdentity);
    const destination = t.withIdentity(h.adminBIdentity);
    const workspace = await source.query(transfersApi.getTransferWorkspace, {
      schoolId: h.schoolA,
    });
    expect(
      workspace.allowed && workspace.destinations.map((d) => d._id),
    ).toEqual([h.schoolB]);
    await expect(
      source.query(transfersApi.listTransferCandidates, {
        schoolId: h.schoolA,
        classId: h.classBId,
      }),
    ).rejects.toThrow();
    expect(
      await source.query(transfersApi.getTransferWorkspace, {
        schoolId: h.schoolB,
      }),
    ).toEqual({ allowed: false });
    const { transferId } = await source.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Written consent",
    });
    await t.run((ctx) => ctx.db.patch(h.groupA, { status: "archived" }));
    await expect(
      source.mutation(authorizeSourceReleaseRef, { transferId }),
    ).rejects.toThrow("active school group");
    await t.run((ctx) => ctx.db.patch(h.groupA, { status: "active" }));
    await source.mutation(authorizeSourceReleaseRef, { transferId });
    const session = await t.run(async (ctx) =>
      ctx.db.insert("academicSessions", {
        schoolId: h.schoolA,
        name: "Foreign",
        isActive: true,
        startDate: 1,
        endDate: 2,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: h.classBId,
        destinationSessionId: session,
      }),
    ).rejects.toThrow("active academic session");
    const numbering = await reviewedNumbering(t, h.adminBIdentity, h.schoolB, h.classBId);
    await t.run(async (ctx) =>
      ctx.db.patch(h.studentId, { enrollmentStatus: "withdrawn" }),
    );
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: h.classBId,
        ...numbering,
      }),
    ).rejects.toThrow("Source student record");
    const reason = {
      transferId,
      reason: "Family withdrew enrollment",
      action: "cancelled" as const,
    };
    const cancelled = await source.mutation(rejectOrCancelTransferRef, reason);
    expect(await source.mutation(rejectOrCancelTransferRef, reason)).toEqual(
      cancelled,
    );
    expect(
      (await t.run((ctx) => ctx.db.get(h.studentId)))?.enrollmentStatus,
    ).toBe("withdrawn");
    await expect(
      destination.mutation(rejectOrCancelTransferRef, {
        ...reason,
        action: "rejected",
      }),
    ).rejects.toThrow("finalized");
  });

  it("redacts legacy health data, filters unrelated group records and gives destination a released/rejected timeline", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const source = t.withIdentity(h.adminAIdentity);
    const destination = t.withIdentity(h.adminBIdentity);
    const { transferId } = await source.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Written consent",
    });
    await t.run(async (ctx) => {
      const row = await ctx.db.get(transferId);
      if (!row?.portableRecordPackage) throw new Error("Missing fixture");
      await ctx.db.patch(transferId, {
        portableRecordPackage: {
          ...row.portableRecordPackage,
          medicalNotes: "legacy private health",
        },
      });
      await ctx.db.insert("studentTransfers", {
        ...Object.fromEntries(
          Object.entries(row).filter(([key]) => !key.startsWith("_")),
        ),
        groupId: h.groupA,
        sourceSchoolId: h.schoolB,
        destinationSchoolId: h.schoolC,
        studentId: h.studentId,
        studentName: "Unrelated student",
        guardianConsentRecorded: true,
        guardianConsentMethod: "Written",
        status: "initiated",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const view = await destination.query(getTransferRef, { transferId });
    expect(JSON.stringify(view)).not.toContain("legacy private health");
    expect(view?.portableRecordPackage?.attendanceSummaryPct).toBeUndefined();
    expect(
      await source.query(listTransfersByGroupRef, { groupId: h.groupA }),
    ).toHaveLength(1);
    await source.mutation(authorizeSourceReleaseRef, {
      transferId,
      sourceReleaseNote: "Source private note",
    });
    const rejection = {
      transferId,
      reason: "No places available",
      action: "rejected" as const,
    };
    expect(
      await destination.mutation(rejectOrCancelTransferRef, rejection),
    ).toEqual(await destination.mutation(rejectOrCancelTransferRef, rejection));
    const rejected = await destination.query(getTransferRef, { transferId });
    expect(rejected?.sourceReleaseRecorded).toBe(true);
    expect(rejected).not.toHaveProperty("sourceReleaseNote");
  });
});

describe("U6 continuous history and current branch authority", () => {
  it("follows two enrollment contexts while keeping each branch's private release data scoped", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const source = t.withIdentity(h.adminAIdentity);
    const destination = t.withIdentity(h.adminBIdentity);
    await t.run(async (ctx) => {
      await ctx.db.insert("academicSessions", {
        schoolId: h.schoolA,
        name: "2026/27",
        startDate: Date.UTC(2026, 8, 1),
        endDate: Date.UTC(2027, 7, 31),
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("admissionNumberPolicies", {
        schoolId: h.schoolA,
        pattern: "{SCHOOL}-{SEQ:4}",
        schoolCode: "SRC",
        campusCode: "A",
        currentSequence: 1,
        resetFrequency: "continuous",
        version: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const first = await source.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Written consent",
    });
    await source.mutation(authorizeSourceReleaseRef, {
      transferId: first.transferId,
      sourceReleaseNote: "First branch note",
    });
    const arrived = await destination.mutation(acceptDestinationTransferRef, {
      transferId: first.transferId,
      destinationClassId: h.classBId,
      ...(await reviewedNumbering(t, h.adminBIdentity, h.schoolB, h.classBId)),
    });
    const second = await destination.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolB,
      destinationSchoolId: h.schoolA,
      studentId: arrived.destinationStudentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "New written consent",
    });
    await destination.mutation(authorizeSourceReleaseRef, {
      transferId: second.transferId,
      sourceReleaseNote: "Second branch private note",
    });
    const returned = await source.mutation(acceptDestinationTransferRef, {
      transferId: second.transferId,
      destinationClassId: h.classAId,
      ...(await reviewedNumbering(t, h.adminAIdentity, h.schoolA, h.classAId)),
    });
    const history = await source.query(getStudentTransferHistoryRef, {
      studentId: returned.destinationStudentId,
    });
    expect(history).toHaveLength(2);
    expect(JSON.stringify(history)).not.toContain("Second branch private note");
    expect(
      await source.query(getStudentTransferHistoryRef, {
        studentId: h.studentId,
      }),
    ).toHaveLength(2);
    await expect(
      destination.query(getStudentTransferHistoryRef, {
        studentId: h.studentId,
      }),
    ).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(h.studentId)))?.schoolId).toBe(
      h.schoolA,
    );
  });
  it("capability-only transfer authority is branch-scoped and revocation also denies replay", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const destination = t.withIdentity(h.adminBIdentity);
    const source = t.withIdentity(h.adminAIdentity);
    const userId = await t.run(async (ctx) => {
      const membership = await ctx.db.get(h.adminBMembershipId);
      if (!membership?.legacyUserId) throw new Error("Missing fixture");
      await ctx.db.patch(membership.legacyUserId, {
        role: "teacher",
        isSchoolAdmin: false,
      });
      return membership.legacyUserId;
    });
    expect(
      await destination.query(transfersApi.getTransferWorkspace, {
        schoolId: h.schoolB,
      }),
    ).toEqual({ allowed: false });
    const grantId = await t.run((ctx) =>
      ctx.db.insert("membershipDirectGrants", {
        membershipId: h.adminBMembershipId,
        capability: "enrollment.intakes.manage",
        reason: "Transfer registrar",
        grantedAt: 1,
      }),
    );
    const workspace = await destination.query(
      transfersApi.getTransferWorkspace,
      { schoolId: h.schoolB },
    );
    expect(workspace.allowed).toBe(true);
    expect(workspace.allowed && workspace.canOverrideNumber).toBe(false);
    const { transferId } = await source.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Written consent",
    });
    await source.mutation(authorizeSourceReleaseRef, { transferId });
    const acceptance = {
      transferId,
      destinationClassId: h.classBId,
      ...(await reviewedNumbering(t, h.adminBIdentity, h.schoolB, h.classBId)),
    };
    await destination.mutation(acceptDestinationTransferRef, acceptance);
    await t.run(async (ctx) => {
      await ctx.db.delete(grantId);
      expect((await ctx.db.get(userId))?.role).toBe("teacher");
    });
    await expect(
      destination.mutation(acceptDestinationTransferRef, acceptance),
    ).rejects.toThrow("Forbidden");
  });
});

describe("U6 Portal canonical identity continuity", () => {
  async function completeTransfer(
    t: ReturnType<typeof convexTest>,
    h: TestHarness,
  ) {
    const source = t.withIdentity(h.adminAIdentity);
    const destination = t.withIdentity(h.adminBIdentity);
    const initiated = await source.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Reviewed written guardian consent",
    });
    await source.mutation(authorizeSourceReleaseRef, {
      transferId: initiated.transferId,
    });
    const acceptanceArgs = {
      transferId: initiated.transferId,
      destinationClassId: h.classBId,
      ...(await reviewedNumbering(t, h.adminBIdentity, h.schoolB, h.classBId)),
    };
    const accepted = await destination.mutation(
      acceptDestinationTransferRef,
      acceptanceArgs,
    );
    return { accepted, acceptanceArgs, destination };
  }

  it("opens the current destination with the same canonical login and keeps source history explicitly selectable", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    await t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId: h.schoolA,
        name: "2025/26 source history",
        startDate: 1,
        endDate: 2,
        isActive: false,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("academicTerms", {
        schoolId: h.schoolA,
        sessionId,
        name: "Source historical term",
        startDate: 1,
        endDate: 2,
        isActive: false,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const { accepted, acceptanceArgs, destination } = await completeTransfer(
      t,
      h,
    );
    const studentLogin = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|student-seun",
      subject: "auth-student-seun",
      email: "different-contact-value@invalid.test",
    });

    expect(await studentLogin.query(portalApi.canAccessPortal, {})).toBe(true);
    expect(
      await studentLogin.query(portalApi.getPortalShellContext, {}),
    ).toEqual({
      schoolId: h.schoolB,
      selectedStudentId: accepted.destinationStudentId,
    });
    const current = await studentLogin.query(portalApi.getWorkspaceData, {});
    expect(current.selectedStudentId).toBe(accepted.destinationStudentId);
    expect(current.school.id).toBe(h.schoolB);
    expect(current.viewer.schoolId).toBe(h.schoolB);
    expect(current.history).toHaveLength(0);
    expect(
      (
        await studentLogin.query(
          api.functions.academic.lessonKnowledgePortal.getPortalTopicIndexData,
          {},
        )
      ).classId,
    ).toBe(h.classBId);
    expect(
      current.students.map((student) => [
        student.studentId,
        student.schoolId,
        student.enrollmentState,
      ]),
    ).toEqual([
      [accepted.destinationStudentId, h.schoolB, "active"],
      [h.studentId, h.schoolA, "historical"],
    ]);

    expect(
      await studentLogin.query(portalApi.getPortalShellContext, {
        studentId: h.studentId,
      }),
    ).toEqual({ schoolId: h.schoolA, selectedStudentId: h.studentId });
    const sourceHistory = await studentLogin.query(portalApi.getWorkspaceData, {
      studentId: h.studentId,
    });
    expect(sourceHistory.school.id).toBe(h.schoolA);
    expect(sourceHistory.selectedStudentId).toBe(h.studentId);
    expect(
      (
        await studentLogin.query(
          api.functions.academic.lessonKnowledgePortal.getPortalTopicIndexData,
          { studentId: h.studentId },
        )
      ).classId,
    ).toBe(h.classAId);
    expect(sourceHistory.selectedStudent?.enrollmentState).toBe("historical");
    expect(sourceHistory.history).toHaveLength(1);
    expect(sourceHistory.history[0].sessionName).toBe("2025/26 Source History");
    expect(sourceHistory.students).toHaveLength(2);

    const replay = await destination.mutation(
      acceptDestinationTransferRef,
      acceptanceArgs,
    );
    expect(replay).toEqual(accepted);
    const counts = await t.run(async (ctx) => {
      const sourceUser = await ctx.db.get(h.studentUserId);
      if (!sourceUser?.personId)
        throw new Error("Missing canonical source fixture");
      const personId = sourceUser.personId;
      return {
        people: await ctx.db
          .query("persons")
          .withIndex("by_token_identifier", (q) =>
            q.eq("authTokenIdentifier", "https://auth.melo.test|student-seun"),
          )
          .collect(),
        users: await ctx.db
          .query("users")
          .withIndex("by_auth_token_identifier", (q) =>
            q.eq("authTokenIdentifier", "https://auth.melo.test|student-seun"),
          )
          .collect(),
        memberships: await ctx.db
          .query("branchMemberships")
          .withIndex("by_person_and_status", (q) =>
            q.eq("personId", personId),
          )
          .collect(),
        destinationStudents: await ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", h.schoolB))
          .collect(),
      };
    });
    expect(counts.people).toHaveLength(1);
    expect(counts.users).toHaveLength(2);
    expect(new Set(counts.users.map((user) => user.authId))).toEqual(
      new Set(["auth-student-seun"]),
    );
    expect(counts.memberships).toHaveLength(2);
    expect(counts.destinationStudents).toHaveLength(1);
  });

  it("omits unrelated projections and fails selected destination access after membership revocation", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const { accepted } = await completeTransfer(t, h);
    const studentLogin = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|student-seun",
      subject: "auth-student-seun",
    });
    const unrelated = await t.run(async (ctx) => {
      const classId = await ctx.db.insert("classes", {
        schoolId: h.schoolC,
        name: "Unrelated",
        level: "Y6",
        createdAt: 1,
        updatedAt: 1,
      });
      const userId = await ctx.db.insert("users", {
        schoolId: h.schoolC,
        authId: "unrelated-subject",
        authTokenIdentifier: "https://auth.melo.test|student-seun",
        name: "Wrong branch projection",
        email: "seun.adeyemi@family.test",
        role: "student",
        createdAt: 1,
        updatedAt: 1,
      });
      return await ctx.db.insert("students", {
        schoolId: h.schoolC,
        classId,
        userId,
        admissionNumber: "WRONG-1",
        enrollmentStatus: "active",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const before = await studentLogin.query(portalApi.getWorkspaceData, {});
    expect(before.students.map((student) => student.studentId)).not.toContain(
      unrelated,
    );

    await t.run(async (ctx) => {
      const destinationStudent = await ctx.db.get(
        accepted.destinationStudentId,
      );
      const destinationUser =
        destinationStudent && (await ctx.db.get(destinationStudent.userId));
      if (!destinationUser?.personId)
        throw new Error("Missing canonical destination fixture");
      const personId = destinationUser.personId;
      const membership = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", personId).eq("schoolId", h.schoolB),
        )
        .unique();
      if (!membership)
        throw new Error("Missing destination membership fixture");
      await ctx.db.patch(membership._id, { status: "suspended" });
    });
    const after = await studentLogin.query(portalApi.getWorkspaceData, {});
    expect(after.selectedStudentId).toBe(h.studentId);
    expect(after.students.map((student) => student.studentId)).toEqual([
      h.studentId,
    ]);
    await expect(
      studentLogin.query(portalApi.getWorkspaceData, {
        studentId: accepted.destinationStudentId,
      }),
    ).rejects.toThrow("Student not found");
  });

  it("denies a suspended canonical person and never falls back to a same-email legacy row", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const login = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|student-seun",
      subject: "auth-student-seun",
    });
    await t.run(async (ctx) => {
      const user = await ctx.db.get(h.studentUserId);
      if (!user?.personId) throw new Error("Missing person fixture");
      await ctx.db.insert("users", {
        schoolId: h.schoolB,
        authId: "auth-student-seun",
        name: "Same email is not identity",
        email: user.email,
        role: "student",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.patch(user.personId, { status: "suspended" });
    });
    expect(await login.query(portalApi.canAccessPortal, {})).toBe(false);
    await expect(login.query(portalApi.getWorkspaceData, {})).rejects.toThrow(
      "Canonical account is inactive",
    );
  });

  it("retains only exact trusted-subject compatibility for an unlinked legacy Portal row", async () => {
    const t = convexTest(schema, modules);
    const { studentId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Legacy Portal School",
        slug: "legacy-portal-school",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId,
        name: "Legacy Class",
        level: "Y5",
        createdAt: 1,
        updatedAt: 1,
      });
      const userId = await ctx.db.insert("users", {
        schoolId,
        authId: "exact-legacy-student",
        name: "Legacy Student",
        email: "contact-only@legacy.test",
        role: "student",
        createdAt: 1,
        updatedAt: 1,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId,
        userId,
        admissionNumber: "LEGACY-1",
        enrollmentStatus: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      return { studentId };
    });
    const trusted = t.withIdentity({
      tokenIdentifier: "https://legacy-auth.test|not-prelinked",
      subject: "exact-legacy-student",
      issuer: "https://legacy-auth.test",
      email: "not-the-contact@legacy.test",
    });
    expect(await trusted.query(portalApi.canAccessPortal, {})).toBe(true);
    expect((await trusted.query(portalApi.getWorkspaceData, {})).selectedStudentId).toBe(studentId);
    const wrongSubject = t.withIdentity({
      tokenIdentifier: "https://legacy-auth.test|not-prelinked",
      subject: "wrong-subject",
      issuer: "https://legacy-auth.test",
      email: "contact-only@legacy.test",
    });
    expect(await wrongSubject.query(portalApi.canAccessPortal, {})).toBe(false);
  });

  it("fails acceptance closed when reviewed canonical source linkage is missing and consumes nothing", async () => {
    const t = convexTest(schema, modules);
    const h = await setupTestHarness(t);
    const source = t.withIdentity(h.adminAIdentity);
    const destination = t.withIdentity(h.adminBIdentity);
    const { transferId } = await source.mutation(initiateStudentTransferRef, {
      sourceSchoolId: h.schoolA,
      destinationSchoolId: h.schoolB,
      studentId: h.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "Reviewed written guardian consent",
    });
    await source.mutation(authorizeSourceReleaseRef, { transferId });
    const numbering = await reviewedNumbering(t, h.adminBIdentity, h.schoolB, h.classBId);
    await t.run((ctx) =>
      ctx.db.patch(h.studentUserId, { personId: undefined }),
    );
    await expect(
      destination.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: h.classBId,
        ...numbering,
      }),
    ).rejects.toThrow("reviewed canonical person");
    const state = await t.run(async (ctx) => ({
      transfer: await ctx.db.get(transferId),
      students: await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", h.schoolB))
        .collect(),
      claims: await ctx.db.query("admissionNumberClaims").collect(),
      policy: await ctx.db.query("admissionNumberPolicies").first(),
    }));
    expect(state.transfer?.status).toBe("source_released");
    expect(state.students).toHaveLength(0);
    expect(state.claims).toHaveLength(0);
    expect(state.policy?.currentSequence).toBe(1);
  });
});
