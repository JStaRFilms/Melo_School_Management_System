import { action, internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../../_generated/api";
import { createBillingGatewayAdapter } from "../billingGateway";
import { admissionsProviderValidator, paymentProviderModeValidator } from "../foundation/contracts";
import { audit, digest, opaqueKey, requireGuardian } from "./helpers";

const safeAttemptValidator = v.object({
  attemptId: v.id("admissionsPurchaseAttempts"), reference: v.string(), state: v.string(),
  amountMinor: v.number(), currency: v.string(), disclosure: v.string(),
});

export const getConfiguredAdmissionsPaymentProviderInternal = internalQuery({
  args: { schoolId: v.id("schools") },
  returns: v.union(v.null(), v.object({ provider: v.literal("paystack"), providerMode: paymentProviderModeValidator })),
  handler: async (ctx, args) => {
    const overview: { activeMode: "test" | "live"; readyForPayments: boolean } = await ctx.runQuery(
      (internal as any).functions.billingProviders.getSchoolPaystackGatewayOverviewInternal,
      { schoolId: args.schoolId },
    );
    return overview.readyForPayments ? { provider: "paystack" as const, providerMode: overview.activeMode } : null;
  },
});

async function resolvePurchase(ctx: Parameters<typeof requireGuardian>[0], guardianId: any, productId: any) {
  const product: any = await ctx.db.get(productId);
  if (!product || product.status !== "active") throw new ConvexError("OFFERING_UNAVAILABLE");
  const intake: any = await ctx.db.get(product.intakeId);
  if (!intake || intake.schoolId !== product.schoolId || intake.status !== "open" || intake.opensAt > Date.now() || intake.closesAt < Date.now()) {
    throw new ConvexError("OFFERING_UNAVAILABLE");
  }
  const prices = await ctx.db.query("admissionsProductPrices")
    .withIndex("by_product_and_status_and_effective_from", (q) => q.eq("productId", productId).eq("status", "published"))
    .order("desc").take(50);
  const price: any = prices.find((entry) => entry.schoolId === product.schoolId && entry.effectiveFrom <= Date.now() && (!entry.effectiveTo || entry.effectiveTo > Date.now()));
  if (!price) throw new ConvexError("OFFERING_UNAVAILABLE");
  return { product, intake, price, guardianId };
}

export const createAttempt = mutation({
  args: { productId: v.id("admissionsProducts"), idempotencyKey: v.string() },
  returns: safeAttemptValidator,
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    if (!guardian.emailVerifiedAt) throw new ConvexError("VERIFICATION_REQUIRED");
    const idempotencyKey = args.idempotencyKey.trim();
    if (!idempotencyKey || idempotencyKey.length > 128) throw new ConvexError("Invalid idempotency key");
    const resolved = await resolvePurchase(ctx, guardian._id, args.productId);
    const existing = await ctx.db.query("admissionsPurchaseAttempts")
      .withIndex("by_school_and_guardian_and_idempotency_key", (q) => q.eq("schoolId", resolved.product.schoolId).eq("guardianId", guardian._id).eq("idempotencyKey", idempotencyKey)).unique();
    if (existing) return { attemptId: existing._id, reference: existing.reference, state: existing.state, amountMinor: existing.amountMinor, currency: existing.currency, disclosure: existing.feeDisclosureSnapshot };
    const providerConfig: { provider: "paystack"; providerMode: "test" | "live" } | null = await ctx.runQuery(
      (internal as any).functions.admissions.payments.getConfiguredAdmissionsPaymentProviderInternal,
      { schoolId: resolved.product.schoolId },
    );
    if (!providerConfig) throw new ConvexError("OFFERING_UNAVAILABLE");
    const now = Date.now();
    const attemptId = await ctx.db.insert("admissionsPurchaseAttempts", {
      schoolId: resolved.product.schoolId, guardianId: guardian._id, productId: resolved.product._id, priceId: resolved.price._id,
      provider: providerConfig.provider, providerMode: providerConfig.providerMode, reference: opaqueKey("adm_"), idempotencyKey,
      amountMinor: resolved.price.amountMinor, currency: resolved.price.currency, feeDisclosureSnapshot: resolved.price.feeDisclosure,
      state: "created", createdAt: now, updatedAt: now,
    });
    await audit({ ctx, schoolId: resolved.product.schoolId, actor: { kind: "guardian", guardianId: guardian._id }, action: "payment.attempt_created", entityType: "purchase_attempt", entityId: String(attemptId), outcome: "success" });
    return { attemptId, reference: (await ctx.db.get(attemptId))!.reference, state: "created", amountMinor: resolved.price.amountMinor, currency: resolved.price.currency, disclosure: resolved.price.feeDisclosure };
  },
});

export const getOwnedAttemptForInitialization = query({
  args: { attemptId: v.id("admissionsPurchaseAttempts") },
  returns: v.union(v.null(), v.object({ schoolId: v.id("schools"), schoolSlug: v.string(), attemptId: v.id("admissionsPurchaseAttempts"), reference: v.string(), provider: admissionsProviderValidator, providerMode: paymentProviderModeValidator, amountMinor: v.number(), currency: v.string(), email: v.string(), state: v.string(), entitlementId: v.union(v.id("admissionsEntitlements"), v.null()) })),
  handler: async (ctx, args) => {
    const { guardian } = await requireGuardian(ctx);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.guardianId !== guardian._id) return null;
    const school = await ctx.db.get(attempt.schoolId);
    if (!school) return null;
    return { schoolId: attempt.schoolId, schoolSlug: school.slug, attemptId: attempt._id, reference: attempt.reference, provider: attempt.provider, providerMode: attempt.providerMode, amountMinor: attempt.amountMinor, currency: attempt.currency, email: guardian.normalizedEmail, state: attempt.state, entitlementId: attempt.entitlementId ?? null };
  },
});

export const verifyReturn = action({
  args: { attemptId: v.id("admissionsPurchaseAttempts") },
  returns: v.object({ state: v.string(), entitlementId: v.union(v.id("admissionsEntitlements"), v.null()) }),
  handler: async (ctx, args) => {
    const attempt: any = await ctx.runQuery((api as any).functions.admissions.payments.getOwnedAttemptForInitialization, args);
    if (!attempt) throw new ConvexError("Not found or access denied");
    if (attempt.state === "paid") return { state: "paid", entitlementId: attempt.entitlementId ?? null };
    if (attempt.state === "refunded" || attempt.state === "reversed" || attempt.state === "manual_attention") return { state: attempt.state, entitlementId: null };
    if (attempt.provider !== "paystack") throw new ConvexError("Payment provider is unavailable");
    const gatewayContext: any = await ctx.runQuery((internal as any).functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal, { schoolId: attempt.schoolId, mode: attempt.providerMode, purpose: "payment_verification" });
    if (!gatewayContext?.activeSecretKey) throw new ConvexError("Payment provider is unavailable");
    const receipt = await createBillingGatewayAdapter({ provider: "paystack", secretKey: gatewayContext.activeSecretKey, mode: attempt.providerMode }).verifyPayment(attempt.reference);
    if (receipt.status !== "success" || Math.round(receipt.amount * 100) !== attempt.amountMinor || receipt.currency.toUpperCase() !== attempt.currency.toUpperCase()) {
      await ctx.runMutation((internal as any).functions.admissions.payments.recordManualAttention, { attemptId: attempt.attemptId, reasonCode: "RECEIPT_MISMATCH_OR_UNRESOLVED" });
      return { state: "manual_attention", entitlementId: null };
    }
    const event: any = await ctx.runMutation((internal as any).functions.foundation.paymentDispatch.recordVerifiedAdmissionsPaymentEventInternal, {
      schoolId: attempt.schoolId, purchaseAttemptId: attempt.attemptId, provider: attempt.provider, providerMode: attempt.providerMode,
      providerEventId: `receipt:${attempt.reference}`, eventType: "payment.receipt_verified", bodyDigest: await digest(`${attempt.reference}:${receipt.status}:${receipt.amount}:${receipt.currency}`), receivedAt: Date.now(),
    });
    const fulfilled: any = await ctx.runMutation((internal as any).functions.admissions.payments.fulfilVerifiedEvent, { paymentEventId: event.eventId });
    return { state: "paid", entitlementId: fulfilled.entitlementId };
  },
});

/** A redirect/receipt mismatch is durable and truthful: it never grants a slot. */
export const recordManualAttention = internalMutation({
  args: { attemptId: v.id("admissionsPurchaseAttempts"), reasonCode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.state === "paid" || attempt.state === "refunded" || attempt.state === "reversed") return null;
    await ctx.db.patch(attempt._id, { state: "manual_attention", failureCode: args.reasonCode.slice(0, 128), updatedAt: Date.now() });
    return null;
  },
});

export const recordInitialization = internalMutation({
  args: { attemptId: v.id("admissionsPurchaseAttempts"), authorizationReference: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || (attempt.state !== "created" && attempt.state !== "checkout_pending")) return null;
    await ctx.db.patch(attempt._id, { state: "checkout_pending", providerAuthorizationReference: args.authorizationReference, updatedAt: Date.now() });
    return null;
  },
});

/** External initialization never fulfils a slot. The verified webhook/receipt path below is the only fulfilment path. */
export const initializeAttempt = action({
  args: { attemptId: v.id("admissionsPurchaseAttempts") },
  returns: v.object({ state: v.string(), checkoutUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const attempt: any = await ctx.runQuery((api as any).functions.admissions.payments.getOwnedAttemptForInitialization, args);
    if (!attempt) throw new ConvexError("Not found or access denied");
    if (attempt.state === "paid") return { state: "paid", checkoutUrl: null };
    if (attempt.state === "refunded" || attempt.state === "reversed" || attempt.state === "manual_attention") return { state: attempt.state, checkoutUrl: null };
    if (attempt.provider !== "paystack") throw new ConvexError("Payment provider is unavailable");
    const gatewayContext: any = await ctx.runQuery((internal as any).functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal, { schoolId: attempt.schoolId, mode: attempt.providerMode, purpose: "payment_initialization" });
    if (!gatewayContext?.activeSecretKey) throw new ConvexError("Payment provider is unavailable");
    const applicationOrigin = process.env.APPLICATION_ORIGIN?.trim() ?? process.env.APPLY_APP_ORIGIN?.trim();
    if (!applicationOrigin) throw new ConvexError("Payment provider is unavailable");
    const result = await createBillingGatewayAdapter({ provider: "paystack", secretKey: gatewayContext.activeSecretKey, mode: attempt.providerMode }).createPaymentLink({
      amount: attempt.amountMinor / 100, email: attempt.email, schoolId: String(attempt.schoolId), schoolSlug: attempt.schoolSlug, invoiceId: String(attempt.attemptId), invoiceNumber: "ADMISSIONS", description: "Admissions application slot", reference: attempt.reference, providerMode: attempt.providerMode, paymentDomain: "admissions", callbackUrl: `${applicationOrigin.replace(/\/$/, "")}/s/${encodeURIComponent(attempt.schoolSlug)}/payments/paystack/return?reference=${encodeURIComponent(attempt.reference)}`,
    });
    await ctx.runMutation((internal as any).functions.admissions.payments.recordInitialization, { attemptId: attempt.attemptId, authorizationReference: result.reference });
    return { state: "checkout_pending", checkoutUrl: result.authorizationUrl };
  },
});

/** B1-only entitlement fulfilment. A B0 verified envelope is consumed once, and replays return the same entitlement. */
export const fulfilVerifiedEvent = internalMutation({
  args: { paymentEventId: v.id("admissionsPaymentEvents") },
  returns: v.object({ entitlementId: v.id("admissionsEntitlements"), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.paymentEventId);
    if (!event || !event.signatureValid || (event.processingStatus !== "verified" && event.processingStatus !== "processed")) throw new ConvexError("Verified payment event required");
    const attempt = await ctx.db.get(event.purchaseAttemptId);
    if (!attempt || attempt.schoolId !== event.schoolId || attempt.provider !== event.provider || attempt.providerMode !== event.providerMode) throw new ConvexError("Payment dispatch context mismatch");
    const existing = await ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", attempt._id)).unique();
    const normalizedEvent = event.eventType.toLowerCase();
    const reversalState = normalizedEvent.includes("refund") ? "refunded" : normalizedEvent.includes("reversal") || normalizedEvent.includes("chargeback") || normalizedEvent.includes("dispute") ? "reversed" : null;
    if (reversalState) {
      const now = Date.now();
      await ctx.db.patch(attempt._id, { state: reversalState, failureCode: normalizedEvent.slice(0, 128), updatedAt: now });
      if (!existing) { await ctx.db.patch(event._id, { processingStatus: "processed", processedAt: now, updatedAt: now }); throw new ConvexError("Verified finance event has no entitlement"); }
      const entitlementState = reversalState === "refunded" ? "refunded" : "revoked";
      await ctx.db.patch(existing._id, { state: entitlementState, voidReason: normalizedEvent.slice(0, 128), updatedAt: now });
      if (existing.applicationId) {
        const application = await ctx.db.get(existing.applicationId);
        if (application) {
          const hold = await ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "active")).unique();
          const holdId = hold?._id ?? await ctx.db.insert("admissionsFinanceHolds", { schoolId: application.schoolId, applicationId: application._id, state: "active", reasonCode: reversalState === "refunded" ? "PAYMENT_REFUNDED" : "PAYMENT_REVERSED", createdAt: now, updatedAt: now });
          await ctx.db.patch(application._id, { activeFinanceHoldId: holdId, financeBlockedReason: reversalState === "refunded" ? "PAYMENT_REFUNDED" : "PAYMENT_REVERSED", updatedAt: now });
        }
      }
      await ctx.db.patch(event._id, { processingStatus: "processed", processedAt: now, updatedAt: now });
      await audit({ ctx, schoolId: attempt.schoolId, actor: { kind: "system" }, action: "payment.entitlement_voided", entityType: "entitlement", entityId: String(existing._id), ...(existing.applicationId ? { applicationId: existing.applicationId } : {}), outcome: "success", reasonCode: reversalState });
      return { entitlementId: existing._id, replayed: event.processingStatus === "processed" };
    }
    if (existing) {
      if (event.processingStatus !== "processed") await ctx.db.patch(event._id, { processingStatus: "processed", processedAt: Date.now(), updatedAt: Date.now() });
      return { entitlementId: existing._id, replayed: true };
    }
    if (event.processingStatus !== "verified") throw new ConvexError("Verified payment event required");
    const product: any = await ctx.db.get(attempt.productId);
    if (!product || product.schoolId !== attempt.schoolId) throw new ConvexError("Payment dispatch context mismatch");
    const now = Date.now();
    const entitlementId = await ctx.db.insert("admissionsEntitlements", { schoolId: attempt.schoolId, guardianId: attempt.guardianId, productId: product._id, intakeId: product.intakeId, sourcePurchaseAttemptId: attempt._id, state: "available", createdAt: now, updatedAt: now });
    await ctx.db.patch(attempt._id, { state: "paid", verifiedAt: now, entitlementId, updatedAt: now });
    await ctx.db.patch(event._id, { processingStatus: "processed", processedAt: now, updatedAt: now });
    await audit({ ctx, schoolId: attempt.schoolId, actor: { kind: "system" }, action: "payment.entitlement_fulfilled", entityType: "entitlement", entityId: String(entitlementId), outcome: "success" });
    return { entitlementId, replayed: false };
  },
});
