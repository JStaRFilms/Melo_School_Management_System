import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
export const bankMetadata = {
  label: v.optional(v.string()),
  branch: v.optional(v.string()),
  iban: v.optional(v.string()),
  swift: v.optional(v.string()),
};
export const paymentInstructionsValidator = v.object({
  bankAccountId: v.optional(v.id("schoolBankAccounts")),
  bankName: v.string(),
  accountName: v.string(),
  accountNumber: v.string(),
  sortCode: v.optional(v.string()),
  currency: v.string(),
  transferNote: v.optional(v.string()),
  ...bankMetadata,
  snapshottedAt: v.number(),
});
export function invoicePaymentInstructions(
  invoice: Pick<
    Doc<"studentInvoices">,
    "status" | "balanceDue" | "paymentInstructionsSnapshot"
  >,
) {
  return invoice.balanceDue > 0 &&
    ["issued", "overdue", "partially_paid"].includes(invoice.status)
    ? (invoice.paymentInstructionsSnapshot ?? null)
    : null;
}
