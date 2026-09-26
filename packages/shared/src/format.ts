/**
 * Shared formatting primitives (consolidation P19). Units are explicit in
 * every name: Major takes whole currency units, Minor takes minor units
 * (kobo/cents). Locales are preserved per variant, never collapsed: money
 * stays en-NG, the portal day format stays en-GB, and the apply minor
 * formatter keeps the caller's locale exactly as before.
 */

export function formatMoneyMajor(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMoneyMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function formatDateGBDay(value: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTimeNG(value: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatScoreOrDash(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
