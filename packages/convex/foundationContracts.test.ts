/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { issueCheckedDocumentAccessV1 } from "./functions/foundation/documentAccess";
import { matchesPaymentDispatchProviderModeV1 } from "./functions/foundation/paymentDispatch";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

describe("B0 foundation contracts", () => {
  test("resolves canonical link from explicit school and intake records", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "North Star", slug: "north-star", status: "active", createdAt: now, updatedAt: now,
      });
      const programmeId = await ctx.db.insert("admissionsProgrammes", {
        schoolId, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now,
      });
      const staleIntakeId = await ctx.db.insert("admissionsIntakes", {
        schoolId, programmeId, slug: "2026-entry", name: "2026 Entry", cycleLabel: "2026", opensAt: now - 20_000, closesAt: now - 10_000, status: "open", createdAt: now, updatedAt: now,
      });
      const intakeId = await ctx.db.insert("admissionsIntakes", {
        schoolId, programmeId, slug: "2027-entry", name: "2027 Entry", cycleLabel: "2027", opensAt: now - 1, closesAt: now + 100_000, status: "open", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("admissionsProducts", {
        schoolId, intakeId: staleIntakeId, slug: "stale-application", name: "Stale application", slotCount: 1, status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("admissionsProducts", {
        schoolId, intakeId, slug: "application", name: "Application", slotCount: 1, status: "active", createdAt: now, updatedAt: now,
      });
    });

    const priorOrigin = process.env.APPLICATION_ORIGIN;
    process.env.APPLICATION_ORIGIN = "https://apply.example.test";
    try {
      await expect(t.query(api.functions.foundation.applicationLinks.getApplicationLink, { schoolSlug: "north-star" })).resolves.toEqual({
        version: "1", schoolSlug: "north-star", href: "https://apply.example.test/s/north-star/i/2027-entry", availability: "open", intakeSlug: "2027-entry", opensAt: expect.any(Number), closesAt: expect.any(Number),
      });
      await expect(t.query(api.functions.foundation.applicationLinks.getApplicationLink, { schoolSlug: "missing-school" })).resolves.toMatchObject({ availability: "unavailable" });
    } finally {
      if (priorOrigin === undefined) delete process.env.APPLICATION_ORIGIN;
      else process.env.APPLICATION_ORIGIN = priorOrigin;
    }
  });

  test("audits denied, quarantined, and stale-auth document access before any URL", async () => {
    const schoolId = "school" as Id<"schools">;
    const documentId = "document" as Id<"admissionsDocuments">;
    const storageId = "storage" as Id<"_storage">;
    const guardianId = "guardian" as Id<"admissionsGuardians">;

    const createContext = (state: "uploaded" | "quarantined") => {
      const events: string[] = [];
      const document = { _id: documentId, schoolId, state, documentKey: "opaque-document", storageId };
      const ctx = {
        db: {
          query: () => ({
            withIndex: () => ({ unique: async () => document }),
          }),
          insert: async (_table: string, row: { outcome: string }) => {
            events.push(`audit:${row.outcome}`);
            return "audit";
          },
        },
        storage: {
          getUrl: async () => {
            events.push("storage");
            return "https://storage.example.test/signed";
          },
        },
      };
      return { ctx, events };
    };

    const denied = createContext("uploaded");
    await expect(issueCheckedDocumentAccessV1({
      ctx: denied.ctx as never, documentKey: "opaque-document",
      actor: { schoolId, kind: "guardian", guardianId, assurance: "fresh" },
      action: "view", requiresFreshAuth: false, authorize: async () => false,
    })).resolves.toEqual({ status: "unavailable", documentKey: "opaque-document" });
    expect(denied.events).toEqual(["audit:denied"]);

    const quarantined = createContext("quarantined");
    await expect(issueCheckedDocumentAccessV1({
      ctx: quarantined.ctx as never, documentKey: "opaque-document",
      actor: { schoolId, kind: "guardian", guardianId, assurance: "fresh" },
      action: "download", requiresFreshAuth: false, authorize: async () => true,
    })).resolves.toEqual({ status: "unavailable", documentKey: "opaque-document" });
    expect(quarantined.events).toEqual(["audit:denied"]);

    const stale = createContext("uploaded");
    await expect(issueCheckedDocumentAccessV1({
      ctx: stale.ctx as never, documentKey: "opaque-document",
      actor: { schoolId, kind: "guardian", guardianId, assurance: "standard" },
      action: "download", requiresFreshAuth: true, authorize: async () => true,
    })).resolves.toEqual({ status: "unavailable", documentKey: "opaque-document" });
    expect(stale.events).toEqual(["audit:denied"]);

    const granted = createContext("uploaded");
    await expect(issueCheckedDocumentAccessV1({
      ctx: granted.ctx as never, documentKey: "opaque-document",
      actor: { schoolId, kind: "guardian", guardianId, assurance: "fresh" },
      action: "download", requiresFreshAuth: true, authorize: async () => true,
    })).resolves.toMatchObject({ status: "available", url: "https://storage.example.test/signed" });
    expect(granted.events).toEqual(["audit:granted", "storage"]);
  });

  test("projects and enforces programme/intake grants without widening scope", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const ids = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", { name: "A", slug: "a", status: "active", createdAt: now, updatedAt: now });
      const schoolB = await ctx.db.insert("schools", { name: "B", slug: "b", status: "active", createdAt: now, updatedAt: now });
      const userA = await ctx.db.insert("users", { schoolId: schoolA, authId: "better-user", authTokenIdentifier: "issuer|subject", name: "User", email: "user@example.test", role: "admin", createdAt: now, updatedAt: now });
      const userB = await ctx.db.insert("users", { schoolId: schoolB, authId: "better-user", authTokenIdentifier: "issuer|subject", name: "User", email: "user@example.test", role: "teacher", createdAt: now, updatedAt: now });
      const programmeA = await ctx.db.insert("admissionsProgrammes", { schoolId: schoolA, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now });
      const programmeB = await ctx.db.insert("admissionsProgrammes", { schoolId: schoolA, slug: "secondary", name: "Secondary", status: "published", createdAt: now, updatedAt: now });
      const programmeOtherSchool = await ctx.db.insert("admissionsProgrammes", { schoolId: schoolB, slug: "other", name: "Other", status: "published", createdAt: now, updatedAt: now });
      const intakeA = await ctx.db.insert("admissionsIntakes", { schoolId: schoolA, programmeId: programmeA, slug: "primary-2027", name: "Primary", cycleLabel: "2027", opensAt: now, closesAt: now + 10_000, status: "open", createdAt: now, updatedAt: now });
      const intakeB = await ctx.db.insert("admissionsIntakes", { schoolId: schoolA, programmeId: programmeB, slug: "secondary-2027", name: "Secondary", cycleLabel: "2027", opensAt: now, closesAt: now + 10_000, status: "open", createdAt: now, updatedAt: now });
      const intakeOtherSchool = await ctx.db.insert("admissionsIntakes", { schoolId: schoolB, programmeId: programmeOtherSchool, slug: "other-2027", name: "Other", cycleLabel: "2027", opensAt: now, closesAt: now + 10_000, status: "open", createdAt: now, updatedAt: now });
      await ctx.db.insert("schoolCapabilityGrants", { schoolId: schoolA, userId: userA, capability: "admissions.catalogue.manage", scope: "programme", programmeId: programmeA, grantedByUserId: userA, reason: "fixture", isBreakGlass: false, createdAt: now });
      await ctx.db.insert("schoolCapabilityGrants", { schoolId: schoolA, userId: userA, capability: "documents.review", scope: "intake", intakeId: intakeA, grantedByUserId: userA, reason: "fixture", isBreakGlass: false, createdAt: now });
      return { schoolA, schoolB, userA, userB, programmeA, programmeB, programmeOtherSchool, intakeA, intakeB, intakeOtherSchool };
    });

    const identity = { subject: "better-user", tokenIdentifier: "issuer|subject", issuer: "issuer" };
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: ids.schoolA })).resolves.toMatchObject({
      membership: { userId: ids.userA, schoolId: ids.schoolA, isSchoolAdmin: true },
      capabilities: [
        { capability: "admissions.catalogue.manage", scope: "programme", programmeId: ids.programmeA, intakeId: null },
        { capability: "documents.review", scope: "intake", programmeId: null, intakeId: ids.intakeA },
      ],
    });
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "admissions.catalogue.manage", programmeId: ids.programmeA, intakeId: null })).resolves.toBe(true);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "admissions.catalogue.manage", programmeId: ids.programmeB, intakeId: null })).resolves.toBe(false);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "admissions.catalogue.manage", programmeId: ids.programmeOtherSchool, intakeId: null })).resolves.toBe(false);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "admissions.catalogue.manage", programmeId: null, intakeId: null })).resolves.toBe(false);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "documents.review", programmeId: ids.programmeA, intakeId: ids.intakeA })).resolves.toBe(true);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "documents.review", programmeId: null, intakeId: ids.intakeOtherSchool })).resolves.toBe(false);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "documents.review", programmeId: ids.programmeB, intakeId: ids.intakeA })).resolves.toBe(false);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.hasViewerCapability, { schoolId: ids.schoolA, capability: "documents.review", programmeId: ids.programmeB, intakeId: ids.intakeB })).resolves.toBe(false);
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: ids.schoolB })).resolves.toMatchObject({
      membership: { userId: ids.userB, schoolId: ids.schoolB, isSchoolAdmin: false }, capabilities: [],
    });
  });

  test("records an admissions payment event once for a verified replay", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const attempt = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "A", slug: "a", status: "active", createdAt: now, updatedAt: now });
      const guardianId = await ctx.db.insert("admissionsGuardians", { authTokenIdentifier: "issuer|guardian", normalizedEmail: "guardian@example.test", status: "active", createdAt: now, updatedAt: now });
      const programmeId = await ctx.db.insert("admissionsProgrammes", { schoolId, slug: "primary", name: "Primary", status: "published", createdAt: now, updatedAt: now });
      const intakeId = await ctx.db.insert("admissionsIntakes", { schoolId, programmeId, slug: "entry", name: "Entry", cycleLabel: "2027", opensAt: now, closesAt: now + 1, status: "open", createdAt: now, updatedAt: now });
      const productId = await ctx.db.insert("admissionsProducts", { schoolId, intakeId, slug: "application", name: "Application", slotCount: 1, status: "active", createdAt: now, updatedAt: now });
      const priceId = await ctx.db.insert("admissionsProductPrices", { schoolId, productId, version: 1, amountMinor: 5000, currency: "NGN", refundPolicyKey: "pending", feeDisclosure: "pending", effectiveFrom: now, status: "published", createdAt: now, updatedAt: now });
      const purchaseAttemptId = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId, guardianId, productId, priceId, provider: "paystack", providerMode: "test", reference: "adm_abc", idempotencyKey: "key", amountMinor: 5000, currency: "NGN", feeDisclosureSnapshot: "pending", state: "verification_pending", createdAt: now, updatedAt: now });
      const billingUserId = await ctx.db.insert("users", { schoolId, authId: "billing-user", name: "Billing user", email: "billing@example.test", role: "admin", createdAt: now, updatedAt: now });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "P1", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2027", startDate: now, endDate: now + 100_000, isActive: true, createdAt: now, updatedAt: now });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Term 1", startDate: now, endDate: now + 10_000, isActive: true, createdAt: now, updatedAt: now });
      const studentUserId = await ctx.db.insert("users", { schoolId, authId: "student-user", name: "Student", email: "student@example.test", role: "student", createdAt: now, updatedAt: now });
      const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, admissionNumber: "ADM-1", createdAt: now, updatedAt: now });
      const feePlanId = await ctx.db.insert("feePlans", { schoolId, name: "Fees", currency: "NGN", lineItems: [], installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 0 }, isActive: true, createdAt: now, updatedAt: now, createdBy: billingUserId, updatedBy: billingUserId });
      const invoiceId = await ctx.db.insert("studentInvoices", { schoolId, feePlanId, studentId, classId, sessionId, termId, invoiceNumber: "INV-1", feePlanNameSnapshot: "Fees", currency: "NGN", lineItems: [], installmentSchedule: [], subtotal: 0, waiverAmount: 0, discountAmount: 0, totalAmount: 0, amountPaid: 0, balanceDue: 0, status: "waived", dueDate: now, issuedAt: now, issuedBy: billingUserId, createdAt: now, updatedAt: now });
      await ctx.db.insert("billingPaymentAttempts", { schoolId, invoiceId, provider: "paystack", providerMode: "live", reference: "billing_abc", gatewayReference: null, authorizationUrl: null, accessCode: null, amount: 0, currency: "NGN", status: "link_generated", reconciliationSource: null, checkoutPayload: {}, callbackUrl: null, paymentId: null, gatewayEventId: null, lastCheckedAt: null, resolvedAt: null, resolutionMessage: null, createdAt: now, updatedAt: now });
      return { schoolId, purchaseAttemptId };
    });

    const billingContext = await t.query(internal.functions.foundation.paymentDispatch.resolvePaymentDispatchContextInternal, { reference: "billing_abc" });
    expect(billingContext).toMatchObject({ domain: "billing", schoolId: attempt.schoolId, provider: "paystack", providerMode: "live", invoiceNumber: "INV-1" });
    expect(matchesPaymentDispatchProviderModeV1(billingContext!, "paystack", "live")).toBe(true);
    expect(matchesPaymentDispatchProviderModeV1(billingContext!, "paystack", "test")).toBe(false);
    expect(matchesPaymentDispatchProviderModeV1(billingContext!, "stripe", "live")).toBe(false);
    await expect(t.query(internal.functions.foundation.paymentDispatch.resolvePaymentDispatchContextInternal, { reference: "adm_abc" })).resolves.toMatchObject({ domain: "admissions", purchaseAttemptId: attempt.purchaseAttemptId, providerMode: "test" });
    const args = { schoolId: attempt.schoolId, purchaseAttemptId: attempt.purchaseAttemptId, provider: "paystack" as const, providerMode: "test" as const, providerEventId: "paystack:evt-1", eventType: "charge.success", bodyDigest: "digest", receivedAt: now };
    expect(await t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, args)).toMatchObject({ replayed: false });
    expect(await t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, args)).toMatchObject({ replayed: true });
    await expect(t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, { ...args, providerMode: "live" })).rejects.toThrow("Payment dispatch context mismatch");
    await expect(t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, { ...args, provider: "stripe" })).rejects.toThrow("Payment dispatch context mismatch");
    expect(await t.run((ctx) => ctx.db.query("admissionsPaymentEvents").collect())).toHaveLength(1);
  });
});
