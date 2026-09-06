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
const _localModules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

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
  ])
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

interface TestHarness {
  schoolA: Id<"schools">;
  schoolB: Id<"schools">;
  schoolC: Id<"schools">;
  groupA: Id<"schoolGroups">;
  groupB: Id<"schoolGroups">;
  adminAIdentity: { tokenIdentifier: string; subject: string; email: string };
  adminBIdentity: { tokenIdentifier: string; subject: string; email: string };
  unauthorizedIdentity: { tokenIdentifier: string; subject: string; email: string };
  classAId: Id<"classes">;
  classBId: Id<"classes">;
  studentId: Id<"students">;
  studentUserId: Id<"users">;
  adminAUserId: Id<"users">;
  adminBMembershipId: Id<"branchMemberships">;
}

async function setupTestHarness(t: ReturnType<typeof convexTest>): Promise<TestHarness> {
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

    // --- Phase 1 Step 1: Initiate Transfer ---
    const initiateResult = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "signed_hardcopy_and_sms_otp",
      academicHistorySummary: "Completed Basic 5 with Grade A in Mathematics and English",
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
    expect(transferAfterInit?.portableRecordPackage?.studentName).toBe("Oluwaseun Adeyemi");
    expect(transferAfterInit?.portableRecordPackage?.attendanceSummaryPct).toBe(97.5);
    expect(transferAfterInit?.portableRecordPackage?.medicalNotes).toBe("Asthma - carries emergency inhaler");

    // Verify audit event written for initiation
    const initiateAudit = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q.eq("module", "enrollment").eq("action", "student_transfer.initiate")
        )
        .first();
    });
    expect(initiateAudit).not.toBeNull();
    expect(initiateAudit?.outcome).toBe("success");

    // --- Phase 1 Step 2: Source Branch Release ---
    const releaseResult = await adminA.mutation(authorizeSourceReleaseRef, {
      transferId,
      sourceReleaseNote: "Principal sign-off approved. Academic dossier cleared for inter-branch relocation.",
    });

    expect(releaseResult.status).toBe("source_released");

    const transferAfterRelease = await t.run(async (ctx) => {
      return (await ctx.db.get(transferId)) as Doc<"studentTransfers"> | null;
    });
    expect(transferAfterRelease?.status).toBe("source_released");
    expect(transferAfterRelease?.sourceReleaseNote).toContain("Principal sign-off approved");
    expect(transferAfterRelease?.sourceReleasedAt).toBeTypeOf("number");

    // Verify audit event written for source release
    const releaseAudit = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q.eq("module", "enrollment").eq("action", "student_transfer.source_release")
        )
        .first();
    });
    expect(releaseAudit).not.toBeNull();
    expect(releaseAudit?.outcome).toBe("success");

    // --- Phase 2: Destination Branch Acceptance ---
    const acceptResult = await adminB.mutation(acceptDestinationTransferRef, {
      transferId,
      destinationClassId: harness.classBId,
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
    const sourceStudent = await t.run(async (ctx) => ctx.db.get(harness.studentId));
    const destinationStudent = await t.run(async (ctx) =>
      ctx.db.get(acceptResult.destinationStudentId)
    );
    expect(sourceStudent?.schoolId).toEqual(harness.schoolA);
    expect(sourceStudent?.classId).toEqual(harness.classAId);
    expect(sourceStudent?.enrollmentStatus).toBe("transferred_out");
    expect(destinationStudent?.schoolId).toEqual(harness.schoolB);
    expect(destinationStudent?.classId).toEqual(harness.classBId);
    expect(destinationStudent?.admissionNumber).toBe(acceptResult.destinationAdmissionNumber);
    expect(destinationStudent?.enrollmentStatus).toBe("active");

    // Immutability Check (MX-15 §4): Source branch historical records retain sourceSchoolId
    const historicalInvoice = await t.run(async (ctx) => {
      return await ctx.db.get(historicalInvoiceId);
    });
    expect(historicalInvoice?.schoolId).toEqual(harness.schoolA);
    expect(historicalInvoice?.studentId).toEqual(harness.studentId);
    expect(historicalInvoice?.balanceDue).toBe(60000);

    const destinationHistory = await adminB.query(getStudentTransferHistoryRef, {
      studentId: acceptResult.destinationStudentId,
    });
    expect(destinationHistory).toHaveLength(1);
    expect(destinationHistory[0]._id).toBe(transferId);

    // Verify audit event recorded at Destination Branch
    const destinationAudit = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q.eq("module", "enrollment").eq("action", "student_transfer.destination_accept")
        )
        .first();
    });
    expect(destinationAudit).not.toBeNull();
    expect(destinationAudit?.outcome).toBe("success");
    expect(destinationAudit?.safeSummary).toContain("Accepted transfer for student Oluwaseun Adeyemi");
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
      })
    ).rejects.toThrow(
      "Cross-group transfers are not permitted. Transferee schools must belong to the same verified school group."
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
      })
    ).rejects.toThrow(
      "Cannot accept transfer: transfer is in status 'initiated', expected 'source_released'"
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
          safeguardingNotes: "CONFIDENTIAL_DSL_REPORT: Statutory social services child welfare referral",
          childProtectionFlag: true,
          disciplinaryRecords: "Suspended 3 days for altercation with student",
          familyFinancialDispute: "Parent defaulted on term 2 tuition balance of ₦180,000",
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
      return (await ctx.db.get(transferId as Id<"studentTransfers">)) as Doc<"studentTransfers"> | null;
    });

    expect(transferRecord).not.toBeNull();
    const pkg = transferRecord!.portableRecordPackage as any;
    expect(pkg).toBeDefined();

    // 1. Assert absolute absence of prohibited fields
    expect(pkg.safeguardingNotes).toBeUndefined();
    expect(pkg.childProtectionFlag).toBeUndefined();
    expect(pkg.disciplinaryRecords).toBeUndefined();
    expect(pkg.familyFinancialDispute).toBeUndefined();
    expect(pkg.balanceDue).toBeUndefined();
    expect(pkg.overdueBalance).toBeUndefined();
    expect(pkg.invoices).toBeUndefined();
    expect(pkg.debtHistory).toBeUndefined();

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
    expect(pkg.studentName).toBe("Oluwaseun Adeyemi");
    expect(pkg.gender).toBe("male");
    expect(pkg.dateOfBirth).toBe("2014-05-12");
    expect(pkg.academicHistorySummary).toBe("Completed Basic 5 coursework; honors in Science");
    expect(pkg.attendanceSummaryPct).toBe(98.0);
    expect(pkg.medicalNotes).toBe("Allergic to amoxicillin");
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

    await expect(t.query(getTransferRef, { transferId })).rejects.toThrow(/UNAUTHENTICATED|Sign in required|Forbidden/);
    await expect(t.query(listTransfersBySchoolRef, { schoolId: harness.schoolA })).rejects.toThrow(/UNAUTHENTICATED|Sign in required|Forbidden/);
    await expect(t.query(listTransfersByGroupRef, { groupId: harness.groupA })).rejects.toThrow(/UNAUTHENTICATED|Sign in required|Forbidden/);
    await expect(t.query(getStudentTransferHistoryRef, { studentId: harness.studentId })).rejects.toThrow(/UNAUTHENTICATED|Sign in required|Forbidden/);
    await expect(outsider.query(getTransferRef, { transferId })).rejects.toThrow(/Not authorized|Forbidden/);
    await expect(outsider.query(listTransfersBySchoolRef, { schoolId: harness.schoolA })).rejects.toThrow(/Not authorized|Forbidden/);

    const sourceView = await adminA.query(getTransferRef, { transferId });
    expect(
      sourceView && "destinationAdmissionNumber" in sourceView
        ? sourceView.destinationAdmissionNumber
        : undefined
    ).toBeUndefined();
  });

  it("6. Manual destination admission number override requires capability, confirmation, reason, and uniqueness", async () => {
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
      })
    ).rejects.toThrow("enrollment.admissions.override_number");

    await t.run(async (ctx) => {
      await ctx.db.insert("membershipDirectGrants", {
        membershipId: harness.adminBMembershipId,
        capability: "enrollment.admissions.override_number",
        grantedAt: Date.now(),
        reason: "Transfer admissions registrar",
      });
    });

    await expect(
      adminB.mutation(acceptDestinationTransferRef, {
        transferId,
        destinationClassId: harness.classBId,
        admissionNumberOverride: "IKY-2026-0001",
        admissionNumberOverrideConfirmed: true,
      })
    ).rejects.toThrow("requires a reason");

    const accepted = await adminB.mutation(acceptDestinationTransferRef, {
      transferId,
      destinationClassId: harness.classBId,
      admissionNumberOverride: "IKY-2026-0001",
      admissionNumberOverrideConfirmed: true,
      admissionNumberOverrideReason: "Registrar correction",
    });
    expect(accepted.destinationAdmissionNumber).toBe("IKY-2026-0001");
    const audit = await t.run(async (ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q.eq("module", "enrollment").eq("action", "student_transfer.destination_accept")
        )
        .first()
    );
    expect(audit?.safeSummary).toContain("confirmed manual override: Registrar correction");
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
      })
    ).rejects.toThrow("Guardian consent must be explicitly recorded prior to initiating transfer");

    // Gate B: Valid initiation followed by source branch cancellation
    const { transferId: transfer1 } = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "in_person_verbal",
    });

    const cancelResult = await adminA.mutation(rejectOrCancelTransferRef, {
      transferId: transfer1,
      reason: "Family relocated to a different state; transfer aborted.",
    });
    expect(cancelResult.status).toBe("cancelled");

    const cancelledTransfer = await t.run(async (ctx) => {
      return (await ctx.db.get(transfer1 as Id<"studentTransfers">)) as Doc<"studentTransfers"> | null;
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
      })
    ).rejects.toThrow("Cannot accept transfer: transfer is in status 'cancelled', expected 'source_released'");

    // Gate C: Valid initiation & source release followed by destination branch rejection
    const { transferId: transfer2 } = await adminA.mutation(initiateStudentTransferRef, {
      sourceSchoolId: harness.schoolA,
      destinationSchoolId: harness.schoolB,
      studentId: harness.studentId,
      guardianConsentRecorded: true,
      guardianConsentMethod: "portal_submission",
    });

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
      return (await ctx.db.get(transfer2 as Id<"studentTransfers">)) as Doc<"studentTransfers"> | null;
    });
    expect(rejectedTransfer?.status).toBe("rejected");
    expect(rejectedTransfer?.cancellationReason).toContain("Class capacity reached");

    // Student remains active at source school
    const studentAfterReject = await t.run(async (ctx) => {
      return await ctx.db.get(harness.studentId);
    });
    expect(studentAfterReject?.schoolId).toEqual(harness.schoolA);
    expect(studentAfterReject?.enrollmentStatus).toBe("active");
  });
});
