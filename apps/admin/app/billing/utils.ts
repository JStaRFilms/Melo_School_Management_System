import type {
  BillingDashboardData,
  BillingSortPreferences,
  FeePlanDraftItem,
  FeePlanDraft,
  FeePlanApplicationDraft,
  InvoiceDraft,
  PaymentDraft,
  BillingSettingsDraft,
  PaystackProviderModeState,
  SortDirection,
} from "./types";

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function toQueryArgs(field: "classId" | "sessionId", value: string) {
  return value.trim()
    ? ({ [field]: value.trim() } as never)
    : ("skip" as never);
}

export function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export function getPaymentAttemptStatusLabel(
  status: "link_generated" | "awaiting_payer_return" | "verified" | "webhook_reconciled" | "manual_attention_needed"
) {
  switch (status) {
    case "link_generated":
      return "Link generated";
    case "awaiting_payer_return":
      return "Awaiting payer return";
    case "verified":
      return "Verified";
    case "webhook_reconciled":
      return "Webhook reconciled";
    case "manual_attention_needed":
      return "Manual attention needed";
  }
}

export function getPaymentAttemptStatusClass(
  status: "link_generated" | "awaiting_payer_return" | "verified" | "webhook_reconciled" | "manual_attention_needed"
) {
  switch (status) {
    case "link_generated":
      return "bg-slate-100 text-slate-700";
    case "awaiting_payer_return":
      return "bg-amber-50 text-amber-700";
    case "verified":
      return "bg-emerald-50 text-emerald-700";
    case "webhook_reconciled":
      return "bg-sky-50 text-sky-700";
    case "manual_attention_needed":
      return "bg-rose-50 text-rose-700";
  }
}

export function formatAttemptTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return "Never checked";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export const BILLING_SORT_STORAGE_KEY = "billing:table-sort-preferences";

export const defaultBillingSortPreferences: BillingSortPreferences = {
  invoices: { key: "date", direction: "desc" },
  payments: { key: "date", direction: "desc" },
  plans: { key: "date", direction: "desc" },
};

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base", numeric: true });
}

function compareNumber(left: number, right: number) {
  return left - right;
}

function applyDirection(result: number, direction: SortDirection) {
  return direction === "asc" ? result : result * -1;
}

export function toggleSortDirection<Key extends string>(
  current: { key: Key; direction: SortDirection },
  nextKey: Key,
  initialDirection: SortDirection = "asc"
): { key: Key; direction: SortDirection } {
  if (current.key === nextKey) {
    return {
      key: nextKey,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }

  return {
    key: nextKey,
    direction: initialDirection,
  };
}

export function sortInvoiceRows(
  invoices: BillingDashboardData["invoices"],
  sort: BillingSortPreferences["invoices"]
) {
  return [...invoices].sort((left, right) => {
    switch (sort.key) {
      case "reference":
        return applyDirection(compareText(left.invoice.invoiceNumber, right.invoice.invoiceNumber), sort.direction);
      case "recipient":
        return applyDirection(compareText(left.studentName, right.studentName), sort.direction);
      case "amount":
        return applyDirection(compareNumber(left.invoice.totalAmount, right.invoice.totalAmount), sort.direction);
      case "status":
        return applyDirection(compareText(left.invoice.status, right.invoice.status), sort.direction);
      case "date":
      default:
        return applyDirection(compareNumber(left.invoice.issuedAt, right.invoice.issuedAt), sort.direction);
    }
  });
}

export function sortPaymentRows(
  payments: BillingDashboardData["payments"],
  sort: BillingSortPreferences["payments"]
) {
  return [...payments].sort((left, right) => {
    switch (sort.key) {
      case "reference":
        return applyDirection(compareText(left.payment.reference, right.payment.reference), sort.direction);
      case "identifier":
        return applyDirection(compareText(left.invoiceNumber, right.invoiceNumber), sort.direction);
      case "recipient":
        return applyDirection(compareText(left.payment.payerName ?? left.studentName, right.payment.payerName ?? right.studentName), sort.direction);
      case "settlement":
        return applyDirection(compareNumber(left.payment.amountReceived, right.payment.amountReceived), sort.direction);
      case "date":
      default:
        return applyDirection(compareNumber(left.payment.receivedAt, right.payment.receivedAt), sort.direction);
    }
  });
}

export function sortFeePlans(
  plans: BillingDashboardData["feePlans"],
  sort: BillingSortPreferences["plans"]
) {
  return [...plans].sort((left, right) => {
    const leftAmount = left.lineItems.reduce((sum, item) => sum + item.amount, 0);
    const rightAmount = right.lineItems.reduce((sum, item) => sum + item.amount, 0);
    switch (sort.key) {
      case "name":
        return applyDirection(compareText(left.name, right.name), sort.direction);
      case "amount":
        return applyDirection(compareNumber(leftAmount, rightAmount), sort.direction);
      case "status":
        return applyDirection(compareText(left.isActive ? "active" : "archived", right.isActive ? "active" : "archived"), sort.direction);
      case "date":
      default:
        return applyDirection(compareNumber(left.createdAt, right.createdAt), sort.direction);
    }
  });
}

export function createDraftLineItem(
  overrides?: Partial<Omit<FeePlanDraftItem, "draftId">>
): FeePlanDraftItem {
  return {
    draftId: crypto.randomUUID(),
    label: overrides?.label ?? "",
    amount: overrides?.amount ?? "",
    category: overrides?.category ?? "other",
  };
}

export function initialPaystackGatewayConfigDraft(): any {
  return {
    publicKey: "",
    secretKey: "",
  };
}

export function initialFeePlanDraft(): FeePlanDraft {
  return {
    name: "",
    description: "",
    currency: "NGN",
    billingMode: "class_default",
    targetClassIds: [],
    installmentEnabled: false,
    installmentCount: "1",
    intervalDays: "0",
    firstDueDays: "14",
    lineItems: [createDraftLineItem({ label: "Tuition", category: "tuition" })],
  };
}

export function initialFeePlanApplicationDraft(): FeePlanApplicationDraft {
  return {
    feePlanId: "",
    classId: "",
    sessionId: "",
    termId: "",
    notes: "",
  };
}

export function initialInvoiceDraft(): InvoiceDraft {
  return {
    feePlanId: "",
    classId: "",
    sessionId: "",
    termId: "",
    studentId: "",
    waiverAmount: "0",
    discountAmount: "0",
    dueDate: "",
    notes: "",
  };
}

export function initialPaymentDraft(): PaymentDraft {
  return {
    invoiceId: "",
    reference: "",
    amountReceived: "",
    paymentMethod: "cash",
    payerName: "",
    payerEmail: "",
    notes: "",
  };
}

export function initialBillingSettingsDraft(schoolSlug = ""): BillingSettingsDraft {
  const normalizedPrefix = schoolSlug.trim().toUpperCase();

  return {
    invoicePrefix: normalizedPrefix,
    defaultCurrency: "NGN",
    defaultDueDays: "14",
    paymentProviderMode: "test",
    allowManualPayments: true,
    allowOnlinePayments: false,
  };
}

export function buildBillingSettingsDraft(
  settings:
    | {
        invoicePrefix: string;
        defaultCurrency: string;
        defaultDueDays: number;
        paymentProviderMode: "test" | "live";
        allowManualPayments: boolean;
        allowOnlinePayments: boolean;
      }
    | null
    | undefined,
  schoolSlug: string
): BillingSettingsDraft {
  if (!settings) {
    return initialBillingSettingsDraft(schoolSlug);
  }

  return {
    invoicePrefix: settings.invoicePrefix,
    defaultCurrency: settings.defaultCurrency,
    defaultDueDays: String(settings.defaultDueDays),
    paymentProviderMode: settings.paymentProviderMode,
    allowManualPayments: settings.allowManualPayments,
    allowOnlinePayments: settings.allowOnlinePayments,
  };
}

export function paymentGatewayStatusLabel(status: PaystackProviderModeState["status"]) {
  switch (status) {
    case "ready":
      return "Ready";
    case "rotation_pending":
      return "Rotation pending";
    case "invalid":
      return "Invalid";
    case "disabled":
      return "Disabled";
    default:
      return "Not configured";
  }
}

export function paymentGatewayStatusClasses(status: PaystackProviderModeState["status"]) {
  switch (status) {
    case "ready":
      return "bg-emerald-50 text-emerald-700";
    case "rotation_pending":
      return "bg-amber-50 text-amber-700";
    case "invalid":
      return "bg-rose-50 text-rose-700";
    case "disabled":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function initialPaymentLinkDraft(): any { // Using any for simplicity in this extraction step
  return {
    invoiceId: "",
    amount: "",
    email: "",
    description: "",
    callbackUrl: "",
  };
}
