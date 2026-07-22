/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
      const intakeId = await ctx.db.insert("admissionsIntakes", {
        schoolId, programmeId, slug: "2027-entry", name: "2027 Entry", cycleLabel: "2027", opensAt: now - 1, closesAt: now + 100_000, status: "open", createdAt: now, updatedAt: now,
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

  test("uses tokenIdentifier memberships across schools and defaults to no capabilities", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const ids = await t.run(async (ctx) => {
      const schoolA = await ctx.db.insert("schools", { name: "A", slug: "a", status: "active", createdAt: now, updatedAt: now });
      const schoolB = await ctx.db.insert("schools", { name: "B", slug: "b", status: "active", createdAt: now, updatedAt: now });
      const userA = await ctx.db.insert("users", { schoolId: schoolA, authId: "better-user", authTokenIdentifier: "issuer|subject", name: "User", email: "user@example.test", role: "admin", createdAt: now, updatedAt: now });
      const userB = await ctx.db.insert("users", { schoolId: schoolB, authId: "better-user", authTokenIdentifier: "issuer|subject", name: "User", email: "user@example.test", role: "teacher", createdAt: now, updatedAt: now });
      return { schoolA, schoolB, userA, userB };
    });

    const identity = { subject: "better-user", tokenIdentifier: "issuer|subject", issuer: "issuer" };
    await expect(t.withIdentity(identity).query(api.functions.foundation.auth.getViewerCapabilities, { schoolId: ids.schoolA })).resolves.toMatchObject({
      membership: { userId: ids.userA, schoolId: ids.schoolA, isSchoolAdmin: true }, capabilities: [],
    });
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
      return { schoolId, purchaseAttemptId };
    });

    await expect(t.query(internal.functions.foundation.paymentDispatch.resolvePaymentDispatchContextInternal, { reference: "adm_abc" })).resolves.toMatchObject({ domain: "admissions", purchaseAttemptId: attempt.purchaseAttemptId });
    const args = { schoolId: attempt.schoolId, purchaseAttemptId: attempt.purchaseAttemptId, provider: "paystack" as const, providerMode: "test" as const, providerEventId: "paystack:evt-1", eventType: "charge.success", bodyDigest: "digest", receivedAt: now };
    expect(await t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, args)).toMatchObject({ replayed: false });
    expect(await t.mutation(internal.functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, args)).toMatchObject({ replayed: true });
    expect(await t.run((ctx) => ctx.db.query("admissionsPaymentEvents").collect())).toHaveLength(1);
  });
});
