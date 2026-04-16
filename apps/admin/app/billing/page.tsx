"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Banknote,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Link2,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
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
  billingMode: "class_default" | "manual_extra";
  targetClassIds: string[];
  installmentEnabled: boolean;
  installmentCount: string;
  intervalDays: string;
  firstDueDays: string;
  lineItems: FeePlanDraftItem[];
};

type FeePlanApplicationDraft = {
  feePlanId: string;
  classId: string;
  sessionId: string;
  termId: string;
  notes: string;
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

type BillingSettingsDraft = {
  invoicePrefix: string;
  defaultCurrency: string;
  defaultDueDays: string;
  allowManualPayments: boolean;
  allowOnlinePayments: boolean;
};

type PaymentLinkDraft = {
  invoiceId: string;
  amount: string;
  email: string;
  description: string;
  callbackUrl: string;
};

type PaymentLinkResult = {
  provider: string;
  reference: string;
  authorizationUrl: string | null;
  accessCode: string | null;
  checkoutPayload: Record<string, unknown>;
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
    feePlanApplicationCount: number;
    gatewayEventCount: number;
  };
  feePlans: Array<{
    _id: string;
    name: string;
    currency: string;
    billingMode: "class_default" | "manual_extra";
    targetClassIds: string[];
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
  applications: Array<{
    application: {
      _id: string;
      feePlanId: string;
      classId: string;
      sessionId: string;
      termId: string;
      studentCount: number;
      createdInvoiceCount: number;
      skippedInvoiceCount: number;
      notes: string | null;
      createdAt: number;
      updatedAt: number;
      createdBy: string;
    };
    feePlanName: string;
    className: string;
    sessionName: string;
    termName: string;
  }>;
  invoices: Array<{
    invoice: {
      _id: string;
      invoiceNumber: string;
      feePlanNameSnapshot: string;
      feePlanApplicationId: string | null;
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
    paymentId: string | null;
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

function matchesSearch(query: string, values: Array<string | null | undefined>) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
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
    billingMode: "class_default",
    targetClassIds: [],
    installmentEnabled: false,
    installmentCount: "1",
    intervalDays: "0",
    firstDueDays: "14",
    lineItems: [createDraftLineItem({ label: "Tuition", category: "tuition" })],
  };
}

function initialFeePlanApplicationDraft(): FeePlanApplicationDraft {
  return {
    feePlanId: "",
    classId: "",
    sessionId: "",
    termId: "",
    notes: "",
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

function initialBillingSettingsDraft(schoolSlug = ""): BillingSettingsDraft {
  const normalizedPrefix = schoolSlug.trim().toUpperCase();

  return {
    invoicePrefix: normalizedPrefix,
    defaultCurrency: "NGN",
    defaultDueDays: "14",
    allowManualPayments: true,
    allowOnlinePayments: false,
  };
}

function buildBillingSettingsDraft(
  settings:
    | {
        invoicePrefix: string;
        defaultCurrency: string;
        defaultDueDays: number;
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
    allowManualPayments: settings.allowManualPayments,
    allowOnlinePayments: settings.allowOnlinePayments,
  };
}

function initialPaymentLinkDraft(): PaymentLinkDraft {
  return {
    invoiceId: "",
    amount: "",
    email: "",
    description: "",
    callbackUrl: "",
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
  const [feePlanApplicationDraft, setFeePlanApplicationDraft] = useState<FeePlanApplicationDraft>(initialFeePlanApplicationDraft());
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(initialInvoiceDraft());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(initialPaymentDraft());
  const [billingSettingsDraft, setBillingSettingsDraft] = useState<BillingSettingsDraft>(initialBillingSettingsDraft());
  const [billingSettingsLoaded, setBillingSettingsLoaded] = useState(false);
  const [paymentLinkDraft, setPaymentLinkDraft] = useState<PaymentLinkDraft>(initialPaymentLinkDraft());
  const [paymentLinkResult, setPaymentLinkResult] = useState<PaymentLinkResult | null>(null);
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const [selectorSearch, setSelectorSearch] = useState({
    targetClasses: "",
    bulkFeePlans: "",
    bulkClasses: "",
    invoiceFeePlans: "",
    invoiceClasses: "",
    invoiceStudents: "",
    paymentInvoices: "",
    paymentLinkInvoices: "",
  });
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
  const applicationTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", feePlanApplicationDraft.sessionId)
  ) as TermOption[] | undefined;

  const saveBillingSettings = useMutation("functions/billing:upsertBillingSettings" as never);
  const createFeePlan = useMutation("functions/billing:createFeePlan" as never);
  const createInvoice = useMutation("functions/billing:createInvoiceFromFeePlan" as never);
  const applyFeePlanToClassStudents = useMutation("functions/billing:applyFeePlanToClassStudents" as never);
  const recordPayment = useMutation("functions/billing:recordManualPayment" as never);
  const createInvoicePaymentLink = useAction("functions/billing:initializeOnlinePayment" as never);

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
  const classNameById = useMemo(
    () => new Map((classes ?? []).map((classOption) => [classOption._id, classOption.name])),
    [classes]
  );
  const selectedInvoiceFeePlan = useMemo(
    () => data?.feePlans?.find((feePlan) => feePlan._id === invoiceDraft.feePlanId) ?? null,
    [data?.feePlans, invoiceDraft.feePlanId]
  );
  const selectedApplicationFeePlan = useMemo(
    () =>
      data?.feePlans?.find((feePlan) => feePlan._id === feePlanApplicationDraft.feePlanId) ?? null,
    [data?.feePlans, feePlanApplicationDraft.feePlanId]
  );
  const bulkFeePlanOptions = useMemo(
    () => (data?.feePlans ?? []).filter((feePlan) => feePlan.billingMode === "class_default"),
    [data?.feePlans]
  );
  const invoiceClassOptions = useMemo(() => {
    if (selectedInvoiceFeePlan && selectedInvoiceFeePlan.targetClassIds.length > 0) {
      return (classes ?? []).filter((classOption) =>
        selectedInvoiceFeePlan.targetClassIds.includes(classOption._id)
      );
    }

    return classes ?? [];
  }, [classes, selectedInvoiceFeePlan]);
  const applicationClassOptions = useMemo(() => {
    if (selectedApplicationFeePlan && selectedApplicationFeePlan.targetClassIds.length > 0) {
      return (classes ?? []).filter((classOption) =>
        selectedApplicationFeePlan.targetClassIds.includes(classOption._id)
      );
    }

    return classes ?? [];
  }, [classes, selectedApplicationFeePlan]);
  const visibleTargetClasses = useMemo(
    () =>
      (classes ?? []).filter((classOption) =>
        matchesSearch(selectorSearch.targetClasses, [classOption.name])
      ),
    [classes, selectorSearch.targetClasses]
  );
  const visibleBulkFeePlanOptions = useMemo(
    () =>
      bulkFeePlanOptions.filter((feePlan) =>
        matchesSearch(selectorSearch.bulkFeePlans, [feePlan.name, feePlan.description])
      ),
    [bulkFeePlanOptions, selectorSearch.bulkFeePlans]
  );
  const visibleApplicationClassOptions = useMemo(
    () =>
      applicationClassOptions.filter((classOption) =>
        matchesSearch(selectorSearch.bulkClasses, [classOption.name])
      ),
    [applicationClassOptions, selectorSearch.bulkClasses]
  );
  const visibleInvoiceFeePlanOptions = useMemo(
    () =>
      (data?.feePlans ?? []).filter((feePlan) =>
        matchesSearch(selectorSearch.invoiceFeePlans, [feePlan.name, feePlan.description])
      ),
    [data?.feePlans, selectorSearch.invoiceFeePlans]
  );
  const visibleInvoiceClassOptions = useMemo(
    () =>
      invoiceClassOptions.filter((classOption) =>
        matchesSearch(selectorSearch.invoiceClasses, [classOption.name])
      ),
    [invoiceClassOptions, selectorSearch.invoiceClasses]
  );
  const visibleInvoiceStudents = useMemo(
    () =>
      (invoiceStudents ?? []).filter((student) =>
        matchesSearch(selectorSearch.invoiceStudents, [student.studentName, student.admissionNumber])
      ),
    [invoiceStudents, selectorSearch.invoiceStudents]
  );
  const visiblePaymentInvoices = useMemo(
    () =>
      (data?.invoices ?? [])
        .filter(
          (row) => row.invoice.balanceDue > 0 && row.invoice.status !== "paid" && row.invoice.status !== "waived"
        )
        .filter((row) =>
          matchesSearch(selectorSearch.paymentInvoices, [
            row.invoice.invoiceNumber,
            row.studentName,
            row.className,
            row.invoice.feePlanNameSnapshot,
          ])
        ),
    [data?.invoices, selectorSearch.paymentInvoices]
  );
  const visiblePaymentLinkInvoices = useMemo(
    () =>
      (data?.invoices ?? [])
        .filter(
          (row) => row.invoice.balanceDue > 0 && row.invoice.status !== "paid" && row.invoice.status !== "waived"
        )
        .filter((row) =>
          matchesSearch(selectorSearch.paymentLinkInvoices, [
            row.invoice.invoiceNumber,
            row.studentName,
            row.className,
            row.invoice.feePlanNameSnapshot,
          ])
        ),
    [data?.invoices, selectorSearch.paymentLinkInvoices]
  );
  const selectedPaymentInvoice = useMemo(
    () => data?.invoices.find((row) => row.invoice._id === paymentDraft.invoiceId) ?? null,
    [data?.invoices, paymentDraft.invoiceId]
  );
  const paymentRowById = useMemo(
    () => new Map((data?.payments ?? []).map((row) => [row.payment._id, row])),
    [data?.payments]
  );
  const selectedPaymentLinkInvoice = useMemo(
    () => data?.invoices.find((row) => row.invoice._id === paymentLinkDraft.invoiceId) ?? null,
    [data?.invoices, paymentLinkDraft.invoiceId]
  );

  useEffect(() => {
    if (selectedInvoiceFeePlan && selectedInvoiceFeePlan.targetClassIds.length > 0) {
      const allowedClassId = selectedInvoiceFeePlan.targetClassIds.includes(invoiceDraft.classId)
        ? invoiceDraft.classId
        : selectedInvoiceFeePlan.targetClassIds[0] ?? "";
      if (allowedClassId !== invoiceDraft.classId) {
        setInvoiceDraft((current) => ({ ...current, classId: allowedClassId, studentId: "" }));
      }
    }
  }, [invoiceDraft.classId, selectedInvoiceFeePlan]);

  useEffect(() => {
    if (selectedApplicationFeePlan && selectedApplicationFeePlan.targetClassIds.length > 0) {
      const allowedClassId = selectedApplicationFeePlan.targetClassIds.includes(
        feePlanApplicationDraft.classId
      )
        ? feePlanApplicationDraft.classId
        : selectedApplicationFeePlan.targetClassIds[0] ?? "";
      if (allowedClassId !== feePlanApplicationDraft.classId) {
        setFeePlanApplicationDraft((current) => ({ ...current, classId: allowedClassId }));
      }
    }
  }, [feePlanApplicationDraft.classId, selectedApplicationFeePlan]);

  useEffect(() => {
    if (!data || billingSettingsLoaded) {
      return;
    }

    setBillingSettingsDraft(buildBillingSettingsDraft(data.settings, data.school.slug));
    setBillingSettingsLoaded(true);
  }, [billingSettingsLoaded, data]);

  useEffect(() => {
    setPaymentLinkDraft((current) => {
      if (current.callbackUrl) {
        return current;
      }

      if (typeof window === "undefined") {
        return current;
      }

      return {
        ...current,
        callbackUrl: `${window.location.origin}/payments/paystack/return`,
      };
    });
  }, []);

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

  const toggleFeePlanTargetClass = (classId: string) => {
    setFeePlanDraft((current) => ({
      ...current,
      targetClassIds: current.targetClassIds.includes(classId)
        ? current.targetClassIds.filter((targetClassId) => targetClassId !== classId)
        : [...current.targetClassIds, classId],
    }));
  };

  const setFeePlanBillingMode = (billingMode: FeePlanDraft["billingMode"]) => {
    setFeePlanDraft((current) => ({
      ...current,
      billingMode,
      targetClassIds: billingMode === "manual_extra" ? [] : current.targetClassIds,
    }));
  };

  const selectPaymentLinkInvoice = (invoiceId: string) => {
    const nextInvoice = data?.invoices.find((row) => row.invoice._id === invoiceId) ?? null;
    setPaymentLinkDraft((current) => ({
      ...current,
      invoiceId,
      amount: nextInvoice ? String(nextInvoice.invoice.balanceDue) : "",
      description: nextInvoice
        ? `Invoice ${nextInvoice.invoice.invoiceNumber} · ${nextInvoice.studentName}`
        : "",
    }));
    setPaymentLinkResult(null);
    setPaymentLinkCopied(false);
  };

  const handleSaveBillingSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      const defaultDueDays = Number(billingSettingsDraft.defaultDueDays);
      if (!Number.isFinite(defaultDueDays) || defaultDueDays < 1) {
        throw new Error("Enter a valid default due-day value.");
      }

      const updatedSettings = (await saveBillingSettings({
        invoicePrefix: billingSettingsDraft.invoicePrefix,
        defaultCurrency: billingSettingsDraft.defaultCurrency,
        defaultDueDays,
        allowManualPayments: billingSettingsDraft.allowManualPayments,
        allowOnlinePayments: billingSettingsDraft.allowOnlinePayments,
      } as never)) as {
        invoicePrefix: string;
        defaultCurrency: string;
        defaultDueDays: number;
        allowManualPayments: boolean;
        allowOnlinePayments: boolean;
      };

      setBillingSettingsDraft({
        invoicePrefix: updatedSettings.invoicePrefix,
        defaultCurrency: updatedSettings.defaultCurrency,
        defaultDueDays: String(updatedSettings.defaultDueDays),
        allowManualPayments: updatedSettings.allowManualPayments,
        allowOnlinePayments: updatedSettings.allowOnlinePayments,
      });
    }, "Billing settings saved", "Unable to save billing settings.");
  };

  const handleGeneratePaymentLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    try {
      const billingData = data;
      if (!billingData) {
        throw new Error("Billing data is still loading.");
      }

      if (!billingData.settings?.allowOnlinePayments) {
        throw new Error("Enable online payments in billing settings before generating a payment link.");
      }

      if (!paymentLinkDraft.invoiceId) {
        throw new Error("Select an invoice first.");
      }

      const selectedInvoice = selectedPaymentLinkInvoice;
      if (!selectedInvoice) {
        throw new Error("Select a valid invoice for the payment link.");
      }

      const amount = Number(paymentLinkDraft.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid payment amount greater than zero.");
      }
      if (amount > selectedInvoice.invoice.balanceDue) {
        throw new Error(
          `Payment link amount cannot exceed the outstanding balance of ${formatMoney(
            selectedInvoice.invoice.balanceDue,
            selectedInvoice.invoice.currency
          )}.`
        );
      }
      if (!paymentLinkDraft.email.trim()) {
        throw new Error("Enter the payer email before generating the payment link.");
      }

      const result = (await createInvoicePaymentLink({
        schoolId: billingData.school.id,
        invoiceId: selectedInvoice.invoice._id,
        amount,
        email: paymentLinkDraft.email,
        description: paymentLinkDraft.description || `Invoice ${selectedInvoice.invoice.invoiceNumber} · ${selectedInvoice.studentName}`,
        callbackUrl: paymentLinkDraft.callbackUrl || undefined,
      } as never)) as PaymentLinkResult;

      setPaymentLinkResult(result);
      setPaymentLinkCopied(false);
      setNotice({
        tone: "success",
        title: "Payment link generated",
        message: "Copy the URL or open it on a device at the front desk.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Payment link generation failed",
        message: getUserFacingErrorMessage(error, "Unable to generate the payment link."),
      });
    }
  };

  const handleCopyPaymentLink = async () => {
    if (!paymentLinkResult?.authorizationUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(paymentLinkResult.authorizationUrl);
      setPaymentLinkCopied(true);
      setNotice({
        tone: "success",
        title: "Payment link copied",
        message: "The front-desk handoff URL is now on the clipboard.",
      });
    } catch {
      setNotice({
        tone: "error",
        title: "Unable to copy link",
        message: "Copy the URL manually if clipboard access is blocked.",
      });
    }
  };

  const handleCreateFeePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      await createFeePlan({
        name: feePlanDraft.name,
        description: feePlanDraft.description || undefined,
        currency: feePlanDraft.currency || undefined,
        billingMode: feePlanDraft.billingMode,
        targetClassIds:
          feePlanDraft.billingMode === "class_default"
            ? feePlanDraft.targetClassIds.map((classId) => classId as never)
            : undefined,
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
      if (!invoiceDraft.feePlanId) {
        throw new Error("Select a fee plan before generating an invoice.");
      }
      if (!invoiceDraft.classId) {
        throw new Error("Select a class before generating an invoice.");
      }
      if (!invoiceDraft.sessionId || !invoiceDraft.termId) {
        throw new Error("Select both session and term before generating an invoice.");
      }
      if (!invoiceDraft.studentId) {
        throw new Error("Select a student before generating an invoice.");
      }

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

  const handleApplyFeePlanToClassStudents = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      if (!feePlanApplicationDraft.feePlanId) {
        throw new Error("Select a fee plan before applying it to a class.");
      }
      if (!feePlanApplicationDraft.classId) {
        throw new Error("Select a class before applying the fee plan.");
      }
      if (!feePlanApplicationDraft.sessionId || !feePlanApplicationDraft.termId) {
        throw new Error("Select both session and term before applying the fee plan.");
      }

      await applyFeePlanToClassStudents({
        feePlanId: feePlanApplicationDraft.feePlanId,
        classId: feePlanApplicationDraft.classId,
        sessionId: feePlanApplicationDraft.sessionId,
        termId: feePlanApplicationDraft.termId,
        notes: feePlanApplicationDraft.notes || undefined,
      } as never);
      setFeePlanApplicationDraft(initialFeePlanApplicationDraft());
    }, "Fee plan applied", "Unable to apply the fee plan to the selected class.");
  };

  const handleRecordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(async () => {
      const amountReceived = Number(paymentDraft.amountReceived);
      if (!Number.isFinite(amountReceived) || amountReceived <= 0) {
        throw new Error("Enter a valid payment amount greater than zero.");
      }

      if (
        selectedPaymentInvoice &&
        amountReceived > selectedPaymentInvoice.invoice.balanceDue
      ) {
        throw new Error(
          `Amount exceeds the outstanding balance of ${formatMoney(
            selectedPaymentInvoice.invoice.balanceDue,
            selectedPaymentInvoice.invoice.currency
          )}.`
        );
      }

      await recordPayment({
        invoiceId: paymentDraft.invoiceId,
        reference: paymentDraft.reference,
        amountReceived,
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

  const canApplyFeePlan = Boolean(
    feePlanApplicationDraft.feePlanId &&
      feePlanApplicationDraft.classId &&
      feePlanApplicationDraft.sessionId &&
      feePlanApplicationDraft.termId
  );
  const canCreateInvoice = Boolean(
    invoiceDraft.feePlanId &&
      invoiceDraft.classId &&
      invoiceDraft.sessionId &&
      invoiceDraft.termId &&
      invoiceDraft.studentId
  );
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

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">School payment setup</h3>
              <p className="text-sm text-slate-500">
                Configure school-scoped billing defaults and enable Paystack-backed online payments.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Direct-to-school
            </div>
          </div>

          <form onSubmit={handleSaveBillingSettings} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Invoice prefix</span>
                <input
                  value={billingSettingsDraft.invoicePrefix}
                  onChange={(event) =>
                    setBillingSettingsDraft((current) => ({ ...current, invoicePrefix: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder={data.school.slug.toUpperCase()}
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Default currency</span>
                <input
                  value={billingSettingsDraft.defaultCurrency}
                  onChange={(event) =>
                    setBillingSettingsDraft((current) => ({ ...current, defaultCurrency: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="NGN"
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Default due days</span>
                <input
                  type="number"
                  min="1"
                  value={billingSettingsDraft.defaultDueDays}
                  onChange={(event) =>
                    setBillingSettingsDraft((current) => ({ ...current, defaultDueDays: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Payment toggles</p>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={billingSettingsDraft.allowManualPayments}
                    onChange={(event) =>
                      setBillingSettingsDraft((current) => ({ ...current, allowManualPayments: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Allow manual cash or bank receipts</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={billingSettingsDraft.allowOnlinePayments}
                    onChange={(event) =>
                      setBillingSettingsDraft((current) => ({ ...current, allowOnlinePayments: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>Allow Paystack online payment links</span>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-sky-900">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                Routing model
              </div>
              <p className="mt-2 leading-6 text-sky-900/85">
                This workspace uses a constrained direct-to-school Paystack flow. The Paystack secret is
                configured at the deployment level, while schoolId and invoice metadata are embedded in the
                transaction so webhook reconciliation comes back to the correct school invoice.
                School billing is kept separate from future platform SaaS billing.
              </p>
            </div>

            <button type="submit" className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold">
              <Settings2 className="h-4 w-4" /> Save billing settings
            </button>
          </form>
        </AdminSurface>

        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Front-desk Paystack handoff</h3>
              <p className="text-sm text-slate-500">
                Generate a shareable payment URL for an invoice, then copy it or open it on a cashier device. Callback verification is handled programmatically, with webhook delivery as a backup.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {data.summary.gatewayEventCount} gateway events
            </div>
          </div>

          <form onSubmit={handleGeneratePaymentLink} className="space-y-4">
            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Invoice</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={selectorSearch.paymentLinkInvoices}
                  onChange={(event) =>
                    setSelectorSearch((current) => ({ ...current, paymentLinkInvoices: event.target.value }))
                  }
                  placeholder="Search invoice number, student, class, or fee plan"
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                />
              </div>
              <select
                value={paymentLinkDraft.invoiceId}
                onChange={(event) => selectPaymentLinkInvoice(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select invoice</option>
                {visiblePaymentLinkInvoices.map((row) => (
                  <option key={row.invoice._id} value={row.invoice._id}>
                    {row.invoice.invoiceNumber} - {row.studentName}
                  </option>
                ))}
              </select>
              {selectedPaymentLinkInvoice ? (
                <p className="text-xs text-slate-500">
                  Outstanding balance: {formatMoney(
                    selectedPaymentLinkInvoice.invoice.balanceDue,
                    selectedPaymentLinkInvoice.invoice.currency
                  )}
                </p>
              ) : null}
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Payer email</span>
                <input
                  value={paymentLinkDraft.email}
                  onChange={(event) =>
                    setPaymentLinkDraft((current) => ({ ...current, email: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="parent@example.com"
                />
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Amount</span>
                <input
                  type="number"
                  min="0"
                  max={selectedPaymentLinkInvoice ? selectedPaymentLinkInvoice.invoice.balanceDue : undefined}
                  value={paymentLinkDraft.amount}
                  onChange={(event) =>
                    setPaymentLinkDraft((current) => ({ ...current, amount: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Description</span>
              <input
                value={paymentLinkDraft.description}
                onChange={(event) =>
                  setPaymentLinkDraft((current) => ({ ...current, description: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Invoice payment for front-desk handoff"
              />
            </label>

            <label className="space-y-1 text-sm block">
              <span className="font-medium text-slate-600">Return URL</span>
              <input
                value={paymentLinkDraft.callbackUrl}
                onChange={(event) =>
                  setPaymentLinkDraft((current) => ({ ...current, callbackUrl: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Public payment return page"
              />
              <p className="text-xs text-slate-500">
                This defaults to the public Paystack return page, which verifies the payment automatically on the payer&apos;s device.
              </p>
            </label>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <QrCode className="h-4 w-4" /> QR-ready handoff
              </div>
              <p className="mt-2 leading-6">
                Generate the link here, then print it as a QR code or share it as a URL. The parent can
                pay on their own phone without leaving the front desk.
              </p>
            </div>

            <button
              type="submit"
              disabled={!data.settings?.allowOnlinePayments || !paymentLinkDraft.invoiceId}
              className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" /> Generate payment link
            </button>
          </form>

          {paymentLinkResult && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    Generated link
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">{paymentLinkResult.reference}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {paymentLinkResult.provider}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white bg-white p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      Authorization URL
                    </p>
                    <p className="mt-2 break-all text-slate-700">
                      {paymentLinkResult.authorizationUrl ?? "No checkout URL was returned."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleCopyPaymentLink}
                      disabled={!paymentLinkResult.authorizationUrl}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {paymentLinkCopied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        paymentLinkResult.authorizationUrl &&
                        window.open(paymentLinkResult.authorizationUrl, "_blank", "noopener,noreferrer")
                      }
                      disabled={!paymentLinkResult.authorizationUrl}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
                <div className="rounded-xl bg-white px-3 py-2 text-slate-600">
                  <span className="block font-semibold uppercase tracking-[0.15em] text-slate-400">Amount</span>
                  <span className="mt-1 block text-sm text-slate-900">
                    {selectedPaymentLinkInvoice
                      ? formatMoney(
                          Number(paymentLinkDraft.amount || 0),
                          selectedPaymentLinkInvoice.invoice.currency
                        )
                      : "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-slate-600">
                  <span className="block font-semibold uppercase tracking-[0.15em] text-slate-400">Invoice</span>
                  <span className="mt-1 block text-sm text-slate-900">
                    {selectedPaymentLinkInvoice?.invoice.invoiceNumber ?? "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-slate-600">
                  <span className="block font-semibold uppercase tracking-[0.15em] text-slate-400">Access code</span>
                  <span className="mt-1 block text-sm text-slate-900">
                    {paymentLinkResult.accessCode ?? "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-slate-600">
                  <span className="block font-semibold uppercase tracking-[0.15em] text-slate-400">Payload keys</span>
                  <span className="mt-1 block text-sm text-slate-900">
                    {Object.keys(paymentLinkResult.checkoutPayload ?? {}).length} fields captured
                  </span>
                </div>
              </div>

            </div>
          )}

          {!data.settings?.allowOnlinePayments && (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
              Online payments are currently disabled. Enable them in the billing settings panel above to
              generate a Paystack handoff link.
            </div>
          )}
        </AdminSurface>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Fee plans</h3>
              <p className="text-sm text-slate-500">Class-default templates, one-off extras, and installment rules.</p>
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

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Billing mode</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFeePlanBillingMode("class_default")}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      feePlanDraft.billingMode === "class_default"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span className="block font-semibold">Class default</span>
                    <span className={`block text-xs ${feePlanDraft.billingMode === "class_default" ? "text-slate-200" : "text-slate-500"}`}>
                      Auto-apply to chosen classes for a session/term.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeePlanBillingMode("manual_extra")}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                      feePlanDraft.billingMode === "manual_extra"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span className="block font-semibold">Manual extra</span>
                    <span className={`block text-xs ${feePlanDraft.billingMode === "manual_extra" ? "text-slate-200" : "text-slate-500"}`}>
                      Use for one-off student charges like books or sportswear.
                    </span>
                  </button>
                </div>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Target classes</p>
                  <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                    {feePlanDraft.targetClassIds.length} selected
                  </span>
                </div>
                {feePlanDraft.billingMode === "manual_extra" ? (
                  <p className="text-sm text-slate-500">
                    Manual extra plans are not assigned to a class. Use them in the one-off invoice flow.
                  </p>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={selectorSearch.targetClasses}
                        onChange={(event) =>
                          setSelectorSearch((current) => ({ ...current, targetClasses: event.target.value }))
                        }
                        placeholder="Search classes"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                      />
                    </div>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                      {visibleTargetClasses.map((classOption) => (
                        <label key={classOption._id} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={feePlanDraft.targetClassIds.includes(classOption._id)}
                            onChange={() => toggleFeePlanTargetClass(classOption._id)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          <span>{classOption.name}</span>
                        </label>
                      ))}
                      {visibleTargetClasses.length === 0 && (
                        <p className="text-sm text-slate-500">No classes match this search yet.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

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
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950">{feePlan.name}</p>
                    <p className="text-xs text-slate-500">{feePlan.description ?? "No description"}</p>
                    <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                      <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">
                        {feePlan.billingMode === "manual_extra" ? "Manual extra" : "Class default"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${feePlan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {feePlan.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {feePlan.lineItems.length} line item{feePlan.lineItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  <span>{feePlan.currency}</span>
                  <span>Installments: {feePlan.installmentPolicy.enabled ? feePlan.installmentPolicy.installmentCount : 1}</span>
                  <span>
                    {feePlan.targetClassIds.length > 0
                      ? `${feePlan.targetClassIds.length} target class${feePlan.targetClassIds.length === 1 ? "" : "es"}`
                      : feePlan.billingMode === "manual_extra"
                        ? "One-off extra only"
                        : "Legacy / school-wide"}
                  </span>
                </div>
                {feePlan.targetClassIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {feePlan.targetClassIds.map((classId) => (
                      <span key={classId} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {classNameById.get(classId) ?? "Unknown class"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-slate-950">Bulk fee-plan application</h4>
                <p className="text-sm text-slate-500">
                  Apply a class-default fee plan to all active students in a class for a session and term.
                  Existing invoices for the same student, plan, session, and term are skipped.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {data.summary.feePlanApplicationCount} runs
              </div>
            </div>

            <form onSubmit={handleApplyFeePlanToClassStudents} className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm block">
                  <span className="font-medium text-slate-600">Fee plan</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={selectorSearch.bulkFeePlans}
                      onChange={(event) =>
                        setSelectorSearch((current) => ({ ...current, bulkFeePlans: event.target.value }))
                      }
                      placeholder="Search fee plans"
                      className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                    />
                  </div>
                  <select
                    value={feePlanApplicationDraft.feePlanId}
                    onChange={(event) =>
                      setFeePlanApplicationDraft((current) => ({ ...current, feePlanId: event.target.value, classId: "" }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <option value="">Select a class-default plan</option>
                    {visibleBulkFeePlanOptions.map((feePlan) => (
                      <option key={feePlan._id} value={feePlan._id}>
                        {feePlan.name}
                        {feePlan.targetClassIds.length > 0 ? ` · ${feePlan.targetClassIds.length} class target${feePlan.targetClassIds.length === 1 ? "" : "s"}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm block">
                  <span className="font-medium text-slate-600">Class</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={selectorSearch.bulkClasses}
                      onChange={(event) =>
                        setSelectorSearch((current) => ({ ...current, bulkClasses: event.target.value }))
                      }
                      placeholder="Search classes"
                      className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                    />
                  </div>
                  <select
                    value={feePlanApplicationDraft.classId}
                    onChange={(event) =>
                      setFeePlanApplicationDraft((current) => ({ ...current, classId: event.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <option value="">Select class</option>
                    {visibleApplicationClassOptions.map((classOption) => (
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
                    value={feePlanApplicationDraft.sessionId}
                    onChange={(event) =>
                      setFeePlanApplicationDraft((current) => ({
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
                    value={feePlanApplicationDraft.termId}
                    onChange={(event) => setFeePlanApplicationDraft((current) => ({ ...current, termId: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <option value="">Select term</option>
                    {applicationTerms?.map((term) => (
                      <option key={term._id} value={term._id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="font-medium text-slate-600">Notes</span>
                <textarea
                  value={feePlanApplicationDraft.notes}
                  onChange={(event) => setFeePlanApplicationDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="Optional note for the application run"
                />
              </label>

              <button
                type="submit"
                disabled={!canApplyFeePlan}
                className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ReceiptText className="h-4 w-4" /> Apply fee plan
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h5 className="text-sm font-semibold text-slate-900">Recent applications</h5>
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Auditable runs</span>
              </div>
              <div className="space-y-3">
                {data.applications.map((entry) => (
                  <div key={entry.application._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{entry.feePlanName}</p>
                        <p className="text-xs text-slate-500">
                          {entry.className} · {entry.sessionName} · {entry.termName}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                          {entry.application.createdInvoiceCount} created · {entry.application.skippedInvoiceCount} skipped
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {entry.application.studentCount} students
                      </div>
                    </div>
                    {entry.application.notes ? (
                      <p className="mt-2 text-xs text-slate-500">{entry.application.notes}</p>
                    ) : null}
                  </div>
                ))}
                {data.applications.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                    No fee-plan application runs yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface className="p-4 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-slate-950">One-off student extra invoice</h3>
              <p className="text-sm text-slate-500">Use this for student-specific charges like books, sportswear, or levies.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {data.summary.paymentCount} payments
            </div>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Fee plan</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={selectorSearch.invoiceFeePlans}
                    onChange={(event) =>
                      setSelectorSearch((current) => ({ ...current, invoiceFeePlans: event.target.value }))
                    }
                    placeholder="Search fee plans"
                    className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                  />
                </div>
                <select
                  value={invoiceDraft.feePlanId}
                  onChange={(event) => setInvoiceDraft((current) => ({ ...current, feePlanId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <option value="">Select a fee plan</option>
                  {visibleInvoiceFeePlanOptions.map((feePlan) => (
                    <option key={feePlan._id} value={feePlan._id}>
                      {feePlan.name} · {feePlan.billingMode === "manual_extra" ? "Manual extra" : "Class default"}
                    </option>
                  ))}
                </select>
                {selectedInvoiceFeePlan && selectedInvoiceFeePlan.billingMode === "class_default" && (
                  <p className="text-xs text-slate-500">
                    This plan is class-targeted. For class-wide billing, use the bulk application flow below.
                  </p>
                )}
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">Class</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={selectorSearch.invoiceClasses}
                    onChange={(event) =>
                      setSelectorSearch((current) => ({ ...current, invoiceClasses: event.target.value }))
                    }
                    placeholder="Search classes"
                    className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                  />
                </div>
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
                  {visibleInvoiceClassOptions.map((classOption) => (
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
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={selectorSearch.invoiceStudents}
                  onChange={(event) =>
                    setSelectorSearch((current) => ({ ...current, invoiceStudents: event.target.value }))
                  }
                  placeholder="Search student name or admission number"
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                />
              </div>
              <select
                value={invoiceDraft.studentId}
                onChange={(event) => setInvoiceDraft((current) => ({ ...current, studentId: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select student</option>
                {visibleInvoiceStudents.map((student) => (
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

            <button
              type="submit"
              disabled={!canCreateInvoice}
              className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
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
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                      {row.invoice.feePlanApplicationId ? "Bulk application" : "One-off invoice"}
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
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={selectorSearch.paymentInvoices}
                  onChange={(event) =>
                    setSelectorSearch((current) => ({ ...current, paymentInvoices: event.target.value }))
                  }
                  placeholder="Search invoice number, student, class, or fee plan"
                  className="mb-2 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm"
                />
              </div>
              <select
                value={paymentDraft.invoiceId}
                onChange={(event) => {
                  const nextInvoiceId = event.target.value;
                  const nextInvoice = visiblePaymentInvoices.find(
                    (row) => row.invoice._id === nextInvoiceId
                  );
                  setPaymentDraft((current) => ({
                    ...current,
                    invoiceId: nextInvoiceId,
                    amountReceived: nextInvoice
                      ? String(nextInvoice.invoice.balanceDue)
                      : "",
                  }));
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <option value="">Select invoice</option>
                {visiblePaymentInvoices.map((row) => (
                  <option key={row.invoice._id} value={row.invoice._id}>
                    {row.invoice.invoiceNumber} - {row.studentName}
                  </option>
                ))}
              </select>
              {selectedPaymentInvoice ? (
                <p className="text-xs text-slate-500">
                  Outstanding balance: {formatMoney(
                    selectedPaymentInvoice.invoice.balanceDue,
                    selectedPaymentInvoice.invoice.currency
                  )}
                </p>
              ) : null}
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
                  max={selectedPaymentInvoice ? selectedPaymentInvoice.invoice.balanceDue : undefined}
                  value={paymentDraft.amountReceived}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, amountReceived: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                />
                {selectedPaymentInvoice ? (
                  <p className="text-xs text-slate-500">
                    Cannot exceed {formatMoney(
                      selectedPaymentInvoice.invoice.balanceDue,
                      selectedPaymentInvoice.invoice.currency
                    )} for this invoice.
                  </p>
                ) : null}
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

            <button
              type="submit"
              disabled={!paymentDraft.invoiceId}
              className="button-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
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
            {data.gatewayEvents.map((event) => {
              const linkedPayment = event.paymentId ? paymentRowById.get(event.paymentId) ?? null : null;

              return (
                <div key={event._id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">{event.eventType}</p>
                      <p className="text-xs text-slate-500">{event.reference}{event.invoiceNumber ? ` · ${event.invoiceNumber}` : ""}</p>
                      {linkedPayment ? (
                        <p className="mt-2 text-xs font-semibold text-slate-700">
                          Paid: {formatMoney(linkedPayment.payment.amountApplied, summaryCurrency)}
                          <span className="font-normal text-slate-500">{` · ${linkedPayment.studentName}`}</span>
                        </p>
                      ) : null}
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
              );
            })}
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
