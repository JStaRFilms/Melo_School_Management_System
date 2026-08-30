"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ShieldCheck, X } from "lucide-react";
import type { CurriculumUnit } from "./types";

interface Props {
  unit: CurriculumUnit | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (unit: CurriculumUnit) => void;
}

export function CurriculumApprovalDialog({ unit, busy, onCancel, onConfirm }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!unit || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="approval-title" className="w-full max-w-md rounded-2xl border border-white/60 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></div>
          <button disabled={busy} onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer" aria-label="Cancel approval"><X className="h-4 w-4" /></button>
        </div>
        <h2 id="approval-title" className="mt-4 text-lg font-black text-slate-950">Approve this curriculum topic?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600"><b>{unit.title}</b> will become an active school topic available to the existing planning workflow.</p>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-800">This is a human approval decision. Review the objectives and source evidence before continuing.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={busy} onClick={onCancel} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
          <button disabled={busy} onClick={() => onConfirm(unit)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50 cursor-pointer"><Check className="h-4 w-4" /> Approve topic</button>
        </div>
      </section>
    </div>,
    document.body
  );
}
