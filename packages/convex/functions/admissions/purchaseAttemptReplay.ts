import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

type CurrentOffering = {
  schoolId: Id<"schools">;
  guardianId: Id<"admissionsGuardians">;
  productId: Id<"admissionsProducts">;
  intakeId: Id<"admissionsIntakes">;
  priceId: Id<"admissionsProductPrices">;
  amountMinor: number;
  currency: string;
  disclosure: string;
};

function matchesCurrentOffering(
  attempt: {
    schoolId: Id<"schools">;
    guardianId: Id<"admissionsGuardians">;
    productId: Id<"admissionsProducts">;
    intakeId?: Id<"admissionsIntakes">;
    priceId: Id<"admissionsProductPrices">;
    amountMinor: number;
    currency: string;
    feeDisclosureSnapshot: string;
  },
  offering: CurrentOffering,
) {
  return attempt.schoolId === offering.schoolId
    && attempt.guardianId === offering.guardianId
    && attempt.productId === offering.productId
    && attempt.intakeId === offering.intakeId
    && attempt.priceId === offering.priceId
    && attempt.amountMinor === offering.amountMinor
    && attempt.currency === offering.currency
    && attempt.feeDisclosureSnapshot === offering.disclosure;
}

/**
 * An idempotency key is a replay token for one immutable offering snapshot,
 * not a school-wide payment token. The legacy index remains collision-only so
 * historical attempts are never rewritten to fit a later offering.
 */
export async function findExactPurchaseAttemptReplay(
  ctx: MutationCtx,
  offering: CurrentOffering,
  idempotencyKey: string,
) {
  const productScoped = await ctx.db
    .query("admissionsPurchaseAttempts")
    .withIndex("by_school_and_guardian_and_product_and_idempotency_key", (q) => q
      .eq("schoolId", offering.schoolId)
      .eq("guardianId", offering.guardianId)
      .eq("productId", offering.productId)
      .eq("idempotencyKey", idempotencyKey))
    .unique();

  if (productScoped) {
    if (matchesCurrentOffering(productScoped, offering)) return productScoped;
    throw new ConvexError("CHECKOUT_IDEMPOTENCY_CONFLICT");
  }

  const legacyCollision = await ctx.db
    .query("admissionsPurchaseAttempts")
    .withIndex("by_school_and_guardian_and_idempotency_key", (q) => q
      .eq("schoolId", offering.schoolId)
      .eq("guardianId", offering.guardianId)
      .eq("idempotencyKey", idempotencyKey))
    .take(1);
  if (legacyCollision.length) throw new ConvexError("CHECKOUT_IDEMPOTENCY_CONFLICT");

  return null;
}
