"use client";

import { AdminSheet } from "@/components/ui/AdminSheet";
import { AdminSurface } from "@/components/ui/AdminSurface";
import {
Filter,
Link2,
Plus,
Search,
X,
} from "lucide-react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { appToast } from "@school/shared/toast";
import { useQuery } from "convex/react";
import { useEffect,useMemo,useState } from "react";
import { useDirtyForm } from "@school/shared/drafts";
import { feePlanSignature, feePlanValidation } from "./fee-plan-validation";

// Local Components
import { BillingHeader } from "./components/BillingHeader";
import { BillingSidebar } from "./components/BillingSidebar";
import { BillingTabs,type BillingTab } from "./components/BillingTabs";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { FeePlanList } from "./components/FeePlanList";
import { InvoiceTable } from "./components/InvoiceTable";
import { PaymentTable } from "./components/PaymentTable";
import { PrintableFinanceModal } from "./components/PrintableFinanceModal";
import { SettingsPanel } from "./components/SettingsPanel";

// Hooks & Utils
import { useBillingActions } from "./hooks/useBillingActions";
import { useBillingData } from "./hooks/useBillingData";
import { useBillingSortPreferences } from "./hooks/useBillingSortPreferences";
import type {
BillingSettingsDraft,
DashboardFilters,
FeePlanApplicationDraft,
FeePlanDraft,
FeePlanSortKey,
InvoiceDraft,
InvoiceSortKey,
PaymentDraft,
PaymentLinkDraft,
PaymentLinkResult,
PaymentSortKey,
PaystackGatewayConfigDraft
} from "./types";
import {
buildBillingSettingsDraft,
initialBillingSettingsDraft,
initialFeePlanApplicationDraft,
initialFeePlanDraft,
initialInvoiceDraft,
initialPaymentDraft,
initialPaymentLinkDraft,
initialPaystackGatewayConfigDraft,
sortFeePlans,
sortInvoiceRows,
sortPaymentRows,
toggleSortDirection
} from "./utils";

type PaymentLinkActionResult = {
  provider?: string;
  reference?: string;
  authorizationUrl?: string | null;
  authorization_url?: string | null;
  accessCode?: string | null;
  access_code?: string | null;
  checkoutPayload?: Record<string, unknown>;
  checkout_payload?: Record<string, unknown>;
};

export default function BillingPage() {
  // 1. State Management
  const [activeTab, setActiveTab] = useState<BillingTab>("overview");
  const [filters, setFilters] = useState<DashboardFilters>({
    classId: "",
    sessionId: "",
    termId: "",
    status: "",
    search: "",
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVariant, setSidebarVariant] = useState<"arsenal" | "payment" | "invoice" | "application" | "link" | "plan">("payment");

  // Drafts
  const [feePlanDraft, setFeePlanDraft] = useState<FeePlanDraft>(initialFeePlanDraft());
  const [feePlanSubmitting, setFeePlanSubmitting] = useState(false);
  const [emptyFeePlanSignature] = useState(() => feePlanSignature(initialFeePlanDraft()));
  const feePlanDirty = feePlanSignature(feePlanDraft) !== emptyFeePlanSignature;
  const requestFeeDeparture = useDirtyForm({
    name: "Fee plan (not saved as a draft)",
    isDirty: feePlanDirty || feePlanSubmitting,
    discard: () => {
      if (feePlanSubmitting) throw new Error("Wait for fee-plan creation to finish before leaving.");
      setFeePlanDraft(initialFeePlanDraft());
    },
  });
  const closeFeeSidebar = async () => {
    if (await requestFeeDeparture({ kind: "close" })) setSidebarOpen(false);
  };
  const [feePlanApplicationDraft, setFeePlanApplicationDraft] = useState<FeePlanApplicationDraft>(initialFeePlanApplicationDraft());
  const [invoiceDraft] = useState<InvoiceDraft>(initialInvoiceDraft());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(initialPaymentDraft());
  const [billingSettingsDraft, setBillingSettingsDraft] = useState<BillingSettingsDraft>(initialBillingSettingsDraft());
  const [gatewayConfigDraft, setGatewayConfigDraft] = useState<PaystackGatewayConfigDraft>(initialPaystackGatewayConfigDraft());
  const [paymentLinkDraft, setPaymentLinkDraft] = useState<PaymentLinkDraft>(initialPaymentLinkDraft());
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<PaymentLinkResult | null>(null);
  const [selectedGatewayMode, setSelectedGatewayMode] = useState<"test" | "live">("test");
  const [financePack, setFinancePack] = useState<{ mode: "invoice" | "statement"; invoiceId: string } | null>(null);
  const [financePackPaymentEmail, setFinancePackPaymentEmail] = useState("");
  const [financePackPaymentLinks, setFinancePackPaymentLinks] = useState<Record<string, PaymentLinkResult>>({});
  const [isGeneratingFinancePackPaymentLink, setIsGeneratingFinancePackPaymentLink] = useState(false);

  const sidebarTitles: Record<string, string> = {
    arsenal: "Financial Hub",
    payment: "Record Receipt",
    invoice: "Generate Invoice",
    application: "Bulk Distribution",
    link: "Payment Handoff",
    plan: "New Fee Plan",
  };

  const showNotice = (notice: { tone: "success" | "error"; title: string; message: string }) => {
    if (notice.tone === "success") {
      appToast.success(notice.title, { description: notice.message });
      return;
    }

    appToast.error(notice.title, { description: notice.message });
  };

  // 2. Data & Actions
  const { 
    data, 
    classes, 
    sessions, 
    classNameById, 
    applicationTerms 
  } = useBillingData(filters, invoiceDraft, feePlanApplicationDraft);
  const selectedFinanceInvoice = useMemo(
    () => data?.invoices.find((row) => row.invoice._id === financePack?.invoiceId) ?? null,
    [data?.invoices, financePack?.invoiceId]
  );
  const financePackReusableAttempts = useQuery(
    api.functions.billing.listBillingPaymentAttemptsForInvoice,
    selectedFinanceInvoice
      ? {
          invoiceId: selectedFinanceInvoice.invoice._id as Id<"studentInvoices">,
          statuses: ["link_generated", "awaiting_payer_return"],
        }
      : "skip"
  ) as NonNullable<typeof data>["paymentAttempts"] | undefined;
  const actions = useBillingActions();
  const { sortPreferences, setSortPreferences } = useBillingSortPreferences();

  const sortedInvoices = useMemo(
    () => sortInvoiceRows(data?.invoices ?? [], sortPreferences.invoices),
    [data?.invoices, sortPreferences.invoices]
  );
  const sortedPayments = useMemo(
    () => sortPaymentRows(data?.payments ?? [], sortPreferences.payments),
    [data?.payments, sortPreferences.payments]
  );
  const sortedFeePlans = useMemo(
    () => sortFeePlans(data?.feePlans ?? [], sortPreferences.plans),
    [data?.feePlans, sortPreferences.plans]
  );
  const overviewInvoices = useMemo(
    () => sortInvoiceRows(data?.invoices ?? [], { key: "date", direction: "desc" }).filter((invoiceRow) => invoiceRow.invoice.status !== "paid").slice(0, 5),
    [data?.invoices]
  );
  const overviewPayments = useMemo(
    () => sortPaymentRows(data?.payments ?? [], { key: "date", direction: "desc" }).slice(0, 5),
    [data?.payments]
  );
  const selectedStudentBilling = useQuery(
    api.functions.billing.listStudentInvoicesAndPayments,
    selectedFinanceInvoice
      ? { studentId: selectedFinanceInvoice.invoice.studentId as Id<"students"> }
      : "skip"
  ) as { invoices: NonNullable<typeof data>["invoices"]; payments: NonNullable<typeof data>["payments"] } | undefined;
  const selectedStudentInvoices = selectedStudentBilling?.invoices ?? [];
  const selectedStudentPayments = selectedStudentBilling?.payments ?? [];
  const selectedInvoiceLatestPaymentAttempt = useMemo(() => {
    if (!selectedFinanceInvoice || selectedFinanceInvoice.invoice.balanceDue <= 0) {
      return null;
    }

    return (financePackReusableAttempts ?? [])
      .filter((row) =>
        row.attempt.invoiceId === selectedFinanceInvoice.invoice._id &&
        row.attempt.authorizationUrl &&
        row.attempt.currency === selectedFinanceInvoice.invoice.currency &&
        Math.abs(row.attempt.amount - selectedFinanceInvoice.invoice.balanceDue) < 0.005
      )
      .sort((left, right) => right.attempt.createdAt - left.attempt.createdAt)[0] ?? null;
  }, [financePackReusableAttempts, selectedFinanceInvoice]);

  const handleInvoiceSortChange = (key: InvoiceSortKey) => {
    setSortPreferences((current) => ({
      ...current,
      invoices: toggleSortDirection(current.invoices, key, key === "date" ? "desc" : "asc"),
    }));
  };

  const handlePaymentSortChange = (key: PaymentSortKey) => {
    setSortPreferences((current) => ({
      ...current,
      payments: toggleSortDirection(current.payments, key, key === "date" || key === "settlement" ? "desc" : "asc"),
    }));
  };

  const handleFeePlanSortChange = (key: FeePlanSortKey) => {
    setSortPreferences((current) => ({
      ...current,
      plans: toggleSortDirection(current.plans, key, key === "date" || key === "amount" ? "desc" : "asc"),
    }));
  };

  // 3. Effects
  useEffect(() => {
    if (data?.settings) {
      setBillingSettingsDraft(buildBillingSettingsDraft(data.settings, data.school.slug));
      setSelectedGatewayMode(data.settings.paymentProviderMode);
    }
  }, [data?.settings, data?.school.slug]);

  // 4. Handlers
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await actions.runAction(async () => {
      await actions.recordPayment({
        invoiceId: paymentDraft.invoiceId,
        reference: paymentDraft.reference,
        amountReceived: Number(paymentDraft.amountReceived),
        paymentMethod: paymentDraft.paymentMethod,
        payerName: paymentDraft.payerName || undefined,
        payerEmail: paymentDraft.payerEmail || undefined,
        notes: paymentDraft.notes || undefined,
      } as never);
    }, "Payment Recorded", "Unable to save manual payment.");
    if (success) {
      setPaymentDraft(initialPaymentDraft());
      setSidebarOpen(false);
    }
  };

  const handleCreateFeePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feePlanSubmitting) return;
    const planName = feePlanDraft.name.trim();
    const issue = feePlanValidation(feePlanDraft);
    if (issue) {
      appToast.error(issue);
      return;
    }

    const validLineItems = feePlanDraft.lineItems.map((item) => ({
      label: item.label.trim(),
      amount: Number(item.amount),
      category: item.category,
      isOptional: Boolean(item.isOptional),
    }));

    setFeePlanSubmitting(true);
    try {
      const success = await actions.runAction(async () => {
        await actions.createFeePlan({
          bankAccountId: feePlanDraft.bankAccountId || undefined,
          name: planName,
          description: feePlanDraft.description?.trim() || undefined,
          currency: feePlanDraft.currency || "NGN",
          billingMode: feePlanDraft.billingMode,
          targetClassIds: feePlanDraft.targetClassIds.length > 0 ? feePlanDraft.targetClassIds : undefined,
          installmentPolicy: {
            enabled: feePlanDraft.installmentEnabled,
            installmentCount: feePlanDraft.installmentEnabled ? Number(feePlanDraft.installmentCount) : 1,
            intervalDays: feePlanDraft.installmentEnabled ? Number(feePlanDraft.intervalDays) : 0,
            firstDueDays: Number(feePlanDraft.firstDueDays),
          },
          lineItems: validLineItems,
        } as never);
      }, "Fee Plan Created", "Unable to create new fee plan.");
      if (success) {
        setFeePlanDraft(initialFeePlanDraft());
        setSidebarOpen(false);
      }
    } finally {
      setFeePlanSubmitting(false);
    }
  };

  const handleApplyFeePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await actions.runAction(async () => {
      await actions.applyFeePlanToClassStudents({
        bankAccountId: feePlanApplicationDraft.bankAccountId || undefined,
        feePlanId: feePlanApplicationDraft.feePlanId,
        classId: feePlanApplicationDraft.classId,
        sessionId: feePlanApplicationDraft.sessionId,
        termId: feePlanApplicationDraft.termId,
      } as never);
    }, "Invoices Generated", "Unable to distribute invoices for class.");
    if (success) {
      setFeePlanApplicationDraft(initialFeePlanApplicationDraft());
      setSidebarOpen(false);
    }
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) {
      return;
    }

    const selectedInvoice = data.invoices.find((row) => row.invoice._id === paymentLinkDraft.invoiceId);
    const fallbackDescription = selectedInvoice
      ? `Payment for ${selectedInvoice.invoice.invoiceNumber}`
      : "Front-desk invoice payment";

    const success = await actions.runAction(async () => {
      const result = await actions.createInvoicePaymentLink({
        schoolId: data.school.id,
        invoiceId: paymentLinkDraft.invoiceId,
        amount: Number(paymentLinkDraft.amount),
        email: paymentLinkDraft.email,
        description: paymentLinkDraft.description.trim() || fallbackDescription,
        callbackUrl: `${window.location.origin}/payments/paystack/return`,
      } as never) as PaymentLinkActionResult;

      setGeneratedPaymentLink({
        provider: result?.provider ?? "paystack",
        reference: result?.reference ?? "",
        authorizationUrl: result?.authorizationUrl ?? result?.authorization_url ?? null,
        accessCode: result?.accessCode ?? result?.access_code ?? null,
        checkoutPayload: result?.checkoutPayload ?? result?.checkout_payload ?? {},
        amount: Number(paymentLinkDraft.amount),
        currency: selectedInvoice?.invoice.currency,
      });
    }, "Link Generated", "Unable to initialize Paystack session.");
    if (success) {
      showNotice({
        tone: "success",
        title: "Link Generated",
        message: "Payment link is ready. Copy it or open it from the handoff panel.",
      });
    }
  };

  const handleOpenFinancePack = (mode: "invoice" | "statement", invoiceId: string) => {
    setFinancePack({ mode, invoiceId });
    setFinancePackPaymentEmail("");
  };

  const handleGenerateFinancePackPaymentLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !selectedFinanceInvoice) {
      return;
    }
    if (selectedFinanceInvoice.invoice.balanceDue <= 0) {
      showNotice({
        tone: "error",
        title: "No Balance",
        message: "This invoice has no outstanding balance to collect.",
      });
      return;
    }

    setIsGeneratingFinancePackPaymentLink(true);
    let success = false;
    try {
      success = await actions.runAction(async () => {
        const result = await actions.createInvoicePaymentLink({
        schoolId: data.school.id,
        invoiceId: selectedFinanceInvoice.invoice._id,
        amount: selectedFinanceInvoice.invoice.balanceDue,
        email: financePackPaymentEmail,
        description: `Payment for ${selectedFinanceInvoice.invoice.invoiceNumber}`,
        callbackUrl: `${window.location.origin}/payments/paystack/return`,
        } as never) as PaymentLinkActionResult;

        const nextPaymentLink: PaymentLinkResult = {
        provider: result?.provider ?? "paystack",
        reference: result?.reference ?? "",
        authorizationUrl: result?.authorizationUrl ?? result?.authorization_url ?? null,
        accessCode: result?.accessCode ?? result?.access_code ?? null,
        checkoutPayload: result?.checkoutPayload ?? result?.checkout_payload ?? {},
        amount: selectedFinanceInvoice.invoice.balanceDue,
        currency: selectedFinanceInvoice.invoice.currency,
        };

        setFinancePackPaymentLinks((current) => ({
          ...current,
          [selectedFinanceInvoice.invoice._id]: nextPaymentLink,
        }));
      }, "Payment Link Ready", "Unable to generate a payment link for this invoice.");
    } finally {
      setIsGeneratingFinancePackPaymentLink(false);
    }

    if (success) {
      setFinancePackPaymentEmail("");
    }
  };

  const handleSaveBillingSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    await actions.runAction(async () => {
      await actions.saveBillingSettings({
        ...billingSettingsDraft,
        defaultDueDays: Number(billingSettingsDraft.defaultDueDays),
      } as never);
    }, "Settings Updated", "Unable to update billing configuration.");
  };

  const handleSaveGatewayConfig = async () => {
    await actions.runAction(async () => {
      await actions.saveSchoolPaystackGatewayConfig({
        mode: selectedGatewayMode,
        publicKey: gatewayConfigDraft.publicKey.trim() || null,
        secretKey: gatewayConfigDraft.secretKey.trim() || null,
      } as never);
      setGatewayConfigDraft((c: any) => ({ ...c, secretKey: "" }));
    }, "Merchant Credentials Saved", "Unable to save Paystack API keys.");
  };

  const handleValidateGatewayConfig = async () => {
    await actions.runAction(async () => {
      await actions.validateSchoolPaystackGatewayConfig({ mode: selectedGatewayMode } as never);
    }, "Credentials Validated", "Verification failed for merchant credentials.");
  };

  const openSidebar = (variant: typeof sidebarVariant) => {
    setSidebarVariant(variant);
    if (variant !== "link") {
      setGeneratedPaymentLink(null);
    }
    // Only open the modal if we're not on desktop (lg breakpoint = 1024px)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(true);
    }
  };

  // 5. Loading State
  if (!data) return <DashboardSkeleton />;

  return (
    <main className="lg:h-[calc(100vh-56px)] lg:max-h-[calc(100dvh-56px)] lg:overflow-hidden bg-slate-50/50 flex flex-col">
      <div className="flex-1 flex lg:overflow-hidden min-h-0">
        {/* Main Content Area */}
        <section className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 lg:p-8 space-y-8">
            {/* System Notifications */}

            <BillingHeader 
              summary={data.summary} 
              currency={data.settings?.defaultCurrency ?? "NGN"} 
              onOpenArsenal={() => openSidebar("arsenal")}
            />

            <div className="flex flex-col gap-6">
              {/* Tab Navigation & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-950/5 pb-2 sticky top-0 bg-slate-50/50 backdrop-blur-md z-10">
                <BillingTabs activeTab={activeTab} onTabChange={setActiveTab} />
                
                <div className="flex items-center gap-2">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-950 transition-colors" />
                    <input 
                      type="text"
                      placeholder="Search ledger..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="h-10 pl-10 pr-4 w-full sm:w-64 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-950 focus:border-slate-950 outline-none transition-all placeholder:text-slate-300 placeholder:font-medium shadow-sm shadow-slate-950/[0.02]"
                    />
                  </div>
                  <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-950 transition-all shadow-sm shadow-slate-950/[0.02]">
                    <Filter className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tab Panels */}
              <div className="pb-20 lg:pb-8">
                {activeTab === "overview" && (
                   <div className="space-y-6">
                      <AdminSurface intensity="medium" className="p-0 overflow-hidden border-none shadow-sm shadow-slate-950/[0.02]">
                         <div className="p-6 border-b border-slate-950/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recent Collections</h3>
                            <button onClick={() => setActiveTab("payments")} className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700">View History</button>
                         </div>
                         <PaymentTable
                           payments={overviewPayments}
                           sortKey="date"
                           sortDirection="desc"
                           sortable={false}
                         />
                      </AdminSurface>

                      <AdminSurface intensity="medium" className="p-0 overflow-hidden border-none shadow-sm shadow-slate-950/[0.02]">
                         <div className="p-6 border-b border-slate-950/5 flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Open Receivables</h3>
                            <button onClick={() => setActiveTab("invoices")} className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-700">Full Ledger</button>
                         </div>
                         <InvoiceTable
                           invoices={overviewInvoices}
                           sortKey="date"
                           sortDirection="desc"
                           sortable={false}
                           onViewInvoice={(invoiceId) => handleOpenFinancePack("invoice", invoiceId)}
                           onViewStatement={(invoiceId) => handleOpenFinancePack("statement", invoiceId)}
                         />
                      </AdminSurface>
                   </div>
                )}

                {activeTab === "invoices" && (
                  <AdminSurface intensity="medium" className="p-0 overflow-hidden border-none shadow-sm shadow-slate-950/[0.02]">
                    <InvoiceTable
                      invoices={sortedInvoices}
                      sortKey={sortPreferences.invoices.key}
                      sortDirection={sortPreferences.invoices.direction}
                      onSortChange={handleInvoiceSortChange}
                      onViewInvoice={(invoiceId) => handleOpenFinancePack("invoice", invoiceId)}
                      onViewStatement={(invoiceId) => handleOpenFinancePack("statement", invoiceId)}
                    />
                  </AdminSurface>
                )}

                {activeTab === "payments" && (
                  <AdminSurface intensity="medium" className="p-0 overflow-hidden border-none shadow-sm shadow-slate-950/[0.02]">
                    <PaymentTable
                      payments={sortedPayments}
                      sortKey={sortPreferences.payments.key}
                      sortDirection={sortPreferences.payments.direction}
                      onSortChange={handlePaymentSortChange}
                    />
                  </AdminSurface>
                )}

                {activeTab === "plans" && (
                   <FeePlanList 
                     plans={sortedFeePlans} 
                     classNameById={classNameById} 
                     sortKey={sortPreferences.plans.key}
                     sortDirection={sortPreferences.plans.direction}
                     onSortChange={handleFeePlanSortChange}
                     onNewPlan={() => openSidebar("plan")}
                     onApplyPlan={(planId) => {
                       setFeePlanApplicationDraft((current) => ({
                         ...current,
                         feePlanId: planId as any,
                       }));
                       openSidebar("application");
                     }}
                   />
                )}

                {activeTab === "settings" && (
                   <SettingsPanel 
                     settingsDraft={billingSettingsDraft}
                     onSettingsChange={setBillingSettingsDraft}
                     onSaveSettings={handleSaveBillingSettings}
                     gatewayOverview={data.paymentGateway}
                     gatewayConfigDraft={gatewayConfigDraft}
                     onGatewayConfigChange={setGatewayConfigDraft}
                     onSaveGatewayConfig={handleSaveGatewayConfig}
                     onValidateGatewayConfig={handleValidateGatewayConfig}
                     selectedGatewayMode={selectedGatewayMode}
                     setSelectedGatewayMode={setSelectedGatewayMode}
                     schoolSlug={data.school.slug}
                   />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Management Sidebar (Desktop) */}
        <aside className="hidden lg:block w-[400px] border-l border-slate-950/5 relative overflow-hidden bg-white/50 backdrop-blur-sm">
          <div className="absolute inset-x-0 top-0 h-64 bg-slate-950/5 skew-y-12 -translate-y-32 pointer-events-none" />
          <div className="relative z-10 h-full flex flex-col">
            <div className="p-6 lg:p-7 border-b border-slate-950/5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Financial Arsenal
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {sidebarVariant === "plan"
                    ? "New Plan"
                    : sidebarVariant === "payment"
                      ? "Receipt"
                      : sidebarVariant === "link"
                        ? "Handoff"
                        : sidebarVariant === "application"
                          ? "Bulk Invoice"
                          : "Action Hub"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                 <button 
                   type="button"
                   onClick={() => setSidebarVariant("payment")}
                   className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                     sidebarVariant === "payment"
                       ? "bg-slate-950 text-white border-slate-950 shadow-md ring-2 ring-emerald-500/30"
                       : "bg-white border-slate-200 text-slate-950 shadow-2xs hover:border-slate-400 hover:bg-slate-50"
                   }`}
                 >
                    <div className={`p-2 rounded-xl transition-transform ${
                      sidebarVariant === "payment" ? "bg-emerald-500/20 text-emerald-300 scale-105" : "bg-emerald-50 text-emerald-600"
                    }`}>
                       <Plus className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Receipt</span>
                 </button>
                 <button 
                    type="button"
                    onClick={() => setSidebarVariant("link")}
                    className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      sidebarVariant === "link"
                        ? "bg-slate-950 text-white border-slate-950 shadow-md ring-2 ring-orange-500/30"
                        : "bg-white border-slate-200 text-slate-950 shadow-2xs hover:border-slate-400 hover:bg-slate-50"
                    }`}
                 >
                    <div className={`p-2 rounded-xl transition-transform ${
                      sidebarVariant === "link" ? "bg-orange-500/20 text-orange-300 scale-105" : "bg-orange-50 text-orange-600"
                    }`}>
                       <Link2 className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Handoff</span>
                 </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button 
                  type="button"
                  onClick={() => setSidebarVariant("application")}
                  className={`w-full flex items-center justify-center gap-1.5 h-10 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-2xs transition-all cursor-pointer ${
                    sidebarVariant === "application"
                      ? "bg-slate-950 text-white border border-slate-950 shadow-md ring-2 ring-indigo-500/30"
                      : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  Bulk Invoicing
                </button>
                <button 
                  type="button"
                  onClick={() => setSidebarVariant("plan")}
                  className={`w-full flex items-center justify-center gap-1.5 h-10 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-2xs transition-all cursor-pointer ${
                    sidebarVariant === "plan"
                      ? "bg-slate-950 text-white border border-slate-950 shadow-md ring-2 ring-indigo-500/30"
                      : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <Plus className="h-3 w-3" /> New Plan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
              <div className="absolute inset-0 bg-white/40 pointer-events-none" />
              <BillingSidebar 
                onClose={() => void closeFeeSidebar()}
                variant={sidebarVariant}
                onVariantChange={(v) => {
                  setSidebarVariant(v);
                  setSidebarOpen(false);
                }}
                paymentDraft={paymentDraft}
                onPaymentDraftChange={setPaymentDraft}
                onRecordPayment={handleRecordPayment}
                paymentLinkDraft={paymentLinkDraft}
                onPaymentLinkDraftChange={(draft) => {
                  setPaymentLinkDraft(draft);
                  setGeneratedPaymentLink(null);
                }}
                generatedPaymentLink={generatedPaymentLink}
                onGenerateLink={handleGenerateLink}
                feePlanDraft={feePlanDraft}
                onFeePlanDraftChange={setFeePlanDraft}
                onCreateFeePlan={handleCreateFeePlan}
                feePlanApplicationDraft={feePlanApplicationDraft}
                onFeePlanApplicationDraftChange={setFeePlanApplicationDraft}
                onApplyFeePlan={handleApplyFeePlan}
                invoices={data.invoices}
                selectedInvoice={data.invoices.find(i => i.invoice._id === paymentDraft.invoiceId)}
                classes={classes ?? []}
                sessions={sessions ?? []}
                applicationTerms={applicationTerms ?? []}
                feePlans={data.feePlans}
              />
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Sidebar */}
      <AdminSheet
        isOpen={sidebarOpen}
        onClose={() => void closeFeeSidebar()}
        title={sidebarTitles[sidebarVariant]}
      >
        <BillingSidebar 
          onClose={() => void closeFeeSidebar()}
          variant={sidebarVariant}
          onVariantChange={setSidebarVariant}
          paymentDraft={paymentDraft}
          onPaymentDraftChange={setPaymentDraft}
          onRecordPayment={handleRecordPayment}
          paymentLinkDraft={paymentLinkDraft}
          onPaymentLinkDraftChange={(draft) => {
            setPaymentLinkDraft(draft);
            setGeneratedPaymentLink(null);
          }}
          generatedPaymentLink={generatedPaymentLink}
          onGenerateLink={handleGenerateLink}
          feePlanDraft={feePlanDraft}
          onFeePlanDraftChange={setFeePlanDraft}
          onCreateFeePlan={handleCreateFeePlan}
          feePlanApplicationDraft={feePlanApplicationDraft}
          onFeePlanApplicationDraftChange={setFeePlanApplicationDraft}
          onApplyFeePlan={handleApplyFeePlan}
          invoices={data.invoices}
          selectedInvoice={data.invoices.find(i => i.invoice._id === paymentDraft.invoiceId)}
          classes={classes ?? []}
          sessions={sessions ?? []}
          applicationTerms={applicationTerms ?? []}
          feePlans={data.feePlans}
        />
      </AdminSheet>

      {financePack && selectedFinanceInvoice && (
        <PrintableFinanceModal
          mode={financePack.mode}
          school={data.school}
          invoice={selectedFinanceInvoice}
          studentInvoices={selectedStudentInvoices}
          studentPayments={selectedStudentPayments}
          latestPaymentAttempt={selectedInvoiceLatestPaymentAttempt}
          generatedPaymentLink={financePackPaymentLinks[selectedFinanceInvoice.invoice._id] ?? null}
          paymentEmail={financePackPaymentEmail}
          isGeneratingPaymentLink={isGeneratingFinancePackPaymentLink}
          onPaymentEmailChange={setFinancePackPaymentEmail}
          onGeneratePaymentLink={handleGenerateFinancePackPaymentLink}
          onClose={() => setFinancePack(null)}
        />
      )}
    </main>
  );
}
