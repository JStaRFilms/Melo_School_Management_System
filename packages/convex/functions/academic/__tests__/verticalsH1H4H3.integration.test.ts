import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";

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

const gradingBandsApi = (api as any).functions.academic.gradingBands;
const admissionNumbersApi = (api as any).functions.academic.admissionNumbers;
const bankAccountsApi = (api as any).functions.academic.bankAccounts;
const bankAccountsInternal = internal.functions.academic.bankAccounts;

function assertExists<T>(value: T): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Expected a result");
}

async function setupTestHarness(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    // 1. Create School
    const schoolId = await ctx.db.insert("schools", {
      name: "Olive Blessed Crest Lagos",
      slug: "obc",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create Proprietor Person & User
    const adminPersonId = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|proprietor-obc",
      email: "proprietor@obc.test",
      name: "Chief Proprietor",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    const adminUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "auth-proprietor-obc",
      authTokenIdentifier: "https://auth.melo.test|proprietor-obc",
      email: "proprietor@obc.test",
      name: "Chief Proprietor",
      role: "admin",
      isSchoolAdmin: true,
      personId: adminPersonId,
      createdAt: now,
      updatedAt: now,
    });

    const adminMembershipId = await ctx.db.insert("branchMemberships", {
      personId: adminPersonId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminUserId,
      joinedAt: now,
      updatedAt: now,
    });

    // Group linkage to make admin group proprietor
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Olive Crest Group",
      slug: "olive-crest-group",
      proprietorPersonId: adminPersonId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId,
      isHeadquarters: true,
      linkedAt: now,
    });

    // 3. Create Regular Teacher (Unauthorized for bank manage)
    const teacherPersonId = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|teacher-tola",
      email: "tola@obc.test",
      name: "Teacher Tola",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    const teacherUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "auth-teacher-tola",
      authTokenIdentifier: "https://auth.melo.test|teacher-tola",
      email: "tola@obc.test",
      name: "Teacher Tola",
      role: "teacher",
      isSchoolAdmin: false,
      personId: teacherPersonId,
      createdAt: now,
      updatedAt: now,
    });

    const teacherMembershipId = await ctx.db.insert("branchMemberships", {
      personId: teacherPersonId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: teacherUserId,
      joinedAt: now,
      updatedAt: now,
    });

    // Academic dependencies for invoice creation
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026/2027 Session",
      startDate: now,
      endDate: now + 365 * 24 * 3600 * 1000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First Term",
      startDate: now,
      endDate: now + 90 * 24 * 3600 * 1000,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "JSS 1 Gold",
      level: "JSS1",
      createdAt: now,
      updatedAt: now,
    });

    const feePlanId = await ctx.db.insert("feePlans", {
      schoolId,
      name: "JSS 1 Tuition Plan",
      currency: "NGN",
      lineItems: [],
      installmentPolicy: {
        enabled: false,
        installmentCount: 1,
        intervalDays: 30,
        firstDueDays: 0,
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    });

    const studentUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "auth-student-chidinma",
      email: "chidinma@obc.test",
      name: "Chidinma Okafor",
      role: "student",
      createdAt: now,
      updatedAt: now,
    });

    const studentId = await ctx.db.insert("students", {
      schoolId,
      classId,
      userId: studentUserId,
      admissionNumber: "LEGACY-0001",
      createdAt: now,
      updatedAt: now,
    });

    return {
      schoolId,
      adminPersonId,
      adminUserId,
      adminMembershipId,
      teacherPersonId,
      teacherUserId,
      teacherMembershipId,
      sessionId,
      termId,
      classId,
      feePlanId,
      studentId,
    };
  });
}

describe("Task B-05 / M4 (PR-E): Grade Band, Sequential Admission Number, and Bank Account Verticals (H1/H4/H3)", () => {
  it("1. Grade band retrieval returns standard defaults when unconfigured, and custom configured bands once updated", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await setupTestHarness(t);

    const adminSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-obc",
      subject: "auth-proprietor-obc",
      email: "proprietor@obc.test",
    });

    // 1. Initial retrieval on unconfigured school returns factory defaults
    const defaultBands = await adminSession.query(gradingBandsApi.getGradingBands, {
      schoolId,
    });

    expect(defaultBands).toHaveLength(6);
    expect(defaultBands.map((b: any) => b.gradeLetter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
    ]);

    // Check specific default score ranges and remarks (A: 75-100, B: 65-74, C: 50-64, D: 45-49, E: 40-44, F: 0-39)
    const bandA = defaultBands.find((b: any) => b.gradeLetter === "A");
    expect(bandA.minScore).toBe(75);
    expect(bandA.maxScore).toBe(100);
    expect(bandA.colorHex).toBe("#065f46");
    expect(bandA.luminanceContrast).toBeGreaterThanOrEqual(4.5);
    expect(bandA.isDefaultPreset).toBe(true);

    const bandF = defaultBands.find((b: any) => b.gradeLetter === "F");
    expect(bandF.minScore).toBe(0);
    expect(bandF.maxScore).toBe(39);
    expect(bandF.colorHex).toBe("#991b1b");
    expect(bandF.luminanceContrast).toBeGreaterThanOrEqual(4.5);

    // 2. Validate non-contiguous score ranges rejection
    await expect(
      adminSession.mutation(gradingBandsApi.updateGradingBands, {
        schoolId,
        bands: [
          {
            gradeLetter: "A",
            minScore: 75,
            maxScore: 100,
            remark: "Distinction",
          },
          { gradeLetter: "F", minScore: 0, maxScore: 50, remark: "Fail" }, // Gap: 51-74 missing!
        ],
      })
    ).rejects.toThrow(/Gap detected/);

    // 3. Update with valid custom branch bands
    const customBandsInput = [
      {
        gradeLetter: "A",
        minScore: 70,
        maxScore: 100,
        gradePoints: 4.0,
        remark: "Distinction",
        colorHex: "#065f46",
      },
      {
        gradeLetter: "B",
        minScore: 60,
        maxScore: 69,
        gradePoints: 3.0,
        remark: "Credit",
        colorHex: "#1e40af",
      },
      {
        gradeLetter: "C",
        minScore: 50,
        maxScore: 59,
        gradePoints: 2.0,
        remark: "Merit",
        colorHex: "#92400e",
      },
      {
        gradeLetter: "D",
        minScore: 45,
        maxScore: 49,
        gradePoints: 1.0,
        remark: "Pass",
        colorHex: "#9a3412",
      },
      {
        gradeLetter: "F",
        minScore: 0,
        maxScore: 44,
        gradePoints: 0.0,
        remark: "Fail",
        colorHex: "#991b1b",
      },
    ];

    await adminSession.mutation(gradingBandsApi.updateGradingBands, {
      schoolId,
      bands: customBandsInput,
    });

    // 4. Retrieve updated bands
    const updatedBands = await adminSession.query(gradingBandsApi.getGradingBands, {
      schoolId,
    });

    expect(updatedBands).toHaveLength(5);
    expect(updatedBands.map((b: any) => b.gradeLetter)).toEqual([
      "F",
      "D",
      "C",
      "B",
      "A",
    ]);
    const updatedBandA = updatedBands.find((b: any) => b.gradeLetter === "A");
    expect(updatedBandA.minScore).toBe(70);
    expect(updatedBandA.isDefaultPreset).toBe(false);
  });

  it("2. Admission number allocation advances counter atomically and produces correct token substitution", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await setupTestHarness(t);

    const adminSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-obc",
      subject: "auth-proprietor-obc",
      email: "proprietor@obc.test",
    });

    // 1. An unconfigured branch has no implicit mutable policy.
    const initialPolicy = await adminSession.query(
      admissionNumbersApi.getAdmissionNumberPolicy,
      { schoolId, level: "JSS1" },
    );
    expect(initialPolicy.policy).toBeNull();
    expect(initialPolicy.preview).toBeNull();

    // 2. Custom policy configuration with tokens
    await adminSession.mutation(
      admissionNumbersApi.updateAdmissionNumberPolicy,
      {
        schoolId,
        pattern: "{SCHOOL}-{CAMPUS}-{LEVEL}-{YEAR}-{SEQ:4}",
        schoolCode: "OBC",
        campusCode: "LAG",
        currentSequence: 1,
        expectedVersion: initialPolicy.version,
        confirmedNextSequence: 1,
      }
    );

    const configuredPolicy = await adminSession.query(
      admissionNumbersApi.getAdmissionNumberPolicy,
      { schoolId, level: "JSS1" },
    );
    expect(configuredPolicy.branchCounter?.nextSequence).toBe(1);
    expect(configuredPolicy.preview).toBe("OBC-LAG-JSS1-2026-0001");

    // 3. Sequential allocation #1
    const alloc1 = await t.mutation(
      internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
      {
        schoolId,
        level: "JSS1",
      }
    );

    expect(alloc1).toMatchObject({
      allocatedNumber: "OBC-LAG-JSS1-2026-0001",
      sequenceNumber: 1,
    });

    // 4. Sequential allocation #2 (advances strictly)
    const alloc2 = await t.mutation(
      internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
      {
        schoolId,
        level: "JSS1",
      }
    );

    expect(alloc2).toMatchObject({
      allocatedNumber: "OBC-LAG-JSS1-2026-0002",
      sequenceNumber: 2,
    });

    // 5. Subsequent sequential allocations advance counter without gaps
    const alloc3 = await t.mutation(
      internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
      {
        schoolId,
        level: "JSS1",
      }
    );
    const alloc4 = await t.mutation(
      internal.functions.academic.admissionNumbers.allocateNextAdmissionNumber,
      {
        schoolId,
        level: "JSS1",
      }
    );

    expect(alloc3.allocatedNumber).toBe("OBC-LAG-JSS1-2026-0003");
    expect(alloc4.allocatedNumber).toBe("OBC-LAG-JSS1-2026-0004");

    // Check preview reflects next available sequence (5)
    const policyAfter = await adminSession.query(
      admissionNumbersApi.getAdmissionNumberPolicy,
      { schoolId, level: "JSS1" },
    );
    expect(policyAfter.branchCounter?.nextSequence).toBe(5);
    expect(policyAfter.preview).toBe("OBC-LAG-JSS1-2026-0005");
  });

  it("3. Bank account listing masks numbers for unauthorized users and shows full numbers for authorized users", async () => {
    const t = convexTest(schema, modules);
    const { schoolId } = await setupTestHarness(t);

    const adminSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-obc",
      subject: "auth-proprietor-obc",
      email: "proprietor@obc.test",
    });

    const teacherSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|teacher-tola",
      subject: "auth-teacher-tola",
      email: "tola@obc.test",
    });

    // 1. Authorized user adds bank account
    await adminSession.mutation(bankAccountsApi.addBankAccount, {
      schoolId,
      bankName: "First Bank of Nigeria",
      accountNumber: "0123456789",
      accountName: "Olive Blessed Crest Limited",
      currency: "NGN",
      isDefault: true,
      transferNote: "Include student admission number in narration",
      confirmation: "CONFIRM",
    });

    // 2. A caller without finance access cannot inspect bank metadata.
    await expect(
      teacherSession.query(bankAccountsApi.listBankAccounts, { schoolId }),
    ).rejects.toThrow("Bank summaries access denied");

    // 3. Even authorized summary lists stay masked; explicit detail access is unmasked.
    const maskedList = await adminSession.query(bankAccountsApi.listBankAccounts, {
      schoolId,
    });
    expect(maskedList).toHaveLength(1);
    expect(maskedList[0].accountNumber).toBe("***-****-6789");
    expect(maskedList[0].isMasked).toBe(true);
    const account = await adminSession.query(bankAccountsApi.getBankAccount, {
      schoolId,
      bankAccountId: maskedList[0]._id,
    });
    expect(account.accountNumber).toBe("0123456789");

    // 4. Verify audit alert was created at tier1_critical level for bank account addition
    const alerts = await t.run(async (ctx) => {
      return await ctx.db
        .query("auditAlerts")
        .withIndex("by_school_and_dismissed", (q) =>
          q.eq("schoolId", schoolId).eq("isDismissed", false)
        )
        .collect();
    });
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].tier).toBe("tier1_critical");
    expect(alerts[0].message).toContain("***-****-6789"); // Pre-write audit log sanitization check
  });

  it("4. Issued invoice snapshot immutability: changing the default bank account afterwards does NOT modify the snapshot on existing issued invoices", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, classId, sessionId, termId, feePlanId, studentId, adminUserId } =
      await setupTestHarness(t);

    const adminSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-obc",
      subject: "auth-proprietor-obc",
      email: "proprietor@obc.test",
    });

    const now = Date.now();

    // 1. Configure initial primary bank account: First Bank
    const firstBankId = await adminSession.mutation(bankAccountsApi.addBankAccount, {
      schoolId,
      bankName: "First Bank of Nigeria",
      accountNumber: "0123456789",
      accountName: "Olive Blessed Crest Ltd",
      currency: "NGN",
      isDefault: true,
      confirmation: "CONFIRM",
    });

    // 2. Create and issue invoice #1
    const invoice1Id = await t.run(async (ctx) => {
      return await ctx.db.insert("studentInvoices", {
        schoolId,
        feePlanId,
        studentId,
        classId,
        sessionId,
        termId,
        invoiceNumber: "INV-2026-0001",
        feePlanNameSnapshot: "Tuition 2026",
        currency: "NGN",
        lineItems: [],
        installmentSchedule: [],
        subtotal: 150000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 150000,
        amountPaid: 0,
        balanceDue: 150000,
        status: "issued",
        dueDate: now + 30 * 24 * 3600 * 1000,
        issuedAt: now,
        issuedBy: adminUserId,
        paymentInstructionsSnapshot: {
          bankAccountId: firstBankId,
          bankName: "First Bank of Nigeria",
          accountName: "Olive Blessed Crest Ltd",
          accountNumber: "0123456789",
          currency: "NGN",
          snapshottedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      });
    });

    // 3. The compatibility reader returns the snapshot captured by issuance.
    expect(bankAccountsApi).not.toHaveProperty("snapshotInvoicePaymentInstructions");
    const snapshot1 = await t.mutation(
      bankAccountsInternal.snapshotInvoicePaymentInstructions,
      { invoiceId: invoice1Id }
    );

    assertExists(snapshot1);
    expect(snapshot1.bankName).toBe("First Bank of Nigeria");
    expect(snapshot1.accountNumber).toBe("0123456789");
    await expect(
      t.query(bankAccountsApi.getInvoicePaymentView, { invoiceId: invoice1Id })
    ).rejects.toThrow("Sign in required");

    // 4. Later in time, school adds GTBank and switches primary default bank account
    const gtbBankId = await adminSession.mutation(bankAccountsApi.addBankAccount, {
      schoolId,
      bankName: "Guaranty Trust Bank",
      accountNumber: "9876543210",
      accountName: "Olive Blessed Crest GTB",
      currency: "NGN",
      isDefault: false,
      confirmation: "CONFIRM",
    });

    await adminSession.mutation(bankAccountsApi.setPrimaryBankAccount, {
      schoolId,
      bankAccountId: gtbBankId,
      confirmation: "CONFIRM",
    });

    // 5. Attempting to re-snapshot or query the historical issued invoice retains the ORIGINAL snapshot
    const reSnapshot = await t.mutation(
      bankAccountsInternal.snapshotInvoicePaymentInstructions,
      { invoiceId: invoice1Id }
    );

    assertExists(reSnapshot);
    expect(reSnapshot.bankName).toBe("First Bank of Nigeria");
    expect(reSnapshot.accountNumber).toBe("0123456789");

    // 6. Verify invoice 1 in DB still strictly has First Bank instructions
    const invoice1InDb = await t.run(async (ctx) => {
      return await ctx.db.get(invoice1Id);
    });
    expect(invoice1InDb!.paymentInstructionsSnapshot?.bankName).toBe(
      "First Bank of Nigeria"
    );
    expect(invoice1InDb!.paymentInstructionsSnapshot?.accountNumber).toBe(
      "0123456789"
    );

    // 7. A newly issued invoice gets the updated GTBank snapshot
    const invoice2Id = await t.run(async (ctx) => {
      return await ctx.db.insert("studentInvoices", {
        schoolId,
        feePlanId,
        studentId,
        classId,
        sessionId,
        termId,
        invoiceNumber: "INV-2026-0002",
        feePlanNameSnapshot: "Tuition 2026",
        currency: "NGN",
        lineItems: [],
        installmentSchedule: [],
        subtotal: 150000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 150000,
        amountPaid: 0,
        balanceDue: 150000,
        status: "issued",
        dueDate: now + 30 * 24 * 3600 * 1000,
        issuedAt: now,
        issuedBy: adminUserId,
        paymentInstructionsSnapshot: {
          bankAccountId: gtbBankId,
          bankName: "Guaranty Trust Bank",
          accountName: "Olive Blessed Crest GTB",
          accountNumber: "9876543210",
          currency: "NGN",
          snapshottedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      });
    });

    const snapshot2 = await t.mutation(
      bankAccountsInternal.snapshotInvoicePaymentInstructions,
      { invoiceId: invoice2Id }
    );

    assertExists(snapshot2);
    expect(snapshot2.bankName).toBe("Guaranty Trust Bank");
    expect(snapshot2.accountNumber).toBe("9876543210");
  });

  it("5. Receipts do not display payment instructions", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, classId, sessionId, termId, feePlanId, studentId, adminUserId } =
      await setupTestHarness(t);

    const adminSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-obc",
      subject: "auth-proprietor-obc",
      email: "proprietor@obc.test",
    });
    const now = Date.now();

    // Setup bank account
    const bankAccountId = await t.run(async (ctx) => {
      return await ctx.db.insert("schoolBankAccounts", {
        schoolId,
        bankName: "First Bank of Nigeria",
        accountNumber: "0123456789",
        accountName: "Olive Blessed Crest Ltd",
        currency: "NGN",
        isDefault: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
        updatedBy: adminUserId,
      });
    });

    // Create an issued unpaid invoice
    const unpaidInvoiceId = await t.run(async (ctx) => {
      return await ctx.db.insert("studentInvoices", {
        schoolId,
        feePlanId,
        studentId,
        classId,
        sessionId,
        termId,
        invoiceNumber: "INV-2026-UNPAID",
        feePlanNameSnapshot: "Tuition 2026",
        currency: "NGN",
        lineItems: [],
        installmentSchedule: [],
        subtotal: 100000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 100000,
        amountPaid: 0,
        balanceDue: 100000,
        status: "issued",
        dueDate: now + 30 * 24 * 3600 * 1000,
        issuedAt: now,
        issuedBy: adminUserId,
        paymentInstructionsSnapshot: {
          bankAccountId,
          bankName: "First Bank of Nigeria",
          accountName: "Olive Blessed Crest Ltd",
          accountNumber: "0123456789",
          currency: "NGN",
          snapshottedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      });
    });

    // Unpaid invoice view DISPLAYS payment instructions
    const unpaidView = await adminSession.query(bankAccountsApi.getInvoicePaymentView, {
      invoiceId: unpaidInvoiceId,
    });
    expect(unpaidView.showPaymentInstructions).toBe(true);
    expect(unpaidView.paymentInstructions).not.toBeNull();
    expect(unpaidView.paymentInstructions?.bankName).toBe("First Bank of Nigeria");

    // Create a paid invoice
    const paidInvoiceId = await t.run(async (ctx) => {
      return await ctx.db.insert("studentInvoices", {
        schoolId,
        feePlanId,
        studentId,
        classId,
        sessionId,
        termId,
        invoiceNumber: "INV-2026-PAID",
        feePlanNameSnapshot: "Tuition 2026",
        currency: "NGN",
        lineItems: [],
        installmentSchedule: [],
        subtotal: 100000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 100000,
        amountPaid: 100000,
        balanceDue: 0,
        status: "paid",
        dueDate: now + 30 * 24 * 3600 * 1000,
        issuedAt: now,
        issuedBy: adminUserId,
        lastPaymentAt: now + 1000,
        createdAt: now,
        updatedAt: now,
      });
    });

    // 1. Paid invoice view SUPPRESSES payment instructions
    const paidView = await adminSession.query(bankAccountsApi.getInvoicePaymentView, {
      invoiceId: paidInvoiceId,
    });
    expect(paidView.showPaymentInstructions).toBe(false);
    expect(paidView.paymentInstructions).toBeNull();

    // 2. Official Receipt query SUPPRESSES payment instructions
    const receipt = await adminSession.query(bankAccountsApi.getInvoiceReceipt, {
      invoiceId: paidInvoiceId,
    });
    expect(receipt.status).toBe("paid");
    expect(receipt.amountPaid).toBe(100000);
    expect(receipt.balanceDue).toBe(0);
    expect(receipt.showPaymentInstructions).toBe(false);
    expect(receipt.paymentInstructions).toBeNull();
  });
});
