import { ExternalLink, Printer, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, type FormEvent } from "react";
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

function findInvoiceNumber(invoices: InvoiceRow[], invoiceId: string) {
  return invoices.find((row) => row.invoice._id === invoiceId)?.invoice.invoiceNumber ?? "Unknown invoice";
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
  const canShowPaymentLink = invoice.invoice.balanceDue > 0;
  const reusableGeneratedLink =
    generatedPaymentLink?.amount === invoice.invoice.balanceDue &&
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
  const statementTotalCharges = studentInvoices.reduce((sum, row) => sum + row.invoice.totalAmount, 0);
  const statementTotalPaid = studentInvoices.reduce((sum, row) => sum + row.invoice.amountPaid, 0);
  const statementBalance = studentInvoices.reduce((sum, row) => sum + row.invoice.balanceDue, 0);
  const sortedStudentInvoices = [...studentInvoices].sort((left, right) => left.invoice.issuedAt - right.invoice.issuedAt);
  const sortedStudentPayments = [...studentPayments].sort((left, right) => left.payment.receivedAt - right.payment.receivedAt);
  const statementRows = [
    ...sortedStudentInvoices.map((row) => ({
      key: `invoice-${row.invoice._id}`,
      occurredAt: row.invoice.issuedAt,
      type: "Charge" as const,
      invoiceNumber: row.invoice.invoiceNumber,
      details: row.invoice.feePlanNameSnapshot,
      charge: row.invoice.totalAmount,
      payment: null,
      currency: row.invoice.currency,
      methodClass: "text-slate-400",
    })),
    ...sortedStudentPayments.map((row) => ({
      key: `payment-${row.payment._id}`,
      occurredAt: row.payment.receivedAt,
      type: "Payment" as const,
      invoiceNumber: findInvoiceNumber(studentInvoices, row.payment.invoiceId),
      details: `${row.payment.reference} | ${row.payment.paymentMethod}`,
      charge: null,
      payment: row.payment.amountApplied,
      currency: statementCurrency,
      methodClass: "text-emerald-600",
    })),
  ].sort((left, right) => left.occurredAt - right.occurredAt);

  return (
    <div className="billing-print-root fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm print:static print:block print:overflow-visible print:bg-white print:p-0 print:backdrop-blur-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .billing-print-root, .billing-print-root * { visibility: visible; }
          .billing-print-root { position: absolute; inset: 0; width: 100%; }
        }
      `}</style>
      <div className="my-4 w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-950/20 print:my-0 print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 sm:p-6 print:hidden">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Printable finance pack</p>
            <h2 className="text-xl font-black tracking-tight text-slate-950">
              {mode === "invoice" ? "Student Invoice" : "Student Statement"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-950 hover:text-slate-950"
              aria-label="Close printable finance pack"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <article className="space-y-8 p-5 text-slate-950 sm:p-8 print:p-8">
          <header className="grid gap-6 border-b border-slate-200 pb-6 sm:grid-cols-[1fr_auto]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{school.name}</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {mode === "invoice" ? `Invoice ${invoice.invoice.invoiceNumber}` : `${invoice.studentName} Statement`}
              </h1>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {invoice.className} | {invoice.sessionName} | {invoice.termName}
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm print:bg-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student</p>
              <p className="mt-1 font-black text-slate-950">{invoice.studentName}</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Generated</p>
              <p className="mt-1 font-bold text-slate-700">{formatDateTime(Date.now())}</p>
            </div>
          </header>

          {mode === "invoice" ? (
            <section className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-4">
                  <SummaryBox label="Issued" value={formatDateTime(invoice.invoice.issuedAt)} />
                  <SummaryBox label="Due" value={formatDateTime(invoice.invoice.dueDate)} />
                  <SummaryBox label="Status" value={invoice.invoice.status.replace(/_/g, " ")} />
                  <SummaryBox label="Balance" value={formatMoney(invoice.invoice.balanceDue, invoice.invoice.currency)} emphasis />
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 print:bg-white">
                      <tr>
                        <th className="px-4 py-3">Charge</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {invoice.invoice.lineItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-bold text-slate-950">{item.label}</td>
                          <td className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-400">{item.category}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-950">{formatMoney(item.amount, invoice.invoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 text-sm font-black print:bg-white">
                      <tr><td className="px-4 py-2" colSpan={2}>Subtotal</td><td className="px-4 py-2 text-right">{formatMoney(invoice.invoice.subtotal, invoice.invoice.currency)}</td></tr>
                      <tr><td className="px-4 py-2" colSpan={2}>Waiver</td><td className="px-4 py-2 text-right">-{formatMoney(invoice.invoice.waiverAmount, invoice.invoice.currency)}</td></tr>
                      <tr><td className="px-4 py-2" colSpan={2}>Discount</td><td className="px-4 py-2 text-right">-{formatMoney(invoice.invoice.discountAmount, invoice.invoice.currency)}</td></tr>
                      <tr><td className="px-4 py-3" colSpan={2}>Total</td><td className="px-4 py-3 text-right">{formatMoney(invoice.invoice.totalAmount, invoice.invoice.currency)}</td></tr>
                      <tr><td className="px-4 py-3" colSpan={2}>Paid</td><td className="px-4 py-3 text-right text-emerald-600">{formatMoney(invoice.invoice.amountPaid, invoice.invoice.currency)}</td></tr>
                    </tfoot>
                  </table>
                </div>

                {invoice.invoice.notes && (
                  <div className="rounded-3xl border border-slate-200 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Notes</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{invoice.invoice.notes}</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4 rounded-[2rem] border border-slate-200 bg-slate-50 p-5 print:bg-white">
                <div>
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <QrCode className="h-4 w-4" /> Payment link
                  </p>
                  {safePaymentUrl ? (
                    <div className="mt-4 space-y-3">
                      <LocalPaymentQrCode value={safePaymentUrl} />
                      <a href={safePaymentUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 break-all rounded-2xl bg-white p-3 text-xs font-bold text-indigo-700 ring-1 ring-slate-200 print:text-slate-950">
                        <ExternalLink className="mt-0.5 h-4 w-4 flex-none" />
                        {safePaymentUrl}
                      </a>
                      {paymentReference && <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Reference: {paymentReference}</p>}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3 print:hidden">
                      <p className="text-sm font-semibold text-slate-600">
                        {invoice.invoice.balanceDue <= 0
                          ? "This invoice is fully settled, so no payment link is shown."
                          : "Generate a Paystack-first payment link for this invoice before printing."}
                      </p>
                      {invoice.invoice.balanceDue > 0 ? <form onSubmit={onGeneratePaymentLink} className="space-y-3">
                        <input
                          type="email"
                          required
                          value={paymentEmail}
                          onChange={(event) => onPaymentEmailChange(event.target.value)}
                          placeholder="payer@email.com"
                          className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-950 outline-none focus:border-slate-950"
                        />
                        <button type="submit" disabled={isGeneratingPaymentLink} className="h-11 w-full rounded-2xl bg-slate-950 text-[10px] font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-60">
                          {isGeneratingPaymentLink ? "Generating..." : "Generate payment link"}
                        </button>
                      </form> : null}
                    </div>
                  )}
                  {!paymentUrl && <p className="mt-4 hidden text-xs font-bold text-slate-500 print:block">No online payment link was generated for this printout.</p>}
                </div>
              </aside>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryBox label="Charges" value={formatMoney(statementTotalCharges, statementCurrency)} />
                <SummaryBox label="Payments applied" value={formatMoney(statementTotalPaid, statementCurrency)} />
                <SummaryBox label="Balance" value={formatMoney(statementBalance, statementCurrency)} emphasis />
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 print:bg-white">
                    <tr>
                      <th className="px-4 py-3">Date/time</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Invoice reference</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3 text-right">Charge</th>
                      <th className="px-4 py-3 text-right">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {statementRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-4 py-3 font-bold text-slate-700">{formatDateTime(row.occurredAt)}</td>
                        <td className={`px-4 py-3 text-xs font-black uppercase tracking-widest ${row.methodClass}`}>{row.type}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-950">{row.invoiceNumber}</td>
                        <td className="px-4 py-3 font-bold text-slate-950">{row.details}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-950">{row.charge === null ? "-" : formatMoney(row.charge, row.currency)}</td>
                        <td className="px-4 py-3 text-right font-black text-emerald-600">{row.payment === null ? "-" : formatMoney(row.payment, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </article>
      </div>
    </div>
  );
}

function LocalPaymentQrCode({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, value, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 192,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    }, (error) => {
      if (error) {
        console.error("QR code generation failed:", error);
        const context = canvas.getContext("2d");
        context?.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }, [value]);

  return (
    <canvas
      ref={canvasRef}
      width={192}
      height={192}
      aria-label="Payment QR code"
      className="mx-auto h-48 w-48 rounded-2xl border border-slate-200 bg-white p-2"
    />
  );
}

function SummaryBox({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-black ${emphasis ? "text-rose-600" : "text-slate-950"}`}>{value}</p>
    </div>
  );
}
