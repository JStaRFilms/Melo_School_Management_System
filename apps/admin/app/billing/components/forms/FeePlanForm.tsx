import {
  Check,
  Layers,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { cn } from "@/utils";
import type { ClassOption, FeePlanDraft } from "../../types";

interface FeePlanFormProps {
  draft: FeePlanDraft;
  onChange: (draft: FeePlanDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  classes: ClassOption[];
}

const labelCx = "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 font-display flex items-center gap-1.5";
const inputCx = "w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all placeholder:text-slate-400";

export function FeePlanForm({ draft, onChange, onSubmit, classes }: FeePlanFormProps) {
  const [showMultiClass, setShowMultiClass] = useState(() => draft.targetClassIds.length > 1);

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
    if (draft.lineItems.length <= 1) return;
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

  const toggleClassId = (classId: string) => {
    const exists = draft.targetClassIds.includes(classId);
    const next = exists
      ? draft.targetClassIds.filter((id) => id !== classId)
      : [...draft.targetClassIds, classId];
    onChange({ ...draft, targetClassIds: next });
  };

  const selectGroup = (pattern: RegExp) => {
    const matchingIds = classes
      .filter((c) => pattern.test(c.name))
      .map((c) => c._id);
    const combined = Array.from(new Set([...draft.targetClassIds, ...matchingIds]));
    onChange({ ...draft, targetClassIds: combined });
  };

  const mandatoryAmount = draft.lineItems
    .filter((i) => !i.isOptional)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const optionalAmount = draft.lineItems
    .filter((i) => i.isOptional)
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  const totalAmount = mandatoryAmount + optionalAmount;

  return (
    <form onSubmit={onSubmit} className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
        {/* Plan Name */}
        <div className="space-y-1">
          <label className={labelCx}>Plan Name *</label>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className={inputCx}
            placeholder="e.g. Primary 1 - 3 Termly Tuition"
            required
          />
        </div>

        {/* Target Classes Scope */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-center justify-between">
            <label className={labelCx}>
              <Layers className="h-3.5 w-3.5 text-slate-600" />
              <span>Target Class</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowMultiClass(!showMultiClass);
                if (showMultiClass) {
                  onChange({ ...draft, targetClassIds: draft.targetClassIds.slice(0, 1) });
                }
              }}
              className="text-[10px] font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {showMultiClass ? "Switch to Single Class" : "Bundle Multiple Classes"}
            </button>
          </div>

          {!showMultiClass ? (
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
              <option value="">All Classes (Universal Template)</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2 pt-1 animate-in fade-in duration-200">
              {/* Quick Group Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => selectGroup(/JSS|JS|Junior/i)}
                  className="rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 transition cursor-pointer"
                >
                  + All Junior (JS 1-3)
                </button>
                <button
                  type="button"
                  onClick={() => selectGroup(/SSS|SS|Senior/i)}
                  className="rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 transition cursor-pointer"
                >
                  + All Senior (SS 1-3)
                </button>
                <button
                  type="button"
                  onClick={() => selectGroup(/Primary|Basic|Pri/i)}
                  className="rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-700 transition cursor-pointer"
                >
                  + All Primary
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, targetClassIds: [] })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-400 hover:text-slate-700 transition cursor-pointer ml-auto"
                >
                  Clear
                </button>
              </div>

              {/* Class Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg border border-slate-200 bg-white custom-scrollbar">
                {classes.map((c) => {
                  const isSelected = draft.targetClassIds.includes(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleClassId(c._id)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                        isSelected
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-slate-500 font-medium">
                {draft.targetClassIds.length === 0
                  ? "Applies to all classes as a universal blueprint."
                  : `Bundled for ${draft.targetClassIds.length} specific class(es).`}
              </p>
            </div>
          )}
        </div>

        {/* Split Payments (Installments) */}
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
          <label className="flex items-center justify-between cursor-pointer select-none">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.installmentEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onChange({
                    ...draft,
                    installmentEnabled: enabled,
                    installmentCount: enabled ? (Number(draft.installmentCount) >= 2 ? draft.installmentCount : "2") : "1",
                    intervalDays: enabled ? "30" : "0",
                  });
                }}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                Allow Split Payments (Installments)
              </span>
            </div>
          </label>

          {draft.installmentEnabled && (
            <div className="pt-2 border-t border-slate-100 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600 shrink-0">
                  Number of payments:
                </span>
                <select
                  value={draft.installmentCount || "2"}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      installmentCount: e.target.value,
                      intervalDays: "30",
                    })
                  }
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-900 focus:border-slate-900 outline-none"
                >
                  <option value="2">2 Payments (50% / 50%)</option>
                  <option value="3">3 Payments (33% each)</option>
                  <option value="4">4 Payments (25% each)</option>
                </select>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Parents can pay in {draft.installmentCount || 2} suggested milestone installments or settle any custom amount / full balance at any time.
              </p>
            </div>
          )}
        </div>

        {/* Fee Line Items */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className={labelCx}>
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Fee Items Breakdown</span>
            </label>
            <button
              type="button"
              onClick={() => addLineItem()}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-1 text-[10px] font-bold transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Item</span>
            </button>
          </div>

          {/* Spacious 2-Row Line Item Cards */}
          <div className="space-y-2.5">
            {draft.lineItems.map((item, idx) => (
              <div
                key={item.draftId}
                className={cn(
                  "p-3 rounded-xl border bg-white space-y-2 transition-all shadow-2xs",
                  item.isOptional
                    ? "border-amber-300/80 bg-amber-50/20"
                    : "border-slate-200"
                )}
              >
                {/* Row 1: Full-Width Item Label */}
                <input
                  value={item.label}
                  onChange={(e) => updateLineItem(idx, { label: e.target.value })}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-slate-900 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                  placeholder="Item name (e.g. Tuition, School Uniform, Bus Service)"
                  required
                />

                {/* Row 2: Amount + Requirement Toggle + Delete */}
                <div className="flex items-center gap-2">
                  {/* Amount with ₦ prefix */}
                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none font-mono">
                      ₦
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.amount}
                      onChange={(e) => handleAmountChange(idx, e.target.value)}
                      placeholder="0.00"
                      className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-7 pr-3 text-xs font-mono font-bold text-slate-900 focus:border-slate-900 outline-none transition-all text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      required
                    />
                  </div>

                  {/* Sleek Toggle Button */}
                  <button
                    type="button"
                    onClick={() => updateLineItem(idx, { isOptional: !item.isOptional })}
                    className={cn(
                      "h-9 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-1",
                      item.isOptional
                        ? "bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200"
                        : "bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                    )}
                    title={item.isOptional ? "Optional Add-on: Parents can toggle during payment" : "Mandatory: Compulsory baseline fee"}
                  >
                    <span>{item.isOptional ? "✨ Optional" : "🔒 Mandatory"}</span>
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => removeLineItem(idx)}
                    disabled={draft.lineItems.length <= 1}
                    className="flex h-9 w-8 items-center justify-center rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Preset Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Add Preset:
            </span>
            {[
              { label: "Tuition", optional: false },
              { label: "Development Levy", optional: false },
              { label: "Uniform (Opt)", actualLabel: "School Uniform", optional: true },
              { label: "Bus Service (Opt)", actualLabel: "Bus / Transport", optional: true },
              { label: "PTA Levy", actualLabel: "PTA Due", optional: false },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addLineItem(preset.actualLabel || preset.label, preset.optional)}
                className="rounded-md border border-slate-200 bg-white hover:bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Solid Pinned Non-Scrolling Bottom Footer (Summary + Action Button) */}
      <div className="shrink-0 bg-white border-t border-slate-200 p-4 sm:p-5 space-y-3 shadow-lg z-20">
        {/* Dynamic Real-Time Breakdown Card */}
        <div className="rounded-xl bg-slate-950 p-3.5 text-white shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-semibold">Mandatory Base:</span>
            <span className="font-mono font-bold text-slate-200">
              ₦{mandatoryAmount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          {optionalAmount > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-400 font-semibold">+ Optional Add-ons:</span>
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

        <button
          type="submit"
          className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md cursor-pointer"
        >
          Create Fee Plan
        </button>
      </div>
    </form>
  );
}


