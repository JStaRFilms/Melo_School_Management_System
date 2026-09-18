/**
 * Shared text normalization predicates (consolidation P13). Pure checks only:
 * length caps and error messages stay with each caller (stricter caps would
 * reject old input), so only the identical expressions are shared.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared email-shape check (trim + lowercase left to callers with their caps). */
export function isEmailAddress(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function normalizeEmailCase(value: string): string {
  return value.trim().toLowerCase();
}
