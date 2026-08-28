import { Info, Plus, Sparkles, Trash2 } from "lucide-react";
import React from "react";
import type { ClassOption, FeePlanDraft } from "../../types";

interface FeePlanFormProps {
  draft: FeePlanDraft;
  onChange: (draft: FeePlanDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  classes: ClassOption[];
}

const labelCx = "text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600";
const inputCx = "w-full h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all placeholder:text-slate-400";

export function FeePlanForm({ draft, onChange, onSubmit, classes }: FeePlanFormProps) {
  const addLineItem = (defaultLabel = "", isOptional = false) => {
    onChange({
      ...draft,
      lineItems: [
        ...draft.lineItems,
        {
          draftId: crypto.randomUUID(),
          label: defaultLabel,
          amount: "",
          category: "tuition",
          isOptional,
        },
      ],
    });
  };

  const removeLineItem = (index: number) => {
    onChange({
      ...draft,
      lineItems: draft.lineItems.filter((_, i) => i !== index),
    });
  };

  const updateLineItem = (index: number, updates: Partial<FeePlanDraft["lineItems"][0]>) => {
    const newLineItems = [...draft.lineItems];
    newLineItems[index] = { ...newLineItems[index], ...updates };
    onChange({ ...draft, lineItems: newLineItems });
  };

  const handleAmountChange = (index: number, rawVal: string) => {
    let cleaned = rawVal.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }
    if (cleaned.length > 1 && cleaned.startsWith("0") && !cleaned.startsWith("0.")) {
      cleaned = cleaned.replace(/^0+/, "");
    }
    updateLineItem(index, { amount: cleaned });
  };

  const mandatoryAmount = draft.lineItems
    .filter((i) => !i.isOptional)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const optionalAmount = draft.lineItems
    .filter((i) => i.isOptional)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const totalAmount = mandatoryAmount + optionalAmount;

  return (
    <form onSubmit={onSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-4">
        {/* Plan Name */}
        <div className="space-y-1.5">
          <label className={labelCx}>Plan Name</label>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className={inputCx}
            placeholder="e.g. Primary 3 Termly Tuition (2026/2027)"
          />
        </div>

        {/* Target Class (Optional) */}
        <div className="space-y-1.5">
          <label className={labelCx}>Target Class (Optional)</label>
          <select
            value={draft.targetClassIds[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...draft,
                targetClassIds: val ? [val] : [],
              });
            }}
            className={inputCx}
          >
            <option value="">All Classes (General Template)</option>
            {classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Split Payments */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-3 h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={draft.installmentEnabled}
              onChange={(e) =>
                onChange({
                  ...draft,
                  installmentEnabled: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm font-semibold text-slate-700 select-none">
              Allow Split Payments / Installments
            </span>
          </label>
        </div>

        {draft.installmentEnabled && (
          <div className="space-y-1.5 animate-in fade-in duration-200">
            <label className={labelCx}>Number of Installments</label>
            <input
              type="number"
              min="2"
              max="12"
              value={draft.installmentCount}
              onChange={(e) =>
                onChange({
                  ...draft,
                  installmentCount: e.target.value,
                })
              }
              className={inputCx}
              placeholder="e.g. 3"
            />
          </div>
        )}

        {/* Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelCx}>Fee Breakdown / Line Items</label>
            <button
              type="button"
              onClick={() => addLineItem()}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {draft.lineItems.map((item, idx) => (
              <div
                key={item.draftId}
                className="p-3 rounded-xl border border-slate-200 bg-white space-y-2.5 animate-in zoom-in-95 duration-200 shadow-2xs hover:border-slate-300"
              >
                <div className="flex items-center gap-2">
                  <input
                    value={item.label}
                    onChange={(e) => updateLineItem(idx, { label: e.target.value })}
                    className="flex-1 min-w-0 h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-slate-900 outline-none transition-all placeholder:text-slate-400"
                    placeholder="e.g. Tuition, School Uniform, Bus"
                  />
                  <div className="relative w-36 sm:w-40 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none font-mono">
                      ₦
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-7 pr-3 text-xs font-bold text-slate-900 focus:border-slate-900 outline-none transition-all text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    className="flex h-10 w-9 items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                    title="Remove line item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Requirement:
                    </span>
                    <button
                      type="button"
                      onClick={() => updateLineItem(idx, { isOptional: !item.isOptional })}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        item.isOptional
                          ? "bg-amber-50 text-amber-800 border border-amber-300/80 shadow-2xs hover:bg-amber-100"
                          : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80"
                      }`}
                    >
                      <span>
                        {item.isOptional ? "✨ Optional Add-on (Payer Can Toggle)" : "🔒 Mandatory Fee"}
                      </span>
                    </button>
                  </div>
                  {item.isOptional && (
                    <span className="text-[10px] text-amber-700 font-medium hidden sm:inline">
                      Parents can opt in / out
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Quick preset pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Presets:</span>
            {[
              { label: "Tuition", optional: false },
              { label: "Development Levy", optional: false },
              { label: "School Uniform", optional: true },
              { label: "Bus / Transport", optional: true },
              { label: "PTA Due", optional: false },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addLineItem(preset.label, preset.optional)}
                className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-slate-400 hover:bg-white hover:text-slate-900 transition-all cursor-pointer flex items-center gap-1"
              >
                <span>+ {preset.label}</span>
                {preset.optional && <span className="text-[9px] text-amber-600 font-bold">(Opt)</span>}
              </button>
            ))}
          </div>

          {/* Total Summary Card */}
          <div className="rounded-xl bg-slate-950 p-3.5 text-white shadow-xs space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-bold uppercase tracking-wider">Mandatory Base:</span>
              <span className="font-mono font-bold text-slate-200">
                ₦{mandatoryAmount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {optionalAmount > 0 && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-amber-400 font-bold uppercase tracking-wider">+ Optional Add-ons:</span>
                <span className="font-mono font-bold text-amber-300">
                  ₦{optionalAmount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Total (All Included)
              </span>
              <span className="text-sm font-black font-mono tracking-tight text-emerald-400">
                ₦{totalAmount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Info callout */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex gap-2.5">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Fee plans serve as billing blueprints. Optional add-ons (like uniforms or transport) allow parents to customize their settlement during payment.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={!draft.name.trim() || draft.lineItems.length === 0 || totalAmount <= 0}
        className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-md shadow-slate-900/10 cursor-pointer"
      >
        Create Fee Plan
      </button>
    </form>
  );
}
