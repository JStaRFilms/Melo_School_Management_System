import { useEffect, useState } from "react";
import type { BillingSortPreferences } from "../types";
import { BILLING_SORT_STORAGE_KEY, defaultBillingSortPreferences } from "../utils";

function isSortDirection(value: unknown): value is "asc" | "desc" {
  return value === "asc" || value === "desc";
}

function readStoredSortPreferences(): BillingSortPreferences {
  if (typeof window === "undefined") {
    return defaultBillingSortPreferences;
  }

  try {
    const raw = window.sessionStorage.getItem(BILLING_SORT_STORAGE_KEY);
    if (!raw) {
      return defaultBillingSortPreferences;
    }

    const parsed = JSON.parse(raw) as Partial<BillingSortPreferences>;
    return {
      invoices: {
        key: parsed.invoices?.key ?? defaultBillingSortPreferences.invoices.key,
        direction: isSortDirection(parsed.invoices?.direction)
          ? parsed.invoices.direction
          : defaultBillingSortPreferences.invoices.direction,
      },
      payments: {
        key: parsed.payments?.key ?? defaultBillingSortPreferences.payments.key,
        direction: isSortDirection(parsed.payments?.direction)
          ? parsed.payments.direction
          : defaultBillingSortPreferences.payments.direction,
      },
      plans: {
        key: parsed.plans?.key ?? defaultBillingSortPreferences.plans.key,
        direction: isSortDirection(parsed.plans?.direction)
          ? parsed.plans.direction
          : defaultBillingSortPreferences.plans.direction,
      },
    };
  } catch {
    return defaultBillingSortPreferences;
  }
}

export function useBillingSortPreferences() {
  const [sortPreferences, setSortPreferences] = useState<BillingSortPreferences>(defaultBillingSortPreferences);

  useEffect(() => {
    setSortPreferences(readStoredSortPreferences());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(BILLING_SORT_STORAGE_KEY, JSON.stringify(sortPreferences));
  }, [sortPreferences]);

  return { sortPreferences, setSortPreferences };
}
