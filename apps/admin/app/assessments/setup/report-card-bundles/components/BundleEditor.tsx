"use client";

import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  GripVertical,
  LayoutGrid,
  FileText
} from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { BundleDraft, ScaleTemplateRecord } from "../types";
import {
  createEmptyField,
  createEmptySection,
  fieldSourceOptions,
  fieldTypeOptions,
  getCanonicalFieldConfig,
  moveItem,
  systemAttendanceFieldOptions,
  systemTermFieldOptions,
} from "../utils";

interface BundleEditorProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
  onChange: (draft: BundleDraft) => void;
}

export function BundleEditor({ draft, scaleTemplates, onChange }: BundleEditorProps) {
  return (
    <div className="space-y-6">
      <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <LayoutGrid className="w-4 h-4 text-slate-600" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Blueprint Authoring</h2>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">Configure report card structure and logic</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="group space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Bundle Identity</span>
            <input
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="e.g. Lower Primary Conduct"
              value={draft.name}
            />
          </label>
          <label className="group space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Description / Purpose</span>
            <input
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder="Internal notes on usage"
              value={draft.description}
            />
          </label>
        </div>
      </AdminSurface>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            <FileText className="w-3 h-3 opacity-50" />
            Structural Sections
          </h3>
          <button
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
            onClick={() => onChange({ ...draft, sections: [...draft.sections, createEmptySection()] })}
            type="button"
          >
            <Plus className="h-3 w-3" />
            Add Section
          </button>
        </div>

        {draft.sections.map((section, sectionIndex) => (
          <div key={section.key} className="group relative animate-in fade-in slide-in-from-top-2 duration-300">
            <AdminSurface intensity="none" className="overflow-hidden border-slate-200/60 shadow-sm border bg-white rounded-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-50 bg-slate-50/50 px-3 py-2.5 sm:px-4 sm:py-3">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="w-4 h-4 text-slate-300 pointer-events-none" />
                  <span className="text-xs font-black text-slate-400 tabular-nums">#{sectionIndex + 1}</span>
                  <input
                    className="flex-1 max-w-sm bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:text-slate-300 focus:text-slate-900"
                    onChange={(event) => {
                      const sections = draft.sections.slice();
                      sections[sectionIndex] = { ...section, label: event.target.value };
                      onChange({ ...draft, sections });
                    }}
                    placeholder="Enter Section Name..."
                    value={section.label}
                  />
                </div>
                <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-20"
                    disabled={sectionIndex === 0}
                    onClick={() => onChange({ ...draft, sections: moveItem(draft.sections, sectionIndex, -1) })}
                    type="button"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-20"
                    disabled={sectionIndex === draft.sections.length - 1}
                    onClick={() => onChange({ ...draft, sections: moveItem(draft.sections, sectionIndex, 1) })}
                    type="button"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    className="ml-1 p-1.5 text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-20"
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

              <div className="p-3 sm:p-4 space-y-3 bg-white">
                {section.fields.map((field, fieldIndex) => (
                  <div key={field.key} className="group/field relative rounded-xl border border-slate-100 bg-slate-50/30 p-3 sm:p-4 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm">
                    {(() => {
                      const canonicalConfig = getCanonicalFieldConfig(field.systemKey);
                      const canonicalOptions =
                        field.source === "system_term"
                          ? systemTermFieldOptions
                          : field.source === "system_attendance"
                            ? systemAttendanceFieldOptions
                            : [];
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100/50 pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/field:bg-slate-900 transition-colors" />
                              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Node {fieldIndex + 1}</span>
                              <span className="text-xs font-bold text-slate-200">•</span>
                              <span className={`text-[11px] font-black uppercase tracking-widest ${field.printable ? "text-emerald-500" : "text-amber-500"}`}>
                                {field.printable ? "Exported" : "Internal Buffer"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
                              <button
                                className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-20"
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
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-20"
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
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-1 text-slate-200 hover:text-rose-600 disabled:opacity-20"
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
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-6">
                            <label className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Display Label</span>
                              <input
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-slate-400 disabled:opacity-50"
                                onChange={(event) => {
                                  const sections = draft.sections.slice();
                                  const fields = section.fields.slice();
                                  fields[fieldIndex] = { ...field, label: event.target.value };
                                  sections[sectionIndex] = { ...section, fields };
                                  onChange({ ...draft, sections });
                                }}
                                placeholder="Punctuality"
                                value={field.label}
                                disabled={field.source === "system_term" || field.source === "system_attendance"}
                              />
                            </label>

                            <label className="space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Source</span>
                              <select
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-slate-400"
                                onChange={(event) => {
                                  const nextSource = event.target.value as BundleDraft["sections"][number]["fields"][number]["source"];
                                  const sections = draft.sections.slice();
                                  const fields = section.fields.slice();
                                  const nextField = { ...field, source: nextSource };

                                  if (nextSource === "system_term") {
                                    const nextSystemKey = "next_term_begins";
                                    const canonical = getCanonicalFieldConfig(nextSystemKey);
                                    fields[fieldIndex] = {
                                      ...nextField,
                                      systemKey: nextSystemKey,
                                      label: canonical?.label ?? field.label,
                                      type: canonical?.type ?? "text",
                                      scaleTemplateId: null,
                                    };
                                  } else if (nextSource === "system_attendance") {
                                    const nextSystemKey = field.systemKey && field.systemKey !== "next_term_begins"
                                      ? field.systemKey
                                      : "times_present";
                                    const canonical = getCanonicalFieldConfig(nextSystemKey);
                                    fields[fieldIndex] = {
                                      ...nextField,
                                      systemKey: nextSystemKey,
                                      label: canonical?.label ?? field.label,
                                      type: canonical?.type ?? "number",
                                      scaleTemplateId: null,
                                    };
                                  } else {
                                    fields[fieldIndex] = {
                                      ...nextField,
                                      systemKey: null,
                                    };
                                  }

                                  sections[sectionIndex] = { ...section, fields };
                                  onChange({ ...draft, sections });
                                }}
                                value={field.source}
                              >
                                {fieldSourceOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Data Type</span>
                              <select
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-slate-400 disabled:opacity-50"
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
                                disabled={field.source === "system_term" || field.source === "system_attendance"}
                              >
                                {fieldTypeOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Visibility</span>
                              <select
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-slate-400"
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
                                <option value="printable">Report Card</option>
                                <option value="internal">Internal Only</option>
                              </select>
                            </label>
                          </div>

                          {(field.source === "system_term" || field.source === "system_attendance") && (
                            <label className="block space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">System Linkage</span>
                              <select
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-slate-400"
                                onChange={(event) => {
                                  const nextSystemKey = event.target.value as NonNullable<typeof field.systemKey>;
                                  const canonical = getCanonicalFieldConfig(nextSystemKey);
                                  const sections = draft.sections.slice();
                                  const fields = section.fields.slice();
                                  fields[fieldIndex] = {
                                    ...field,
                                    systemKey: nextSystemKey,
                                    label: canonical?.label ?? field.label,
                                    type: canonical?.type ?? field.type,
                                    scaleTemplateId: null,
                                  };
                                  sections[sectionIndex] = { ...section, fields };
                                  onChange({ ...draft, sections });
                                }}
                                value={field.systemKey ?? ""}
                              >
                                <option value="">Select Reference...</option>
                                {canonicalOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}

                          {field.type === "scale" && (
                            <label className="block space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Evaluation Matrix</span>
                              <select
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-slate-400"
                                onChange={(event) => {
                                  const sections = draft.sections.slice();
                                  const fields = section.fields.slice();
                                  fields[fieldIndex] = { ...field, scaleTemplateId: event.target.value || null };
                                  sections[sectionIndex] = { ...section, fields };
                                  onChange({ ...draft, sections });
                                }}
                                value={field.scaleTemplateId ?? ""}
                              >
                                <option value="">Attach Scale...</option>
                                {scaleTemplates.map((template) => (
                                  <option key={template._id} value={template._id}>
                                    {template.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}

                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 transition-all"
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
                  <Plus className="h-3 w-3" />
                  Append New Field
                </button>
              </div>
            </AdminSurface>
          </div>
        ))}
      </div>
    </div>
  );
}
