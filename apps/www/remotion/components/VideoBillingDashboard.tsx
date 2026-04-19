import React from "react";
import { AlertTriangle, Banknote, Landmark, ReceiptText } from "lucide-react";

const kpis = [
  { label: "Outstanding", value: "N5.7M", icon: Banknote },
  { label: "Collected", value: "N18.5M", icon: Landmark },
  { label: "Invoices", value: "412", icon: ReceiptText },
  { label: "Overdue", value: "37", icon: AlertTriangle, tone: "rose" },
];

const invoices = [
  {
    ref: "INV-2026-00421",
    student: "Sarah Sunday",
    classroom: "Grade 5 A",
    amount: "N450,000",
    pending: "N120,000 pending",
    status: "partially paid",
    date: "18 Apr 2026",
  },
  {
    ref: "INV-2026-00420",
    student: "David Okafor",
    classroom: "JSS 2 Gold",
    amount: "N450,000",
    pending: "N0 pending",
    status: "paid",
    date: "17 Apr 2026",
  },
  {
    ref: "INV-2026-00419",
    student: "Blessing Edet",
    classroom: "Primary 4 Blue",
    amount: "N280,000",
    pending: "N280,000 pending",
    status: "overdue",
    date: "15 Apr 2026",
  },
];

const payments = [
  {
    ref: "PAY-93821",
    invoice: "INV-2026-00421",
    payer: "John Sunday",
    email: "johnsunday@gmail.com",
    amount: "N120,000",
    date: "18 Apr 2026, 11:34",
  },
  {
    ref: "PAY-93820",
    invoice: "INV-2026-00420",
    payer: "Ngozi Okafor",
    email: "ngoziokafor@gmail.com",
    amount: "N450,000",
    date: "17 Apr 2026, 09:11",
  },
];

export const VideoBillingDashboard: React.FC = () => {
  return (
    <div className="space-y-7">
      <header className="space-y-6">
        <div className="flex items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
              Billing ledger
            </h1>
            <p className="max-w-xl text-[13px] font-medium leading-relaxed text-slate-500">
              Monitor school-wide collections, outstanding balances, and recent payment activity.
            </p>
          </div>

          <button className="rounded-3xl bg-slate-950 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-xl shadow-slate-900/20">
            Financial Hub
          </button>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-950/5"
            >
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-400">
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.tone === "rose" ? "text-rose-500" : ""}`} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  {kpi.label}
                </p>
              </div>
              <div className="mt-1 px-0.5 text-xl font-black tracking-tight text-slate-950">
                {kpi.value}
              </div>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-[1.08fr_0.92fr] gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-950/5 px-6 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Open receivables
            </p>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-950/5 bg-slate-50/50">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Recipients
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Summary
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950/5">
              {invoices.map((invoice, index) => (
                <tr key={invoice.ref} className={index === 0 ? "bg-slate-50/40" : ""}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-slate-950">{invoice.ref}</div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {invoice.status}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-950">{invoice.student}</div>
                    <div className="text-[10px] font-bold uppercase tracking-tight text-slate-400">
                      {invoice.classroom}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-slate-950">{invoice.amount}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                      {invoice.pending}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {invoice.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-950/5 px-6 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Recent collections
            </p>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-950/5 bg-slate-50/50">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Recipient
                </th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Settlement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-950/5">
              {payments.map((payment) => (
                <tr key={payment.ref}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px] font-bold text-slate-950 ring-1 ring-slate-950/5">
                      {payment.ref}
                    </span>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-slate-400">
                      {payment.invoice}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-950">{payment.payer}</div>
                    <div className="truncate text-[10px] font-medium text-slate-400">
                      {payment.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-emerald-600">{payment.amount}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {payment.date}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};
