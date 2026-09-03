"use client";

import { memo } from "react";
import { CheckCircle2, GraduationCap, Layers, ShieldCheck, Sparkles } from "lucide-react";
import type { ScaleTemplateDraft } from "../types";

interface ScaleLiveCanvasProps {
  draft: ScaleTemplateDraft;
}

export const ScaleLiveCanvas = memo(function ScaleLiveCanvas({ draft }: ScaleLiveCanvasProps) {
  return (
    <div className="w-full space-y-4">
      <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl shadow-slate-900/5 space-y-5 transition-all text-slate-800">
        {/* Header */}
        <div className="border-b-2 border-slate-900/10 pb-4 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-md shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 truncate">
                Rating Scale Preview
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                Evaluation Key on Report Cards
              </p>
            </div>
          </div>
        </div>

        {/* Scale Details */}
        <div className="space-y-1">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
            {draft.name.trim() || "Untitled Rating Scale"}
          </h4>
          {draft.description.trim() && (
            <p className="text-[10px] text-slate-400 italic">{draft.description.trim()}</p>
          )}
        </div>

        {/* Scale Grid Preview */}
        {draft.options.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/50 space-y-2 p-4">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <p className="text-xs font-bold text-slate-700">No Rating Levels Added</p>
            <p className="text-[11px] text-slate-400 max-w-[240px]">
              Add levels or click a 1-Click Preset on the left to see how this scale renders on report cards.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table Matrix Demo */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                How It Appears In Report Card Tables:
              </span>
              <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <th className="p-2 text-left">Sample Trait</th>
                      {draft.options.map((opt, optIdx) => (
                        <th key={opt.key ?? `opt-${optIdx}`} className="p-1.5 text-center w-8" title={opt.label}>
                          <span className="block font-black text-slate-800">{opt.shortLabel || opt.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700 text-[11px]">
                    {["Punctuality & Neatness", "Attentiveness & Focus", "Honesty & Integrity"].map((trait, tIdx) => (
                      <tr key={trait} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2 font-bold text-slate-900 truncate max-w-[160px]">{trait}</td>
                        {draft.options.map((opt, optIdx) => {
                          const isChecked = optIdx === (tIdx % draft.options.length);
                          return (
                            <td key={opt.key ?? `cell-${optIdx}`} className="p-1.5 text-center">
                              <div className="flex items-center justify-center">
                                {isChecked ? (
                                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                  </div>
                                ) : (
                                  <div className="w-3 h-3 rounded-full border border-slate-200" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scale Key Breakdown */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Evaluation Key Legend:
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {draft.options.map((opt, idx) => (
                  <div
                    key={opt.key ?? `key-${idx}`}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-2"
                  >
                    <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-[10px] font-black text-slate-800 flex items-center justify-center shrink-0">
                      {opt.shortLabel || idx + 1}
                    </span>
                    <span className="text-[11px] font-bold text-slate-700 truncate">{opt.label || "Untitled"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            Reusable Matrix Scale
          </span>
          <span>Melo Portal</span>
        </div>
      </div>
    </div>
  );
});
