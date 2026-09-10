"use client";

import { useQuery } from "convex/react";
import { useAuth } from "@/AuthProvider";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { Landmark } from "lucide-react";

export function BankAccountSelection({
  value,
  onChange,
  label = "Deposit Account",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const accounts = useQuery(
    api.functions.academic.bankAccounts.listBankAccounts,
    schoolId ? { schoolId } : "skip",
  );

  const activeAccounts = accounts?.filter((a) => a.status === "active") ?? [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 font-display flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5 text-slate-400" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Optional
        </span>
      </div>

      <select
        className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all cursor-pointer"
        value={value}
        disabled={!accounts}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {accounts ? "Default school settlement account" : "Loading bank accounts…"}
        </option>
        {activeAccounts.map((a) => (
          <option key={a._id} value={a._id}>
            {a.label || a.bankName} · {a.accountNumber} ({a.currency})
          </option>
        ))}
      </select>

      <p className="text-[10px] text-slate-400 leading-normal">
        {value ? (
          <span className="text-indigo-600 font-semibold">
            Invoices from this plan will deposit into this account.
          </span>
        ) : (
          "Leave unset to route payments to the school's primary account."
        )}
      </p>
    </div>
  );
}
