import { Info,Trash2 } from "lucide-react";
import React from "react";
import type { ClassOption,FeePlanDraft } from "../../types";

interface FeePlanFormProps {
  draft: FeePlanDraft;
  onChange: (draft: FeePlanDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  classes: ClassOption[];
}

const labelCx = "text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600";
const inputCx = "w-full h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-all placeholder:text-slate-400";

export function FeePlanForm({ draft, onChange, onSubmit }: FeePlanFormProps) {
  const addLineItem = () => {
    onChange({
      ...draft,
      lineItems: [...draft.lineItems, { 
        draftId: crypto.randomUUID(), 
        label: "", 
        amount: "0", 
        category: "tuition" 
      }],
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

  return (
    <form onSubmit={onSubmit} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className={labelCx}>Plan Name</label>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            className={inputCx}
            placeholder="e.g. JSS1 Termly Tuition (2026)"
          />
        </div>

        <div className="space-y-1.5">
           <div className="flex items-center gap-3 h-11 px-4 rounded-xl bg-slate-50 border border-slate-200">
              <input
                type="checkbox"
                checked={draft.installmentEnabled}
                onChange={(e) => onChange({ 
                  ...draft, 
                  installmentEnabled: e.target.checked 
                })}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="text-sm font-semibold text-slate-700">Allow Split Payments</span>
           </div>
        </div>
           
        {draft.installmentEnabled && (
          <div className="space-y-1.5">
             <label className={labelCx}>Number of Installments</label>
             <input
               type="number"
               value={draft.installmentCount}
               onChange={(e) => onChange({ 
                 ...draft, 
                 installmentCount: e.target.value 
               })}
               className={inputCx}
             />
          </div>
        )}

        {/* Line Items */}
        <div className="space-y-3">
           <div className="flex items-center justify-between">
              <label className={labelCx}>Line Items</label>
              <button 
                type="button" 
                onClick={addLineItem}
                className="text-[11px] font-bold text-slate-900 hover:text-slate-600 transition-colors"
              >
                + Add Item
              </button>
           </div>
           
           <div className="space-y-2">
              {draft.lineItems.map((item, idx) => (
                <div key={item.draftId} className="flex gap-2 animate-in zoom-in-95 duration-200">
                  <input
                    value={item.label}
                    onChange={(e) => updateLineItem(idx, { label: e.target.value })}
                    className="flex-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-slate-900 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Item name"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">₦</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateLineItem(idx, { amount: e.target.value })}
                      className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-7 pr-3 text-xs font-semibold text-slate-900 focus:border-slate-900 outline-none transition-all text-right"
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={() => removeLineItem(idx)}
                    className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
           </div>
        </div>

        {/* Info callout */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex gap-3">
           <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
           <p className="text-[12px] text-slate-600 leading-relaxed">
             Plans are templates. Changes won&apos;t retroactively affect existing invoices.
           </p>
        </div>
      </div>

      <button 
        type="submit" 
        className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
      >
        Create Fee Plan
      </button>
    </form>
  );
}
