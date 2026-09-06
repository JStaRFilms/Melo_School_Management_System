import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Hash,
  Link2,
  Plus,
  ReceiptText,
  Users,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type {
  BillingDashboardData,
  ClassOption,
  FeePlanApplicationDraft,
  FeePlanDraft,
  PaymentDraft,
  PaymentLinkDraft,
  PaymentLinkResult,
  SessionOption,
  TermOption,
} from "../types";
import { formatMoney } from "../utils";
import { BulkApplicationForm } from "./forms/BulkApplicationForm";
import { FeePlanForm } from "./forms/FeePlanForm";
import type { DraftStatus } from "@school/shared/drafts";

type BillingSidebarVariant = "arsenal" | "payment" | "invoice" | "application" | "link" | "plan";

interface BillingSidebarProps {
  onClose?: () => void;
  variant: BillingSidebarVariant;
  onVariantChange?: (variant: BillingSidebarVariant) => void;

  paymentDraft: PaymentDraft;
  onPaymentDraftChange: (draft: PaymentDraft) => void;
  onRecordPayment: (e: React.FormEvent) => void;

  paymentLinkDraft: PaymentLinkDraft;
  onPaymentLinkDraftChange: (draft: PaymentLinkDraft) => void;
  generatedPaymentLink: PaymentLinkResult | null;
  onGenerateLink: (e: React.FormEvent) => void;

  feePlanDraft: FeePlanDraft;
  onFeePlanDraftChange: (draft: FeePlanDraft) => void;
  onCreateFeePlan: (e: React.FormEvent) => void;
  feePlanDraftStatus?: DraftStatus;
  feePlanDraftLastSavedAt?: number | null;

  feePlanApplicationDraft: FeePlanApplicationDraft;
  onFeePlanApplicationDraftChange: (draft: FeePlanApplicationDraft) => void;
  onApplyFeePlan: (e: React.FormEvent) => void;

  invoices: BillingDashboardData["invoices"];
  selectedInvoice?: BillingDashboardData["invoices"][number];
  classes: ClassOption[];
  sessions: SessionOption[];
  applicationTerms: TermOption[];
  feePlans: BillingDashboardData["feePlans"];
}

const labelCx = "text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 font-display";
const inputCx = "w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all placeholder:text-slate-400";

export function BillingSidebar({
  variant,
  onVariantChange,
  paymentDraft,
  onPaymentDraftChange,
  onRecordPayment,
  paymentLinkDraft,
  onPaymentLinkDraftChange,
  generatedPaymentLink,
  onGenerateLink,
  feePlanDraft,
  onFeePlanDraftChange,
  onCreateFeePlan,
  feePlanDraftStatus,
  feePlanDraftLastSavedAt,
  feePlanApplicationDraft,
  onFeePlanApplicationDraftChange,
  onApplyFeePlan,
  invoices,
  selectedInvoice,
  classes,
  sessions,
  applicationTerms,
  feePlans,
}: BillingSidebarProps) {
  const [copied, setCopied] = useState(false);

  const payableInvoices = useMemo(() => {
    return invoices.filter((row) => row.invoice.balanceDue > 0);
  }, [invoices]);

  const getInvoiceOptionLabel = (row: BillingDashboardData["invoices"][number]) => {
    const student = row.studentName ? `${row.studentName} • ` : "";
    const balance = formatMoney(row.invoice.balanceDue, row.invoice.currency);
    return `${student}${row.invoice.invoiceNumber} (${balance} due)`;
  };

  const handleCopyGeneratedLink = async () => {
    if (!generatedPaymentLink?.authorizationUrl) {
      return;
    }

    await navigator.clipboard.writeText(generatedPaymentLink.authorizationUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const generateAutoReference = () => {
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    onPaymentDraftChange({ ...paymentDraft, reference: `REC-${dateStr}-${rand}` });
  };

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-xl min-h-0 overflow-hidden">
      {/* ── Arsenal: Stacked Action List ─────────────────── */}
      {variant === "arsenal" && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 shadow-2xs">
            <button
              onClick={() => onVariantChange?.("payment")}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left cursor-pointer"
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

            <button
              onClick={() => onVariantChange?.("link")}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left cursor-pointer"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Link2 className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900">Payment Handoff</p>
                <p className="text-[11px] text-slate-500 leading-snug">Direct online settlement link</p>
              </div>
              <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            <button
              onClick={() => onVariantChange?.("application")}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left cursor-pointer"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Users className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900">Bulk Invoicing</p>
                <p className="text-[11px] text-slate-500 leading-snug">Generate term fees for entire class</p>
              </div>
              <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            <button
              onClick={() => onVariantChange?.("plan")}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50 transition-colors group text-left cursor-pointer"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                <Plus className="h-[18px] w-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-900">New Fee Blueprint</p>
                <p className="text-[11px] text-slate-500 leading-snug">Define reusable class fee structures</p>
              </div>
              <svg className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Payment: Record Receipt Form ─────────────────── */}
      {variant === "payment" && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
          <div className="space-y-1">
            <p className={labelCx}>Manual Entry</p>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Log cash or bank transfer payment against an existing student invoice.
            </p>
          </div>

          <form onSubmit={onRecordPayment} className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelCx}>Target Invoice *</label>
              <select
                value={paymentDraft.invoiceId}
                onChange={(e) => onPaymentDraftChange({ ...paymentDraft, invoiceId: e.target.value })}
                className={inputCx}
                required
              >
                <option value="">Select Student Invoice</option>
                {payableInvoices.map((row) => (
                  <option key={row.invoice._id} value={row.invoice._id}>
                    {getInvoiceOptionLabel(row)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={labelCx}>Reference / Receipt # *</label>
              <div className="relative flex items-center">
                <input
                  value={paymentDraft.reference}
                  onChange={(e) => onPaymentDraftChange({ ...paymentDraft, reference: e.target.value })}
                  className={`${inputCx} pr-24 font-mono`}
                  placeholder="e.g. Bank Session ID, Teller #"
                  required
                />
                <button
                  type="button"
                  onClick={generateAutoReference}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  title="Generate unique receipt identifier"
                >
                  <Hash className="h-3.5 w-3.5 text-slate-500" />
                  <span>Generate</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Enter the bank transfer session ID, cash receipt number, or click Generate.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className={labelCx}>Amount Received *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono select-none pointer-events-none">
                  ₦
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentDraft.amountReceived}
                  onChange={(e) => {
                    let cleaned = e.target.value.replace(/[^0-9.]/g, "");
                    const parts = cleaned.split(".");
                    if (parts.length > 2) {
                      cleaned = parts[0] + "." + parts.slice(1).join("");
                    }
                    if (cleaned.length > 1 && cleaned.startsWith("0") && !cleaned.startsWith("0.")) {
                      cleaned = cleaned.replace(/^0+/, "");
                    }
                    onPaymentDraftChange({ ...paymentDraft, amountReceived: cleaned });
                  }}
                  placeholder="0.00"
                  className={`${inputCx} !pl-8 font-mono font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                  required
                />
              </div>
              {selectedInvoice && (
                <div className="flex items-center justify-between text-[11px] font-semibold pt-1">
                  <span className="text-slate-500">Current Balance:</span>
                  <span className="font-mono font-bold text-rose-600">
                    {formatMoney(selectedInvoice.invoice.balanceDue, selectedInvoice.invoice.currency)}
                  </span>
                </div>
              )}
            </div>

            {selectedInvoice ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">{selectedInvoice.studentName}</p>
                <p className="text-slate-500 font-mono">{selectedInvoice.invoice.invoiceNumber}</p>
                <p className="text-[11px] text-slate-400">{selectedInvoice.className} • {selectedInvoice.sessionName}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!paymentDraft.invoiceId || !paymentDraft.amountReceived}
              className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer shadow-md"
            >
              Record Payment Receipt
            </button>
          </form>
        </div>
      )}

      {/* ── Plan Form: Clean self-contained scroll & pinned summary footer ──────── */}
      {variant === "plan" && (
        <FeePlanForm
          draft={feePlanDraft}
          onChange={onFeePlanDraftChange}
          onSubmit={onCreateFeePlan}
          classes={classes}
          draftStatus={feePlanDraftStatus}
          draftLastSavedAt={feePlanDraftLastSavedAt}
        />
      )}

      {/* ── Bulk Application Form ────────────────────────── */}
      {variant === "application" && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar animate-in fade-in slide-in-from-right-4 duration-300">
          <BulkApplicationForm
            draft={feePlanApplicationDraft}
            onChange={onFeePlanApplicationDraftChange}
            onSubmit={onApplyFeePlan}
            classes={classes}
            sessions={sessions}
            terms={applicationTerms}
            feePlans={feePlans}
          />
        </div>
      )}

      {/* ── Link: Payment Handoff Form ───────────────────── */}
      {variant === "link" && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="space-y-1">
            <p className={labelCx}>Direct Payment Link</p>
            <p className="text-[12px] text-slate-500 leading-relaxed">
              Generate a secure Paystack checkout link to send directly to a parent.
            </p>
          </div>

          {(() => {
            const selectedLinkInvoice = invoices.find((row) => row.invoice._id === paymentLinkDraft.invoiceId);

            return (
              <form onSubmit={onGenerateLink} className="space-y-4">
                <div className="space-y-1.5">
                  <label className={labelCx}>Target Invoice *</label>
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
                    required
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
                  <label className={labelCx}>Amount to Settle *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono select-none pointer-events-none">
                      ₦
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentLinkDraft.amount}
                      onChange={(e) => {
                        let cleaned = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = cleaned.split(".");
                        if (parts.length > 2) {
                          cleaned = parts[0] + "." + parts.slice(1).join("");
                        }
                        if (cleaned.length > 1 && cleaned.startsWith("0") && !cleaned.startsWith("0.")) {
                          cleaned = cleaned.replace(/^0+/, "");
                        }
                        onPaymentLinkDraftChange({ ...paymentLinkDraft, amount: cleaned });
                      }}
                      className={`${inputCx} !pl-8 font-mono font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {selectedLinkInvoice ? (
                    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
                      <p className="font-bold text-slate-900">{selectedLinkInvoice.studentName}</p>
                      <p className="font-mono">{selectedLinkInvoice.invoice.invoiceNumber}</p>
                      <p className="font-bold text-rose-600">
                        Total Outstanding: {formatMoney(selectedLinkInvoice.invoice.balanceDue, selectedLinkInvoice.invoice.currency)}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <label className={labelCx}>Payer Email *</label>
                  <input
                    type="email"
                    value={paymentLinkDraft.email}
                    onChange={(e) => onPaymentLinkDraftChange({ ...paymentLinkDraft, email: e.target.value })}
                    className={inputCx}
                    placeholder="parent@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={!paymentLinkDraft.invoiceId || !paymentLinkDraft.amount || !paymentLinkDraft.email}
                  className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer shadow-md"
                >
                  Generate Payment Link
                </button>

                {generatedPaymentLink?.authorizationUrl ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">Payment Link Ready</p>
                      <p className="mt-1 text-xs leading-relaxed text-emerald-900 break-all font-mono">
                        {generatedPaymentLink.authorizationUrl}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyGeneratedLink}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-100 cursor-pointer"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copied ? "Copied" : "Copy Link"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(generatedPaymentLink.authorizationUrl!, "_blank", "noopener,noreferrer")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Open Checkout</span>
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
  );
}
