"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { createEmptyScaleOption, moveItem } from "../utils";
import type { ScaleTemplateDraft } from "../types";

interface ScaleTemplateEditorProps {
  draft: ScaleTemplateDraft;
  onChange: (draft: ScaleTemplateDraft) => void;
}

export function ScaleTemplateEditor({ draft, onChange }: ScaleTemplateEditorProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-1 border-b border-slate-100 pb-5">
        <h2 className="text-lg font-semibold text-slate-900">Scale builder</h2>
        <p className="text-sm text-slate-500">Create reusable rating ladders once, then attach them to bundle fields.</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-1">
          <span className="text-sm font-medium text-slate-700">Template name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Affective scale"
            value={draft.name}
          />
        </label>
        <label className="space-y-2 md:col-span-1">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder="Shown to admins during bundle setup"
            value={draft.description}
          />
        </label>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Options</h3>
            <p className="text-sm text-slate-500">Order becomes the default scale order everywhere this template is used.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={() => onChange({ ...draft, options: [...draft.options, createEmptyScaleOption()] })}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add option
          </button>
        </div>

        {draft.options.map((option, index) => (
          <div key={option.key} className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-[1.5fr_1fr_auto]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Label</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                onChange={(event) => {
                  const options = draft.options.slice();
                  options[index] = { ...option, label: event.target.value };
                  onChange({ ...draft, options });
                }}
                placeholder="Excellent"
                value={option.label}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Short label</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                onChange={(event) => {
                  const options = draft.options.slice();
                  options[index] = { ...option, shortLabel: event.target.value };
                  onChange({ ...draft, options });
                }}
                placeholder="Ex"
                value={option.shortLabel}
              />
            </label>
            <div className="flex items-end gap-2 md:justify-end">
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                disabled={index === 0}
                onClick={() => onChange({ ...draft, options: moveItem(draft.options, index, -1) })}
                type="button"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                disabled={index === draft.options.length - 1}
                onClick={() => onChange({ ...draft, options: moveItem(draft.options, index, 1) })}
                type="button"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                className="rounded-xl border border-rose-200 p-2 text-rose-600 disabled:opacity-30"
                disabled={draft.options.length === 1}
                onClick={() => onChange({ ...draft, options: draft.options.filter((_, row) => row !== index) })}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
