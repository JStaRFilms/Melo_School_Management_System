import React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Check, ShieldAlert } from "lucide-react";
import { formatMoney } from "../utils";
import type { BillingDashboardData, FeePlanSortKey, SortDirection } from "../types";

interface FeePlanListProps {
  plans: BillingDashboardData["feePlans"];
  classNameById: Map<string, string>;
  sortKey: FeePlanSortKey;
  sortDirection: SortDirection;
  onSortChange: (key: FeePlanSortKey) => void;
  onNewPlan: () => void;
}

function FeePlanSortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
      }`}
    >
      <span>{label}</span>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function FeePlanList({ plans, classNameById, sortKey, sortDirection, onSortChange, onNewPlan }: FeePlanListProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-950/5 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 px-1">Revenue Blueprints</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block px-1">Active Templates</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-1">
          <FeePlanSortButton
            label="Date"
            active={sortKey === "date"}
            direction={sortDirection}
            onClick={() => onSortChange("date")}
          />
          <FeePlanSortButton
            label="Name"
            active={sortKey === "name"}
            direction={sortDirection}
            onClick={() => onSortChange("name")}
          />
          <FeePlanSortButton
            label="Amount"
            active={sortKey === "amount"}
            direction={sortDirection}
            onClick={() => onSortChange("amount")}
          />
          <FeePlanSortButton
            label="Status"
            active={sortKey === "status"}
            direction={sortDirection}
            onClick={() => onSortChange("status")}
          />
          <button
            type="button"
            onClick={onNewPlan}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            New Plan
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan._id} className="group relative rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-950 transition-all shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
               <div className="min-w-0">
                  <h4 className="font-bold text-slate-950 group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight truncate">{plan.name}</h4>
                  <p className="text-xs font-medium text-slate-400 mt-0.5 line-clamp-1">{plan.description || "System generated template."}</p>
               </div>
               <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${
                 plan.isActive ? "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-600/10" : "bg-slate-100 text-slate-500"
               }`}>
                 {plan.isActive ? "Active" : "Archived"}
               </span>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between py-2 border-y border-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pricing</span>
                  <span className="font-bold text-slate-950">
                    {formatMoney(plan.lineItems.reduce((acc, curr) => acc + curr.amount, 0), plan.currency)}
                  </span>
               </div>
               
               <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Applicability</span>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.targetClassIds.length > 0 ? (
                      plan.targetClassIds.slice(0, 3).map(id => (
                        <span key={id} className="px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[10px] font-bold border border-slate-200/50">
                          {classNameById.get(id) || "Class"}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 italic">One-off / Specific</span>
                    )}
                    {plan.targetClassIds.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-400">+{plan.targetClassIds.length - 3} more</span>
                    )}
                  </div>
               </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${plan.installmentPolicy.enabled ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"}`}>
                    {plan.installmentPolicy.enabled ? <Check className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {plan.installmentPolicy.enabled ? `${plan.installmentPolicy.installmentCount} Pay` : "Full Only"}
                  </span>
               </div>
               <button className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-950 transition-colors">Details</button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full py-16 text-center rounded-3xl border border-dashed border-slate-200 bg-white/50">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">No Plans Defined</p>
            <p className="text-xs text-slate-400 mt-1">Fee templates will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
