"use client";

import { memo } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { BundleFieldDraft, ScaleTemplateRecord } from "../types";
import {
  fieldSourceOptions,
  fieldTypeOptions,
  getCanonicalFieldConfig,
  systemAttendanceFieldOptions,
  systemTermFieldOptions,
} from "../utils";

interface FieldEditorProps {
  field: BundleFieldDraft;
  fieldIndex: number;
  sectionIndex: number;
  scaleTemplates: ScaleTemplateRecord[];
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onUpdateField: (sectionIndex: number, fieldIndex: number, updatedField: BundleFieldDraft) => void;
  onMoveField: (sectionIndex: number, fieldIndex: number, direction: -1 | 1) => void;
  onDeleteField: (sectionIndex: number, fieldIndex: number) => void;
}

export const FieldEditor = memo(function FieldEditor({
  field,
  fieldIndex,
  sectionIndex,
  scaleTemplates,
  isFirst,
  isLast,
  canDelete,
  onUpdateField,
  onMoveField,
  onDeleteField,
}: FieldEditorProps) {
  const canonicalOptions =
    field.source === "system_term"
      ? systemTermFieldOptions
      : field.source === "system_attendance"
        ? systemAttendanceFieldOptions
        : [];

  return (
    <div
      key={field.key}
      className="group/field relative rounded-xl border border-slate-100 bg-slate-50/30 p-3 sm:p-4 transition-all hover:border-slate-200 hover:bg-white hover:shadow-sm"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100/50 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/field:bg-slate-900 transition-colors" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Field {fieldIndex + 1}</span>
            <span className="text-xs font-bold text-slate-200">•</span>
            <span className={`text-[11px] font-black uppercase tracking-widest ${field.printable ? "text-emerald-600" : "text-amber-600"}`}>
              {field.printable ? "Printed on Report Card" : "Internal Only"}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
            <button
              className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-20"
              disabled={isFirst}
              onClick={() => onMoveField(sectionIndex, fieldIndex, -1)}
              type="button"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-20"
              disabled={isLast}
              onClick={() => onMoveField(sectionIndex, fieldIndex, 1)}
              type="button"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              className="p-1 text-slate-200 hover:text-rose-600 disabled:opacity-20"
              disabled={!canDelete}
              onClick={() => onDeleteField(sectionIndex, fieldIndex)}
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
                onUpdateField(sectionIndex, fieldIndex, { ...field, label: event.target.value });
              }}
              placeholder="e.g. Attentiveness"
              value={field.label}
              disabled={field.source === "system_term" || field.source === "system_attendance"}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Source</span>
            <select
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none focus:border-slate-400"
              onChange={(event) => {
                const nextSource = event.target.value as BundleFieldDraft["source"];
                const nextField = { ...field, source: nextSource };

                if (nextSource === "system_term") {
                  const nextSystemKey = "next_term_begins";
                  const canonical = getCanonicalFieldConfig(nextSystemKey);
                  onUpdateField(sectionIndex, fieldIndex, {
                    ...nextField,
                    systemKey: nextSystemKey,
                    label: canonical?.label ?? field.label,
                    type: canonical?.type ?? "text",
                    scaleTemplateId: null,
                  });
                } else if (nextSource === "system_attendance") {
                  const nextSystemKey = field.systemKey && field.systemKey !== "next_term_begins"
                    ? field.systemKey
                    : "times_present";
                  const canonical = getCanonicalFieldConfig(nextSystemKey);
                  onUpdateField(sectionIndex, fieldIndex, {
                    ...nextField,
                    systemKey: nextSystemKey,
                    label: canonical?.label ?? field.label,
                    type: canonical?.type ?? "number",
                    scaleTemplateId: null,
                  });
                } else {
                  onUpdateField(sectionIndex, fieldIndex, {
                    ...nextField,
                    systemKey: null,
                  });
                }
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
                const nextType = event.target.value as BundleFieldDraft["type"];
                onUpdateField(sectionIndex, fieldIndex, {
                  ...field,
                  type: nextType,
                  scaleTemplateId: nextType === "scale" ? field.scaleTemplateId : null,
                });
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
                onUpdateField(sectionIndex, fieldIndex, {
                  ...field,
                  printable: event.target.value === "printable",
                });
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
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">System Field</span>
            <select
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-slate-400"
              onChange={(event) => {
                const nextSystemKey = event.target.value as NonNullable<typeof field.systemKey>;
                const canonical = getCanonicalFieldConfig(nextSystemKey);
                onUpdateField(sectionIndex, fieldIndex, {
                  ...field,
                  systemKey: nextSystemKey,
                  label: canonical?.label ?? field.label,
                  type: canonical?.type ?? field.type,
                  scaleTemplateId: null,
                });
              }}
              value={field.systemKey ?? ""}
            >
              <option value="">Select System Field...</option>
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
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Rating Scale Template</span>
            <select
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-slate-400"
              onChange={(event) => {
                onUpdateField(sectionIndex, fieldIndex, {
                  ...field,
                  scaleTemplateId: event.target.value || null,
                });
              }}
              value={field.scaleTemplateId ?? ""}
            >
              <option value="">Select Rating Scale...</option>
              {scaleTemplates.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
});
