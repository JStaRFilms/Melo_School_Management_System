import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
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
