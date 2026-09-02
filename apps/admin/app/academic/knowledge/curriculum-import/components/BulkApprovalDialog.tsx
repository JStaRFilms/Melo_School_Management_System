"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ShieldCheck, X, Sparkles } from "lucide-react";
import type { CurriculumUnit } from "./types";

interface Props {
  units: CurriculumUnit[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (units: CurriculumUnit[]) => void;
}

export function BulkApprovalDialog({ units, busy, onCancel, onConfirm }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (units.length === 0 || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-approval-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <button
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Cancel approval"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
              Bulk Action
            </span>
            <span className="text-xs font-bold text-slate-500">
              {units.length} {units.length === 1 ? "Unit" : "Units"} Selected
            </span>
          </div>
          <h2 id="bulk-approval-title" className="mt-2 text-xl font-black text-slate-950 tracking-tight">
            Approve {units.length} Curriculum {units.length === 1 ? "Topic" : "Topics"}?
          </h2>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            These units will be converted into active school topics and instantly linked to your curriculum knowledge bank.
          </p>
        </div>

        {/* Scrollable list of units */}
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 divide-y divide-slate-100 custom-scrollbar space-y-1.5">
          {units.map((unit) => (
            <div key={unit._id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                  {unit.weekNumber ? `W${unit.weekNumber}` : "—"}
                </span>
                <span className="text-xs font-bold text-slate-900 truncate">
                  {unit.title}
                </span>
              </div>
              <span className="text-[10px] font-medium text-slate-500 shrink-0">
                {unit.learningObjectives.length} obj
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-amber-50/80 border border-amber-200/70 p-3 text-[11px] font-semibold leading-relaxed text-amber-900 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Teachers will immediately be able to generate lesson plans, notes, and assessment questions against these approved topics.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            disabled={busy}
            onClick={onCancel}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => onConfirm(units)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span>Approve {units.length} {units.length === 1 ? "Topic" : "Topics"}</span>
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
