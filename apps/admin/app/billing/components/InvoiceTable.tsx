import React from "react";
import { formatMoney } from "../utils";
import type { BillingDashboardData, InvoiceSortKey, SortDirection } from "../types";
import { SortHeaderButton } from "./SortHeaderButton";

interface InvoiceTableProps {
  invoices: BillingDashboardData["invoices"];
  sortKey: InvoiceSortKey;
  sortDirection: SortDirection;
  onSortChange?: (key: InvoiceSortKey) => void;
  sortable?: boolean;
  onViewInvoice?: (id: string) => void;
}

export function InvoiceTable({
  invoices,
  sortKey,
  sortDirection,
  onSortChange,
  sortable = true,
  onViewInvoice,
}: InvoiceTableProps) {
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
                  label="Recipients"
                  active={sortKey === "recipient"}
                  direction={sortDirection}
                  onClick={() => onSortChange("recipient")}
                />
              ) : (
                <span className="uppercase tracking-widest">Recipients</span>
              )}
            </th>
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Summary"
                  active={sortKey === "amount"}
                  direction={sortDirection}
                  onClick={() => onSortChange("amount")}
                />
              ) : (
                <span className="uppercase tracking-widest">Summary</span>
              )}
            </th>
            <th className="px-6 py-3 font-bold text-[10px] text-slate-400">
              {sortable && onSortChange ? (
                <SortHeaderButton
                  label="Status"
                  active={sortKey === "status"}
                  direction={sortDirection}
                  onClick={() => onSortChange("status")}
                />
              ) : (
                <span className="uppercase tracking-widest">Status</span>
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
          {invoices.map((row) => (
            <tr key={row.invoice._id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-display font-bold text-slate-950">
                  {row.invoice.invoiceNumber}
                </span>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Due {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(row.invoice.dueDate)}
                </p>
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-950 truncate max-w-[180px]">{row.studentName}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{row.className}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-bold text-slate-950">
                  {formatMoney(row.invoice.totalAmount, row.invoice.currency)}
                </div>
                {row.invoice.balanceDue > 0 && (
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                    {formatMoney(row.invoice.balanceDue, row.invoice.currency)} Pending
                  </p>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
                  row.invoice.status === "paid" 
                    ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10" 
                    : row.invoice.status === "overdue"
                    ? "bg-rose-50 text-rose-600 ring-1 ring-rose-600/10"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {row.invoice.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(row.invoice.issuedAt)}
              </td>
            </tr>
          ))}
          {invoices.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-20 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">No Ledger Activity</p>
                <p className="text-xs text-slate-400 mt-1">Invoices will appear here once generated.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
