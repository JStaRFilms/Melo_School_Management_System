import { internalMutation, internalQuery } from "../../_generated/server";
import { v } from "convex/values";
import {
  admissionsProviderValidator,
  paymentProviderModeValidator,
} from "./contracts";

const billingDispatchContextValidator = v.object({
  domain: v.literal("billing"),
  schoolId: v.id("schools"),
  provider: admissionsProviderValidator,
  providerMode: paymentProviderModeValidator,
  invoiceId: v.id("studentInvoices"),
  invoiceNumber: v.string(),
});

const admissionsDispatchContextValidator = v.object({
  domain: v.literal("admissions"),
  schoolId: v.id("schools"),
  provider: admissionsProviderValidator,
  providerMode: paymentProviderModeValidator,
  purchaseAttemptId: v.id("admissionsPurchaseAttempts"),
});

export function matchesPaymentDispatchProviderModeV1(
  context: { provider: string; providerMode: string },
  provider: string,
  providerMode?: string
): boolean {
  return context.provider === provider && (!providerMode || context.providerMode === providerMode);
}

/** Resolves the payment domain from a persisted reference, not webhook metadata. */
export const resolvePaymentDispatchContextInternal = internalQuery({
  args: { reference: v.string() },
  returns: v.union(v.null(), billingDispatchContextValidator, admissionsDispatchContextValidator),
  handler: async (ctx, args) => {
    const reference = args.reference.trim();
    if (!reference) return null;

    if (reference.startsWith("adm_")) {
      const attempt = await ctx.db
        .query("admissionsPurchaseAttempts")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .unique();
      if (!attempt) return null;
      return {
        domain: "admissions" as const,
        schoolId: attempt.schoolId,
        provider: attempt.provider,
        providerMode: attempt.providerMode,
        purchaseAttemptId: attempt._id,
      };
    }

    const attempt = await ctx.db
      .query("billingPaymentAttempts")
      .withIndex("by_reference", (q) => q.eq("reference", reference))
      .unique();
    if (!attempt) return null;
    const invoice = await ctx.db.get(attempt.invoiceId);
    if (!invoice) return null;

    return {
      domain: "billing" as const,
      schoolId: attempt.schoolId,
      provider: attempt.provider,
      providerMode: attempt.providerMode ?? "test",
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
    };
  },
});

/**
 * B0's replay ledger for verified `adm_` webhook envelopes. It deliberately
 * does not create an entitlement; B1 consumes the immutable verified event in
 * its own transaction and marks it processed.
 */
export const recordVerifiedAdmissionsPaymentEventInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    purchaseAttemptId: v.id("admissionsPurchaseAttempts"),
    provider: admissionsProviderValidator,
    providerMode: paymentProviderModeValidator,
    providerEventId: v.string(),
    eventType: v.string(),
    bodyDigest: v.string(),
    receivedAt: v.number(),
  },
  returns: v.object({ eventId: v.id("admissionsPaymentEvents"), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.purchaseAttemptId);
    if (
      !attempt ||
      attempt.schoolId !== args.schoolId ||
      attempt.provider !== args.provider ||
      attempt.providerMode !== args.providerMode
    ) {
      throw new Error("Payment dispatch context mismatch");
    }

    const existing = await ctx.db
      .query("admissionsPaymentEvents")
      .withIndex("by_school_and_provider_and_provider_event_id", (q) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("provider", args.provider)
          .eq("providerEventId", args.providerEventId)
      )
      .unique();
    if (existing) return { eventId: existing._id, replayed: true };

    const eventId = await ctx.db.insert("admissionsPaymentEvents", {
      schoolId: args.schoolId,
      purchaseAttemptId: args.purchaseAttemptId,
      provider: args.provider,
      providerMode: args.providerMode,
      providerEventId: args.providerEventId,
      eventType: args.eventType,
      bodyDigest: args.bodyDigest,
      signatureValid: true,
      processingStatus: "verified",
      receivedAt: args.receivedAt,
      createdAt: args.receivedAt,
      updatedAt: args.receivedAt,
    });
    return { eventId, replayed: false };
  },
});
