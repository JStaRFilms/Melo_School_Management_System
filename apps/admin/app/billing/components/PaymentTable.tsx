import React from "react";
import { formatMoney, formatDateTime } from "../utils";
import type { BillingDashboardData, PaymentSortKey, SortDirection } from "../types";
import { SortHeaderButton } from "./SortHeaderButton";

interface PaymentTableProps {
  payments: BillingDashboardData["payments"];
  sortKey: PaymentSortKey;
  sortDirection: SortDirection;
  onSortChange?: (key: PaymentSortKey) => void;
  sortable?: boolean;
}

export function PaymentTable({
  payments,
  sortKey,
  sortDirection,
  onSortChange,
  sortable = true,
}: PaymentTableProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-950/5 bg-slate-50/50">
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Reference"
                  active={sortKey === "reference"}
                  direction={sortDirection}
                  onClick={() => onSortChange("reference")}
                />
              ) : (
                <span className="uppercase tracking-widest">Reference</span>
              )}
            </th>
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Identifier"
                  active={sortKey === "identifier"}
                  direction={sortDirection}
                  onClick={() => onSortChange("identifier")}
                />
              ) : (
                <span className="uppercase tracking-widest">Identifier</span>
              )}
            </th>
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Recipient"
                  active={sortKey === "recipient"}
                  direction={sortDirection}
                  onClick={() => onSortChange("recipient")}
                />
              ) : (
                <span className="uppercase tracking-widest">Recipient</span>
              )}
            </th>
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Settlement"
                  active={sortKey === "settlement"}
                  direction={sortDirection}
                  onClick={() => onSortChange("settlement")}
                />
              ) : (
                <span className="uppercase tracking-widest">Settlement</span>
              )}
            </th>
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400 text-right">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Date"
                  active={sortKey === "date"}
                  direction={sortDirection}
                  onClick={() => onSortChange("date")}
                  align="right"
                />
              ) : (
                <span className="uppercase tracking-widest">Date</span>
              )}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-950/5">
          {payments.map((row) => (
            <tr key={row.payment._id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-mono text-[10px] font-bold text-slate-950 bg-slate-100 px-2 py-1 rounded-md ring-1 ring-slate-950/5">
                  {row.payment.reference}
                </span>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-1">{row.payment.paymentMethod}</p>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-bold text-slate-950">{row.invoiceNumber}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Invoice</div>
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-950 truncate max-w-[150px]">{row.payment.payerName || row.studentName}</div>
                <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{row.payment.payerEmail || "Manual Record"}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="font-bold text-emerald-600">
                  {formatMoney(row.payment.amountReceived, "NGN")}
                </div>
                <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-emerald-500`}>
                  Confirmed
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                {formatDateTime(row.payment.receivedAt)}
              </td>
            </tr>
          ))}
          {payments.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-20 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">No Payment Activity</p>
                <p className="text-xs text-slate-400 mt-1">Manual and online payments will be logged here.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
