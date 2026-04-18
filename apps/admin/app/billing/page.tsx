"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  Link2,
} from "lucide-react";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { AdminSurface } from "@/components/ui/AdminSurface";

// Local Components
import { BillingHeader } from "./components/BillingHeader";
import { BillingTabs, type BillingTab } from "./components/BillingTabs";
import { InvoiceTable } from "./components/InvoiceTable";
import { PaymentTable } from "./components/PaymentTable";
import { SettingsPanel } from "./components/SettingsPanel";
import { BillingSidebar } from "./components/BillingSidebar";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { FeePlanList } from "./components/FeePlanList";

// Hooks & Utils
import { useBillingData } from "./hooks/useBillingData";
import { useBillingActions } from "./hooks/useBillingActions";
import { useBillingSortPreferences } from "./hooks/useBillingSortPreferences";
import { 
  initialFeePlanDraft, 
  initialFeePlanApplicationDraft, 
  initialInvoiceDraft, 
  initialPaymentDraft, 
  initialBillingSettingsDraft,
  initialPaystackGatewayConfigDraft,
  initialPaymentLinkDraft,
  buildBillingSettingsDraft,
  sortFeePlans,
  sortInvoiceRows,
  sortPaymentRows,
  toggleSortDirection
} from "./utils";
import type { 
  DashboardFilters, 
  FeePlanDraft, 
  FeePlanApplicationDraft, 
  InvoiceDraft, 
  PaymentDraft, 
  BillingSettingsDraft,
  PaystackGatewayConfigDraft,
  PaymentLinkDraft,
  PaymentLinkResult,
  FeePlanSortKey,
  InvoiceSortKey,
  PaymentSortKey
} from "./types";

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
  const [notice, setNotice] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVariant, setSidebarVariant] = useState<"arsenal" | "payment" | "invoice" | "application" | "link" | "plan">("payment");

  // Drafts
  const [feePlanDraft, setFeePlanDraft] = useState<FeePlanDraft>(initialFeePlanDraft());
  const [feePlanApplicationDraft, setFeePlanApplicationDraft] = useState<FeePlanApplicationDraft>(initialFeePlanApplicationDraft());
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(initialInvoiceDraft());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(initialPaymentDraft());
  const [billingSettingsDraft, setBillingSettingsDraft] = useState<BillingSettingsDraft>(initialBillingSettingsDraft());
  const [gatewayConfigDraft, setGatewayConfigDraft] = useState<PaystackGatewayConfigDraft>(initialPaystackGatewayConfigDraft());
  const [paymentLinkDraft, setPaymentLinkDraft] = useState<PaymentLinkDraft>(initialPaymentLinkDraft());
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<PaymentLinkResult | null>(null);
  const [selectedGatewayMode, setSelectedGatewayMode] = useState<"test" | "live">("test");

  const sidebarTitles: Record<string, string> = {
    arsenal: "Financial Hub",
    payment: "Record Receipt",
    invoice: "Generate Invoice",
    application: "Bulk Distribution",
    link: "Payment Handoff",
    plan: "New Fee Plan",
  };

  // 2. Data & Actions
  const { 
    data, 
    classes, 
    sessions, 
    classNameById, 
    applicationTerms 
  } = useBillingData(filters, invoiceDraft, feePlanApplicationDraft);
  const actions = useBillingActions(setNotice);
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
    const success = await actions.runAction(async () => {
      await actions.createFeePlan({
        name: feePlanDraft.name,
        description: feePlanDraft.description,
        currency: feePlanDraft.currency,
        billingMode: feePlanDraft.billingMode,
        targetClassIds: feePlanDraft.targetClassIds,
        installmentEnabled: feePlanDraft.installmentEnabled,
        installmentCount: Number(feePlanDraft.installmentCount),
        intervalDays: Number(feePlanDraft.intervalDays),
        firstDueDays: Number(feePlanDraft.firstDueDays),
        lineItems: feePlanDraft.lineItems.map((item: any) => ({
             label: item.label,
             amount: Number(item.amount),
             category: item.category,
             order: 0
        })),
      } as never);
    }, "Fee Plan Created", "Unable to create new fee plan.");
    if (success) {
      setFeePlanDraft(initialFeePlanDraft());
      setSidebarOpen(false);
    }
  };

  const handleApplyFeePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await actions.runAction(async () => {
      await actions.applyFeePlanToClassStudents({
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
      } as never) as any;

      setGeneratedPaymentLink({
        provider: result?.provider ?? "paystack",
        reference: result?.reference ?? "",
        authorizationUrl: result?.authorizationUrl ?? result?.authorization_url ?? null,
        accessCode: result?.accessCode ?? result?.access_code ?? null,
        checkoutPayload: result?.checkoutPayload ?? result?.checkout_payload ?? {},
      });
    }, "Link Generated", "Unable to initialize Paystack session.");
    if (success) {
      setNotice({
        tone: "success",
        title: "Link Generated",
        message: "Payment link is ready. Copy it or open it from the handoff panel.",
      });
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
    <main className="lg:h-screen lg:overflow-hidden bg-slate-50/50 flex flex-col">
      <div className="flex-1 flex lg:overflow-hidden">
        {/* Main Content Area */}
        <section className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 lg:p-8 space-y-8">
            {/* System Notifications */}
            {notice && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                <AdminSurface 
                  intensity="medium" 
                  className={`border-l-4 ${notice.tone === 'success' ? 'border-l-emerald-500' : 'border-l-rose-500'} flex items-center justify-between p-4 shadow-lg shadow-slate-200/50`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${notice.tone === 'success' ? 'bg-emerald-50 text-emerald-600 font-black' : 'bg-rose-50 text-rose-600 font-black'}`}>
                      {notice.tone === 'success' ? <Plus className="h-5 w-5" /> : <X className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">System Activity</p>
                      <p className="text-sm font-black text-slate-950 tracking-tight uppercase">{notice.message}</p>
                    </div>
                  </div>
                  <button onClick={() => setNotice(null)} className="p-2 rounded-full hover:bg-slate-50 transition-colors">
                    <X className="h-4 w-4 text-slate-300" />
                  </button>
                </AdminSurface>
              </div>
            )}

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
            <div className="p-8 border-b border-slate-950/5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Financial Arsenal</h3>
              <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => openSidebar("payment")}
                   className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl bg-white border border-slate-950/5 shadow-sm hover:border-slate-950 transition-all group"
                 >
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                       <Plus className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-950">Receipt</span>
                 </button>
                 <button 
                    onClick={() => openSidebar("link")}
                    className="flex flex-col items-center justify-center gap-3 p-4 rounded-3xl bg-white border border-slate-950/5 shadow-sm hover:border-slate-950 transition-all group"
                 >
                    <div className="p-2.5 rounded-2xl bg-orange-50 text-orange-600 group-hover:scale-110 transition-transform">
                       <Link2 className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-950">Handoff</span>
                 </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => openSidebar("application")}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-3xl bg-white border border-slate-200 text-slate-950 font-black text-[9px] uppercase tracking-widest shadow-sm hover:translate-y-[-2px] active:translate-y-0 transition-all"
                >
                  Bulk Invoicing
                </button>
                <button 
                  onClick={() => openSidebar("plan")}
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-3xl bg-slate-950 text-white font-black text-[9px] uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:translate-y-[-2px] active:translate-y-0 transition-all"
                >
                  <Plus className="h-3 w-3" /> New Plan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative">
              <div className="absolute inset-0 bg-white/40 pointer-events-none" />
              <BillingSidebar 
                onClose={() => setSidebarOpen(false)}
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
        onClose={() => setSidebarOpen(false)}
        title={sidebarTitles[sidebarVariant]}
      >
        <BillingSidebar 
          onClose={() => setSidebarOpen(false)}
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
    </main>
  );
}
