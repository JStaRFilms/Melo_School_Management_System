"use client";

import { Check, CheckCircle2, Clock, FileSearch, Pencil, X, AlertTriangle } from "lucide-react";
import type { CurriculumUnit } from "./types";
import { visibleCurriculumSubtopics } from "./curriculumUnitPresentation";

interface Props {
  unit: CurriculumUnit;
  busy: boolean;
  isEditing?: boolean;
  isChecked?: boolean;
  onToggleCheck?: (unitId: string, checked: boolean) => void;
  onEdit: (unit: CurriculumUnit) => void;
  onReject: (unit: CurriculumUnit) => void;
  onApprove: (unit: CurriculumUnit) => void;
}

export function CurriculumUnitCard({
  unit,
  busy,
  isEditing,
  isChecked,
  onToggleCheck,
  onEdit,
  onReject,
  onApprove,
}: Props) {
  const warnings = [...unit.validationWarnings, ...unit.duplicateWarnings];
  const subtopics = visibleCurriculumSubtopics(unit.subtopics, unit.learningObjectives);
  const isApproved = unit.reviewStatus === "approved";
  const isRejected = unit.reviewStatus === "rejected";

  return (
    <article
      className={`rounded-xl border transition-all p-4 space-y-3 ${
        isEditing
          ? "border-indigo-500 bg-indigo-50/20 ring-1 ring-indigo-500/20"
          : isChecked
          ? "border-indigo-400 bg-indigo-50/10 shadow-2xs"
          : isApproved
          ? "border-emerald-200/80 bg-emerald-50/15"
          : isRejected
          ? "border-rose-200/70 bg-rose-50/10 opacity-75"
          : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-2xs"
      }`}
    >
      {/* Top Header: Checkbox + Week Badge + Match % + Review Status */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {onToggleCheck && (
            <input
              type="checkbox"
              checked={isChecked || false}
              onChange={(e) => onToggleCheck(unit._id, e.target.checked)}
              disabled={busy || isApproved}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              title={isApproved ? "Unit is already approved" : "Select for bulk action"}
            />
          )}

          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
            {unit.weekNumber ? `Week ${unit.weekNumber}` : "Unscheduled"}
          </span>

          <span className="text-[10px] font-semibold text-slate-400">
            {Math.round(unit.confidence * 100)}% Match
          </span>
        </div>

        <div>
          {isApproved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-wider">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              <span>Approved</span>
            </span>
          ) : isRejected ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black uppercase tracking-wider">
              <X className="w-2.5 h-2.5 text-rose-600" />
              <span>Rejected</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase tracking-wider">
              <Clock className="w-2.5 h-2.5 text-amber-600" />
              <span>Proposed</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Title & Subtopics */}
      <div className="space-y-1">
        <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
          {unit.title}
        </h3>

        {subtopics.length > 0 && (
          <p className="text-xs text-slate-600 leading-normal">
            <span className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mr-1">Subtopics:</span>
            {subtopics.join(" · ")}
          </p>
        )}
      </div>

      {/* Learning Objectives */}
      <div className="text-xs space-y-0.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
          Learning Objectives
        </span>
        <ul className="space-y-0.5 text-slate-700 font-medium pl-0.5">
          {unit.learningObjectives.map((obj, i) => (
            <li key={i} className="flex items-start gap-1.5 leading-relaxed text-xs">
              <span className="text-slate-400 font-bold select-none">•</span>
              <span>{obj}</span>
            </li>
          ))}
        </ul>
      </div>

      {unit.suggestedDuration && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Suggested Duration: <span className="text-slate-700">{unit.suggestedDuration}</span>
        </p>
      )}

      {/* Source Evidence Excerpt */}
      {unit.supportingExcerpt && (
        <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-2.5 space-y-0.5 text-xs">
          <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
            <FileSearch className="h-3 w-3 text-indigo-600 shrink-0" />
            <span>Source Reference · Pages {unit.sourcePages.join(", ")}</span>
          </div>
          <p className="italic leading-relaxed text-slate-600 pl-4">
            &ldquo;{unit.supportingExcerpt}&rdquo;
          </p>
        </div>
      )}

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-2 flex items-start gap-1.5 text-xs font-semibold text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>{warnings.join(" ")}</span>
        </div>
      )}

      {/* Action Buttons */}
      {!isApproved && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onEdit(unit)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <Pencil className="h-3 w-3 text-slate-400" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(unit)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200/80 bg-rose-50/40 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <X className="h-3 w-3 text-rose-500" />
              <span>Reject</span>
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(unit)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-black uppercase tracking-wider transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            <span>Approve Topic</span>
          </button>
        </div>
      )}
    </article>
  );
}


