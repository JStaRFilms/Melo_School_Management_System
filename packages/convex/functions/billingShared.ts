import { ConvexError, v } from "convex/values";
import { paymentInstructionsValidator } from "./foundation/bankInstructions";

export const billingLineItemCategoryValidator = v.union(
  v.literal("tuition"),
  v.literal("boarding"),
  v.literal("transport"),
  v.literal("exam"),
  v.literal("activity"),
  v.literal("other")
);

export const billingInstallmentPolicyValidator = v.object({
  enabled: v.boolean(),
  installmentCount: v.number(),
  intervalDays: v.number(),
  firstDueDays: v.number(),
});

export const billingLineItemValidator = v.object({
  id: v.string(),
  label: v.string(),
  amount: v.number(),
  category: billingLineItemCategoryValidator,
  order: v.number(),
  isOptional: v.optional(v.boolean()),
  isSelected: v.optional(v.boolean()),
  sourceSelectableItemId: v.optional(v.id("selectableBillingItems")),
  unitAmount: v.optional(v.number()),
  quantity: v.optional(v.number()),
});

export const billingOptionalSelectionModeValidator = v.union(
  v.literal("legacy_included"),
  v.literal("parent_selectable")
);

export const selectableBillingSelectionValidator = v.object({
  itemId: v.id("selectableBillingItems"),
  quantity: v.number(),
});

export const invoiceOptionalSelectionValidator = v.object({
  lineItemId: v.string(),
  isSelected: v.boolean(),
});

const selectableBillingItemProjectionValidator = v.object({
  _id: v.id("selectableBillingItems"),
  label: v.string(),
  description: v.union(v.string(), v.null()),
  unitAmount: v.number(),
  category: billingLineItemCategoryValidator,
  order: v.number(),
  isActive: v.boolean(),
});

export const selectableBillingCollectionValidator = v.object({
  _id: v.id("selectableBillingCollections"),
  schoolId: v.id("schools"),
  bankAccountId: v.union(v.id("schoolBankAccounts"), v.null()),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  currency: v.string(),
  targetClassIds: v.array(v.id("classes")),
  targetClasses: v.array(v.object({ _id: v.id("classes"), name: v.string() })),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  items: v.array(selectableBillingItemProjectionValidator),
});

export const billingInstallmentScheduleValidator = v.object({
  id: v.string(),
  label: v.string(),
  dueAt: v.number(),
  amount: v.number(),
  isPaid: v.boolean(),
});

export const billingFeePlanBillingModeValidator = v.union(
  v.literal("class_default"),
  v.literal("manual_extra")
);

export const billingFeePlanValidator = v.object({
  bankAccountId: v.optional(v.id("schoolBankAccounts")),
  _id: v.id("feePlans"),
  schoolId: v.id("schools"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  currency: v.string(),
  billingMode: billingFeePlanBillingModeValidator,
  targetClassIds: v.array(v.id("classes")),
  optionalSelectionMode: billingOptionalSelectionModeValidator,
  lineItems: v.array(billingLineItemValidator),
  installmentPolicy: billingInstallmentPolicyValidator,
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  updatedBy: v.id("users"),
});

export const billingFeePlanApplicationValidator = v.object({
  _id: v.id("feePlanApplications"),
  schoolId: v.id("schools"),
  feePlanId: v.id("feePlans"),
  classId: v.id("classes"),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  studentCount: v.number(),
  createdInvoiceCount: v.number(),
  skippedInvoiceCount: v.number(),
  notes: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.id("users"),
});

export const billingInvoiceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("issued"),
  v.literal("partially_paid"),
  v.literal("paid"),
  v.literal("overdue"),
  v.literal("waived"),
  v.literal("cancelled")
);

export const billingInvoiceValidator = v.object({
  paymentInstructions: v.union(paymentInstructionsValidator, v.null()),
  _id: v.id("studentInvoices"),
  schoolId: v.id("schools"),
  feePlanId: v.union(v.id("feePlans"), v.null()),
  selectableCollectionId: v.union(v.id("selectableBillingCollections"), v.null()),
  feePlanApplicationId: v.union(v.id("feePlanApplications"), v.null()),
  selectionRevision: v.union(v.number(), v.null()),
  studentId: v.id("students"),
  classId: v.id("classes"),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  invoiceNumber: v.string(),
  feePlanNameSnapshot: v.string(),
  currency: v.string(),
  lineItems: v.array(billingLineItemValidator),
  installmentSchedule: v.array(billingInstallmentScheduleValidator),
  subtotal: v.number(),
  waiverAmount: v.number(),
  discountAmount: v.number(),
  totalAmount: v.number(),
  amountPaid: v.number(),
  balanceDue: v.number(),
  status: billingInvoiceStatusValidator,
  dueDate: v.number(),
  issuedAt: v.number(),
  issuedBy: v.id("users"),
  notes: v.union(v.string(), v.null()),
  lastPaymentId: v.union(v.id("billingPayments"), v.null()),
  lastPaymentAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const billingPaymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("bank_transfer"),
  v.literal("cheque"),
  v.literal("mobile_money"),
  v.literal("card"),
  v.literal("online")
);

export const billingPaymentProviderValidator = v.union(
  v.literal("paystack"),
  v.literal("flutterwave"),
  v.literal("stripe"),
  v.literal("manual")
);

export const billingPaymentProviderModeValidator = v.union(
  v.literal("test"),
  v.literal("live")
);

export const billingPaymentProviderStatusValidator = v.union(
  v.literal("not_configured"),
  v.literal("invalid"),
  v.literal("ready"),
  v.literal("disabled"),
  v.literal("rotation_pending")
);

export const billingPaymentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("successful"),
  v.literal("failed"),
  v.literal("reconciled"),
  v.literal("reversed")
);

export const billingPaymentApplicationStatusValidator = v.union(
  v.literal("applied"),
  v.literal("partial"),
  v.literal("unapplied")
);

export const billingReconciliationStatusValidator = v.union(
  v.literal("unreconciled"),
  v.literal("reconciled"),
  v.literal("flagged")
);

export const billingPaymentValidator = v.object({
  _id: v.id("billingPayments"),
  schoolId: v.id("schools"),
  invoiceId: v.id("studentInvoices"),
  reference: v.string(),
  gatewayReference: v.union(v.string(), v.null()),
  provider: v.union(billingPaymentProviderValidator, v.null()),
  providerMode: v.union(billingPaymentProviderModeValidator, v.null()),
  paymentMethod: billingPaymentMethodValidator,
  amountReceived: v.number(),  amountApplied: v.number(),
  unappliedAmount: v.number(),
  applicationStatus: billingPaymentApplicationStatusValidator,
  status: billingPaymentStatusValidator,
  payerName: v.union(v.string(), v.null()),
  payerEmail: v.union(v.string(), v.null()),
  receivedAt: v.number(),
  recordedBy: v.union(v.id("users"), v.null()),
  reconciliationStatus: billingReconciliationStatusValidator,
  reconciledBy: v.union(v.id("users"), v.null()),
  reconciledAt: v.union(v.number(), v.null()),
  notes: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const billingPaymentAttemptStatusValidator = v.union(
  v.literal("link_generated"),
  v.literal("awaiting_payer_return"),
  v.literal("verified"),
  v.literal("webhook_reconciled"),
  v.literal("manual_attention_needed")
);

export const billingPaymentAttemptReconciliationSourceValidator = v.union(
  v.literal("return_page"),
  v.literal("webhook"),
  v.literal("admin_poll"),
  v.null()
);

export const billingPaymentAttemptValidator = v.object({
  _id: v.id("billingPaymentAttempts"),
  schoolId: v.id("schools"),
  invoiceId: v.id("studentInvoices"),
  provider: billingPaymentProviderValidator,
  reference: v.string(),
  gatewayReference: v.union(v.string(), v.null()),
  providerMode: v.union(billingPaymentProviderModeValidator, v.null()),
  authorizationUrl: v.union(v.string(), v.null()),
  accessCode: v.union(v.string(), v.null()),
  amount: v.number(),
  currency: v.string(),
  status: billingPaymentAttemptStatusValidator,
  reconciliationSource: billingPaymentAttemptReconciliationSourceValidator,
  checkoutPayload: v.any(),
  callbackUrl: v.union(v.string(), v.null()),
  paymentId: v.union(v.id("billingPayments"), v.null()),
  gatewayEventId: v.union(v.id("paymentGatewayEvents"), v.null()),
  lastCheckedAt: v.union(v.number(), v.null()),
  resolvedAt: v.union(v.number(), v.null()),
  resolutionMessage: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const billingSettingsValidator = v.union(
  v.null(),
  v.object({
    _id: v.id("schoolBillingSettings"),
    schoolId: v.id("schools"),
    invoicePrefix: v.string(),
    defaultCurrency: v.string(),
    defaultDueDays: v.number(),
    preferredProvider: billingPaymentProviderValidator,
    paymentProviderMode: billingPaymentProviderModeValidator,
    allowManualPayments: v.boolean(),
    allowOnlinePayments: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.union(v.id("users"), v.null()),
  })
);

export const billingGatewayEventValidator = v.object({
  _id: v.id("paymentGatewayEvents"),
  schoolId: v.id("schools"),
  provider: billingPaymentProviderValidator,
  providerMode: v.union(billingPaymentProviderModeValidator, v.null()),
  eventId: v.string(),
  eventType: v.string(),
  reference: v.string(),
  invoiceNumber: v.union(v.string(), v.null()),
  invoiceId: v.union(v.id("studentInvoices"), v.null()),
  paymentId: v.union(v.id("billingPayments"), v.null()),
  signatureValid: v.boolean(),
  verificationStatus: v.union(
    v.literal("verified"),
    v.literal("rejected"),
    v.literal("ignored")
  ),
  processedAt: v.union(v.number(), v.null()),
  verificationMessage: v.union(v.string(), v.null()),
  receivedAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const billingPaystackProviderModeStateValidator = v.object({
  provider: v.literal("paystack"),
  mode: billingPaymentProviderModeValidator,
  isEnabled: v.boolean(),
  status: billingPaymentProviderStatusValidator,
  publicKeyMasked: v.union(v.string(), v.null()),
  activeSecretMasked: v.union(v.string(), v.null()),
  pendingSecretMasked: v.union(v.string(), v.null()),
  publicKeyFingerprint: v.union(v.string(), v.null()),
  activeSecretFingerprint: v.union(v.string(), v.null()),
  pendingSecretFingerprint: v.union(v.string(), v.null()),
  lastValidatedAt: v.union(v.number(), v.null()),
  lastValidationMessage: v.union(v.string(), v.null()),
  hasActiveSecret: v.boolean(),
  hasPendingSecret: v.boolean(),
  readyForPayments: v.boolean(),
  readyForWebhookVerification: v.boolean(),
});

export const billingPaystackProviderOverviewValidator = v.object({
  provider: v.literal("paystack"),
  activeMode: billingPaymentProviderModeValidator,
  allowOnlinePayments: v.boolean(),
  readyForPayments: v.boolean(),
  modes: v.object({
    test: billingPaystackProviderModeStateValidator,
    live: billingPaystackProviderModeStateValidator,
  }),
});

export function normalizeBillingText(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    const trimmed = String(value).trim();
    return trimmed || undefined;
  }

  return undefined;
}

export function normalizeCurrencyCode(value: string | null | undefined, fallback = "NGN") {
  const normalized = normalizeBillingText(value);
  if (!normalized) {
    return fallback;
  }

  return normalized.toUpperCase();
}

export function normalizeBillingAmount(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Amount must be a finite number");
  }

  return Math.round(value * 100) / 100;
}

export function makeBillingLineItemId(prefix: string, order: number, label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "item";

  return `${prefix}-${String(order + 1).padStart(2, "0")}-${slug}`;
}

export function computeBillingSubtotal(
  lineItems: Array<{ amount: number; isOptional?: boolean; isSelected?: boolean }>
) {
  return normalizeBillingAmount(
    lineItems
      .filter((item) => !item.isOptional || item.isSelected !== false)
      .reduce((sum, item) => sum + item.amount, 0)
  );
}

export function computeBillingInvoiceTotal(args: {
  lineItems: Array<{ amount: number; isOptional?: boolean; isSelected?: boolean }>;
  waiverAmount?: number;
  discountAmount?: number;
}) {
  const subtotal = computeBillingSubtotal(args.lineItems);
  const waiverAmount = normalizeBillingAmount(args.waiverAmount ?? 0);
  const discountAmount = normalizeBillingAmount(args.discountAmount ?? 0);
  const totalAmount = Math.max(
    0,
    normalizeBillingAmount(subtotal - waiverAmount - discountAmount)
  );

  return {
    subtotal,
    waiverAmount,
    discountAmount,
    totalAmount,
  };
}

export function deriveBillingInvoiceStatus(args: {
  totalAmount: number;
  amountPaid: number;
  dueDate: number;
  now?: number;
}) {
  const now = args.now ?? Date.now();
  if (args.totalAmount <= 0) {
    return "waived" as const;
  }

  if (args.amountPaid <= 0) {
    return args.dueDate < now ? ("overdue" as const) : ("issued" as const);
  }

  if (args.amountPaid < args.totalAmount) {
    return args.dueDate < now
      ? ("overdue" as const)
      : ("partially_paid" as const);
  }

  return "paid" as const;
}

export function buildBillingInstallmentSchedule(args: {
  totalAmount: number;
  policy: {
    enabled: boolean;
    installmentCount: number;
    intervalDays: number;
    firstDueDays: number;
  };
  issuedAt: number;
}) {
  const installmentCount = Math.max(1, Math.floor(args.policy.installmentCount));
  const normalizedCount =
    args.policy.enabled && installmentCount > 1 ? installmentCount : 1;
  const amountPerInstallment = normalizeBillingAmount(
    args.totalAmount / normalizedCount
  );
  const roundedAmounts = Array.from({ length: normalizedCount }, (_, index) => {
    if (index === normalizedCount - 1) {
      const priorTotal = amountPerInstallment * (normalizedCount - 1);
      return normalizeBillingAmount(args.totalAmount - priorTotal);
    }

    return amountPerInstallment;
  });

  const intervalDays = Math.max(1, Math.floor(args.policy.intervalDays || 30));
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const firstDueDays = Math.max(0, Math.floor(args.policy.firstDueDays || 14));
  const firstDueAt = args.issuedAt + firstDueDays * 24 * 60 * 60 * 1000;

  return roundedAmounts.map((amount, index) => ({
    id: `inst-${index + 1}`,
    label: `Installment ${index + 1}`,
    dueAt: firstDueAt + index * intervalMs,
    amount,
    isPaid: false,
  }));
}

export function buildBillingInstallmentPolicy(input?: {
  enabled?: boolean;
  installmentCount?: number;
  intervalDays?: number;
  firstDueDays?: number;
}) {
  return {
    enabled: input?.enabled ?? false,
    installmentCount: Math.max(1, Math.floor(input?.installmentCount ?? 1)),
    intervalDays: Math.max(0, Math.floor(input?.intervalDays ?? 0)),
    firstDueDays: Math.max(0, Math.floor(input?.firstDueDays ?? 0)),
  };
}

export function generateBillingInvoiceNumber(args: {
  prefix: string;
  invoiceId: string;
}) {
  const invoiceSuffix = String(args.invoiceId).replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${args.prefix}-${timestamp}-${invoiceSuffix}`;
}

export function normalizeBillingReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Reference is required");
  }

  return trimmed;
}

export function normalizeBillingLineItems(input: Array<{
  label: string;
  amount: number;
  category?: string;
  isOptional?: boolean;
}>, prefix: string, optionalSelectionMode: "legacy_included" | "parent_selectable" = "legacy_included") {
  return input.map((item, index) => ({
    id: makeBillingLineItemId(prefix, index, item.label),
    label: normalizeBillingText(item.label) ?? `Item ${index + 1}`,
    amount: normalizeBillingAmount(item.amount),
    category: (item.category as
      | "tuition"
      | "boarding"
      | "transport"
      | "exam"
      | "activity"
      | "other") ?? "other",
    order: index,
    isOptional: Boolean(item.isOptional),
    ...(optionalSelectionMode === "parent_selectable"
      ? { isSelected: !item.isOptional }
      : {}),
  }));
}

export type BillingErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "DUPLICATE_INVOICE"
  | "SELECTION_CONFLICT"
  | "SELECTION_LOCKED"
  | "ZERO_VALUE_INVOICE";

export function billingContractError(
  code: BillingErrorCode,
  message: string,
  details: Record<string, string | number> = {},
) {
  return new ConvexError({ code, message, ...details });
}

export function normalizeSelectableRequestKey(value: string) {
  const requestKey = value.trim();
  if (requestKey.length < 8 || requestKey.length > 128) {
    throw billingContractError(
      "VALIDATION_FAILED",
      "Request key must contain between 8 and 128 characters",
    );
  }
  return requestKey;
}

export const MAX_SELECTABLE_BILLING_COLLECTIONS = 100;
export const MAX_SELECTABLE_BILLING_ITEMS = 100;
export const MAX_SELECTABLE_BILLING_STUDENTS = 100;
export const MAX_SELECTABLE_BILLING_QUANTITY = 9999;
export const MAX_STUDENT_INVOICE_HISTORY = 200;

export function normalizeSelectableSelections<T extends string>(
  selections: Array<{ itemId: T; quantity: number }>,
) {
  if (selections.length === 0 || selections.length > MAX_SELECTABLE_BILLING_ITEMS) {
    throw billingContractError(
      "VALIDATION_FAILED",
      `Select between 1 and ${MAX_SELECTABLE_BILLING_ITEMS} items`,
    );
  }
  const normalized = selections
    .map((selection) => {
      if (
        !Number.isInteger(selection.quantity) ||
        selection.quantity < 1 ||
        selection.quantity > MAX_SELECTABLE_BILLING_QUANTITY
      ) {
        throw billingContractError(
          "VALIDATION_FAILED",
          `Quantity must be a whole number from 1 to ${MAX_SELECTABLE_BILLING_QUANTITY}`,
        );
      }
      return { itemId: selection.itemId, quantity: selection.quantity };
    })
    .sort((left, right) => String(left.itemId).localeCompare(String(right.itemId)));
  if (new Set(normalized.map((selection) => String(selection.itemId))).size !== normalized.length) {
    throw billingContractError("VALIDATION_FAILED", "Each item may be selected only once");
  }
  return normalized;
}

export function buildSelectableInvoiceFingerprint(args: {
  actorKind: "parent" | "admin";
  actorUserId: string;
  schoolId: string;
  studentId: string;
  collectionId: string;
  sessionId: string;
  termId: string;
  requestedDueDate: number | null;
  selections: Array<{ itemId: string; quantity: number }>;
}) {
  return JSON.stringify({
    ...args,
    selections: [...args.selections].sort((left, right) =>
      left.itemId.localeCompare(right.itemId),
    ),
  });
}

export function projectBillingLineItem(item: {
  id: string;
  label: string;
  amount: number;
  category: string;
  order: number;
  isOptional?: boolean;
  isSelected?: boolean;
  unitAmount?: number;
  quantity?: number;
}) {
  return {
    id: item.id,
    label: item.label,
    amount: item.amount,
    category: item.category,
    order: item.order,
    isOptional: item.isOptional === true,
    isSelected: item.isOptional ? item.isSelected !== false : true,
    unitAmount: item.unitAmount ?? item.amount,
    quantity: item.quantity ?? 1,
  };
}

export function invoiceHasOptionalSelectionRows(invoice: {
  feePlanId?: unknown;
  lineItems: Array<{ isOptional?: boolean }>;
}) {
  return Boolean(invoice.feePlanId) &&
    invoice.lineItems.some((item) => item.isOptional === true) &&
    invoice.lineItems.some((item) => item.isOptional !== true);
}

export function redistributeBillingInstallments(
  schedule: Array<{ id: string; label: string; dueAt: number; amount: number; isPaid: boolean }>,
  totalAmount: number,
  dueDate: number,
) {
  const rows = schedule.length > 0
    ? schedule
    : [{ id: "inst-1", label: "Installment 1", dueAt: dueDate, amount: totalAmount, isPaid: false }];
  const amountPerRow = normalizeBillingAmount(totalAmount / rows.length);
  return rows.map((row, index) => ({
    ...row,
    amount: index === rows.length - 1
      ? normalizeBillingAmount(totalAmount - amountPerRow * (rows.length - 1))
      : amountPerRow,
  }));
}

export function summarizeBillingCollections(args: {
  invoices: Array<{ totalAmount: number; amountPaid: number; balanceDue: number; status: string }>;
  payments: Array<{ amountReceived: number; amountApplied: number; reconciliationStatus: string; status: string; paymentMethod: string; provider?: string | null }>;
}) {
  const totalInvoiceAmount = args.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const amountCollected = args.payments
    .filter((payment) => payment.status === "successful" || payment.status === "reconciled")
    .reduce((sum, payment) => sum + payment.amountApplied, 0);
  const outstandingBalance = args.invoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
  const overdueInvoices = args.invoices.filter((invoice) => invoice.status === "overdue").length;
  const paidInvoices = args.invoices.filter((invoice) => invoice.status === "paid").length;
  const unreconciledPayments = args.payments.filter(
    (payment) => payment.reconciliationStatus !== "reconciled"
  ).length;
  const manualPayments = args.payments.filter((payment) => payment.provider === "manual").length;
  const gatewayPayments = args.payments.filter((payment) => payment.provider && payment.provider !== "manual").length;

  return {
    totalInvoiceAmount,
    amountCollected,
    outstandingBalance,
    overdueInvoices,
    paidInvoices,
    unreconciledPayments,
    manualPayments,
    gatewayPayments,
    invoiceCount: args.invoices.length,
    paymentCount: args.payments.length,
  };
}
