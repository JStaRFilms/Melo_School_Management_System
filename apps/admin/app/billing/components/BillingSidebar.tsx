import { Check,Copy,CreditCard,ExternalLink,Link2,Plus,ReceiptText } from "lucide-react";
import React,{ useMemo,useState } from "react";
import type {
BillingDashboardData,
ClassOption,
FeePlanApplicationDraft,
FeePlanDraft,
PaymentDraft,
PaymentLinkDraft,
PaymentLinkResult,
SessionOption,
TermOption
} from "../types";
import { formatMoney } from "../utils";
import { BulkApplicationForm } from "./forms/BulkApplicationForm";
import { FeePlanForm } from "./forms/FeePlanForm";

type BillingSidebarVariant = "arsenal" | "payment" | "invoice" | "application" | "link" | "plan";

interface BillingSidebarProps {
  onClose: () => void;
  variant: BillingSidebarVariant;
  paymentDraft: PaymentDraft;
  onPaymentDraftChange: (draft: PaymentDraft) => void;
  onRecordPayment: (e: React.FormEvent) => void;
  paymentLinkDraft: PaymentLinkDraft;
  onPaymentLinkDraftChange: (draft: PaymentLinkDraft) => void;
  generatedPaymentLink: PaymentLinkResult | null;
  onGenerateLink: (e: React.FormEvent) => void;
  invoices: BillingDashboardData["invoices"];
  selectedInvoice?: any;
  feePlanDraft: FeePlanDraft;
  onFeePlanDraftChange: (draft: FeePlanDraft) => void;
  onCreateFeePlan: (e: React.FormEvent) => void;
  feePlanApplicationDraft: FeePlanApplicationDraft;
  onFeePlanApplicationDraftChange: (draft: FeePlanApplicationDraft) => void;
  onApplyFeePlan: (e: React.FormEvent) => void;
  classes: ClassOption[];
  sessions: SessionOption[];
  applicationTerms: TermOption[];
  feePlans: BillingDashboardData["feePlans"];
}

export function BillingSidebar({

  variant,
  paymentDraft,
  onPaymentDraftChange,
  onRecordPayment,
  paymentLinkDraft,
  onPaymentLinkDraftChange,
  onGenerateLink,
  generatedPaymentLink,
  invoices,
  selectedInvoice,
  feePlanDraft,
  onFeePlanDraftChange,
  onCreateFeePlan,
  feePlanApplicationDraft,
  onFeePlanApplicationDraftChange,
  onApplyFeePlan,
  classes,
  sessions,
  applicationTerms,
  feePlans,
  onVariantChange,
}: BillingSidebarProps & { onVariantChange?: (variant: BillingSidebarVariant) => void }) {
  const labelCx = "text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600";
  const inputCx = "w-full h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all placeholder:text-slate-400";
  const [copied, setCopied] = useState(false);

  const payableInvoices = useMemo(
    () =>
      [...invoices]
        .filter((row) => row.invoice.balanceDue > 0)
        .sort((left, right) => {
          const byStudent = left.studentName.localeCompare(right.studentName, undefined, {
            sensitivity: "base",
          });
          if (byStudent !== 0) {
            return byStudent;
          }
          return right.invoice.issuedAt - left.invoice.issuedAt;
        }),
    [invoices]
  );

  const formatCompactAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);

  const getInvoiceOptionLabel = (row: BillingDashboardData["invoices"][number]) =>
    `${row.studentName} • ${formatCompactAmount(row.invoice.balanceDue, row.invoice.currency)}`;

  const handleCopyGeneratedLink = async () => {
    if (!generatedPaymentLink?.authorizationUrl) {
      return;
    }

    await navigator.clipboard.writeText(generatedPaymentLink.authorizationUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl">
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">

        {/* ── Arsenal: Stacked Action List ─────────────────── */}
        {variant === "arsenal" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-3">
            {/* Action List */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
              {/* Record Receipt */}
              <button
                onClick={() => onVariantChange?.("payment")}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left"
              >
                <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CreditCard className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900">Record Receipt</p>
                  <p className="text-[11px] text-slate-500 leading-snug">Log manual bank transfer or cash</p>
                </div>
                <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>

              {/* Payment Handoff */}
              <button
                onClick={() => onVariantChange?.("link")}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left"
              >
                <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Link2 className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900">Payment Handoff</p>
                  <p className="text-[11px] text-slate-500 leading-snug">Generate secure payment link</p>
                </div>
                <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>

              {/* Bulk Invoicing */}
              <button
                onClick={() => onVariantChange?.("application")}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left"
              >
                <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ReceiptText className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900">Bulk Invoicing</p>
                  <p className="text-[11px] text-slate-500 leading-snug">Distribute invoices to a class</p>
                </div>
                <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* New Fee Plan — standalone CTA */}
            <button
              onClick={() => onVariantChange?.("plan")}
              className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/10"
            >
              <Plus className="h-4 w-4" />
              New Fee Plan
            </button>
          </div>
        )}

        {/* ── Payment: Record Receipt Form ─────────────────── */}
        {variant === "payment" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="space-y-1">
              <p className={labelCx}>Manual Entry</p>
              <p className="text-[13px] text-slate-500 leading-relaxed">Log a payment received via bank transfer or cash.</p>
            </div>

            <form onSubmit={onRecordPayment} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCx}>Target Invoice</label>
                <select
                  value={paymentDraft.invoiceId}
                  onChange={(e) => onPaymentDraftChange({ ...paymentDraft, invoiceId: e.target.value })}
                  className={inputCx}
                >
                  <option value="">Select Invoice</option>
                  {payableInvoices.map((row) => (
                    <option key={row.invoice._id} value={row.invoice._id}>
                      {getInvoiceOptionLabel(row)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCx}>Reference Number</label>
                <input
                  value={paymentDraft.reference}
                  onChange={(e) => onPaymentDraftChange({ ...paymentDraft, reference: e.target.value })}
                  className={inputCx}
                  placeholder="e.g. TRF-12345"
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelCx}>Amount Received</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500">NGN</span>
                  <input
                    type="number"
                    value={paymentDraft.amountReceived}
                    onChange={(e) => onPaymentDraftChange({ ...paymentDraft, amountReceived: e.target.value })}
                    className={`${inputCx} !pl-14`}
                  />
                </div>
                {selectedInvoice && (
                  <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mt-1">
                    Balance Due: {formatMoney(selectedInvoice.invoice.balanceDue, "NGN")}
                  </p>
                )}
              </div>

              {selectedInvoice ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-900">{selectedInvoice.studentName}</p>
                  <p>{selectedInvoice.invoice.invoiceNumber}</p>
                  <p>{selectedInvoice.className}</p>
                </div>
              ) : null}

              <button type="submit" disabled={!paymentDraft.invoiceId || !paymentDraft.amountReceived} className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                Record Payment
              </button>
            </form>
          </div>
        )}

        {/* ── Plan Form ────────────────────────────────────── */}
        {variant === "plan" && (
           <FeePlanForm 
             draft={feePlanDraft} 
             onChange={onFeePlanDraftChange} 
             onSubmit={onCreateFeePlan}
             classes={classes}
           />
        )}

        {/* ── Bulk Application Form ────────────────────────── */}
        {variant === "application" && (
           <BulkApplicationForm 
             draft={feePlanApplicationDraft}
             onChange={onFeePlanApplicationDraftChange}
             onSubmit={onApplyFeePlan}
             classes={classes}
             sessions={sessions}
             terms={applicationTerms}
             feePlans={feePlans}
           />
        )}

        {/* ── Link: Payment Handoff Form ───────────────────── */}
        {variant === "link" && (
           <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="space-y-1">
                <p className={labelCx}>Direct Handoff</p>
                <p className="text-[13px] text-slate-500 leading-relaxed">Generate a secure payment link for external settlement.</p>
              </div>

              {(() => {
                const selectedLinkInvoice = invoices.find((row) => row.invoice._id === paymentLinkDraft.invoiceId);

                return (
                  <form onSubmit={onGenerateLink} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className={labelCx}>Target Invoice</label>
                      <select
                        value={paymentLinkDraft.invoiceId}
                        onChange={(e) => {
                          const nextInvoiceId = e.target.value;
                          const nextInvoice = payableInvoices.find((row) => row.invoice._id === nextInvoiceId);
                          onPaymentLinkDraftChange({
                            ...paymentLinkDraft,
                            invoiceId: nextInvoiceId,
                            amount: nextInvoice ? String(nextInvoice.invoice.balanceDue) : "",
                            description: nextInvoice ? `Payment for ${nextInvoice.invoice.invoiceNumber}` : "",
                          });
                        }}
                        className={inputCx}
                      >
                        <option value="">Select Invoice</option>
                        {payableInvoices.map((row) => (
                          <option key={row.invoice._id} value={row.invoice._id}>
                            {getInvoiceOptionLabel(row)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className={labelCx}>Amount Owed</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500">NGN</span>
                        <input
                          type="number"
                          value={paymentLinkDraft.amount}
                          onChange={(e) => onPaymentLinkDraftChange({ ...paymentLinkDraft, amount: e.target.value })}
                          className={`${inputCx} !pl-14`}
                          placeholder="0"
                        />
                      </div>
                      {selectedLinkInvoice ? (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                          <p className="font-bold text-slate-900">{selectedLinkInvoice.studentName}</p>
                          <p>{selectedLinkInvoice.invoice.invoiceNumber}</p>
                          <p>{selectedLinkInvoice.className}</p>
                          <p className="font-bold uppercase tracking-wider text-slate-500">
                            Outstanding Balance: {formatMoney(selectedLinkInvoice.invoice.balanceDue, selectedLinkInvoice.invoice.currency)}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-1.5">
                      <label className={labelCx}>Payer Email</label>
                      <input
                        value={paymentLinkDraft.email}
                        onChange={(e) => onPaymentLinkDraftChange({ ...paymentLinkDraft, email: e.target.value })}
                        className={inputCx}
                        placeholder="parent@example.com"
                      />
                    </div>

                    <button type="submit" disabled={!paymentLinkDraft.invoiceId || !paymentLinkDraft.amount || !paymentLinkDraft.email} className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
                      Generate Link
                    </button>

                    {generatedPaymentLink?.authorizationUrl ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-700">Payment Link Ready</p>
                          <p className="mt-1 text-[12px] leading-relaxed text-emerald-900 break-all">
                            {generatedPaymentLink.authorizationUrl}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleCopyGeneratedLink}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-900 transition-colors hover:bg-emerald-100"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            {copied ? "Copied" : "Copy Link"}
                          </button>
                          <button
                            type="button"
                            onClick={() => window.open(generatedPaymentLink.authorizationUrl!, "_blank", "noopener,noreferrer")}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open Payment Page
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </form>
                );
              })()}
           </div>
        )}
      </div>
    </div>
  );
}
