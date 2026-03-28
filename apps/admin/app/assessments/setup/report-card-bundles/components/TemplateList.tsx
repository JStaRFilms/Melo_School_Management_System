"use client";

import { Plus, Scale } from "lucide-react";
import type { ScaleTemplateRecord } from "../types";

interface TemplateListProps {
  templates: ScaleTemplateRecord[];
  selectedId: string | "new";
  onSelect: (id: string | "new") => void;
}

export function TemplateList({ templates, selectedId, onSelect }: TemplateListProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Reusable scales</h2>
          <p className="text-sm text-slate-500">Shared templates for scale fields.</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          onClick={() => onSelect("new")}
          type="button"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {templates.map((template) => {
          const isSelected = selectedId === template._id;
          return (
            <button
              key={template._id}
              className={[
                "w-full rounded-2xl border px-4 py-3 text-left transition",
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white",
              ].join(" ")}
              onClick={() => onSelect(template._id)}
              type="button"
            >
              <div className="flex items-start gap-3">
                <Scale className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-semibold">{template.name}</div>
                  <div className={isSelected ? "text-white/70" : "text-slate-500"}>
                    {template.options.length} options
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            No scale templates yet.
          </div>
        )}
      </div>
    </section>
  );
}
