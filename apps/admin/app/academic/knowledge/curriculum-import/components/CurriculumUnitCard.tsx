"use client";
import { Check, FileSearch, Pencil, X } from "lucide-react";
import type { CurriculumUnit } from "./types";

interface Props { unit: CurriculumUnit; busy: boolean; selected?: boolean; onEdit: (unit: CurriculumUnit) => void; onReject: (unit: CurriculumUnit) => void; onApprove: (unit: CurriculumUnit) => void; }
export function CurriculumUnitCard({ unit, busy, selected, onEdit, onReject, onApprove }: Props) {
  const warnings = [...unit.validationWarnings, ...unit.duplicateWarnings];
  return <article className={`border-b border-slate-100 p-4 last:border-0 ${selected ? "bg-blue-50/50" : "bg-white"}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-400">{unit.weekNumber ? `Week ${unit.weekNumber}` : "Unscheduled"} · {Math.round(unit.confidence * 100)}% confidence</p><h3 className="mt-1 text-sm font-black text-slate-900">{unit.title}</h3></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-slate-500">{unit.reviewStatus.replace("_", " ")}</span></div>
    <p className="mt-2 text-xs leading-5 text-slate-600">{unit.subtopics.join(" · ")}</p><p className="mt-2 text-[11px] font-semibold text-slate-700">Objectives: {unit.learningObjectives.join("; ")}</p>{unit.suggestedDuration && <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Suggested duration: {unit.suggestedDuration}</p>}
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5"><p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-blue-700"><FileSearch className="h-3 w-3" /> Pages {unit.sourcePages.join(", ")}</p><p className="mt-1 text-[11px] leading-4 text-slate-600">{unit.supportingExcerpt}</p></div>
    {warnings.length > 0 && <p className="mt-2 text-[10px] font-bold text-amber-700">Review: {warnings.join(" ")}</p>}
    {unit.reviewStatus !== "approved" && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => onEdit(unit)} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-600"><Pencil className="h-3 w-3" /> Edit</button><button disabled={busy} onClick={() => onReject(unit)} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-600"><X className="h-3 w-3" /> Reject</button><button disabled={busy} onClick={() => onApprove(unit)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-white"><Check className="h-3 w-3" /> Approve</button></div>}
  </article>;
}
