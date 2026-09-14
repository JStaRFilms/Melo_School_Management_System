import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createBillingGatewayAdapter, isDefinitiveBillingGatewayRejection } from "../billingGateway";
import { admissionsProviderValidator, paymentProviderModeValidator } from "../foundation/contracts";
import { resolveApplicationCallbackOrigin } from "../foundation/applicationLinks";
import {
  admissionsError,
  consumeAdmissionsRateLimit,
  normalizeRequiredText,
  normalizeSlug,
  recordAdmissionsAudit,
  requireAdmissionsModuleEnabled,
  requireGuardian,
} from "./shared";
import {
  markAttemptRecoveryOutcomeRef,
  markCheckoutInitializedRef,
  ownedProviderAttemptRef,
  recordVerifiedPaymentRef,
} from "./refs";

const attemptResultValidator = v.object({
  attemptId: v.id("admissionsPurchaseAttempts"),
  reference: v.string(),
  state: v.string(),
  amountMinor: v.number(),
  currency: v.string(),
  entitlementId: v.union(v.id("admissionsEntitlements"), v.null()),
  replayed: v.boolean(),
});

const unresolvedPurchaseAttemptStates = new Set(["created", "checkout_pending", "verification_pending", "manual_attention"]);

function isUnresolvedPurchaseAttempt(state: string): boolean {
  return unresolvedPurchaseAttemptStates.has(state);
}

export const createAttempt = mutation({
  args: { schoolSlug: v.string(), productSlug: v.string(), idempotencyKey: v.string() },
  returns: attemptResultValidator,
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const idempotencyKey = normalizeRequiredText(args.idempotencyKey, "Idempotency key", 128);
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.schoolSlug, "School slug"))).unique();
    if (!school) admissionsError("OFFERING_UNAVAILABLE", "Application offering is unavailable");
    await requireAdmissionsModuleEnabled(ctx, school._id);
    const product = await ctx.db.query("admissionsProducts").withIndex("by_school_and_slug", (q) => q.eq("schoolId", school._id).eq("slug", normalizeSlug(args.productSlug, "Product slug"))).unique();
    if (!product || product.slotCount !== 1) admissionsError("OFFERING_UNAVAILABLE", "Application offering is unavailable");
    const now = Date.now();
    const existing = await ctx.db.query("admissionsPurchaseAttempts").withIndex("by_school_and_guardian_and_idempotency_key", (q) => q.eq("schoolId", school._id).eq("guardianId", guardian._id).eq("idempotencyKey", idempotencyKey)).unique();
    if (existing) {
      if (existing.productId !== product._id) throw new ConvexError("Idempotency key is already bound to another purchase");
      return { attemptId: existing._id, reference: existing.reference, state: existing.state, amountMinor: existing.amountMinor, currency: existing.currency, entitlementId: existing.entitlementId ?? null, replayed: true };
    }
    const guard = await ctx.db.query("admissionsPurchaseGuards").withIndex("by_school_and_guardian_and_product", (q) => q.eq("schoolId", school._id).eq("guardianId", guardian._id).eq("productId", product._id)).unique();
    let guardedAttempt = guard ? await ctx.db.get(guard.currentAttemptId) : null;
    const guardedAttemptIsCurrent = guardedAttempt?.schoolId === school._id
      && guardedAttempt.guardianId === guardian._id
      && guardedAttempt.productId === product._id
      && isUnresolvedPurchaseAttempt(guardedAttempt.state);
    if (!guard || !guardedAttemptIsCurrent) {
      const guardianInventory = await ctx.db.query("admissionsPurchaseAttempts").withIndex("by_guardian_and_created_at", (q) => q.eq("guardianId", guardian._id)).order("desc").take(101);
      if (guardianInventory.length > 100) admissionsError("PAYMENT_REVIEW_REQUIRED", "An existing payment attempt requires review");
      const unresolvedMatches = guardianInventory.filter((attempt) => attempt.schoolId === school._id && attempt.productId === product._id && isUnresolvedPurchaseAttempt(attempt.state));
      if (unresolvedMatches.length > 1 || (guard && unresolvedMatches.length > 0)) admissionsError("PAYMENT_REVIEW_REQUIRED", "An existing payment attempt requires review");
      if (!guard && unresolvedMatches.length === 1) {
        guardedAttempt = unresolvedMatches[0] ?? null;
        if (guardedAttempt) await ctx.db.insert("admissionsPurchaseGuards", { schoolId: school._id, guardianId: guardian._id, productId: product._id, currentAttemptId: guardedAttempt._id, createdAt: now, updatedAt: now });
      }
    }
    if (guardedAttempt?.schoolId === school._id && guardedAttempt.guardianId === guardian._id && guardedAttempt.productId === product._id && isUnresolvedPurchaseAttempt(guardedAttempt.state)) {
      return { attemptId: guardedAttempt._id, reference: guardedAttempt.reference, state: guardedAttempt.state, amountMinor: guardedAttempt.amountMinor, currency: guardedAttempt.currency, entitlementId: guardedAttempt.entitlementId ?? null, replayed: true };
    }
    if (product.status !== "active") admissionsError("OFFERING_UNAVAILABLE", "Application offering is unavailable");
    const intake = await ctx.db.get(product.intakeId);
    if (!intake || intake.schoolId !== school._id || intake.status !== "open" || now < intake.opensAt || now > intake.closesAt) admissionsError("OFFERING_UNAVAILABLE", "Application offering is unavailable");
    const prices = await ctx.db.query("admissionsProductPrices").withIndex("by_product_and_status_and_effective_from", (q) => q.eq("productId", product._id).eq("status", "published")).order("desc").take(10);
    const price = prices.find((candidate) => candidate.effectiveFrom <= now && (candidate.effectiveTo === undefined || candidate.effectiveTo >= now));
    if (!price || price.schoolId !== school._id || !Number.isSafeInteger(price.amountMinor) || price.amountMinor <= 0) admissionsError("OFFERING_UNAVAILABLE", "A positive application price is required");
    const providerRows = await ctx.db.query("schoolPaymentProviders").withIndex("by_school_and_provider", (q) => q.eq("schoolId", school._id).eq("provider", "paystack")).take(2);
    const provider = providerRows.find((row) => row.isEnabled && (row.status === "ready" || row.status === "rotation_pending"));
    if (!provider) admissionsError("OFFERING_UNAVAILABLE", "Application payment is unavailable");
    await consumeAdmissionsRateLimit(ctx, {
      action: "checkout_attempt_create",
      schoolId: school._id,
      guardianId: guardian._id,
    });
    const reference = `adm_${crypto.randomUUID().replaceAll("-", "")}`;
    const attemptId = await ctx.db.insert("admissionsPurchaseAttempts", { schoolId: school._id, guardianId: guardian._id, productId: product._id, priceId: price._id, provider: "paystack", providerMode: provider.mode, reference, idempotencyKey, amountMinor: price.amountMinor, currency: price.currency, feeDisclosureSnapshot: price.feeDisclosure, state: "created", createdAt: now, updatedAt: now });
    if (guard) await ctx.db.patch(guard._id, { currentAttemptId: attemptId, updatedAt: now });
    else await ctx.db.insert("admissionsPurchaseGuards", { schoolId: school._id, guardianId: guardian._id, productId: product._id, currentAttemptId: attemptId, createdAt: now, updatedAt: now });
    await recordAdmissionsAudit(ctx, { schoolId: school._id, actorKind: "guardian", actorGuardianId: guardian._id, action: "payment.attempt_created", entityType: "admissionsPurchaseAttempt", entityId: attemptId });
    return { attemptId, reference, state: "created", amountMinor: price.amountMinor, currency: price.currency, entitlementId: null, replayed: false };
  },
});

export const getOwnedStatus = query({
  args: { reference: v.string() },
  returns: v.union(v.null(), attemptResultValidator),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const attempt = await ctx.db.query("admissionsPurchaseAttempts").withIndex("by_reference", (q) => q.eq("reference", args.reference.trim())).unique();
    if (!attempt || attempt.guardianId !== guardian._id) return null;
    return { attemptId: attempt._id, reference: attempt.reference, state: attempt.state, amountMinor: attempt.amountMinor, currency: attempt.currency, entitlementId: attempt.entitlementId ?? null, replayed: true };
  },
});

const providerAttemptValidator = v.object({
  attemptId: v.id("admissionsPurchaseAttempts"), schoolId: v.id("schools"), schoolSlug: v.string(), guardianEmail: v.string(),
  providerMode: paymentProviderModeValidator, reference: v.string(), amountMinor: v.number(), currency: v.string(), state: v.string(),
  failureCode: v.union(v.string(), v.null()), authorizationUrl: v.union(v.string(), v.null()), entitlementId: v.union(v.id("admissionsEntitlements"), v.null()), moduleEnabled: v.boolean(),
});

export const getOwnedProviderAttemptInternal = internalQuery({
  args: { reference: v.string() },
  returns: providerAttemptValidator,
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const attempt = await ctx.db.query("admissionsPurchaseAttempts").withIndex("by_reference", (q) => q.eq("reference", args.reference.trim())).unique();
    if (!attempt || attempt.guardianId !== guardian._id || attempt.provider !== "paystack") admissionsError("NOT_FOUND_OR_DENIED", "Payment attempt not found");
    const school = await ctx.db.get(attempt.schoolId);
    if (!school) throw new ConvexError("Payment school is unavailable");
    return { attemptId: attempt._id, schoolId: attempt.schoolId, schoolSlug: school.slug, guardianEmail: guardian.normalizedEmail, providerMode: attempt.providerMode, reference: attempt.reference, amountMinor: attempt.amountMinor, currency: attempt.currency, state: attempt.state, failureCode: attempt.failureCode ?? null, authorizationUrl: attempt.providerAuthorizationUrl ?? null, entitlementId: attempt.entitlementId ?? null, moduleEnabled: school.status === "active" && school.features?.admissions === true };
  },
});

export const markCheckoutInitialized = internalMutation({
  args: { attemptId: v.id("admissionsPurchaseAttempts"), authorizationUrl: v.string(), authorizationReference: v.optional(v.string()) },
  returns: v.object({ state: v.string(), authorizationUrl: v.string(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.guardianId !== guardian._id) admissionsError("NOT_FOUND_OR_DENIED", "Payment attempt not found");
    if (attempt.providerAuthorizationUrl) return { state: attempt.state, authorizationUrl: attempt.providerAuthorizationUrl, replayed: true };
    const authorizationUrl = new URL(args.authorizationUrl);
    if (authorizationUrl.protocol !== "https:") throw new ConvexError("Payment provider returned an invalid checkout URL");
    if (["paid", "refunded", "reversed"].includes(attempt.state)) return { state: attempt.state, authorizationUrl: authorizationUrl.toString(), replayed: true };
    await requireAdmissionsModuleEnabled(ctx, attempt.schoolId);
    if (attempt.state !== "created") throw new ConvexError("Payment attempt cannot be initialized in its current state");
    await ctx.db.patch(attempt._id, { state: "checkout_pending", providerAuthorizationUrl: authorizationUrl.toString(), ...(args.authorizationReference ? { providerAuthorizationReference: args.authorizationReference.slice(0, 200) } : {}), updatedAt: Date.now() });
    return { state: "checkout_pending", authorizationUrl: authorizationUrl.toString(), replayed: false };
  },
});

export const markAttemptRecoveryOutcome = internalMutation({
  args: {
    attemptId: v.id("admissionsPurchaseAttempts"),
    outcome: v.union(v.literal("failed"), v.literal("manual_attention"), v.literal("verification_pending")),
    failureCode: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.guardianId !== guardian._id) admissionsError("NOT_FOUND_OR_DENIED", "Payment attempt not found");
    if (["paid", "refunded", "reversed"].includes(attempt.state)) return null;
    const genericInitializationReview = attempt.state === "manual_attention" && attempt.failureCode === "PAYMENT_INITIALIZATION_REVIEW_REQUIRED";
    const allowed = args.outcome === "verification_pending"
      ? ["created", "checkout_pending", "verification_pending", "expired"].includes(attempt.state)
      : ["created", "checkout_pending", "verification_pending", "expired"].includes(attempt.state) || (args.outcome === "failed" && genericInitializationReview);
    if (!allowed) return null;
    await ctx.db.patch(attempt._id, {
      state: args.outcome,
      failureCode: normalizeRequiredText(args.failureCode, "Payment recovery code", 120),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const initializeAttempt = action({
  args: { reference: v.string(), returnOrigin: v.optional(v.string()) },
  returns: v.object({ reference: v.string(), state: v.string(), authorizationUrl: v.string(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const attempt = await ctx.runQuery(ownedProviderAttemptRef, { reference: args.reference });
    if (attempt.authorizationUrl) return { reference: attempt.reference, state: attempt.state, authorizationUrl: attempt.authorizationUrl, replayed: true };
    if (attempt.state !== "created") throw new ConvexError("Payment initialization is unavailable in its current state");
    if (!attempt.moduleEnabled || attempt.amountMinor <= 0) {
      await ctx.runMutation(markAttemptRecoveryOutcomeRef, { attemptId: attempt.attemptId, outcome: "failed", failureCode: "PAYMENT_INITIALIZATION_UNAVAILABLE" });
      throw new ConvexError("Payment initialization is unavailable");
    }
    let callbackUrl: string;
    try {
      const applicationOrigin = resolveApplicationCallbackOrigin(args.returnOrigin);
      const callback = new URL(`/s/${encodeURIComponent(attempt.schoolSlug)}/payments/paystack/return`, applicationOrigin);
      callback.searchParams.set("reference", attempt.reference);
      callbackUrl = callback.toString();
    } catch {
      await ctx.runMutation(markAttemptRecoveryOutcomeRef, { attemptId: attempt.attemptId, outcome: "failed", failureCode: "PAYMENT_CALLBACK_CONFIGURATION_INVALID" });
      throw new ConvexError("Payment initialization is unavailable");
    }
    const gatewayContext = await ctx.runQuery(internal.functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal, { schoolId: attempt.schoolId, mode: attempt.providerMode, purpose: "payment_initialization" });
    if (!gatewayContext?.activeSecretKey) {
      await ctx.runMutation(markAttemptRecoveryOutcomeRef, { attemptId: attempt.attemptId, outcome: "manual_attention", failureCode: "PAYMENT_INITIALIZATION_REVIEW_REQUIRED" });
      throw new ConvexError("Payment initialization requires review");
    }
    try {
      const gateway = createBillingGatewayAdapter({ provider: "paystack", secretKey: gatewayContext.activeSecretKey, mode: attempt.providerMode });
      const initialized = await gateway.createPaymentLink({ amount: attempt.amountMinor / 100, email: attempt.guardianEmail, schoolId: String(attempt.schoolId), schoolSlug: attempt.schoolSlug, invoiceId: String(attempt.attemptId), invoiceNumber: attempt.reference, description: "Admissions application", reference: attempt.reference, callbackUrl, providerMode: attempt.providerMode });
      if (!initialized.authorizationUrl) throw new Error("missing authorization URL");
      const committed = await ctx.runMutation(markCheckoutInitializedRef, { attemptId: attempt.attemptId, authorizationUrl: initialized.authorizationUrl, ...(initialized.accessCode ? { authorizationReference: initialized.accessCode } : {}) });
      return { reference: attempt.reference, ...committed };
    } catch (error) {
      const definitiveRejection = isDefinitiveBillingGatewayRejection(error);
      await ctx.runMutation(markAttemptRecoveryOutcomeRef, {
        attemptId: attempt.attemptId,
        outcome: definitiveRejection ? "failed" : "manual_attention",
        failureCode: definitiveRejection ? "PAYMENT_INITIALIZATION_REJECTED" : "PAYMENT_INITIALIZATION_REVIEW_REQUIRED",
      });
      throw new ConvexError(definitiveRejection ? "Payment initialization was declined" : "Payment initialization requires review");
    }
  },
});

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
}

function providerEventId(raw: unknown, reference: string) {
  const root = recordValue(raw);
  const data = recordValue(root?.data);
  const marker = data?.id ?? root?.event_id ?? reference;
  return `paystack:return:${typeof marker === "string" || typeof marker === "number" ? String(marker) : reference}`;
}

export const verifyReturn = action({
  args: { reference: v.string() },
  returns: attemptResultValidator,
  handler: async (ctx, args) => {
    const attempt = await ctx.runQuery(ownedProviderAttemptRef, { reference: args.reference });
    const recoveryState = attempt.state === "manual_attention" ? "manual_attention" : "verification_pending";
    const pendingResult = { attemptId: attempt.attemptId, reference: attempt.reference, state: recoveryState, amountMinor: attempt.amountMinor, currency: attempt.currency, entitlementId: attempt.entitlementId, replayed: false };
    if (["paid", "refunded", "reversed", "failed"].includes(attempt.state)) return { ...pendingResult, state: attempt.state, replayed: true };
    if (attempt.state !== "manual_attention") await ctx.runMutation(markAttemptRecoveryOutcomeRef, { attemptId: attempt.attemptId, outcome: "verification_pending", failureCode: "PAYMENT_VERIFICATION_PENDING" });
    const gatewayContext = await ctx.runQuery(internal.functions.billingProviders.resolveSchoolPaystackGatewaySecretContextInternal, { schoolId: attempt.schoolId, mode: attempt.providerMode, purpose: "payment_verification" });
    if (!gatewayContext?.activeSecretKey) return pendingResult;
    let verification;
    try {
      const gateway = createBillingGatewayAdapter({ provider: "paystack", secretKey: gatewayContext.activeSecretKey, mode: attempt.providerMode });
      verification = await gateway.verifyPayment(attempt.reference);
    } catch {
      return pendingResult;
    }
    if (verification.reference !== attempt.reference) {
      await ctx.runMutation(markAttemptRecoveryOutcomeRef, { attemptId: attempt.attemptId, outcome: "manual_attention", failureCode: "PAYMENT_REFERENCE_MISMATCH" });
      throw new ConvexError("Payment verification requires review");
    }
    const providerStatus = verification.status.trim().toLowerCase();
    if (providerStatus === "failed" || providerStatus === "abandoned") {
      await ctx.runMutation(markAttemptRecoveryOutcomeRef, { attemptId: attempt.attemptId, outcome: "failed", failureCode: "PAYMENT_VERIFICATION_FAILED" });
      const protectedManualAttention = attempt.state === "manual_attention" && attempt.failureCode !== "PAYMENT_INITIALIZATION_REVIEW_REQUIRED";
      return { ...pendingResult, state: protectedManualAttention ? "manual_attention" : "failed" };
    }
    if (providerStatus !== "success") return pendingResult;
    const amountMinor = Math.round(verification.amount * 100);
    const result = await ctx.runMutation(recordVerifiedPaymentRef, { schoolId: attempt.schoolId, purchaseAttemptId: attempt.attemptId, provider: "paystack", providerMode: attempt.providerMode, providerEventId: providerEventId(verification.raw, attempt.reference), eventType: "charge.success", bodyDigest: await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(verification.raw))).then((digest) => Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")), amountMinor, currency: verification.currency.trim().toUpperCase(), receivedAt: Date.now() });
    return { attemptId: attempt.attemptId, reference: attempt.reference, state: result.state, amountMinor: attempt.amountMinor, currency: attempt.currency, entitlementId: result.entitlementId, replayed: result.replayed };
  },
});

function financeOutcome(eventType: string, verifiedOutcome?: "refunded" | "reversed"): "refunded" | "reversed" | null {
  if (verifiedOutcome) return verifiedOutcome;
  const normalized = eventType.toLowerCase();
  if (normalized.includes("refund") && (normalized.includes("processed") || normalized.includes("success"))) return "refunded";
  if (normalized.endsWith(".reversed") || ((normalized.includes("reversal") || normalized.includes("chargeback")) && (normalized.includes("processed") || normalized.includes("success") || normalized.includes("completed")))) return "reversed";
  return null;
}

/** Signature or provider verification happens before this transaction. */
export const recordVerifiedPayment = internalMutation({
  args: { schoolId: v.id("schools"), purchaseAttemptId: v.id("admissionsPurchaseAttempts"), provider: admissionsProviderValidator, providerMode: paymentProviderModeValidator, providerEventId: v.string(), eventType: v.string(), bodyDigest: v.string(), amountMinor: v.number(), currency: v.string(), financialOutcome: v.optional(v.union(v.literal("refunded"), v.literal("reversed"))), receivedAt: v.number() },
  returns: v.object({ eventId: v.id("admissionsPaymentEvents"), entitlementId: v.union(v.id("admissionsEntitlements"), v.null()), replayed: v.boolean(), processed: v.boolean(), state: v.string() }),
  handler: async (ctx, args) => {
    if (!Number.isSafeInteger(args.amountMinor) || args.amountMinor <= 0 || !/^[A-Z]{3}$/.test(args.currency)) throw new ConvexError("Verified payment amount and currency are invalid");
    const attempt = await ctx.db.get(args.purchaseAttemptId);
    if (!attempt || attempt.schoolId !== args.schoolId || attempt.provider !== args.provider || attempt.providerMode !== args.providerMode) throw new ConvexError("Payment dispatch context mismatch");
    const existingEvents = await ctx.db.query("admissionsPaymentEvents").withIndex("by_school_and_provider_and_provider_event_id", (q) => q.eq("schoolId", args.schoolId).eq("provider", args.provider).eq("providerEventId", args.providerEventId)).filter((q) => q.eq(q.field("providerMode"), args.providerMode)).take(2);
    if (existingEvents.length > 1) throw new ConvexError("Conflicting verified payment event replay");
    const existingEvent = existingEvents[0];
    if (existingEvent && (existingEvent.purchaseAttemptId !== attempt._id || existingEvent.providerMode !== args.providerMode || existingEvent.eventType !== args.eventType || !existingEvent.signatureValid || existingEvent.bodyDigest !== args.bodyDigest || (existingEvent.verifiedAmountMinor !== undefined && existingEvent.verifiedAmountMinor !== args.amountMinor) || (existingEvent.verifiedCurrency !== undefined && existingEvent.verifiedCurrency !== args.currency))) throw new ConvexError("Conflicting verified payment event replay");
    const terminalEvent = existingEvent && ["processed", "ignored", "rejected"].includes(existingEvent.processingStatus);
    if (terminalEvent) {
      const entitlement = attempt.entitlementId ?? (await ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", attempt._id)).unique())?._id ?? null;
      return { eventId: existingEvent._id, entitlementId: entitlement, replayed: true, processed: existingEvent.processingStatus === "processed", state: attempt.state };
    }
    const exact = attempt.amountMinor === args.amountMinor && attempt.currency === args.currency;
    const paidEvent = args.eventType === "charge.success";
    const financialState = financeOutcome(args.eventType, args.financialOutcome);
    const now = Date.now();
    const eventId: Id<"admissionsPaymentEvents"> = existingEvent?._id ?? await ctx.db.insert("admissionsPaymentEvents", { schoolId: args.schoolId, purchaseAttemptId: attempt._id, provider: args.provider, providerMode: args.providerMode, providerEventId: normalizeRequiredText(args.providerEventId, "Provider event ID", 160), eventType: normalizeRequiredText(args.eventType, "Payment event type", 120), bodyDigest: args.bodyDigest, signatureValid: true, processingStatus: "verified", receivedAt: args.receivedAt, createdAt: now, updatedAt: now });
    const finalizeEvent = async (status: "processed" | "ignored" | "rejected", message: string) => ctx.db.patch(eventId, { verifiedAmountMinor: args.amountMinor, verifiedCurrency: args.currency, processingStatus: status, processingMessage: message, processedAt: now, updatedAt: now });
    let entitlement = await ctx.db.query("admissionsEntitlements").withIndex("by_source_purchase_attempt", (q) => q.eq("sourcePurchaseAttemptId", attempt._id)).unique();
    const terminalFinancialState = attempt.state === "refunded" || attempt.state === "reversed" ? attempt.state : null;
    if (financialState && terminalFinancialState) {
      await finalizeEvent("processed", `Verified ${financialState} recorded without changing terminal ${terminalFinancialState} outcome`);
      return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: true, state: terminalFinancialState };
    }
    if (paidEvent && terminalFinancialState && !exact) {
      await finalizeEvent("rejected", `Mismatched delayed success recorded without changing terminal ${terminalFinancialState} outcome`);
      return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: false, state: terminalFinancialState };
    }
    if (!exact) {
      if (financialState) {
        const application = entitlement?.applicationId ? await ctx.db.get(entitlement.applicationId) : null;
        if (entitlement) await ctx.db.patch(entitlement._id, { state: "revoked", voidReason: "VERIFIED_PARTIAL_FINANCIAL_REVERSAL", updatedAt: now });
        if (application) await ctx.db.patch(application._id, { financialHoldAt: now, financialHoldReason: "VERIFIED_PARTIAL_FINANCIAL_REVERSAL", updatedAt: now });
        await ctx.db.patch(attempt._id, { state: "manual_attention", failureCode: "PARTIAL_FINANCIAL_REVERSAL_REVIEW_REQUIRED", updatedAt: now });
        await finalizeEvent("processed", "Verified partial financial reversal applied a fail-closed hold for review");
        return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: true, state: "manual_attention" };
      }
      await finalizeEvent("rejected", "Verified event did not match the immutable purchase snapshot");
      if (paidEvent) await ctx.db.patch(attempt._id, { state: "manual_attention", failureCode: "PAYMENT_REVIEW_REQUIRED", updatedAt: now });
      return { eventId, entitlementId: null, replayed: Boolean(existingEvent), processed: false, state: paidEvent ? "manual_attention" : attempt.state };
    }
    if (financialState) {
      if (entitlement) {
        const application = entitlement.applicationId ? await ctx.db.get(entitlement.applicationId) : null;
        await ctx.db.patch(entitlement._id, { state: financialState === "refunded" ? "refunded" : "revoked", voidReason: `VERIFIED_${financialState.toUpperCase()}`, updatedAt: now });
        if (application) await ctx.db.patch(application._id, { financialHoldAt: now, financialHoldReason: `VERIFIED_${financialState.toUpperCase()}`, updatedAt: now });
      }
      await ctx.db.patch(attempt._id, { state: financialState, failureCode: undefined, updatedAt: now });
      await finalizeEvent("processed", `Verified ${financialState} applied monotonically`);
      return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: true, state: financialState };
    }
    if (!paidEvent) {
      await finalizeEvent("ignored", "Verified event is not a fulfilment or financial reversal event");
      return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: false, state: attempt.state };
    }
    if (attempt.state === "manual_attention" && attempt.failureCode !== "PAYMENT_INITIALIZATION_REVIEW_REQUIRED") {
      await finalizeEvent("processed", "Delayed success recorded without clearing the existing payment review hold");
      return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: true, state: attempt.state };
    }
    if (attempt.state === "refunded" || attempt.state === "reversed") {
      await finalizeEvent("processed", "Delayed success recorded without undoing the later financial outcome");
      return { eventId, entitlementId: entitlement?._id ?? null, replayed: Boolean(existingEvent), processed: true, state: attempt.state };
    }
    if (!entitlement) {
      const product = await ctx.db.get(attempt.productId);
      if (!product || product.schoolId !== args.schoolId) throw new ConvexError("Paid product context is unavailable");
      const entitlementId = await ctx.db.insert("admissionsEntitlements", { schoolId: args.schoolId, guardianId: attempt.guardianId, productId: attempt.productId, intakeId: product.intakeId, sourcePurchaseAttemptId: attempt._id, state: "available", createdAt: now, updatedAt: now });
      entitlement = await ctx.db.get(entitlementId);
      if (!entitlement) throw new ConvexError("Payment entitlement was not persisted");
    }
    await ctx.db.patch(attempt._id, { state: "paid", verifiedAt: now, entitlementId: entitlement._id, failureCode: undefined, updatedAt: now });
    await finalizeEvent("processed", "Verified payment created one application entitlement");
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "system", action: "payment.verified", entityType: "admissionsPurchaseAttempt", entityId: attempt._id, metadata: { providerEventId: args.providerEventId } });
    return { eventId, entitlementId: entitlement._id, replayed: Boolean(existingEvent), processed: true, state: "paid" };
  },
});
