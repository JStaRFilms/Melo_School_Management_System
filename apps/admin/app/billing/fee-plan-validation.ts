import type { FeePlanDraft } from "./types";

export function feePlanSignature(draft: FeePlanDraft): string {
  return JSON.stringify({ ...draft, bankAccountId: draft.bankAccountId || undefined, lineItems: draft.lineItems.map(item => ({ label: item.label, amount: item.amount, category: item.category, isOptional: item.isOptional })) });
}

/** Validate every row: silently filtering invalid fees changes the submitted plan. */
export function feePlanValidation(draft: FeePlanDraft): string | null {
  if (!draft.name.trim()) return "Please enter a fee plan name";
  if (!draft.lineItems.length || draft.lineItems.some(item => !item.label.trim() || !item.amount.trim() || !Number.isFinite(Number(item.amount)) || Number(item.amount) <= 0)) {
    return "Every fee item needs a name and a finite amount greater than zero";
  }
  if (draft.installmentEnabled && (!Number.isInteger(Number(draft.installmentCount)) || Number(draft.installmentCount) < 2 || !Number.isInteger(Number(draft.intervalDays)) || Number(draft.intervalDays) < 1)) {
    return "Installments need at least two payments and a positive whole-day interval";
  }
  if (!draft.firstDueDays.trim() || !Number.isInteger(Number(draft.firstDueDays)) || Number(draft.firstDueDays) < 0) return "First due days must be a nonnegative whole number";
  return null;
}
