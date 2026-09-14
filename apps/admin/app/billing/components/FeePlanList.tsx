import React, { useMemo, useState } from "react";
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Ban, Check, Layers, Plus, RotateCcw, Send, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { formatMoney } from "../utils";
import type { BillingDashboardData, FeePlanSortKey, SortDirection } from "../types";

interface FeePlanListProps {
  plans: BillingDashboardData["feePlans"];
  classNameById: Map<string, string>;
  sortKey: FeePlanSortKey;
  sortDirection: SortDirection;
  onSortChange: (key: FeePlanSortKey) => void;
  onNewPlan?: () => void;
  onApplyPlan?: (planId: string) => void;
  onArchivePlan?: (planId: string) => Promise<boolean>;
  onRestorePlan?: (planId: string) => Promise<boolean>;
  onDeletePlan?: (planId: string, expectedName: string) => Promise<boolean>;
  onRevokePlan?: (planId: string, reason: string) => Promise<boolean>;
}

type FeePlan = BillingDashboardData["feePlans"][number];
type LifecycleAction = "archive" | "restore" | "delete" | "revoke";

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

export function FeePlanList({
  plans,
  classNameById,
  sortKey,
  sortDirection,
  onSortChange,
  onNewPlan,
  onApplyPlan,
  onArchivePlan,
  onRestorePlan,
  onDeletePlan,
  onRevokePlan,
}: FeePlanListProps) {
  const [selectedPlan, setSelectedPlan] = useState<FeePlan | null>(null);
  const [view, setView] = useState<"active" | "archived">("active");
  const [pendingAction, setPendingAction] = useState<{ action: LifecycleAction; plan: FeePlan } | null>(null);
  const [revocationReason, setRevocationReason] = useState("");
  const [actionPending, setActionPending] = useState(false);
  const visiblePlans = useMemo(
    () => plans.filter((plan) => view === "active" ? plan.isActive : !plan.isActive),
    [plans, view],
  );
  const archivedCount = plans.filter((plan) => !plan.isActive).length;

  const closeAction = () => {
    if (actionPending) return;
    setPendingAction(null);
    setRevocationReason("");
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setActionPending(true);
    const { action, plan } = pendingAction;
    let succeeded = false;
    try {
      if (action === "archive" && onArchivePlan) succeeded = await onArchivePlan(plan._id);
      if (action === "restore" && onRestorePlan) succeeded = await onRestorePlan(plan._id);
      if (action === "delete" && onDeletePlan) succeeded = await onDeletePlan(plan._id, plan.name);
      if (action === "revoke" && onRevokePlan) succeeded = await onRevokePlan(plan._id, revocationReason.trim());
      if (succeeded) {
        setSelectedPlan(null);
        setPendingAction(null);
        setRevocationReason("");
      }
    } finally {
      setActionPending(false);
    }
  };

  const actionCopy = pendingAction ? {
    archive: {
      title: "Archive this fee plan?",
      description: "The plan will stop generating invoices and move to the archived view. Existing invoices and payments stay unchanged.",
      label: "Archive plan",
      variant: "warning" as const,
    },
    restore: {
      title: "Restore this fee plan?",
      description: "The plan will return to the active list and can generate new invoices again.",
      label: "Restore plan",
      variant: "emerald" as const,
    },
    delete: {
      title: "Permanently delete this fee plan?",
      description: `Delete ${pendingAction.plan.name}. This is allowed only because it has no application runs or invoices. This action cannot be undone.`,
      label: "Delete permanently",
      variant: "danger" as const,
    },
    revoke: {
      title: "Revoke unpaid invoices?",
      description: `${pendingAction.plan.usage.revocableInvoiceCount} unpaid invoice${pendingAction.plan.usage.revocableInvoiceCount === 1 ? "" : "s"} will be cancelled and this plan will be archived. ${pendingAction.plan.usage.blockedPaidInvoiceCount} paid or partly paid invoice${pendingAction.plan.usage.blockedPaidInvoiceCount === 1 ? "" : "s"} will remain unchanged.`,
      label: "Revoke invoices",
      variant: "danger" as const,
    },
  }[pendingAction.action] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-950/5 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 px-1">Revenue Blueprints</h3>
          <div className="flex rounded-full border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("active")}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${view === "active" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setView("archived")}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${view === "archived" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}
            >
              Archived {archivedCount > 0 ? `(${archivedCount})` : ""}
            </button>
          </div>
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
          {onNewPlan && <button
            type="button"
            onClick={onNewPlan}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-800 cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Plan
          </button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visiblePlans.map((plan) => (
          <div key={plan._id} className="group relative rounded-2xl border border-slate-200 bg-white p-5 hover:border-slate-400 transition-all shadow-xs">
            <div className="flex items-start justify-between gap-4 mb-4">
               <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight truncate">{plan.name}</h4>
                  <p className="text-xs font-medium text-slate-400 mt-0.5 line-clamp-1">{plan.description || "System generated template."}</p>
               </div>
               <span className={`shrink-0 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest ${
                 plan.isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20" : "bg-slate-100 text-slate-500"
               }`}>
                 {plan.isActive ? "Active" : "Archived"}
               </span>
            </div>

            <div className="space-y-4">
               <div className="flex items-center justify-between py-2 border-y border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Plan Amount</span>
                  <span className="font-mono font-bold text-slate-950 text-sm">
                    {formatMoney(plan.lineItems.reduce((acc, curr) => acc + curr.amount, 0), plan.currency)}
                  </span>
               </div>
               
               <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Applicability</span>
                  <div className="flex flex-wrap gap-1.5">
                    {plan.targetClassIds.length > 0 ? (
                      plan.targetClassIds.slice(0, 3).map(id => (
                        <span key={id} className="px-2 py-0.5 rounded-lg bg-slate-50 text-slate-700 text-[10px] font-bold border border-slate-200">
                          {classNameById.get(id) || "Class"}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 italic bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">Universal (All Classes)</span>
                    )}
                    {plan.targetClassIds.length > 3 && (
                      <span className="text-[10px] font-bold text-slate-400 self-center">+{plan.targetClassIds.length - 3} more</span>
                    )}
                  </div>
               </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${plan.installmentPolicy.enabled ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {plan.installmentPolicy.enabled ? <Check className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {plan.installmentPolicy.enabled ? `${plan.installmentPolicy.installmentCount} Payments` : "Full Settlement"}
                  </span>
               </div>
               <button
                 type="button"
                 onClick={() => setSelectedPlan(plan)}
                 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:underline transition-colors cursor-pointer"
               >
                 Details
               </button>
            </div>
          </div>
        ))}
        {visiblePlans.length === 0 && (
          <div className="col-span-full py-16 text-center rounded-3xl border border-dashed border-slate-200 bg-white/50">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">No {view} plans</p>
            <p className="text-xs text-slate-400 mt-1">{view === "active" ? "Create a fee plan or restore one from the archive." : "Archived fee plans will appear here."}</p>
          </div>
        )}
      </div>

      {/* Fee Plan Details Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Fee Blueprint Details</p>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedPlan.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlan(null)}
                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
                  <p className="text-xs font-bold text-slate-900 capitalize">{selectedPlan.isActive ? "Active Blueprint" : "Archived"}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Split Payment Policy</span>
                  <p className="text-xs font-bold text-slate-900">
                    {selectedPlan.installmentPolicy.enabled ? `${selectedPlan.installmentPolicy.installmentCount} Installments` : "Full Settlement Only"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Currency</span>
                  <p className="text-xs font-bold text-slate-900">{selectedPlan.currency || "NGN"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                  <span><strong className="text-slate-900">{selectedPlan.usage.invoiceCount}</strong> <span className="text-slate-500">issued</span></span>
                  <span><strong className="text-slate-900">{selectedPlan.usage.revocableInvoiceCount}</strong> <span className="text-slate-500">unpaid and revocable</span></span>
                  <span><strong className="text-slate-900">{selectedPlan.usage.blockedPaidInvoiceCount}</strong> <span className="text-slate-500">payment-protected</span></span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {selectedPlan.usage.canDelete
                    ? "No invoice or application history exists. This plan can be permanently deleted."
                    : "This plan has billing history and cannot be deleted. Archive it to stop future use."}
                </p>
              </div>

              {/* Applicability */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                  <span>Applicable Target Classes</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlan.targetClassIds.length > 0 ? (
                    selectedPlan.targetClassIds.map((id) => (
                      <span key={id} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                        {classNameById.get(id) || "Class"}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-slate-600 italic bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                      🌍 Universal Template (Applies to all school classes)
                    </span>
                  )}
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span>Itemized Fee Breakdown</span>
                </label>
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Item Description</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Requirement</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPlan.lineItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-2.5 font-bold text-slate-900">{item.label}</td>
                          <td className="px-4 py-2.5 text-[11px] font-semibold text-slate-500 capitalize">{item.category}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              item.isOptional ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-700"
                            }`}>
                              {item.isOptional ? "✨ Optional Add-on" : "🔒 Mandatory"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                            {formatMoney(item.amount, selectedPlan.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Financial Summary Card */}
              <div className="rounded-xl bg-slate-950 p-4 text-white space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Mandatory Baseline Total:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {formatMoney(
                      selectedPlan.lineItems.filter((i) => !i.isOptional).reduce((sum, curr) => sum + curr.amount, 0),
                      selectedPlan.currency
                    )}
                  </span>
                </div>
                {selectedPlan.lineItems.some((i) => i.isOptional) && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-amber-400 font-semibold">+ Optional Add-ons Total:</span>
                    <span className="font-mono font-bold text-amber-300">
                      {formatMoney(
                        selectedPlan.lineItems.filter((i) => i.isOptional).reduce((sum, curr) => sum + curr.amount, 0),
                        selectedPlan.currency
                      )}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-sm">
                  <span className="font-bold uppercase tracking-wider text-slate-300">Total (All Included)</span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    {formatMoney(
                      selectedPlan.lineItems.reduce((sum, curr) => sum + curr.amount, 0),
                      selectedPlan.currency
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {selectedPlan.isActive && onArchivePlan && (
                  <button
                    type="button"
                    onClick={() => setPendingAction({ action: "archive", plan: selectedPlan })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                )}
                {!selectedPlan.isActive && onRestorePlan && (
                  <button
                    type="button"
                    onClick={() => setPendingAction({ action: "restore", plan: selectedPlan })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                )}
                {selectedPlan.usage.revocableInvoiceCount > 0 && onRevokePlan && (
                  <button
                    type="button"
                    onClick={() => setPendingAction({ action: "revoke", plan: selectedPlan })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Revoke invoices
                  </button>
                )}
                {selectedPlan.usage.canDelete && onDeletePlan && (
                  <button
                    type="button"
                    onClick={() => setPendingAction({ action: "delete", plan: selectedPlan })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPlan(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  Close
                </button>
                {selectedPlan.isActive && onApplyPlan && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedPlan._id;
                      setSelectedPlan(null);
                      onApplyPlan(id);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Bulk Invoice with this Plan</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(pendingAction && actionCopy)}
        onClose={closeAction}
        onConfirm={() => void confirmAction()}
        title={actionCopy?.title ?? "Confirm fee-plan action"}
        description={actionCopy?.description ?? "Review this fee-plan action before continuing."}
        confirmLabel={actionCopy?.label}
        confirmVariant={actionCopy?.variant}
        isLoading={actionPending}
        confirmDisabled={pendingAction?.action === "revoke" && revocationReason.trim().length < 5}
      >
        {pendingAction?.action === "revoke" && (
          <label className="block space-y-1.5 text-xs font-bold text-slate-700">
            Reason for revocation
            <textarea
              value={revocationReason}
              onChange={(event) => setRevocationReason(event.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="For example, the approved fee amount changed."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
            <span className="block text-[10px] font-medium text-slate-400">At least 5 characters. This reason is stored on every cancelled invoice.</span>
          </label>
        )}
      </ConfirmationModal>
    </div>
  );
}

