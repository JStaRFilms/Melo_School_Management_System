"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import type { BundleDraft, ScaleTemplateRecord } from "../types";
import { createEmptyField, createEmptySection, fieldTypeOptions, moveItem } from "../utils";

interface BundleEditorProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
  onChange: (draft: BundleDraft) => void;
}

export function BundleEditor({ draft, scaleTemplates, onChange }: BundleEditorProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="space-y-1 border-b border-slate-100 pb-5">
        <h2 className="text-lg font-semibold text-slate-900">Bundle authoring</h2>
        <p className="text-sm text-slate-500">Define the field set, control print visibility, and tune order for report card editors.</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-1">
          <span className="text-sm font-medium text-slate-700">Bundle name</span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Lower Primary Conduct"
            value={draft.name}
          />
        </label>
        <label className="space-y-2 md:col-span-1">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder="Used for all lower primary classes"
            value={draft.description}
          />
        </label>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Sections</h3>
            <p className="text-sm text-slate-500">Group related fields into report-card sections such as attendance, affective domain, or skills.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={() => onChange({ ...draft, sections: [...draft.sections, createEmptySection()] })}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        </div>

        {draft.sections.map((section, sectionIndex) => (
          <div key={section.key} className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">Section {sectionIndex + 1}</div>
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                  onChange={(event) => {
                    const sections = draft.sections.slice();
                    sections[sectionIndex] = { ...section, label: event.target.value };
                    onChange({ ...draft, sections });
                  }}
                  placeholder="Affective domain"
                  value={section.label}
                />
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                  disabled={sectionIndex === 0}
                  onClick={() => onChange({ ...draft, sections: moveItem(draft.sections, sectionIndex, -1) })}
                  type="button"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                  disabled={sectionIndex === draft.sections.length - 1}
                  onClick={() => onChange({ ...draft, sections: moveItem(draft.sections, sectionIndex, 1) })}
                  type="button"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  className="rounded-xl border border-rose-200 p-2 text-rose-600 disabled:opacity-30"
                  disabled={draft.sections.length === 1}
                  onClick={() =>
                    onChange({
                      ...draft,
                      sections: draft.sections.filter((_, row) => row !== sectionIndex),
                    })
                  }
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {section.fields.map((field, fieldIndex) => (
                <div key={field.key} className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Field {fieldIndex + 1}</div>
                      <div className="text-xs text-slate-500">
                        {field.printable ? "Prints on the report card" : "Internal only"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                        disabled={fieldIndex === 0}
                        onClick={() => {
                          const sections = draft.sections.slice();
                          sections[sectionIndex] = {
                            ...section,
                            fields: moveItem(section.fields, fieldIndex, -1),
                          };
                          onChange({ ...draft, sections });
                        }}
                        type="button"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                        disabled={fieldIndex === section.fields.length - 1}
                        onClick={() => {
                          const sections = draft.sections.slice();
                          sections[sectionIndex] = {
                            ...section,
                            fields: moveItem(section.fields, fieldIndex, 1),
                          };
                          onChange({ ...draft, sections });
                        }}
                        type="button"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-xl border border-rose-200 p-2 text-rose-600 disabled:opacity-30"
                        disabled={section.fields.length === 1}
                        onClick={() => {
                          const sections = draft.sections.slice();
                          sections[sectionIndex] = {
                            ...section,
                            fields: section.fields.filter((_, row) => row !== fieldIndex),
                          };
                          onChange({ ...draft, sections });
                        }}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Label</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        onChange={(event) => {
                          const sections = draft.sections.slice();
                          const fields = section.fields.slice();
                          fields[fieldIndex] = { ...field, label: event.target.value };
                          sections[sectionIndex] = { ...section, fields };
                          onChange({ ...draft, sections });
                        }}
                        placeholder="Punctuality"
                        value={field.label}
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Type</span>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        onChange={(event) => {
                          const nextType = event.target.value as BundleDraft["sections"][number]["fields"][number]["type"];
                          const sections = draft.sections.slice();
                          const fields = section.fields.slice();
                          fields[fieldIndex] = {
                            ...field,
                            type: nextType,
                            scaleTemplateId: nextType === "scale" ? field.scaleTemplateId : null,
                          };
                          sections[sectionIndex] = { ...section, fields };
                          onChange({ ...draft, sections });
                        }}
                        value={field.type}
                      >
                        {fieldTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Placement</span>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        onChange={(event) => {
                          const sections = draft.sections.slice();
                          const fields = section.fields.slice();
                          fields[fieldIndex] = {
                            ...field,
                            printable: event.target.value === "printable",
                          };
                          sections[sectionIndex] = { ...section, fields };
                          onChange({ ...draft, sections });
                        }}
                        value={field.printable ? "printable" : "internal"}
                      >
                        <option value="printable">Report card section</option>
                        <option value="internal">Internal notes section</option>
                      </select>
                    </label>
                  </div>

                  {field.type === "scale" ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Reusable scale</span>
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400"
                        onChange={(event) => {
                          const sections = draft.sections.slice();
                          const fields = section.fields.slice();
                          fields[fieldIndex] = { ...field, scaleTemplateId: event.target.value || null };
                          sections[sectionIndex] = { ...section, fields };
                          onChange({ ...draft, sections });
                        }}
                        value={field.scaleTemplateId ?? ""}
                      >
                        <option value="">Select a scale</option>
                        {scaleTemplates.map((template) => (
                          <option key={template._id} value={template._id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ))}

              <button
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                onClick={() => {
                  const sections = draft.sections.slice();
                  sections[sectionIndex] = {
                    ...section,
                    fields: [...section.fields, createEmptyField()],
                  };
                  onChange({ ...draft, sections });
                }}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add field
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
