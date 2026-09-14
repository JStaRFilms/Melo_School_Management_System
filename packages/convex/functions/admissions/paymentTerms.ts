import type { Doc } from "../../_generated/dataModel";
import type { AdmissionsContext } from "./shared";
import { sha256Hex } from "./shared";

export type PurchaseTerms = {
  amountMinor: number;
  currency: string;
  feeDisclosure: string;
  refundPolicyKey: string;
  termsDigest: string;
};

export async function immutablePurchaseTerms(
  ctx: AdmissionsContext,
  attempt: Doc<"admissionsPurchaseAttempts">,
): Promise<PurchaseTerms> {
  let refundPolicyKey = attempt.refundPolicySnapshot;
  if (!refundPolicyKey) {
    const boundPrice = await ctx.db.get(attempt.priceId);
    if (!boundPrice || boundPrice.productId !== attempt.productId || boundPrice.schoolId !== attempt.schoolId) {
      throw new Error("Immutable payment terms are unavailable");
    }
    refundPolicyKey = boundPrice.refundPolicyKey;
  }
  const terms = {
    amountMinor: attempt.amountMinor,
    currency: attempt.currency,
    feeDisclosure: attempt.feeDisclosureSnapshot,
    refundPolicyKey,
  };
  return {
    ...terms,
    termsDigest: await sha256Hex(JSON.stringify(terms)),
  };
}
