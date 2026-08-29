import { Check, Copy, ExternalLink, Globe, Mail, Phone, Printer, QrCode, Sparkles, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { BillingDashboardData, PaymentLinkResult } from "../types";
import { formatDateTime, formatMoney } from "../utils";

type InvoiceRow = BillingDashboardData["invoices"][number];
type PaymentRow = BillingDashboardData["payments"][number];
type PaymentAttemptRow = BillingDashboardData["paymentAttempts"][number];

type PrintableFinanceModalProps = {
  mode: "invoice" | "statement";
  school: BillingDashboardData["school"];
  invoice: InvoiceRow;
  studentInvoices: InvoiceRow[];
  studentPayments: PaymentRow[];
  latestPaymentAttempt: PaymentAttemptRow | null;
  generatedPaymentLink: PaymentLinkResult | null;
  paymentEmail: string;
  isGeneratingPaymentLink: boolean;
  onPaymentEmailChange: (email: string) => void;
  onGeneratePaymentLink: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

function amountsMatch(left: number | undefined, right: number) {
  return left !== undefined && Math.abs(left - right) < 0.005;
}

function getSafeHttpsUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function PrintableFinanceModal({
  mode,
  school,
  invoice,
  studentInvoices,
  studentPayments,
  latestPaymentAttempt,
  generatedPaymentLink,
  paymentEmail,
  isGeneratingPaymentLink,
  onPaymentEmailChange,
  onGeneratePaymentLink,
  onClose,
}: PrintableFinanceModalProps) {
  const [mounted, setMounted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const canShowPaymentLink = invoice.invoice.balanceDue > 0;
  const reusableGeneratedLink =
    amountsMatch(generatedPaymentLink?.amount, invoice.invoice.balanceDue) &&
    generatedPaymentLink?.currency === invoice.invoice.currency
      ? generatedPaymentLink
      : null;
  const paymentUrl = canShowPaymentLink
    ? reusableGeneratedLink?.authorizationUrl ?? latestPaymentAttempt?.attempt.authorizationUrl ?? null
    : null;
  const safePaymentUrl = getSafeHttpsUrl(paymentUrl);
  const paymentReference = canShowPaymentLink
    ? reusableGeneratedLink?.reference ?? latestPaymentAttempt?.attempt.reference ?? null
    : null;

  const statementCurrency = invoice.invoice.currency;
  const sameCurrencyInvoices = studentInvoices.filter((row) => row.invoice.currency === statementCurrency);
  const statementTotalCharges = sameCurrencyInvoices.reduce((sum, row) => sum + row.invoice.totalAmount, 0);
  const statementTotalPaid = sameCurrencyInvoices.reduce((sum, row) => sum + row.invoice.amountPaid, 0);
  const statementBalance = sameCurrencyInvoices.reduce((sum, row) => sum + row.invoice.balanceDue, 0);
  const sortedStudentInvoices = [...studentInvoices].sort((left, right) => left.invoice.issuedAt - right.invoice.issuedAt);
  const invoiceNumberById = new Map(studentInvoices.map((row) => [row.invoice._id, row.invoice.invoiceNumber]));
  const sortedStudentPayments = [...studentPayments].sort((left, right) => left.payment.receivedAt - right.payment.receivedAt);

  // Compute Statement Ledger with Running Balance
  const statementTransactions = [
    ...sortedStudentInvoices.map((row) => ({
      key: `invoice-${row.invoice._id}`,
      occurredAt: row.invoice.issuedAt,
      type: "Charge / Invoice" as const,
      invoiceNumber: row.invoice.invoiceNumber,
      details: row.invoice.feePlanNameSnapshot,
      charge: row.invoice.totalAmount,
      payment: 0,
      currency: row.invoice.currency,
    })),
    ...sortedStudentPayments.map((row) => ({
      key: `payment-${row.payment._id}`,
      occurredAt: row.payment.receivedAt,
      type: "Payment / Receipt" as const,
      invoiceNumber: invoiceNumberById.get(row.payment.invoiceId) ?? "Invoice",
      details: `${row.payment.reference} (${row.payment.paymentMethod})`,
      charge: 0,
      payment: row.payment.amountApplied,
      currency: statementCurrency,
    })),
  ].sort((left, right) => left.occurredAt - right.occurredAt);

  let currentRunningBalance = 0;
  const statementRowsWithBalance = statementTransactions.map((tx) => {
    currentRunningBalance = currentRunningBalance + tx.charge - tx.payment;
    return {
      ...tx,
      runningBalance: currentRunningBalance,
    };
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">● Fully Settled</span>;
      case "partially_paid":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">● Partially Paid</span>;
      case "overdue":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">● Overdue</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300">● Pending Payment</span>;
    }
  };

  const handleCopyLink = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  };

  if (!mounted) return null;

  return createPortal(
    <div className="billing-print-root fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-3 sm:p-6 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-white print:p-0 print:backdrop-blur-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .billing-print-root, .billing-print-root * { visibility: visible; }
          .billing-print-root { position: absolute; inset: 0; width: 100%; background: white !important; }
          @page { margin: 15mm; size: A4 portrait; }
        }
      `}</style>

      <div className="my-4 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 print:my-0 print:max-w-none print:rounded-none print:shadow-none print:border-none">
        {/* Screen Action Bar (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Finance Document</span>
            <span className="text-slate-300">•</span>
            <span className="text-xs font-bold text-slate-900">
              {mode === "invoice" ? "Student Billing Invoice" : "Statement of Account"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Close document"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <article className="p-6 sm:p-10 space-y-6 text-slate-900 print:p-0 print:space-y-6">
          {/* Institutional Letterhead */}
          <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-900 pb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase font-display">
                {school.name}
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-1">Official Institutional Bursary & Student Billing</p>
            </div>
            <div className="text-left sm:text-right space-y-1">
              <div className="inline-block bg-slate-900 text-white px-3.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                {mode === "invoice" ? "Student Invoice" : "Statement of Account"}
              </div>
              <p className="font-mono text-xs font-bold text-slate-600">
                {mode === "invoice" ? `INV: ${invoice.invoice.invoiceNumber}` : `STMT: ${invoice.studentName.toUpperCase()}`}
              </p>
            </div>
          </header>

          {/* Student & Term Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Student Name</span>
              <span className="font-bold text-slate-900 text-sm">{invoice.studentName}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Class & Session</span>
              <span className="font-bold text-slate-800">{invoice.className}</span>
              <p className="text-[11px] text-slate-500 font-medium">{invoice.sessionName} • {invoice.termName}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Issue / Due Date</span>
              <span className="font-semibold text-slate-800">Issued: {formatDateTime(invoice.invoice.issuedAt)}</span>
              {mode === "invoice" && (
                <p className="text-[11px] font-bold text-rose-600">Due: {formatDateTime(invoice.invoice.dueDate)}</p>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status</span>
              <div className="mt-1">
                {mode === "invoice" ? getStatusBadge(invoice.invoice.status) : (
                  statementBalance <= 0
                    ? <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Clean Ledger</span>
                    : <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Balance Pending</span>
                )}
              </div>
            </div>
          </div>

          {/* ── MODE: INVOICE ────────────────────────────────────── */}
          {mode === "invoice" ? (
            <div className="space-y-6">
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Billed</span>
                  <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                    {formatMoney(invoice.invoice.totalAmount, invoice.invoice.currency)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Amount Paid</span>
                  <span className="text-base font-black font-mono text-emerald-700 mt-1 block">
                    {formatMoney(invoice.invoice.amountPaid, invoice.invoice.currency)}
                  </span>
                </div>
                <div className={`p-3.5 rounded-xl border shadow-2xs ${
                  invoice.invoice.balanceDue > 0 ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                    invoice.invoice.balanceDue > 0 ? "text-rose-700" : "text-slate-400"
                  }`}>Balance Due</span>
                  <span className={`text-base font-black font-mono mt-1 block ${
                    invoice.invoice.balanceDue > 0 ? "text-rose-700" : "text-slate-900"
                  }`}>
                    {formatMoney(invoice.invoice.balanceDue, invoice.invoice.currency)}
                  </span>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 print:bg-slate-100">
                    <tr>
                      <th className="px-4 py-3">Fee Item Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Requirement</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.invoice.lineItems.map((item) => (
                      <tr key={item.id} className={item.isOptional && item.isSelected === false ? "opacity-40 bg-slate-50" : ""}>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <span>{item.label}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-semibold text-slate-500 capitalize">{item.category}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            item.isOptional
                              ? item.isSelected === false
                                ? "bg-slate-100 text-slate-400 line-through"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            {item.isOptional ? (item.isSelected === false ? "Opted Out" : "Optional Add-on") : "Mandatory"}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${
                          item.isOptional && item.isSelected === false ? "line-through text-slate-400" : "text-slate-900"
                        }`}>
                          {formatMoney(item.amount, invoice.invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 text-xs font-bold border-t border-slate-200 print:bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-slate-600">Subtotal</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(invoice.invoice.subtotal, invoice.invoice.currency)}</td>
                    </tr>
                    {invoice.invoice.waiverAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-emerald-700">Waiver / Scholarship</td>
                        <td className="px-4 py-1.5 text-right font-mono text-emerald-700">-{formatMoney(invoice.invoice.waiverAmount, invoice.invoice.currency)}</td>
                      </tr>
                    )}
                    {invoice.invoice.discountAmount > 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-1.5 text-emerald-700">Early Bird / Sibling Discount</td>
                        <td className="px-4 py-1.5 text-right font-mono text-emerald-700">-{formatMoney(invoice.invoice.discountAmount, invoice.invoice.currency)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-slate-200 text-sm">
                      <td colSpan={3} className="px-4 py-2.5 font-black uppercase text-slate-900">Total Net Amount</td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">{formatMoney(invoice.invoice.totalAmount, invoice.invoice.currency)}</td>
                    </tr>
                    <tr className="text-sm bg-emerald-50/70 text-emerald-900">
                      <td colSpan={3} className="px-4 py-2 font-bold uppercase">Amount Paid to Date</td>
                      <td className="px-4 py-2 text-right font-mono font-black text-emerald-700">{formatMoney(invoice.invoice.amountPaid, invoice.invoice.currency)}</td>
                    </tr>
                    <tr className="text-base bg-slate-950 text-white font-black">
                      <td colSpan={3} className="px-4 py-3 uppercase tracking-wide text-slate-200">Outstanding Balance Due</td>
                      <td className={`px-4 py-3 text-right font-mono font-black ${invoice.invoice.balanceDue > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                        {formatMoney(invoice.invoice.balanceDue, invoice.invoice.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Online Payment Link & QR Checkout Box */}
              {invoice.invoice.balanceDue > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-5">
                  {safePaymentUrl ? (
                    <>
                      <div className="shrink-0 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                        <LocalPaymentQrCode value={safePaymentUrl} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Direct Paystack Checkout</p>
                          <p className="text-xs font-semibold text-slate-700 mt-0.5">
                            Scan the QR code or click below to settle this balance securely online.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 print:hidden">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(safePaymentUrl)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                          >
                            {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            <span>{linkCopied ? "Copied!" : "Copy Payment Link"}</span>
                          </button>
                          <a
                            href={safePaymentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Pay Online</span>
                          </a>
                        </div>
                        <p className="font-mono text-[11px] text-slate-500 break-all">{safePaymentUrl}</p>
                      </div>
                    </>
                  ) : (
                    <div className="w-full space-y-3 print:hidden">
                      <div>
                        <p className="text-xs font-bold text-slate-900">Generate Online Payment Link</p>
                        <p className="text-[11px] text-slate-500">Create an instant Paystack link to embed on this invoice before printing or sending.</p>
                      </div>
                      <form onSubmit={onGeneratePaymentLink} className="flex gap-2">
                        <input
                          type="email"
                          required
                          value={paymentEmail}
                          onChange={(e) => onPaymentEmailChange(e.target.value)}
                          placeholder="parent@email.com"
                          className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-slate-900"
                        />
                        <button
                          type="submit"
                          disabled={isGeneratingPaymentLink}
                          className="h-10 px-4 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        >
                          {isGeneratingPaymentLink ? "Generating..." : "Generate Link"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── MODE: STATEMENT OF ACCOUNT ────────────────────────── */
            <div className="space-y-6">
              {/* Financial KPI Summary Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Charges</span>
                  <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                    {formatMoney(statementTotalCharges, statementCurrency)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Total Payments</span>
                  <span className="text-base font-black font-mono text-emerald-700 mt-1 block">
                    {formatMoney(statementTotalPaid, statementCurrency)}
                  </span>
                </div>
                <div className={`p-3.5 rounded-xl border shadow-2xs ${
                  statementBalance > 0 ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                    statementBalance > 0 ? "text-rose-700" : "text-slate-400"
                  }`}>Net Balance Due</span>
                  <span className={`text-base font-black font-mono mt-1 block ${
                    statementBalance > 0 ? "text-rose-700" : "text-slate-900"
                  }`}>
                    {formatMoney(statementBalance, statementCurrency)}
                  </span>
                </div>
              </div>

              {/* Statement Ledger Table with Running Balance */}
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 print:bg-slate-100">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Reference / Description</th>
                      <th className="px-4 py-3 text-right">Debit (Charge)</th>
                      <th className="px-4 py-3 text-right">Credit (Payment)</th>
                      <th className="px-4 py-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statementRowsWithBalance.map((row) => (
                      <tr key={row.key} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-700">{formatDateTime(row.occurredAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            row.payment > 0 ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-700"
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <span>{row.details}</span>
                          <span className="block text-[10px] text-slate-400 font-mono">{row.invoiceNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {row.charge > 0 ? formatMoney(row.charge, row.currency) : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                          {row.payment > 0 ? formatMoney(row.payment, row.currency) : "-"}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-black ${
                          row.runningBalance > 0 ? "text-rose-700" : "text-emerald-700"
                        }`}>
                          {formatMoney(row.runningBalance, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-950 text-white text-sm font-black">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 uppercase tracking-wide text-slate-300">
                        Final Statement Balance
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-black ${
                        statementBalance > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        {formatMoney(statementBalance, statementCurrency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Official Footer Notes */}
          <footer className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <p>Generated electronically by {school.name} School Portal. No physical signature required.</p>
            <p className="font-mono">Verification Ref: {invoice.invoice._id}</p>
          </footer>
        </article>
      </div>
    </div>,
    document.body
  );
}

function LocalPaymentQrCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let isCurrent = true;
    QRCode.toCanvas(canvas, value, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 120,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }, (error) => {
      if (!isCurrent) return;
      if (error) {
        console.error("QR code generation failed:", error);
        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={120}
      aria-label="Payment QR code"
      className="h-28 w-28 rounded-lg"
    />
  );
}

