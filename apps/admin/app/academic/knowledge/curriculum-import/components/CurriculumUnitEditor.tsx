"use client";

import { useEffect, useState } from "react";
import { Check, PencilLine, X } from "lucide-react";
import type { CurriculumUnit } from "./types";
import { visibleCurriculumSubtopics } from "./curriculumUnitPresentation";

interface Props {
  unit: CurriculumUnit | null;
  busy: boolean;
  onClose: () => void;
  onSave: (unit: CurriculumUnit, values: UnitEditValues) => Promise<void>;
}

export interface UnitEditValues {
  title: string;
  subtopics: string[];
  learningObjectives: string[];
  suggestedDuration?: string;
}

export function CurriculumUnitEditor({ unit, busy, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [subtopics, setSubtopics] = useState("");
  const [objectives, setObjectives] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    setTitle(unit?.title ?? "");
    setSubtopics(unit ? visibleCurriculumSubtopics(unit.subtopics, unit.learningObjectives).join("\n") : "");
    setObjectives(unit?.learningObjectives.join("\n") ?? "");
    setDuration(unit?.suggestedDuration ?? "");
  }, [unit]);

  if (!unit) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
          <PencilLine className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-slate-700">Select a Unit to Inspect</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 max-w-xs">
          Click &ldquo;Edit Details&rdquo; on any proposed unit card in the queue to refine its title, objectives, and duration before approval.
        </p>
      </div>
    );
  }

  const listFrom = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  const canSave = title.trim() && listFrom(objectives).length > 0;

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSave) return;
        void onSave(unit, {
          title: title.trim(),
          subtopics: listFrom(subtopics),
          learningObjectives: listFrom(objectives),
          ...(duration.trim() ? { suggestedDuration: duration.trim() } : {}),
        });
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
              {unit.weekNumber ? `Week ${unit.weekNumber}` : "Unscheduled"}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-extrabold text-slate-900">Unit Inspector</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <EditorField label="Unit title">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
      </EditorField>

      <EditorField label="Subtopics" hint="Optional · one per line">
        <textarea
          value={subtopics}
          onChange={(event) => setSubtopics(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all custom-scrollbar"
        />
      </EditorField>

      <EditorField label="Learning objectives" hint="One per line">
        <textarea
          value={objectives}
          onChange={(event) => setObjectives(event.target.value)}
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all custom-scrollbar"
        />
      </EditorField>

      <EditorField label="Suggested duration">
        <input
          value={duration}
          onChange={(event) => setDuration(event.target.value)}
          placeholder="e.g. 40 minutes"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
      </EditorField>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !canSave}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition-all shadow-md shadow-slate-950/20 active:scale-98 disabled:opacity-40 cursor-pointer"
        >
          <Check className="h-4 w-4" />
          <span>Save Changes</span>
        </button>
      </div>
    </form>
  );
}

function EditorField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
        <span>{label}</span>
        {hint && <span className="font-semibold normal-case tracking-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

