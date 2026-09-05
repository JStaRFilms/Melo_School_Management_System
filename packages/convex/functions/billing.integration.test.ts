import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);
const adminIdentity = {
  subject: "billing-regression-admin",
  tokenIdentifier: "https://auth.school.test|billing-regression-admin",
};

const lineItems = [{ label: "Tuition", amount: 5000, category: "tuition" as const }];
const storedLineItems = [{ id: "tuition", label: "Tuition", amount: 5000, category: "tuition" as const, order: 0, isOptional: false }];

describe("billing registered functions", () => {
  it("allows universal class-default plans while rejecting class-targeted manual extras", async () => {
    const t = convexTest(schema, modules);
    const classId = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Billing School", slug: "billing-fee-plans", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@billing.test", role: "admin", createdAt: now, updatedAt: now });
      return await ctx.db.insert("classes", { schoolId, name: "Primary 1", gradeName: "Primary 1", level: "Primary", createdAt: now, updatedAt: now });
    });

    const universalPlan = await t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, {
      name: "Universal Fees",
      billingMode: "class_default",
      lineItems,
    });
    expect(universalPlan).toMatchObject({ billingMode: "class_default", targetClassIds: [] });

    const targetedPlan = await t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, {
      name: "Primary 1 Fees",
      billingMode: "class_default",
      targetClassIds: [classId],
      lineItems,
    });
    expect(targetedPlan).toMatchObject({ billingMode: "class_default", targetClassIds: [classId] });

    await expect(t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, {
      name: "Invalid Manual Extra",
      billingMode: "manual_extra",
      targetClassIds: [classId],
      lineItems,
    })).rejects.toThrow(/Manual extra fee plans cannot target classes/);
  });

  it("snapshots overdue fee-plan issuance and skips fully waived invoices", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Snapshot Billing School",
        slug: "snapshot-billing-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const adminId = await ctx.db.insert("users", {
        schoolId,
        authId: adminIdentity.subject,
        authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Billing Admin",
        email: "admin@snapshot-billing.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const personId = await ctx.db.insert("persons", { name: "Billing Owner", email: "admin@snapshot-billing.test", authTokenIdentifier: adminIdentity.tokenIdentifier, status: "active", createdAt: now, updatedAt: now });
      await ctx.db.patch(adminId, { personId });
      await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: adminId, isDefaultBranch: true, status: "active", joinedAt: now, updatedAt: now });
      const groupId = await ctx.db.insert("schoolGroups", { name: "Synthetic group", slug: "synthetic-billing-group", proprietorPersonId: personId, status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("schoolGroupBranches", { schoolId, groupId, isHeadquarters: true, linkedAt: now });
      const classId = await ctx.db.insert("classes", {
        schoolId,
        name: "Primary 1",
        gradeName: "Primary 1",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2026/2027",
        startDate: now,
        endDate: now + 365 * 24 * 60 * 60 * 1000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId,
        name: "First Term",
        startDate: now,
        endDate: now + 90 * 24 * 60 * 60 * 1000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const studentIds = [];
      for (const [index, name] of ["Ada", "Bola"].entries()) {
        const userId = await ctx.db.insert("users", {
          schoolId,
          authId: `snapshot-student-${index}`,
          authTokenIdentifier: `https://auth.school.test|snapshot-student-${index}`,
          name,
          email: `${name.toLowerCase()}@snapshot-billing.test`,
          role: "student",
          createdAt: now,
          updatedAt: now,
        });
        studentIds.push(
          await ctx.db.insert("students", {
            schoolId,
            classId,
            userId,
            admissionNumber: `SNAP-${index + 1}`,
            enrollmentStatus: "active",
            createdAt: now,
            updatedAt: now,
          })
        );
      }
      const directFeePlanId = await ctx.db.insert("feePlans", {
        schoolId,
        name: "Direct Tuition",
        currency: "NGN",
        billingMode: "class_default",
        targetClassIds: [],
        lineItems: storedLineItems,
        installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 14 },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      const bulkFeePlanId = await ctx.db.insert("feePlans", {
        schoolId,
        name: "Bulk Activity Fee",
        currency: "NGN",
        billingMode: "class_default",
        targetClassIds: [],
        lineItems: storedLineItems,
        installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 14 },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      const waivedFeePlanId = await ctx.db.insert("feePlans", {
        schoolId,
        name: "Waived Tuition",
        currency: "NGN",
        billingMode: "class_default",
        targetClassIds: [],
        lineItems: storedLineItems,
        installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 14 },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      const firstBankId = await ctx.db.insert("schoolBankAccounts", {
        schoolId,
        bankName: "First Bank",
        accountNumber: "0123456789",
        accountName: "Snapshot School",
        currency: "NGN",
        isDefault: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });
      const secondBankId = await ctx.db.insert("schoolBankAccounts", {
        schoolId,
        bankName: "GTBank",
        accountNumber: "9876543210",
        accountName: "Snapshot School New",
        currency: "NGN",
        isDefault: false,
        status: "active",
        createdAt: now,
        updatedAt: now,
        updatedBy: adminId,
      });

      return {
        schoolId,
        adminId,
        classId,
        sessionId,
        termId,
        studentIds,
        directFeePlanId,
        bulkFeePlanId,
        waivedFeePlanId,
        firstBankId,
        secondBankId,
      };
    });

    const directInvoice = await t.withIdentity(adminIdentity).mutation(
      api.functions.billing.createInvoiceFromFeePlan,
      {
        feePlanId: ids.directFeePlanId,
        studentId: ids.studentIds[0],
        classId: ids.classId,
        sessionId: ids.sessionId,
        termId: ids.termId,
        dueDate: Date.now() - 1,
      }
    );
    expect(directInvoice.status).toBe("overdue");
    const issuedDirectInvoice = await t.run((ctx) =>
      ctx.db.get("studentInvoices", directInvoice._id)
    );
    expect(issuedDirectInvoice?.paymentInstructionsSnapshot).toMatchObject({
      bankAccountId: ids.firstBankId,
      bankName: "First Bank",
      accountNumber: "0123456789",
    });

    const draftInvoiceId = await t.run((ctx) =>
      ctx.db.insert("studentInvoices", {
        schoolId: ids.schoolId,
        feePlanId: ids.directFeePlanId,
        studentId: ids.studentIds[0],
        classId: ids.classId,
        sessionId: ids.sessionId,
        termId: ids.termId,
        invoiceNumber: "DRAFT-SNAPSHOT-MISUSE",
        feePlanNameSnapshot: "Direct Tuition",
        currency: "NGN",
        lineItems: storedLineItems,
        installmentSchedule: [],
        subtotal: 5000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 5000,
        amountPaid: 0,
        balanceDue: 5000,
        status: "draft",
        dueDate: Date.now() + 24 * 60 * 60 * 1000,
        issuedAt: Date.now(),
        issuedBy: ids.adminId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    );
    await expect(
      t.mutation(internal.functions.academic.bankAccounts.snapshotInvoicePaymentInstructions, {
        invoiceId: draftInvoiceId,
      })
    ).rejects.toThrow(/payable issued invoices/);

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch(ids.firstBankId, { isDefault: false, updatedAt: now });
      await ctx.db.patch(ids.secondBankId, { isDefault: true, updatedAt: now });
    });

    const waivedInvoice = await t.withIdentity(adminIdentity).mutation(
      api.functions.billing.createInvoiceFromFeePlan,
      {
        feePlanId: ids.waivedFeePlanId,
        studentId: ids.studentIds[1],
        classId: ids.classId,
        sessionId: ids.sessionId,
        termId: ids.termId,
        waiverAmount: 5000,
      }
    );
    expect(waivedInvoice).toMatchObject({
      status: "waived",
      totalAmount: 0,
      balanceDue: 0,
    });
    const storedWaivedInvoice = await t.run((ctx) =>
      ctx.db.get("studentInvoices", waivedInvoice._id)
    );
    expect(storedWaivedInvoice?.paymentInstructionsSnapshot).toBeUndefined();

    const bulkResult = await t.withIdentity(adminIdentity).mutation(
      api.functions.billing.applyFeePlanToClassStudents,
      {
        feePlanId: ids.bulkFeePlanId,
        classId: ids.classId,
        sessionId: ids.sessionId,
        termId: ids.termId,
      }
    );
    expect(bulkResult.createdCount).toBe(2);

    const invoices = await t.run(async (ctx) =>
      await ctx.db
        .query("studentInvoices")
        .withIndex("by_school", (q) => q.eq("schoolId", ids.schoolId))
        .collect()
    );
    const historicalInvoice = invoices.find((invoice) => invoice._id === directInvoice._id);
    const bulkInvoices = invoices.filter((invoice) => invoice.feePlanId === ids.bulkFeePlanId);

    expect(historicalInvoice?.paymentInstructionsSnapshot).toMatchObject({
      bankAccountId: ids.firstBankId,
      bankName: "First Bank",
      accountNumber: "0123456789",
    });
    // Explicit alternate selection, not whichever account became default most recently.
    const alternatePlan = await t.withIdentity(adminIdentity).mutation(api.functions.billing.createFeePlan, { name: "Synthetic alternate", billingMode: "manual_extra", lineItems });
    const alternateInvoice = await t.withIdentity(adminIdentity).mutation(api.functions.billing.createInvoiceFromFeePlan, { feePlanId: alternatePlan._id, studentId: ids.studentIds[0], classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId, bankAccountId: ids.firstBankId });
    expect(alternateInvoice.paymentInstructions?.bankAccountId).toBe(ids.firstBankId);
    await t.run(ctx => ctx.db.patch(ids.firstBankId, { accountNumber: "1111111111", status: "archived" }));
    const immutable = await t.withIdentity(adminIdentity).query(api.functions.academic.bankAccounts.getInvoicePaymentView, { invoiceId: alternateInvoice._id });
    expect(immutable.paymentInstructions?.accountNumber).toBe("0123456789");
    await t.run(ctx => ctx.db.patch(draftInvoiceId, { status: "issued" }));
    expect(await t.mutation(internal.functions.academic.bankAccounts.snapshotInvoicePaymentInstructions, { invoiceId: draftInvoiceId })).toBeNull();
    expect((await t.withIdentity(adminIdentity).query(api.functions.academic.bankAccounts.getInvoicePaymentView, { invoiceId: draftInvoiceId })).paymentInstructions).toBeNull();
    await t.run(ctx => ctx.db.patch(alternateInvoice._id, { status: "paid", balanceDue: 0, amountPaid: 5000 }));
    expect((await t.withIdentity(adminIdentity).query(api.functions.academic.bankAccounts.getInvoicePaymentView, { invoiceId: alternateInvoice._id })).paymentInstructions).toBeNull();
    expect((await t.withIdentity(adminIdentity).query(api.functions.academic.bankAccounts.getInvoiceReceipt, { invoiceId: directInvoice._id })).paymentInstructions).toBeNull();
    expect((await t.withIdentity(adminIdentity).query(api.functions.academic.bankAccounts.getInvoicePaymentView, { invoiceId: waivedInvoice._id })).paymentInstructions).toBeNull();
    await expect(t.withIdentity({ subject: "snapshot-student-1", tokenIdentifier: "https://auth.school.test|snapshot-student-1" }).query(api.functions.portal.resolvePortalInvoicePaymentContext, { invoiceId: directInvoice._id })).rejects.toThrow();
    expect(bulkInvoices).toHaveLength(2);
    for (const invoice of bulkInvoices) {
      expect(invoice.paymentInstructionsSnapshot).toMatchObject({
        bankAccountId: ids.secondBankId,
        bankName: "GTBank",
        accountNumber: "9876543210",
      });
    }
  }, 15_000);

  it("keeps invoice-less gateway events only on unfiltered dashboards", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", {
        name: "Alpha Billing",
        slug: "alpha-billing-events",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const adminId = await ctx.db.insert("users", {
        schoolId,
        authId: adminIdentity.subject,
        authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Alpha Admin",
        email: "admin@alpha-billing.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId,
        name: "Primary 1",
        gradeName: "Primary 1",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId,
        name: "2026/2027",
        startDate: 100,
        endDate: 300,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId,
        sessionId,
        name: "First Term",
        startDate: 100,
        endDate: 200,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const studentUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "alpha-student",
        authTokenIdentifier: "https://auth.school.test|alpha-student",
        name: "Alpha Student",
        email: "student@alpha-billing.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId,
        classId,
        userId: studentUserId,
        admissionNumber: "ALPHA-001",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      const feePlanId = await ctx.db.insert("feePlans", {
        schoolId,
        name: "Tuition",
        currency: "NGN",
        billingMode: "class_default",
        targetClassIds: [],
        lineItems: storedLineItems,
        installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 14 },
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId,
        updatedBy: adminId,
      });
      const invoiceId = await ctx.db.insert("studentInvoices", {
        schoolId,
        feePlanId,
        studentId,
        classId,
        sessionId,
        termId,
        invoiceNumber: "ALPHA-INV-001",
        feePlanNameSnapshot: "Tuition",
        currency: "NGN",
        lineItems: storedLineItems,
        installmentSchedule: [],
        subtotal: 5000,
        waiverAmount: 0,
        discountAmount: 0,
        totalAmount: 5000,
        amountPaid: 0,
        balanceDue: 5000,
        status: "issued",
        dueDate: 200,
        issuedAt: now,
        issuedBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("paymentGatewayEvents", {
        schoolId,
        provider: "paystack",
        eventId: "alpha-invoice-event",
        eventType: "charge.success",
        reference: "alpha-invoice-ref",
        invoiceId,
        signatureValid: true,
        verificationStatus: "verified",
        rawBody: "{}",
        payload: {},
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("paymentGatewayEvents", {
        schoolId,
        provider: "paystack",
        eventId: "alpha-invoice-less-event",
        eventType: "charge.success",
        reference: "alpha-invoice-less-ref",
        signatureValid: true,
        verificationStatus: "ignored",
        rawBody: "{}",
        payload: {},
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const otherSchoolId = await ctx.db.insert("schools", {
        name: "Beta Billing",
        slug: "beta-billing-events",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const otherIdentity = {
        subject: "billing-regression-beta-admin",
        tokenIdentifier: "https://auth.school.test|billing-regression-beta-admin",
      };
      await ctx.db.insert("users", {
        schoolId: otherSchoolId,
        authId: otherIdentity.subject,
        authTokenIdentifier: otherIdentity.tokenIdentifier,
        name: "Beta Admin",
        email: "admin@beta-billing.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("paymentGatewayEvents", {
        schoolId: otherSchoolId,
        provider: "paystack",
        eventId: "beta-invoice-less-event",
        eventType: "charge.success",
        reference: "beta-invoice-less-ref",
        signatureValid: true,
        verificationStatus: "ignored",
        rawBody: "{}",
        payload: {},
        receivedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      return { classId, sessionId, termId, otherIdentity };
    });

    const dashboard = await t.withIdentity(adminIdentity).query(api.functions.billing.getBillingDashboard, {});
    expect(dashboard.gatewayEvents.map((event) => event.eventId)).toEqual([
      "alpha-invoice-event",
      "alpha-invoice-less-event",
    ]);
    expect(dashboard.gatewayEvents[0]).not.toHaveProperty("rawBody");
    expect(dashboard.gatewayEvents[0]).not.toHaveProperty("payload");

    const filters = [
      { classId: ids.classId },
      { sessionId: ids.sessionId },
      { termId: ids.termId },
      { status: "issued" as const },
      { search: "alpha-inv-001" },
    ];
    for (const filter of filters) {
      const filtered = await t.withIdentity(adminIdentity).query(api.functions.billing.getBillingDashboard, filter);
      expect(filtered.gatewayEvents.map((event) => event.eventId)).toEqual(["alpha-invoice-event"]);
    }

    const otherDashboard = await t.withIdentity(ids.otherIdentity).query(api.functions.billing.getBillingDashboard, {});
    expect(otherDashboard.gatewayEvents.map((event) => event.eventId)).toEqual(["beta-invoice-less-event"]);
  });
});
