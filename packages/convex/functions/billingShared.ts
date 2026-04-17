import { v } from "convex/values";

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
  _id: v.id("feePlans"),
  schoolId: v.id("schools"),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  currency: v.string(),
  billingMode: billingFeePlanBillingModeValidator,
  targetClassIds: v.array(v.id("classes")),
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
  _id: v.id("studentInvoices"),
  schoolId: v.id("schools"),
  feePlanId: v.id("feePlans"),
  feePlanApplicationId: v.union(v.id("feePlanApplications"), v.null()),
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
  paymentMethod: billingPaymentMethodValidator,
  amountReceived: v.number(),
  amountApplied: v.number(),
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
  rawBody: v.string(),
  payload: v.any(),
  processedAt: v.union(v.number(), v.null()),
  verificationMessage: v.union(v.string(), v.null()),
  receivedAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
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
  lineItems: Array<{ amount: number }>
) {
  return normalizeBillingAmount(
    lineItems.reduce((sum, item) => sum + item.amount, 0)
  );
}

export function computeBillingInvoiceTotal(args: {
  lineItems: Array<{ amount: number }>;
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

  return roundedAmounts.map((amount, index) => ({
    id: `inst-${String(index + 1).padStart(2, "0")}`,
    label:
      normalizedCount === 1
        ? "Full payment"
        : `Installment ${index + 1}`,
    dueAt:
      args.issuedAt +
      (index === 0
        ? Math.max(0, args.policy.firstDueDays) * 24 * 60 * 60 * 1000
        : (Math.max(0, args.policy.firstDueDays) + index * Math.max(0, args.policy.intervalDays)) * 24 * 60 * 60 * 1000),
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
}>, prefix: string) {
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
