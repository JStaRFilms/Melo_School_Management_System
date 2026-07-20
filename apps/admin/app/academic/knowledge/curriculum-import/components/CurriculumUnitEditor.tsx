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
      <div className="flex min-h-64 flex-col items-center justify-center px-8 text-center text-slate-400">
        <PencilLine className="mb-3 h-6 w-6" />
        <p className="text-xs font-bold text-slate-600">Select a unit to edit</p>
        <p className="mt-1 text-[11px] leading-5">The editable curriculum fields will appear here.</p>
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
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-blue-600">Unit editor</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Week {unit.weekNumber ?? "—"}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close editor">
          <X className="h-4 w-4" />
        </button>
      </div>
      <EditorField label="Unit title">
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-400" />
      </EditorField>
      <EditorField label="Subtopics" hint="Optional · one per line">
        <textarea value={subtopics} onChange={(event) => setSubtopics(event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 outline-none focus:border-blue-400" />
      </EditorField>
      <EditorField label="Learning objectives" hint="One per line">
        <textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} rows={6} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 outline-none focus:border-blue-400" />
      </EditorField>
      <EditorField label="Suggested duration">
        <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="e.g. 40 minutes" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-blue-400" />
      </EditorField>
      <button disabled={busy || !canSave} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-40">
        <Check className="h-3.5 w-3.5" /> Save changes
      </button>
    </form>
  );
}

function EditorField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-500"><span>{label}</span>{hint && <span className="font-semibold normal-case tracking-normal text-slate-400">{hint}</span>}</span>{children}</label>;
}
