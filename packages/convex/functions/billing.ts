import { query, mutation, internalMutation, internalQuery, action } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { api, internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import { formatClassDisplayName } from "@school/shared/name-format";
import { getReadableUserName } from "./academic/studentNameCompat";
import { getAuthenticatedSchoolMembership } from "./academic/auth";
import {
  billingFeePlanApplicationValidator,
  billingFeePlanBillingModeValidator,
  billingFeePlanValidator,
  billingGatewayEventValidator,
  billingInvoiceStatusValidator,
  billingInvoiceValidator,
  billingPaymentMethodValidator,
  billingPaymentProviderValidator,
  billingPaymentStatusValidator,
  billingPaymentValidator,
  billingSettingsValidator,
  buildBillingInstallmentPolicy,
  buildBillingInstallmentSchedule,
  computeBillingInvoiceTotal,
  deriveBillingInvoiceStatus,
  generateBillingInvoiceNumber,
  normalizeBillingAmount,
  normalizeBillingLineItems,
  normalizeBillingReference,
  normalizeBillingText,
  normalizeCurrencyCode,
  summarizeBillingCollections,
} from "./billingShared";
import { createBillingGatewayAdapter } from "./billingGateway";

const billingSummaryValidator = v.object({
  totalInvoiceAmount: v.number(),
  amountCollected: v.number(),
  outstandingBalance: v.number(),
  overdueInvoices: v.number(),
  paidInvoices: v.number(),
  unreconciledPayments: v.number(),
  manualPayments: v.number(),
  gatewayPayments: v.number(),
  invoiceCount: v.number(),
  paymentCount: v.number(),
  feePlanCount: v.number(),
  feePlanApplicationCount: v.number(),
  gatewayEventCount: v.number(),
});

const billingInvoiceRowValidator = v.object({
  invoice: billingInvoiceValidator,
  studentName: v.string(),
  className: v.string(),
  sessionName: v.string(),
  termName: v.string(),
});

const billingPaymentRowValidator = v.object({
  payment: billingPaymentValidator,
  invoiceNumber: v.string(),
  studentName: v.string(),
  className: v.string(),
  sessionName: v.string(),
  termName: v.string(),
});

const billingFeePlanApplicationRowValidator = v.object({
  application: billingFeePlanApplicationValidator,
  feePlanName: v.string(),
  className: v.string(),
  sessionName: v.string(),
  termName: v.string(),
});

const billingDashboardValidator = v.object({
  school: v.object({
    id: v.id("schools"),
    name: v.string(),
    slug: v.string(),
  }),
  settings: billingSettingsValidator,
  summary: billingSummaryValidator,
  feePlans: v.array(billingFeePlanValidator),
  applications: v.array(billingFeePlanApplicationRowValidator),
  invoices: v.array(billingInvoiceRowValidator),
  payments: v.array(billingPaymentRowValidator),
  gatewayEvents: v.array(billingGatewayEventValidator),
});

const billingSettingsUpdateValidator = v.object({
  invoicePrefix: v.string(),
  defaultCurrency: v.string(),
  defaultDueDays: v.number(),
  allowManualPayments: v.boolean(),
  allowOnlinePayments: v.boolean(),
});

const createFeePlanValidator = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  currency: v.optional(v.string()),
  billingMode: v.optional(billingFeePlanBillingModeValidator),
  targetClassIds: v.optional(v.array(v.id("classes"))),
  lineItems: v.array(
    v.object({
      label: v.string(),
      amount: v.number(),
      category: v.optional(
        v.union(
          v.literal("tuition"),
          v.literal("boarding"),
          v.literal("transport"),
          v.literal("exam"),
          v.literal("activity"),
          v.literal("other")
        )
      ),
    })
  ),
  installmentPolicy: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      installmentCount: v.optional(v.number()),
      intervalDays: v.optional(v.number()),
      firstDueDays: v.optional(v.number()),
    })
  ),
});

const applyFeePlanValidator = v.object({
  feePlanId: v.id("feePlans"),
  classId: v.id("classes"),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  notes: v.optional(v.string()),
});

const applyFeePlanResultValidator = v.object({
  application: billingFeePlanApplicationValidator,
  createdCount: v.number(),
  skippedCount: v.number(),
});

const createInvoiceValidator = v.object({
  feePlanId: v.id("feePlans"),
  studentId: v.id("students"),
  classId: v.id("classes"),
  sessionId: v.id("academicSessions"),
  termId: v.id("academicTerms"),
  waiverAmount: v.optional(v.number()),
  discountAmount: v.optional(v.number()),
  dueDate: v.optional(v.number()),
  notes: v.optional(v.string()),
});

const manualPaymentValidator = v.object({
  invoiceId: v.id("studentInvoices"),
  reference: v.string(),
  amountReceived: v.number(),
  paymentMethod: billingPaymentMethodValidator,
  receivedAt: v.optional(v.number()),
  payerName: v.optional(v.string()),
  payerEmail: v.optional(v.string()),
  notes: v.optional(v.string()),
});

const gatewayEventInputValidator = v.object({
  schoolId: v.id("schools"),
  provider: billingPaymentProviderValidator,
  eventId: v.string(),
  eventType: v.string(),
  reference: v.string(),
  invoiceNumber: v.optional(v.string()),
  invoiceId: v.optional(v.id("studentInvoices")),
  gatewayReference: v.optional(v.string()),
  amountReceived: v.optional(v.number()),
  payerName: v.optional(v.string()),
  payerEmail: v.optional(v.string()),
  rawBody: v.string(),
  payload: v.any(),
  signatureValid: v.boolean(),
  verificationMessage: v.optional(v.string()),
  receivedAt: v.optional(v.number()),
});

function assertAdmin(user: { isSchoolAdmin: boolean }) {
  if (!user.isSchoolAdmin) {
    throw new ConvexError("Admin access required");
  }
}

function getInvoiceDisplayName(invoiceNumber: string) {
  return invoiceNumber.trim() || "Unnumbered invoice";
}

function getSchoolPrefix(school: { name: string; slug: string }, settings: { invoicePrefix: string } | null) {
  return normalizeBillingText(settings?.invoicePrefix) ?? school.slug.trim().toUpperCase();
}

function buildSchoolDisplayName(student: { name?: string | null; firstName?: string | null; lastName?: string | null }) {
  const displayName = getReadableUserName(student as any).displayName;
  return displayName || student.name || "Unnamed student";
}

function invoiceDocToReturn(invoice: any) {
  return {
    _id: invoice._id,
    schoolId: invoice.schoolId,
    feePlanId: invoice.feePlanId,
    feePlanApplicationId: invoice.feePlanApplicationId ?? null,
    studentId: invoice.studentId,
    classId: invoice.classId,
    sessionId: invoice.sessionId,
    termId: invoice.termId,
    invoiceNumber: invoice.invoiceNumber,
    feePlanNameSnapshot: invoice.feePlanNameSnapshot,
    currency: invoice.currency,
    lineItems: invoice.lineItems,
    installmentSchedule: invoice.installmentSchedule,
    subtotal: invoice.subtotal,
    waiverAmount: invoice.waiverAmount,
    discountAmount: invoice.discountAmount,
    totalAmount: invoice.totalAmount,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    status: invoice.status,
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    issuedBy: invoice.issuedBy,
    notes: invoice.notes ?? null,
    lastPaymentId: invoice.lastPaymentId ?? null,
    lastPaymentAt: invoice.lastPaymentAt ?? null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

function paymentDocToReturn(payment: any) {
  return {
    _id: payment._id,
    schoolId: payment.schoolId,
    invoiceId: payment.invoiceId,
    reference: payment.reference,
    gatewayReference: payment.gatewayReference ?? null,
    provider: payment.provider ?? null,
    paymentMethod: payment.paymentMethod,
    amountReceived: payment.amountReceived,
    amountApplied: payment.amountApplied,
    unappliedAmount: payment.unappliedAmount,
    applicationStatus: payment.applicationStatus,
    status: payment.status,
    payerName: payment.payerName ?? null,
    payerEmail: payment.payerEmail ?? null,
    receivedAt: payment.receivedAt,
    recordedBy: payment.recordedBy ?? null,
    reconciliationStatus: payment.reconciliationStatus,
    reconciledBy: payment.reconciledBy ?? null,
    reconciledAt: payment.reconciledAt ?? null,
    notes: payment.notes ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function feePlanDocToReturn(feePlan: any) {
  return {
    _id: feePlan._id,
    schoolId: feePlan.schoolId,
    name: feePlan.name,
    description: feePlan.description ?? null,
    currency: feePlan.currency,
    billingMode: feePlan.billingMode ?? "class_default",
    targetClassIds: feePlan.targetClassIds ?? [],
    lineItems: feePlan.lineItems,
    installmentPolicy: feePlan.installmentPolicy,
    isActive: feePlan.isActive,
    createdAt: feePlan.createdAt,
    updatedAt: feePlan.updatedAt,
    createdBy: feePlan.createdBy,
    updatedBy: feePlan.updatedBy,
  };
}

function feePlanApplicationDocToReturn(application: any) {
  return {
    _id: application._id,
    schoolId: application.schoolId,
    feePlanId: application.feePlanId,
    classId: application.classId,
    sessionId: application.sessionId,
    termId: application.termId,
    studentCount: application.studentCount,
    createdInvoiceCount: application.createdInvoiceCount,
    skippedInvoiceCount: application.skippedInvoiceCount,
    notes: application.notes ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    createdBy: application.createdBy,
  };
}

function normalizeClassIdList(classIds?: Array<Id<"classes">>) {
  return [...new Set((classIds ?? []).map((classId) => String(classId)))] as Array<Id<"classes">>;
}

function feePlanBillingMode(feePlan: any) {
  return (feePlan.billingMode ?? "class_default") as "class_default" | "manual_extra";
}

function feePlanTargetClassIds(feePlan: any) {
  return normalizeClassIdList(feePlan.targetClassIds ?? []);
}

async function createInvoiceFromFeePlanRecord(args: {
  ctx: any;
  school: { _id: Id<"schools">; name: string; slug: string };
  settingsRecord: any;
  feePlan: any;
  student: any;
  classDoc: any;
  session: any;
  term: any;
  issuedAt?: number;
  waiverAmount?: number;
  discountAmount?: number;
  dueDate?: number;
  notes?: string | null;
  applicationId?: Id<"feePlanApplications">;
  issuedBy: Id<"users">;
}) {
  const issuedAt = args.issuedAt ?? Date.now();
  const total = computeBillingInvoiceTotal({
    lineItems: args.feePlan.lineItems,
    waiverAmount: args.waiverAmount,
    discountAmount: args.discountAmount,
  });
  const dueDate =
    args.dueDate ??
    issuedAt +
      Math.max(
        1,
        args.settingsRecord?.defaultDueDays ?? args.feePlan.installmentPolicy.firstDueDays ?? 14
      ) *
        24 *
        60 *
        60 *
        1000;
  const installmentSchedule = buildBillingInstallmentSchedule({
    totalAmount: total.totalAmount,
    policy: args.feePlan.installmentPolicy,
    issuedAt,
  });

  const normalizedNotes = normalizeBillingText(args.notes);
  const invoiceId = await args.ctx.db.insert("studentInvoices", {
    schoolId: args.school._id,
    feePlanId: args.feePlan._id,
    ...(args.applicationId ? { feePlanApplicationId: args.applicationId } : {}),
    studentId: args.student._id,
    classId: args.classDoc._id,
    sessionId: args.session._id,
    termId: args.term._id,
    invoiceNumber: "",
    feePlanNameSnapshot: args.feePlan.name,
    currency: args.feePlan.currency,
    lineItems: args.feePlan.lineItems,
    installmentSchedule,
    subtotal: total.subtotal,
    waiverAmount: total.waiverAmount,
    discountAmount: total.discountAmount,
    totalAmount: total.totalAmount,
    amountPaid: 0,
    balanceDue: total.totalAmount,
    status: deriveBillingInvoiceStatus({
      totalAmount: total.totalAmount,
      amountPaid: 0,
      dueDate,
      now: issuedAt,
    }),
    dueDate,
    issuedAt,
    issuedBy: args.issuedBy,
    ...(normalizedNotes ? { notes: normalizedNotes } : {}),
    createdAt: issuedAt,
    updatedAt: issuedAt,
  });

  const invoiceNumber = generateBillingInvoiceNumber({
    prefix: getSchoolPrefix(args.school, args.settingsRecord),
    invoiceId: String(invoiceId),
  });

  await args.ctx.db.patch(invoiceId, {
    invoiceNumber,
    updatedAt: Date.now(),
  });

  return await args.ctx.db.get(invoiceId);
}

function billingSettingsDocToReturn(settings: any) {
  return {
    _id: settings._id,
    schoolId: settings.schoolId,
    invoicePrefix: settings.invoicePrefix,
    defaultCurrency: settings.defaultCurrency,
    defaultDueDays: settings.defaultDueDays,
    preferredProvider: settings.preferredProvider,
    allowManualPayments: settings.allowManualPayments,
    allowOnlinePayments: settings.allowOnlinePayments,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy ?? null,
  };
}

function gatewayEventDocToReturn(event: any) {
  return {
    _id: event._id,
    schoolId: event.schoolId,
    provider: event.provider,
    eventId: event.eventId,
    eventType: event.eventType,
    reference: event.reference,
    invoiceNumber: event.invoiceNumber ?? null,
    invoiceId: event.invoiceId ?? null,
    paymentId: event.paymentId ?? null,
    signatureValid: event.signatureValid,
    verificationStatus: event.verificationStatus,
    rawBody: event.rawBody,
    payload: event.payload,
    processedAt: event.processedAt ?? null,
    verificationMessage: event.verificationMessage ?? null,
    receivedAt: event.receivedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function parsePaystackMetadata(rawMetadata: unknown) {
  if (!rawMetadata) {
    return {} as Record<string, unknown>;
  }

  if (typeof rawMetadata === "string") {
    try {
      const parsed = JSON.parse(rawMetadata) as unknown;
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {} as Record<string, unknown>;
    }

    return {} as Record<string, unknown>;
  }

  if (typeof rawMetadata === "object") {
    return rawMetadata as Record<string, unknown>;
  }

  return {} as Record<string, unknown>;
}

function extractPaystackVerificationMetadata(payload: any) {
  const data = payload?.data ?? {};
  const metadata = parsePaystackMetadata(data?.metadata ?? payload?.metadata ?? {});

  return {
    schoolId: normalizeBillingText(metadata.schoolId ?? payload?.schoolId),
    invoiceId: normalizeBillingText(metadata.invoiceId),
    invoiceNumber: normalizeBillingText(metadata.invoiceNumber),
    gatewayReference: normalizeBillingText(
      data.reference ?? data.gateway_reference ?? payload?.reference
    ),
    amountReceived:
      typeof data.amount === "number"
        ? data.amount / 100
        : typeof payload?.amount === "number"
          ? payload.amount
          : undefined,
    payerEmail: normalizeBillingText(
      data?.customer?.email ?? data?.authorization?.customer_email ?? metadata.email
    ),
    payerName: normalizeBillingText(
      data?.customer?.name ?? metadata.payerName ?? data?.customer?.first_name
    ),
  };
}

function buildPaystackEventId(payload: any, fallbackReference: string) {
  const data = payload?.data ?? {};
  const eventMarker = normalizeBillingText(data.id ?? payload?.event_id) ?? fallbackReference;
  return `paystack:${eventMarker}`;
}

async function verifyPaystackReferenceAndReconcile(
  ctx: any,
  reference: string,
  options?: { expectedSchoolId?: Id<"schools"> | null }
): Promise<{
  event: any;
  invoice: any;
  payment: any;
}> {
  const gateway = createBillingGatewayAdapter("paystack");
  const verification = await gateway.verifyPayment(reference);
  const payload = verification.raw as any;
  const metadata = extractPaystackVerificationMetadata(payload);
  const invoiceResolution: any = await ctx.runQuery(
    (internal as any).functions.billing.resolveBillingInvoiceForWebhookInternal,
    {
      invoiceId: metadata.invoiceId ?? undefined,
      invoiceNumber: metadata.invoiceNumber ?? undefined,
    }
  );

  const schoolId: Id<"schools"> | null =
    (metadata.schoolId as Id<"schools"> | undefined) ??
    invoiceResolution?.schoolId ??
    null;
  if (!schoolId) {
    throw new ConvexError("Verified Paystack payment did not include a resolvable school reference");
  }

  if (options?.expectedSchoolId && String(options.expectedSchoolId) !== String(schoolId)) {
    throw new ConvexError("Cross-school access denied");
  }

  if (
    invoiceResolution &&
    metadata.schoolId &&
    String(invoiceResolution.schoolId) !== String(metadata.schoolId)
  ) {
    throw new ConvexError("Verified invoice reference does not belong to the supplied schoolId");
  }

  const data = payload?.data ?? {};
  const eventType =
    verification.status === "success"
      ? "charge.success"
      : `payment.${normalizeBillingText(data.status) ?? "unknown"}`;

  return await ctx.runMutation(
    (internal as any).functions.billing.recordVerifiedGatewayEventInternal,
    {
      schoolId,
      provider: "paystack",
      eventId: buildPaystackEventId(payload, verification.reference),
      eventType,
      reference: metadata.gatewayReference ?? verification.reference,
      invoiceId: invoiceResolution?.invoiceId ?? undefined,
      invoiceNumber: invoiceResolution?.invoiceNumber ?? metadata.invoiceNumber ?? undefined,
      gatewayReference: metadata.gatewayReference ?? verification.reference,
      amountReceived: metadata.amountReceived ?? verification.amount,
      payerName: metadata.payerName,
      payerEmail: metadata.payerEmail,
      rawBody: JSON.stringify(payload),
      payload,
      signatureValid: true,
      verificationMessage: "Paystack verify endpoint confirmed payment",
      receivedAt: Date.now(),
    }
  );
}

export const resolveBillingInvoiceForWebhookInternal = internalQuery({
  args: {
    invoiceId: v.optional(v.id("studentInvoices")),
    invoiceNumber: v.optional(v.string()),
  },
  returns: v.union(
    v.null(),
    v.object({
      schoolId: v.id("schools"),
      invoiceId: v.id("studentInvoices"),
      invoiceNumber: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    if (args.invoiceId) {
      const invoice = await ctx.db.get(args.invoiceId);
      if (!invoice) {
        return null;
      }

      return {
        schoolId: invoice.schoolId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
      };
    }

    if (args.invoiceNumber) {
      const invoices = await ctx.db.query("studentInvoices").collect();
      const invoice = invoices.find(
        (entry: any) => entry.invoiceNumber === args.invoiceNumber
      );
      if (!invoice) {
        return null;
      }

      return {
        schoolId: invoice.schoolId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
      };
    }

    return null;
  },
});

export const resolveBillingInvoiceForPaymentLinkInternal = internalQuery({
  args: {
    invoiceId: v.id("studentInvoices"),
  },
  returns: v.union(
    v.null(),
    v.object({
      schoolId: v.id("schools"),
      schoolName: v.string(),
      schoolSlug: v.string(),
      settings: billingSettingsValidator,
      invoice: billingInvoiceValidator,
    })
  ),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      return null;
    }

    const school = await ctx.db.get(invoice.schoolId);
    if (!school) {
      return null;
    }

    const settingsRecord = await ctx.db
      .query("schoolBillingSettings")
      .withIndex("by_school", (q: any) => q.eq("schoolId", invoice.schoolId))
      .unique();

    return {
      schoolId: school._id,
      schoolName: school.name,
      schoolSlug: school.slug,
      settings: settingsRecord ? billingSettingsDocToReturn(settingsRecord) : null,
      invoice: invoiceDocToReturn(invoice),
    };
  },
});

async function loadBillingLookups(ctx: any, schoolId: Id<"schools">) {
  const [students, users, classes, sessions, terms, feePlans] = await Promise.all([
    ctx.db.query("students").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect(),
    ctx.db.query("users").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect(),
    ctx.db.query("classes").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect(),
    ctx.db.query("academicSessions").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect(),
    ctx.db.query("academicTerms").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect(),
    ctx.db.query("feePlans").withIndex("by_school", (q: any) => q.eq("schoolId", schoolId)).collect(),
  ]);

  const studentUserByStudentId = new Map<string, string>();
  for (const student of students) {
    const studentUser = users.find((user: any) => String(user._id) === String(student.userId));
    if (studentUser) {
      studentUserByStudentId.set(String(student._id), buildSchoolDisplayName(studentUser));
    }
  }

  const classNameById = new Map<string, string>();
  for (const classDoc of classes) {
    classNameById.set(
      String(classDoc._id),
      formatClassDisplayName({
        gradeName: classDoc.gradeName,
        classLabel: classDoc.classLabel,
        name: classDoc.name,
      })
    );
  }

  const sessionNameById = new Map<string, string>();
  for (const session of sessions) {
    sessionNameById.set(String(session._id), session.name);
  }

  const termNameById = new Map<string, string>();
  for (const term of terms) {
    termNameById.set(String(term._id), term.name);
  }

  const feePlanById = new Map<string, any>();
  for (const feePlan of feePlans) {
    feePlanById.set(String(feePlan._id), feePlan);
  }

  return {
    students,
    users,
    classes,
    sessions,
    terms,
    feePlans,
    studentUserByStudentId,
    classNameById,
    sessionNameById,
    termNameById,
    feePlanById,
  };
}

async function loadInvoiceById(ctx: any, invoiceId: Id<"studentInvoices">) {
  return await ctx.db.get(invoiceId);
}

async function loadPaymentByReference(
  ctx: any,
  schoolId: Id<"schools">,
  reference: string
) {
  const existingPayments = await ctx.db
    .query("billingPayments")
    .withIndex("by_reference", (q: any) => q.eq("reference", reference))
    .collect();

  return existingPayments.find((payment: any) => String(payment.schoolId) === String(schoolId)) ?? null;
}

function applyInvoiceLedgerUpdate(args: {
  invoice: any;
  amountApplied: number;
  paymentId: Id<"billingPayments">;
  receivedAt: number;
}) {
  const amountPaid = normalizeBillingAmount(args.invoice.amountPaid + args.amountApplied);
  const balanceDue = normalizeBillingAmount(Math.max(0, args.invoice.totalAmount - amountPaid));
  const status = deriveBillingInvoiceStatus({
    totalAmount: args.invoice.totalAmount,
    amountPaid,
    dueDate: args.invoice.dueDate,
    now: args.receivedAt,
  });

  return {
    amountPaid,
    balanceDue,
    status,
  };
}

async function createPaymentAndAllocation(args: {
  ctx: any;
  schoolId: Id<"schools">;
  invoice: any;
  reference: string;
  gatewayReference?: string | null;
  provider?: "paystack" | "flutterwave" | "stripe" | "manual" | null;
  paymentMethod: "cash" | "bank_transfer" | "cheque" | "mobile_money" | "card" | "online";
  amountReceived: number;
  receivedAt: number;
  payerName?: string | null;
  payerEmail?: string | null;
  notes?: string | null;
  recordedBy?: Id<"users"> | null;
  reconciliationStatus?: "unreconciled" | "reconciled" | "flagged";
}) {
  const existingPayment = await loadPaymentByReference(args.ctx, args.schoolId, args.reference);
  if (existingPayment) {
    if (String(existingPayment.invoiceId) !== String(args.invoice._id)) {
      throw new ConvexError("This payment reference is already linked to another invoice");
    }

    return {
      invoice: args.invoice,
      payment: existingPayment,
      reused: true,
    };
  }

  const amountReceived = normalizeBillingAmount(args.amountReceived);
  if (amountReceived <= 0) {
    throw new ConvexError("Payment amount must be greater than zero");
  }

  const amountApplied = normalizeBillingAmount(
    Math.min(amountReceived, Math.max(0, args.invoice.balanceDue))
  );
  const unappliedAmount = normalizeBillingAmount(amountReceived - amountApplied);
  const applicationStatus =
    amountApplied <= 0
      ? "unapplied"
      : unappliedAmount > 0
        ? "partial"
        : "applied";

  const now = args.receivedAt;
  const paymentId = await args.ctx.db.insert("billingPayments", {
    schoolId: args.schoolId,
    invoiceId: args.invoice._id,
    reference: normalizeBillingReference(args.reference),
    gatewayReference: normalizeBillingText(args.gatewayReference),
    provider: args.provider ?? null,
    paymentMethod: args.paymentMethod,
    amountReceived,
    amountApplied,
    unappliedAmount,
    applicationStatus,
    status: "successful",
    payerName: normalizeBillingText(args.payerName),
    payerEmail: normalizeBillingText(args.payerEmail),
    receivedAt: now,
    recordedBy: args.recordedBy ?? null,
    reconciliationStatus: args.reconciliationStatus ?? "unreconciled",
    reconciledBy: null,
    notes: normalizeBillingText(args.notes),
    createdAt: now,
    updatedAt: now,
  });

  if (amountApplied > 0) {
    await args.ctx.db.insert("paymentAllocations", {
      schoolId: args.schoolId,
      invoiceId: args.invoice._id,
      paymentId,
      amountApplied,
      createdAt: now,
      createdBy: args.recordedBy ?? null,
    });

    const ledgerUpdate = applyInvoiceLedgerUpdate({
      invoice: args.invoice,
      amountApplied,
      paymentId,
      receivedAt: now,
    });

    await args.ctx.db.patch(args.invoice._id, {
      amountPaid: ledgerUpdate.amountPaid,
      balanceDue: ledgerUpdate.balanceDue,
      status: ledgerUpdate.status,
      lastPaymentId: paymentId,
      lastPaymentAt: now,
      updatedAt: now,
    });
  }

  const updatedInvoice = await args.ctx.db.get(args.invoice._id);
  if (!updatedInvoice) {
    throw new ConvexError("Invoice not found after payment allocation");
  }

  const updatedPayment = await args.ctx.db.get(paymentId);
  if (!updatedPayment) {
    throw new ConvexError("Payment not found after allocation");
  }

  return {
    invoice: updatedInvoice,
    payment: updatedPayment,
    reused: false,
  };
}

export const getBillingDashboard = query({
  args: {
    classId: v.optional(v.union(v.id("classes"), v.null())),
    sessionId: v.optional(v.union(v.id("academicSessions"), v.null())),
    termId: v.optional(v.union(v.id("academicTerms"), v.null())),
    status: v.optional(v.union(billingInvoiceStatusValidator, v.null())),
    search: v.optional(v.string()),
  },
  returns: billingDashboardValidator,
  handler: async (ctx, args) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const school = await ctx.db.get(viewer.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    const settingsRecord = await ctx.db
      .query("schoolBillingSettings")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .unique();

    const lookups = await loadBillingLookups(ctx, viewer.schoolId);
    const allInvoices = await ctx.db
      .query("studentInvoices")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .collect();
    const allPayments = await ctx.db
      .query("billingPayments")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .collect();
    const allEvents = await ctx.db
      .query("paymentGatewayEvents")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .collect();
    const allApplications = await ctx.db
      .query("feePlanApplications")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .collect();

    const filteredInvoices = allInvoices.filter((invoice: any) => {
      if (args.classId && String(invoice.classId) !== String(args.classId)) {
        return false;
      }
      if (args.sessionId && String(invoice.sessionId) !== String(args.sessionId)) {
        return false;
      }
      if (args.termId && String(invoice.termId) !== String(args.termId)) {
        return false;
      }
      if (args.status && invoice.status !== args.status) {
        return false;
      }
      if (args.search) {
        const normalizedSearch = args.search.trim().toLowerCase();
        const haystack = [
          invoice.invoiceNumber,
          invoice.feePlanNameSnapshot,
          lookups.studentUserByStudentId.get(String(invoice.studentId)) ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });

    const visibleInvoiceIds = new Set(filteredInvoices.map((invoice: any) => String(invoice._id)));
    const visiblePayments = allPayments.filter((payment: any) =>
      visibleInvoiceIds.has(String(payment.invoiceId))
    );
    const visibleEvents = allEvents.filter((event: any) => {
      if (!event.invoiceId) {
        return visibleInvoiceIds.has(String(event.invoiceId ?? ""));
      }
      return visibleInvoiceIds.has(String(event.invoiceId));
    });

    const invoiceRows = filteredInvoices.map((invoice: any) => ({
      invoice: invoiceDocToReturn(invoice),
      studentName: lookups.studentUserByStudentId.get(String(invoice.studentId)) ?? "Unknown student",
      className: lookups.classNameById.get(String(invoice.classId)) ?? "Unknown class",
      sessionName: lookups.sessionNameById.get(String(invoice.sessionId)) ?? "Unknown session",
      termName: lookups.termNameById.get(String(invoice.termId)) ?? "Unknown term",
    }));

    const paymentRows = visiblePayments.map((payment: any) => {
      const invoice = filteredInvoices.find((entry: any) => String(entry._id) === String(payment.invoiceId));
      return {
        payment: paymentDocToReturn(payment),
        invoiceNumber: invoice ? getInvoiceDisplayName(invoice.invoiceNumber) : "Unknown invoice",
        studentName: invoice
          ? lookups.studentUserByStudentId.get(String(invoice.studentId)) ?? "Unknown student"
          : "Unknown student",
        className: invoice
          ? lookups.classNameById.get(String(invoice.classId)) ?? "Unknown class"
          : "Unknown class",
        sessionName: invoice
          ? lookups.sessionNameById.get(String(invoice.sessionId)) ?? "Unknown session"
          : "Unknown session",
        termName: invoice
          ? lookups.termNameById.get(String(invoice.termId)) ?? "Unknown term"
          : "Unknown term",
      };
    });

    const applicationRows = [...allApplications]
      .sort((left: any, right: any) => right.createdAt - left.createdAt)
      .slice(0, 12)
      .map((application: any) => ({
        application: feePlanApplicationDocToReturn(application),
        feePlanName: lookups.feePlanById.get(String(application.feePlanId))?.name ?? "Unknown fee plan",
        className: lookups.classNameById.get(String(application.classId)) ?? "Unknown class",
        sessionName: lookups.sessionNameById.get(String(application.sessionId)) ?? "Unknown session",
        termName: lookups.termNameById.get(String(application.termId)) ?? "Unknown term",
      }));

    const summary = summarizeBillingCollections({
      invoices: filteredInvoices,
      payments: visiblePayments,
    });

    return {
      school: {
        id: school._id,
        name: school.name,
        slug: school.slug,
      },
      settings: settingsRecord ? billingSettingsDocToReturn(settingsRecord) : null,
      summary: {
        ...summary,
        feePlanCount: lookups.feePlans.length,
        feePlanApplicationCount: allApplications.length,
        gatewayEventCount: visibleEvents.length,
      },
      feePlans: lookups.feePlans.map(feePlanDocToReturn),
      applications: applicationRows,
      invoices: invoiceRows,
      payments: paymentRows,
      gatewayEvents: visibleEvents.slice(0, 12).map(gatewayEventDocToReturn),
    };
  },
});

export const upsertBillingSettings = mutation({
  args: billingSettingsUpdateValidator,
  returns: billingSettingsValidator,
  handler: async (ctx, args) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const school = await ctx.db.get(viewer.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    const normalizedPrefix = normalizeBillingText(args.invoicePrefix) ?? school.slug.trim().toUpperCase();
    const normalizedCurrency = normalizeCurrencyCode(args.defaultCurrency, "NGN");
    const normalizedDueDays = Math.max(1, Math.floor(args.defaultDueDays));
    const now = Date.now();
    const existingSettings = await ctx.db
      .query("schoolBillingSettings")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .unique();

    const nextSettings = {
      schoolId: viewer.schoolId,
      invoicePrefix: normalizedPrefix,
      defaultCurrency: normalizedCurrency,
      defaultDueDays: normalizedDueDays,
      preferredProvider: args.allowOnlinePayments ? "paystack" : "manual",
      allowManualPayments: args.allowManualPayments,
      allowOnlinePayments: args.allowOnlinePayments,
      updatedAt: now,
      updatedBy: viewer.userId,
    } as const;

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, nextSettings);
      const updatedSettings = await ctx.db.get(existingSettings._id);
      if (!updatedSettings) {
        throw new ConvexError("Billing settings not found after update");
      }

      return billingSettingsDocToReturn(updatedSettings);
    }

    const settingsId = await ctx.db.insert("schoolBillingSettings", {
      ...nextSettings,
      createdAt: now,
    });
    const createdSettings = await ctx.db.get(settingsId);
    if (!createdSettings) {
      throw new ConvexError("Billing settings not found after creation");
    }

    return billingSettingsDocToReturn(createdSettings);
  },
});

export const listFeePlans = query({
  args: {},
  returns: v.array(billingFeePlanValidator),
  handler: async (ctx) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const feePlans = await ctx.db
      .query("feePlans")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .collect();

    return feePlans.map(feePlanDocToReturn);
  },
});

export const createFeePlan = mutation({
  args: createFeePlanValidator,
  returns: billingFeePlanValidator,
  handler: async (ctx, args) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const name = normalizeBillingText(args.name);
    if (!name) {
      throw new ConvexError("Fee plan name is required");
    }

    if (args.lineItems.length === 0) {
      throw new ConvexError("At least one fee-plan line item is required");
    }

    const normalizedLineItems = normalizeBillingLineItems(args.lineItems, name);
    const policy = buildBillingInstallmentPolicy(args.installmentPolicy);
    if (policy.enabled && policy.installmentCount > 1 && policy.intervalDays <= 0) {
      throw new ConvexError("Installment plans need a positive interval");
    }

    const billingMode = args.billingMode ?? "class_default";
    const targetClassIds = normalizeClassIdList(args.targetClassIds ?? []);
    if (billingMode === "class_default" && targetClassIds.length === 0) {
      throw new ConvexError("Class-default fee plans need at least one target class");
    }
    if (billingMode === "manual_extra" && targetClassIds.length > 0) {
      throw new ConvexError("Manual extra fee plans cannot target classes");
    }

    if (targetClassIds.length > 0) {
      const targetClasses = await Promise.all(
        targetClassIds.map((classId) => ctx.db.get(classId))
      );
      for (const classDoc of targetClasses) {
        if (!classDoc || classDoc.schoolId !== viewer.schoolId || classDoc.isArchived) {
          throw new ConvexError("One or more target classes are not available");
        }
      }
    }

    const now = Date.now();
    const feePlanId = await ctx.db.insert("feePlans", {
      schoolId: viewer.schoolId,
      name,
      description: normalizeBillingText(args.description),
      currency: normalizeBillingText(args.currency)?.toUpperCase() ?? "NGN",
      billingMode,
      targetClassIds,
      lineItems: normalizedLineItems,
      installmentPolicy: policy,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: viewer.userId,
      updatedBy: viewer.userId,
    });

    const feePlan = await ctx.db.get(feePlanId);
    if (!feePlan) {
      throw new ConvexError("Fee plan not found after creation");
    }

    return feePlanDocToReturn(feePlan);
  },
});

export const createInvoiceFromFeePlan = mutation({
  args: createInvoiceValidator,
  returns: billingInvoiceValidator,
  handler: async (ctx, args) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const [feePlan, student, classDoc, session, term] = await Promise.all([
      ctx.db.get(args.feePlanId),
      ctx.db.get(args.studentId),
      ctx.db.get(args.classId),
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
    ]);

    if (!feePlan || feePlan.schoolId !== viewer.schoolId) {
      throw new ConvexError("Fee plan not found");
    }
    if (!student || student.schoolId !== viewer.schoolId || student.classId !== args.classId) {
      throw new ConvexError("Student not found in the selected class");
    }
    if (!classDoc || classDoc.schoolId !== viewer.schoolId) {
      throw new ConvexError("Class not found");
    }
    if (!session || session.schoolId !== viewer.schoolId) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== viewer.schoolId || String(term.sessionId) !== String(session._id)) {
      throw new ConvexError("Term not found in the selected session");
    }

    const duplicateInvoice = await ctx.db
      .query("studentInvoices")
      .withIndex("by_student", (q: any) => q.eq("studentId", args.studentId))
      .filter((q: any) =>
        q.and(
          q.eq(q.field("feePlanId"), args.feePlanId),
          q.eq(q.field("sessionId"), args.sessionId),
          q.eq(q.field("termId"), args.termId),
          q.eq(q.field("classId"), args.classId)
        )
      )
      .first();

    if (duplicateInvoice) {
      throw new ConvexError("An invoice already exists for this student, term, and fee plan");
    }

    const feePlanMode = feePlanBillingMode(feePlan);
    const targetClassIds = feePlanTargetClassIds(feePlan);
    if (
      feePlanMode === "class_default" &&
      targetClassIds.length > 0 &&
      !targetClassIds.some((targetClassId) => String(targetClassId) === String(args.classId))
    ) {
      throw new ConvexError("This fee plan is not assigned to the selected class");
    }

    const school = await ctx.db.get(viewer.schoolId);
    if (!school) {
      throw new ConvexError("School not found");
    }

    const settingsRecord = await ctx.db
      .query("schoolBillingSettings")
      .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
      .unique();

    const invoice = await createInvoiceFromFeePlanRecord({
      ctx,
      school,
      settingsRecord,
      feePlan,
      student,
      classDoc,
      session,
      term,
      waiverAmount: args.waiverAmount,
      discountAmount: args.discountAmount,
      dueDate: args.dueDate,
      notes: args.notes,
      issuedBy: viewer.userId,
    });
    if (!invoice) {
      throw new ConvexError("Invoice not found after creation");
    }

    return invoiceDocToReturn(invoice);
  },
});

export const applyFeePlanToClassStudents = mutation({
  args: applyFeePlanValidator,
  returns: applyFeePlanResultValidator,
  handler: async (ctx, args) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const [feePlan, classDoc, session, term, school] = await Promise.all([
      ctx.db.get(args.feePlanId),
      ctx.db.get(args.classId),
      ctx.db.get(args.sessionId),
      ctx.db.get(args.termId),
      ctx.db.get(viewer.schoolId),
    ]);

    if (!school) {
      throw new ConvexError("School not found");
    }
    if (!feePlan || feePlan.schoolId !== viewer.schoolId) {
      throw new ConvexError("Fee plan not found");
    }
    if (!classDoc || classDoc.schoolId !== viewer.schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }
    if (!session || session.schoolId !== viewer.schoolId) {
      throw new ConvexError("Session not found");
    }
    if (!term || term.schoolId !== viewer.schoolId || String(term.sessionId) !== String(session._id)) {
      throw new ConvexError("Term not found in the selected session");
    }

    const feePlanMode = feePlanBillingMode(feePlan);
    if (feePlanMode !== "class_default") {
      throw new ConvexError("Manual extra fee plans cannot be bulk applied");
    }

    const targetClassIds = feePlanTargetClassIds(feePlan);
    if (
      targetClassIds.length > 0 &&
      !targetClassIds.some((targetClassId) => String(targetClassId) === String(args.classId))
    ) {
      throw new ConvexError("This fee plan is not assigned to the selected class");
    }

    const [students, existingInvoices, settingsRecord] = await Promise.all([
      ctx.db
        .query("students")
        .withIndex("by_school_and_class", (q: any) =>
          q.eq("schoolId", viewer.schoolId).eq("classId", args.classId)
        )
        .collect(),
      ctx.db
        .query("studentInvoices")
        .withIndex("by_school_and_class", (q: any) =>
          q.eq("schoolId", viewer.schoolId).eq("classId", args.classId)
        )
        .collect(),
      ctx.db
        .query("schoolBillingSettings")
        .withIndex("by_school", (q: any) => q.eq("schoolId", viewer.schoolId))
        .unique(),
    ]);

    const activeStudents = students.filter((student: any) => !student.isArchived);
    const existingInvoiceStudentIds = new Set(
      existingInvoices
        .filter(
          (invoice: any) =>
            String(invoice.feePlanId) === String(args.feePlanId) &&
            String(invoice.sessionId) === String(args.sessionId) &&
            String(invoice.termId) === String(args.termId)
        )
        .map((invoice: any) => String(invoice.studentId))
    );

    const applicationId = await ctx.db.insert("feePlanApplications", {
      schoolId: viewer.schoolId,
      feePlanId: args.feePlanId,
      classId: args.classId,
      sessionId: args.sessionId,
      termId: args.termId,
      studentCount: activeStudents.length,
      createdInvoiceCount: 0,
      skippedInvoiceCount: 0,
      notes: normalizeBillingText(args.notes),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: viewer.userId,
    });

    let createdCount = 0;
    let skippedCount = 0;
    const orderedStudents = [...activeStudents].sort((left: any, right: any) =>
      left.admissionNumber.localeCompare(right.admissionNumber)
    );

    for (const student of orderedStudents) {
      if (existingInvoiceStudentIds.has(String(student._id))) {
        skippedCount += 1;
        continue;
      }

      const createdInvoice = await createInvoiceFromFeePlanRecord({
        ctx,
        school,
        settingsRecord,
        feePlan,
        student,
        classDoc,
        session,
        term,
        applicationId,
        issuedBy: viewer.userId,
        notes: args.notes,
      });

      if (!createdInvoice) {
        throw new ConvexError("Invoice creation failed during bulk application");
      }

      createdCount += 1;
    }

    await ctx.db.patch(applicationId, {
      createdInvoiceCount: createdCount,
      skippedInvoiceCount: skippedCount,
      updatedAt: Date.now(),
    });

    const application = await ctx.db.get(applicationId);
    if (!application) {
      throw new ConvexError("Fee plan application not found after creation");
    }

    return {
      application: feePlanApplicationDocToReturn(application),
      createdCount,
      skippedCount,
    };
  },
});

export const recordManualPayment = mutation({
  args: manualPaymentValidator,
  returns: v.object({
    invoice: billingInvoiceValidator,
    payment: billingPaymentValidator,
  }),
  handler: async (ctx, args) => {
    const viewer = await getAuthenticatedSchoolMembership(ctx);
    assertAdmin(viewer);

    const invoice = await loadInvoiceById(ctx, args.invoiceId);
    if (!invoice || invoice.schoolId !== viewer.schoolId) {
      throw new ConvexError("Invoice not found");
    }

    if (invoice.status === "cancelled") {
      throw new ConvexError("Cancelled invoices cannot receive payments");
    }

    const amountReceived = normalizeBillingAmount(args.amountReceived);
    const balanceDue = normalizeBillingAmount(Math.max(0, invoice.balanceDue));
    if (amountReceived > balanceDue) {
      throw new ConvexError(
        `Manual payment cannot exceed the invoice balance due of ${balanceDue.toFixed(2)}`
      );
    }

    const paymentResult = await createPaymentAndAllocation({
      ctx,
      schoolId: viewer.schoolId,
      invoice,
      reference: args.reference,
      gatewayReference: null,
      provider: "manual",
      paymentMethod: args.paymentMethod,
      amountReceived,
      receivedAt: args.receivedAt ?? Date.now(),
      payerName: args.payerName,
      payerEmail: args.payerEmail,
      notes: args.notes,
      recordedBy: viewer.userId,
      reconciliationStatus: "unreconciled",
    });

    return {
      invoice: invoiceDocToReturn(paymentResult.invoice),
      payment: paymentDocToReturn(paymentResult.payment),
    };
  },
});

export const recordVerifiedGatewayEventInternal = internalMutation({
  args: gatewayEventInputValidator,
  returns: v.object({
    event: billingGatewayEventValidator,
    invoice: v.union(billingInvoiceValidator, v.null()),
    payment: v.union(billingPaymentValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const now = args.receivedAt ?? Date.now();
    const existingEvent = await ctx.db
      .query("paymentGatewayEvents")
      .withIndex("by_school_and_event", (q: any) =>
        q.eq("schoolId", args.schoolId).eq("eventId", args.eventId)
      )
      .unique();

    if (existingEvent) {
      const existingInvoice = existingEvent.invoiceId ? await ctx.db.get(existingEvent.invoiceId) : null;
      const existingPayment = existingEvent.paymentId ? await ctx.db.get(existingEvent.paymentId) : null;
      return {
        event: gatewayEventDocToReturn(existingEvent),
        invoice: existingInvoice ? invoiceDocToReturn(existingInvoice) : null,
        payment: existingPayment ? paymentDocToReturn(existingPayment) : null,
      };
    }

    const schoolId = args.schoolId;
    const invoiceCandidate = args.invoiceId
      ? await ctx.db.get(args.invoiceId)
      : args.invoiceNumber
        ? await ctx.db
            .query("studentInvoices")
            .withIndex("by_school_and_number", (q: any) =>
              q.eq("schoolId", schoolId).eq("invoiceNumber", args.invoiceNumber ?? "")
            )
            .unique()
        : null;

    if (invoiceCandidate && invoiceCandidate.schoolId !== schoolId) {
      throw new ConvexError("Invoice does not belong to the payment event school");
    }

    let payment: any = null;
    let invoice: any = invoiceCandidate;
    let verificationStatus: "verified" | "rejected" | "ignored" = "verified";
    let paymentId: Id<"billingPayments"> | null = null;
    let processingMessage = args.verificationMessage ?? null;

    const successfulEventTypes = new Set([
      "charge.success",
      "transfer.success",
      "transaction.success",
      "payment.success",
    ]);

    if (!args.signatureValid) {
      verificationStatus = "rejected";
      processingMessage = processingMessage ?? "Webhook signature verification failed";
    } else if (!invoiceCandidate) {
      verificationStatus = "ignored";
      processingMessage = processingMessage ?? "No invoice reference was provided";
    } else if (!successfulEventTypes.has(args.eventType)) {
      verificationStatus = "ignored";
      processingMessage = processingMessage ?? `Event type ${args.eventType} does not represent a completed payment`;
    } else if (!args.amountReceived || args.amountReceived <= 0) {
      verificationStatus = "ignored";
      processingMessage = processingMessage ?? "Webhook payload did not include a received amount";
    } else {
      const paymentReference = normalizeBillingReference(
        args.gatewayReference ?? args.reference ?? args.eventId
      );
      const result = await createPaymentAndAllocation({
        ctx,
        schoolId,
        invoice: invoiceCandidate,
        reference: paymentReference,
        gatewayReference: args.gatewayReference ?? args.reference,
        provider: args.provider,
        paymentMethod: "online",
        amountReceived: args.amountReceived,
        receivedAt: now,
        payerName: args.payerName,
        payerEmail: args.payerEmail,
        notes: processingMessage,
        recordedBy: null,
        reconciliationStatus: "reconciled",
      });
      payment = result.payment;
      invoice = result.invoice;
      paymentId = result.payment._id;
      verificationStatus = "verified";
      processingMessage = processingMessage ?? "Webhook payment applied successfully";
    }

    const eventId = await ctx.db.insert("paymentGatewayEvents", {
      schoolId,
      provider: args.provider,
      eventId: args.eventId,
      eventType: args.eventType,
      reference: normalizeBillingReference(args.reference),
      invoiceNumber: args.invoiceNumber ? normalizeBillingText(args.invoiceNumber) : undefined,
      invoiceId: invoice?._id ?? undefined,
      paymentId: paymentId ?? undefined,
      signatureValid: args.signatureValid,
      verificationStatus,
      rawBody: args.rawBody,
      payload: args.payload,
      processedAt: payment ? now : undefined,
      ...(processingMessage ? { verificationMessage: processingMessage } : {}),
      receivedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Gateway event not found after persistence");
    }

    return {
      event: gatewayEventDocToReturn(event),
      invoice: invoice ? invoiceDocToReturn(invoice) : null,
      payment: payment ? paymentDocToReturn(payment) : null,
    };
  },
});

export const verifyOnlinePaymentByReference = action({
  args: {
    reference: v.string(),
  },
  returns: v.object({
    event: billingGatewayEventValidator,
    invoice: v.union(billingInvoiceValidator, v.null()),
    payment: v.union(billingPaymentValidator, v.null()),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    event: any;
    invoice: any;
    payment: any;
  }> => {
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer) {
      throw new ConvexError("Unauthorized");
    }
    assertAdmin({ isSchoolAdmin: viewer.isSchoolAdmin === true });

    return await verifyPaystackReferenceAndReconcile(ctx, args.reference, {
      expectedSchoolId: viewer.schoolId ?? null,
    });
  },
});

export const verifyOnlinePaymentByReferencePublic = action({
  args: {
    reference: v.string(),
  },
  returns: v.object({
    reference: v.string(),
    verificationStatus: v.union(
      v.literal("verified"),
      v.literal("rejected"),
      v.literal("ignored")
    ),
    invoiceNumber: v.union(v.string(), v.null()),
    paymentRecorded: v.boolean(),
    message: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    reference: string;
    verificationStatus: "verified" | "rejected" | "ignored";
    invoiceNumber: string | null;
    paymentRecorded: boolean;
    message: string;
  }> => {
    const result = await verifyPaystackReferenceAndReconcile(ctx, args.reference);

    return {
      reference: result.event.reference,
      verificationStatus: result.event.verificationStatus,
      invoiceNumber: result.invoice?.invoiceNumber ?? result.event.invoiceNumber ?? null,
      paymentRecorded: result.payment !== null,
      message:
        result.event.verificationMessage ??
        (result.payment !== null
          ? "Payment verified successfully"
          : "Payment verification completed"),
    };
  },
});

async function createOnlinePaymentLinkForInvoiceContext(args: {
  paymentContext: any;
  invoiceId: Id<"studentInvoices">;
  amount: number;
  email: string;
  description: string;
  callbackUrl?: string;
}) {
  if (!args.paymentContext) {
    throw new ConvexError("Invoice not found");
  }

  if (!args.paymentContext.settings || !args.paymentContext.settings.allowOnlinePayments) {
    throw new ConvexError("Online payments are not enabled for this school");
  }

  if (args.paymentContext.settings.preferredProvider !== "paystack") {
    throw new ConvexError("This school is not configured for Paystack online payments");
  }

  const invoice = args.paymentContext.invoice;
  if (invoice.status === "cancelled" || invoice.status === "waived" || invoice.status === "paid") {
    throw new ConvexError("Only unpaid school invoices can receive an online payment link");
  }

  const amount = normalizeBillingAmount(args.amount);
  if (amount <= 0) {
    throw new ConvexError("Payment amount must be greater than zero");
  }
  if (amount > invoice.balanceDue) {
    throw new ConvexError(
      `Payment link amount cannot exceed the outstanding balance of ${invoice.balanceDue.toFixed(2)}`
    );
  }

  const gateway = createBillingGatewayAdapter("paystack");
  const reference = generateBillingInvoiceNumber({
    prefix: `${invoice.invoiceNumber}-PAY`,
    invoiceId: String(args.invoiceId),
  });
  const description = normalizeBillingText(args.description) ?? `Pay ${invoice.invoiceNumber}`;

  return await gateway.createPaymentLink({
    amount,
    email: args.email.trim().toLowerCase(),
    schoolId: String(args.paymentContext.schoolId),
    schoolSlug: args.paymentContext.schoolSlug,
    invoiceId: String(args.invoiceId),
    invoiceNumber: invoice.invoiceNumber,
    description,
    reference,
    callbackUrl: args.callbackUrl,
  });
}

export const initializeOnlinePayment = action({
  args: {
    schoolId: v.id("schools"),
    invoiceId: v.id("studentInvoices"),
    amount: v.number(),
    email: v.string(),
    description: v.string(),
    callbackUrl: v.optional(v.string()),
  },
  returns: v.object({
    provider: billingPaymentProviderValidator,
    reference: v.string(),
    authorizationUrl: v.union(v.string(), v.null()),
    accessCode: v.union(v.string(), v.null()),
    checkoutPayload: v.any(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    provider: "paystack";
    reference: string;
    authorizationUrl: string | null;
    accessCode: string | null;
    checkoutPayload: Record<string, unknown>;
  }> => {
    const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
    if (!viewer) {
      throw new ConvexError("Unauthorized");
    }
    assertAdmin({ isSchoolAdmin: viewer.isSchoolAdmin === true });

    if (!viewer.schoolId || String(viewer.schoolId) !== String(args.schoolId)) {
      throw new ConvexError("Cross-school access denied");
    }

    const paymentContext: any = await ctx.runQuery(
      (internal as any).functions.billing.resolveBillingInvoiceForPaymentLinkInternal,
      {
        invoiceId: args.invoiceId,
      }
    );

    if (!paymentContext || String(paymentContext.schoolId) !== String(args.schoolId)) {
      throw new ConvexError("Invoice not found");
    }

    return await createOnlinePaymentLinkForInvoiceContext({
      paymentContext,
      invoiceId: args.invoiceId,
      amount: args.amount,
      email: args.email,
      description: args.description || `Pay ${paymentContext.invoice.invoiceNumber} via front desk`,
      callbackUrl: args.callbackUrl,
    });
  },
});

export const initializePortalOnlinePayment = action({
  args: {
    invoiceId: v.id("studentInvoices"),
    callbackUrl: v.optional(v.string()),
  },
  returns: v.object({
    provider: billingPaymentProviderValidator,
    reference: v.string(),
    authorizationUrl: v.union(v.string(), v.null()),
    accessCode: v.union(v.string(), v.null()),
    checkoutPayload: v.any(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    provider: "paystack";
    reference: string;
    authorizationUrl: string | null;
    accessCode: string | null;
    checkoutPayload: Record<string, unknown>;
  }> => {
    const portalPaymentContext: any = await ctx.runQuery(
      api.functions.portal.resolvePortalInvoicePaymentContext,
      { invoiceId: args.invoiceId }
    );

    const paymentContext: any = await ctx.runQuery(
      (internal as any).functions.billing.resolveBillingInvoiceForPaymentLinkInternal,
      {
        invoiceId: args.invoiceId,
      }
    );

    if (!paymentContext || String(paymentContext.schoolId) !== String(portalPaymentContext.schoolId)) {
      throw new ConvexError("Invoice not found");
    }

    return await createOnlinePaymentLinkForInvoiceContext({
      paymentContext,
      invoiceId: args.invoiceId,
      amount: paymentContext.invoice.balanceDue,
      email: portalPaymentContext.payerEmail,
      description: `Portal payment for ${paymentContext.invoice.invoiceNumber}`,
      callbackUrl: args.callbackUrl,
    });
  },
});
