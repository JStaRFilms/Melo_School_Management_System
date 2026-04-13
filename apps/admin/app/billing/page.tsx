"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  Search,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { StatGroup } from "@/components/ui/StatGroup";

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
] as const;

type DashboardFilters = {
  classId: string;
  sessionId: string;
  termId: string;
  status: string;
  search: string;
};

type FeePlanDraftItem = {
  draftId: string;
  label: string;
  amount: string;
  category: "tuition" | "boarding" | "transport" | "exam" | "activity" | "other";
};

type FeePlanDraft = {
  name: string;
  description: string;
  currency: string;
  installmentEnabled: boolean;
  installmentCount: string;
  intervalDays: string;
  firstDueDays: string;
  lineItems: FeePlanDraftItem[];
};

type InvoiceDraft = {
  feePlanId: string;
  classId: string;
  sessionId: string;
  termId: string;
  studentId: string;
  waiverAmount: string;
  discountAmount: string;
  dueDate: string;
  notes: string;
};

type PaymentDraft = {
  invoiceId: string;
  reference: string;
  amountReceived: string;
  paymentMethod: (typeof paymentMethods)[number]["value"];
  payerName: string;
  payerEmail: string;
  notes: string;
};

type ClassOption = {
  _id: string;
  name: string;
};

type SessionOption = {
  _id: string;
  name: string;
};

type TermOption = {
  _id: string;
  name: string;
};

type StudentOption = {
  _id: string;
  studentName: string;
  admissionNumber: string;
};

type BillingDashboardData = {
  school: {
    id: string;
    name: string;
    slug: string;
  };
  settings: {
    _id: string;
    invoicePrefix: string;
    defaultCurrency: string;
    defaultDueDays: number;
    preferredProvider: string;
    allowManualPayments: boolean;
    allowOnlinePayments: boolean;
  } | null;
  summary: {
    totalInvoiceAmount: number;
    amountCollected: number;
    outstandingBalance: number;
    overdueInvoices: number;
    paidInvoices: number;
    unreconciledPayments: number;
    manualPayments: number;
    gatewayPayments: number;
    invoiceCount: number;
    paymentCount: number;
    feePlanCount: number;
    gatewayEventCount: number;
  };
  feePlans: Array<{
    _id: string;
    name: string;
    currency: string;
    lineItems: Array<{ id: string; label: string; amount: number; category: string; order: number }>;
    installmentPolicy: {
      enabled: boolean;
      installmentCount: number;
      intervalDays: number;
      firstDueDays: number;
    };
    isActive: boolean;
    description: string | null;
  }>;
  invoices: Array<{
    invoice: {
      _id: string;
      invoiceNumber: string;
      feePlanNameSnapshot: string;
      currency: string;
      totalAmount: number;
      amountPaid: number;
      balanceDue: number;
      status: string;
      dueDate: number;
      issuedAt: number;
      notes: string | null;
    };
    studentName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  payments: Array<{
    payment: {
      _id: string;
      invoiceId: string;
      reference: string;
      gatewayReference: string | null;
      provider: string | null;
      paymentMethod: string;
      amountReceived: number;
      amountApplied: number;
      unappliedAmount: number;
      applicationStatus: string;
      status: string;
      payerName: string | null;
      payerEmail: string | null;
      receivedAt: number;
      reconciliationStatus: string;
      reconciledAt: number | null;
      notes: string | null;
    };
    invoiceNumber: string;
    studentName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  gatewayEvents: Array<{
    _id: string;
    provider: string;
    eventId: string;
    eventType: string;
    reference: string;
    invoiceNumber: string | null;
    signatureValid: boolean;
    verificationStatus: string;
    processedAt: number | null;
    verificationMessage: string | null;
    receivedAt: number;
  }>;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function toQueryArgs(field: "classId" | "sessionId", value: string) {
  return value.trim()
    ? ({ [field]: value.trim() } as never)
    : ("skip" as never);
}

function createDraftLineItem(
  overrides?: Partial<Omit<FeePlanDraftItem, "draftId">>
): FeePlanDraftItem {
  return {
    draftId: crypto.randomUUID(),
    label: overrides?.label ?? "",
    amount: overrides?.amount ?? "",
    category: overrides?.category ?? "other",
  };
}

function initialFeePlanDraft(): FeePlanDraft {
  return {
    name: "",
    description: "",
    currency: "NGN",
    installmentEnabled: false,
    installmentCount: "1",
    intervalDays: "0",
    firstDueDays: "14",
    lineItems: [createDraftLineItem({ label: "Tuition", category: "tuition" })],
  };
}

function initialInvoiceDraft(): InvoiceDraft {
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

function initialPaymentDraft(): PaymentDraft {
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

function DashboardSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="h-20 rounded-2xl bg-slate-100/80 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-slate-100/70 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[420px] rounded-2xl bg-slate-100/70 animate-pulse" />
        <div className="h-[420px] rounded-2xl bg-slate-100/70 animate-pulse" />
      </div>
      <div className="h-[520px] rounded-2xl bg-slate-100/70 animate-pulse" />
    </div>
  );
}

export default function BillingPage() {
  const [filters, setFilters] = useState<DashboardFilters>({
    classId: "",
    sessionId: "",
    termId: "",
    status: "",
    search: "",
  });
  const [feePlanDraft, setFeePlanDraft] = useState<FeePlanDraft>(initialFeePlanDraft());
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(initialInvoiceDraft());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(initialPaymentDraft());
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const dashboardArgs = {
    classId: filters.classId ? (filters.classId as never) : (null as never),
    sessionId: filters.sessionId ? (filters.sessionId as never) : (null as never),
    termId: filters.termId ? (filters.termId as never) : (null as never),
    status: filters.status ? (filters.status as never) : (null as never),
    search: filters.search.trim() ? filters.search.trim() : undefined,
  };

  const data = useQuery("functions/billing:getBillingDashboard" as never, dashboardArgs as never) as
    | BillingDashboardData
    | undefined;

  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as
    | ClassOption[]
    | undefined;
  const sessions = useQuery("functions/academic/academicSetup:listSessions" as never) as
    | SessionOption[]
    | undefined;
  const filterTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", filters.sessionId)
  ) as TermOption[] | undefined;
  const invoiceTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", invoiceDraft.sessionId)
  ) as TermOption[] | undefined;
  const invoiceStudents = useQuery(
    "functions/academic/studentEnrollment:listStudentsByClass" as never,
    toQueryArgs("classId", invoiceDraft.classId)
  ) as StudentOption[] | undefined;

  const createFeePlan = useMutation("functions/billing:createFeePlan" as never);
  const createInvoice = useMutation("functions/billing:createInvoiceFromFeePlan" as never);
  const recordPayment = useMutation("functions/billing:recordManualPayment" as never);

  const selectedCurrency = feePlanDraft.currency.trim().toUpperCase() || data?.settings?.defaultCurrency || "NGN";
  const feePlanTotal = useMemo(
    () =>
      feePlanDraft.lineItems.reduce((sum, item) => {
        const parsed = Number(item.amount);
        return sum + (Number.isFinite(parsed) ? parsed : 0);
      }, 0),
    [feePlanDraft.lineItems]
  );

  const activeFilters = [filters.classId, filters.sessionId, filters.termId, filters.status, filters.search.trim()].filter(Boolean).length;

  const runAction = async (
    action: () => Promise<unknown>,
    successTitle: string,
    fallbackMessage: string
  ) => {
    setNotice(null);
    try {
      await action();
      setNotice({
        tone: "success",
        title: successTitle,
        message: "Saved successfully.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: successTitle,
        message: getUserFacingErrorMessage(error, fallbackMessage),
      });
    }
  };

  const updateLineItem = (index: number, field: keyof FeePlanDraftItem, value: string) => {
    setFeePlanDraft((current) => ({
      ...current,
      lineItems: current.lineItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addLineItem = () => {
    setFeePlanDraft((current) => ({
      ...current,
      lineItems: [...current.lineItems, createDraftLineItem()],
    }));
  };

  const removeLineItem = (index: number) => {
    setFeePlanDraft((current) => ({
      ...current,
      lineItems: current.lineItems.length === 1
        ? current.lineItems
        : current.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleCreateFeePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      await createFeePlan({
        name: feePlanDraft.name,
        description: feePlanDraft.description || undefined,
        currency: feePlanDraft.currency || undefined,
        lineItems: feePlanDraft.lineItems.map((item) => ({
          label: item.label,
          amount: Number(item.amount),
          category: item.category,
        })),
        installmentPolicy: {
          enabled: feePlanDraft.installmentEnabled,
          installmentCount: Number(feePlanDraft.installmentCount),
          intervalDays: Number(feePlanDraft.intervalDays),
          firstDueDays: Number(feePlanDraft.firstDueDays),
        },
      } as never);
      setFeePlanDraft(initialFeePlanDraft());
    }, "Fee plan created", "Unable to create the fee plan.");
  };

  const handleCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      await createInvoice({
        feePlanId: invoiceDraft.feePlanId,
        studentId: invoiceDraft.studentId,
        classId: invoiceDraft.classId,
        sessionId: invoiceDraft.sessionId,
        termId: invoiceDraft.termId,
        waiverAmount: invoiceDraft.waiverAmount ? Number(invoiceDraft.waiverAmount) : undefined,
        discountAmount: invoiceDraft.discountAmount ? Number(invoiceDraft.discountAmount) : undefined,
        dueDate: invoiceDraft.dueDate ? new Date(invoiceDraft.dueDate).getTime() : undefined,
        notes: invoiceDraft.notes || undefined,
      } as never);
      setInvoiceDraft(initialInvoiceDraft());
    }, "Invoice created", "Unable to generate the invoice.");
  };

  const handleRecordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      await recordPayment({
        invoiceId: paymentDraft.invoiceId,
        reference: paymentDraft.reference,
        amountReceived: Number(paymentDraft.amountReceived),
        paymentMethod: paymentDraft.paymentMethod,
        payerName: paymentDraft.payerName || undefined,
        payerEmail: paymentDraft.payerEmail || undefined,
        notes: paymentDraft.notes || undefined,
      } as never);
      setPaymentDraft(initialPaymentDraft());
    }, "Payment recorded", "Unable to save the payment.");
  };

  if (data === undefined) {
    return <DashboardSkeleton />;
  }

  const summaryCurrency = data.settings?.defaultCurrency ?? "NGN";

  return (
    <div className="space-y-6 md:space-y-8">
      <AdminHeader
        title="Billing & Collections"
        actions={
          <StatGroup
            stats={[
              { label: "Outstanding", value: formatMoney(data.summary.outstandingBalance, summaryCurrency), icon: <Banknote /> },
              { label: "Collected", value: formatMoney(data.summary.amountCollected, summaryCurrency), icon: <Landmark /> },
              { label: "Invoices", value: data.summary.invoiceCount, icon: <ReceiptText /> },
              { label: "Overdue", value: data.summary.overdueInvoices, icon: <AlertTriangle /> },
            ]}
          />
        }
      />

      {notice && (
        <div
          className={`rounded-2xl border-l-4 bg-white p-4 shadow-sm ${
            notice.tone === "success" ? "border-emerald-500" : "border-rose-500"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {notice.title}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700">{notice.message}</p>
            </div>
            <button onClick={() => setNotice(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <AdminSurface className="p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr] xl:items-end">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Collections view
            </h2>
            <p className="text-sm text-slate-600">
              Filter invoices, payments, and reconciliation states for the current school.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={filters.classId}
              onChange={(event) => setFilters((current) => ({ ...current, classId: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All classes</option>
              {classes?.map((classOption) => (
                <option key={classOption._id} value={classOption._id}>
                  {classOption.name}
                </option>
              ))}
            </select>

            <select
              value={filters.sessionId}
              onChange={(event) => setFilters((current) => ({ ...current, sessionId: event.target.value, termId: "" }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All sessions</option>
              {sessions?.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.name}
                </option>
              ))}
            </select>

            <select
              value={filters.termId}
              onChange={(event) => setFilters((current) => ({ ...current, termId: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All terms</option>
              {filterTerms?.map((term) => (
                <option key={term._id} value={term._id}>
                  {term.name}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">All invoice states</option>
              <option value="issued">Issued</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="waived">Waived</option>
            </select>

            <div className="relative xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search invoices"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
              />
            </div>
          </div>
        </div>

        {activeFilters > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <span>{activeFilters} active filter{activeFilters === 1 ? "" : "s"}</span>
            <button
              onClick={() => setFilters({ classId: "", sessionId: "", termId: "", status: "", search: "" })}
              className="font-semibold text-slate-700 hover:text-slate-950"
            >
              Clear filters
            </button>
          </div>
        )}
      </AdminSurface>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Fee plans</h3>
              <p className="text-sm text-slate-500">School-wide templates with line items and installment rules.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {data.summary.feePlanCount} plans
            </div>
          </div>

          <form onSubmit={handleCreateFeePlan} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Plan name</span>
                <input
                  value={feePlanDraft.name}
                  onChange={(event) => setFeePlanDraft((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Mid-year school fees"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Currency</span>
                <input
                  value={feePlanDraft.currency}
                  onChange={(event) => setFeePlanDraft((current) => ({ ...current, currency: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="NGN"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Description</span>
              <textarea
                value={feePlanDraft.description}
                onChange={(event) => setFeePlanDraft((current) => ({ ...current, description: event.target.value }))}
                className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Optional note for bursary staff"
              />
            </label>

            <div className="grid gap-3 md:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Installments</span>
                <input
                  type="number"
                  min="1"
                  value={feePlanDraft.installmentCount}
                  onChange={(event) => setFeePlanDraft((current) => ({ ...current, installmentCount: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">First due days</span>
                <input
                  type="number"
                  min="0"
                  value={feePlanDraft.firstDueDays}
                  onChange={(event) => setFeePlanDraft((current) => ({ ...current, firstDueDays: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Interval days</span>
                <input
                  type="number"
                  min="0"
                  value={feePlanDraft.intervalDays}
                  onChange={(event) => setFeePlanDraft((current) => ({ ...current, intervalDays: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm flex items-end gap-2 pb-1">
                <input
                  type="checkbox"
                  checked={feePlanDraft.installmentEnabled}
                  onChange={(event) => setFeePlanDraft((current) => ({ ...current, installmentEnabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="font-medium text-slate-600">Enable installments</span>
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-semibold text-slate-900">Line items</h4>
                <button type="button" onClick={addLineItem} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <Plus className="h-3.5 w-3.5" /> Add item
                </button>
              </div>

              <div className="space-y-3">
                {feePlanDraft.lineItems.map((item, index) => (
                  <div key={item.draftId} className="grid gap-2 rounded-2xl border border-slate-200 p-3 md:grid-cols-[1.2fr_0.7fr_0.7fr_auto] md:items-center">
                    <input
                      value={item.label}
                      onChange={(event) => updateLineItem(index, "label", event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Item label"
                    />
                    <input
                      value={item.amount}
                      onChange={(event) => updateLineItem(index, "amount", event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Amount"
                    />
                    <select
                      value={item.category}
                      onChange={(event) => updateLineItem(index, "category", event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="tuition">Tuition</option>
                      <option value="boarding">Boarding</option>
                      <option value="transport">Transport</option>
                      <option value="exam">Exam</option>
                      <option value="activity">Activity</option>
                      <option value="other">Other</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">Estimated total</span>
              <span className="font-semibold text-slate-950">{formatMoney(feePlanTotal, selectedCurrency)}</span>
            </div>

            <button type="submit" className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <ReceiptText className="h-4 w-4" /> Save fee plan
            </button>
          </form>

          <div className="mt-6 space-y-3">
            {data.feePlans.map((feePlan) => (
              <div key={feePlan._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{feePlan.name}</p>
                    <p className="text-xs text-slate-500">{feePlan.description ?? "No description"}</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {feePlan.lineItems.length} line item{feePlan.lineItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  <span>{feePlan.currency}</span>
                  <span>Installments: {feePlan.installmentPolicy.enabled ? feePlan.installmentPolicy.installmentCount : 1}</span>
                  <span>{feePlan.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            ))}
          </div>
        </AdminSurface>

        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Invoice creation</h3>
              <p className="text-sm text-slate-500">Generate a student invoice from a fee plan and academic term.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {data.summary.paymentCount} payments
            </div>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Fee plan</span>
                <select
                  value={invoiceDraft.feePlanId}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, feePlanId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Select a fee plan</option>
                  {data.feePlans.map((feePlan) => (
                    <option key={feePlan._id} value={feePlan._id}>
                      {feePlan.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Class</span>
                <select
                  value={invoiceDraft.classId}
                  onChange={(event) =>
                    setInvoiceDraft((current) => ({
                      ...current,
                      classId: event.target.value,
                      studentId: "",
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Select class</option>
                  {classes?.map((classOption) => (
                    <option key={classOption._id} value={classOption._id}>
                      {classOption.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Session</span>
                <select
                  value={invoiceDraft.sessionId}
                  onChange={(event) =>
                    setInvoiceDraft((current) => ({
                      ...current,
                      sessionId: event.target.value,
                      termId: "",
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Select session</option>
                  {sessions?.map((session) => (
                    <option key={session._id} value={session._id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Term</span>
                <select
                  value={invoiceDraft.termId}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, termId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Select term</option>
                  {invoiceTerms?.map((term) => (
                    <option key={term._id} value={term._id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Student</span>
              <select
                value={invoiceDraft.studentId}
                onChange={(event) => setInvoiceDraft((current) => ({ ...current, studentId: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select student</option>
                {invoiceStudents?.map((student) => (
                  <option key={student._id} value={student._id}>
                    {student.studentName} - {student.admissionNumber}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Waiver</span>
                <input
                  type="number"
                  min="0"
                  value={invoiceDraft.waiverAmount}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, waiverAmount: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Discount</span>
                <input
                  type="number"
                  min="0"
                  value={invoiceDraft.discountAmount}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, discountAmount: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Due date</span>
                <input
                  type="date"
                  value={invoiceDraft.dueDate}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, dueDate: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Notes</span>
              <textarea
                value={invoiceDraft.notes}
                onChange={(event) => setInvoiceDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Optional memo for the bursary desk"
              />
            </label>

            <button type="submit" className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <FileText className="h-4 w-4" /> Generate invoice
            </button>
          </form>

          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
            <div className="max-h-[340px] divide-y divide-slate-200 overflow-y-auto">
              {data.invoices.map((row) => (
                <div key={row.invoice._id} className="grid gap-2 bg-white p-4 md:grid-cols-[1.4fr_1fr_0.8fr] md:items-center">
                  <div>
                    <p className="font-semibold text-slate-950">{row.studentName}</p>
                    <p className="text-xs text-slate-500">
                      {row.className} · {row.sessionName} · {row.termName}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                      {row.invoice.invoiceNumber} · {row.invoice.feePlanNameSnapshot}
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>Total: {formatMoney(row.invoice.totalAmount, row.invoice.currency)}</p>
                    <p>Balance: {formatMoney(row.invoice.balanceDue, row.invoice.currency)}</p>
                  </div>
                  <div className="flex justify-start md:justify-end">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {row.invoice.status}
                    </span>
                  </div>
                </div>
              ))}
              {data.invoices.length === 0 && (
                <div className="bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                  No invoices match the current filters.
                </div>
              )}
            </div>
          </div>
        </AdminSurface>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Manual payment capture</h3>
              <p className="text-sm text-slate-500">Record cash or bank payments against a specific invoice.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {data.summary.manualPayments} manual
            </div>
          </div>

          <form onSubmit={handleRecordPayment} className="space-y-4">
            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Invoice</span>
              <select
                value={paymentDraft.invoiceId}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, invoiceId: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select invoice</option>
                {data.invoices.map((row) => (
                  <option key={row.invoice._id} value={row.invoice._id}>
                    {row.invoice.invoiceNumber} - {row.studentName}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Reference</span>
                <input
                  value={paymentDraft.reference}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Receipt or bank reference"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Amount received</span>
                <input
                  type="number"
                  min="0"
                  value={paymentDraft.amountReceived}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, amountReceived: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Method</span>
                <select
                  value={paymentDraft.paymentMethod}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentMethod: event.target.value as PaymentDraft["paymentMethod"] }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Payer name</span>
                <input
                  value={paymentDraft.payerName}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, payerName: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Payer email</span>
                <input
                  value={paymentDraft.payerEmail}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, payerEmail: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Optional"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Notes</span>
                <input
                  value={paymentDraft.notes}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Optional reconciliation note"
                />
              </label>
            </div>

            <button type="submit" className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <CreditCard className="h-4 w-4" /> Save payment
            </button>
          </form>
        </AdminSurface>

        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Payment history and gateway events</h3>
              <p className="text-sm text-slate-500">Review captured cash, bank, and online payment records.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {data.summary.unreconciledPayments} unreconciled
            </div>
          </div>

          <div className="space-y-3">
            {data.payments.map((row) => (
              <div key={row.payment._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">{row.studentName}</p>
                    <p className="text-xs text-slate-500">
                      {row.className} · {row.sessionName} · {row.termName}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                      {row.invoiceNumber} · {row.payment.reference}
                    </p>
                  </div>
                  <div className="text-right text-sm text-slate-600">
                    <p>{formatMoney(row.payment.amountApplied, summaryCurrency)}</p>
                    <p className="text-xs text-slate-400">
                      {row.payment.provider ?? row.payment.paymentMethod} · {row.payment.reconciliationStatus}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {data.payments.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No payments have been recorded for the current filter.
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">Recent gateway events</h4>
            {data.gatewayEvents.map((event) => (
              <div key={event._id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">{event.eventType}</p>
                    <p className="text-xs text-slate-500">{event.reference}{event.invoiceNumber ? ` · ${event.invoiceNumber}` : ""}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {event.verificationStatus}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {event.signatureValid ? "Signature verified" : "Signature failed"}
                  {event.verificationMessage ? ` · ${event.verificationMessage}` : ""}
                </p>
              </div>
            ))}
            {data.gatewayEvents.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                No verified gateway events yet.
              </div>
            )}
          </div>
        </AdminSurface>
      </div>
    </div>
  );
}
