"use client";

import { memo, useCallback, type Dispatch, type SetStateAction } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical, LayoutGrid, FileText, Sparkles } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { BundleDraft, BundleFieldDraft, ScaleTemplateRecord } from "../types";
import { 
  createEmptyField, 
  createEmptySection, 
  moveItem,
  STARTER_BUNDLE_PRESETS,
  createBundleDraftFromPreset 
} from "../utils";
import { FieldEditor } from "./FieldEditor";

interface BundleEditorProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
  onChange: (draft: BundleDraft | ((prev: BundleDraft) => BundleDraft)) => void;
}

export const BundleEditor = memo(function BundleEditor({ draft, scaleTemplates, onChange }: BundleEditorProps) {
  const handleLoadPreset = useCallback((presetIndex: number) => {
    const preset = STARTER_BUNDLE_PRESETS[presetIndex];
    if (!preset) return;
    const defaultScale = scaleTemplates[0]?._id ?? null;
    onChange(createBundleDraftFromPreset(preset, defaultScale));
  }, [onChange, scaleTemplates]);

  const presetRequiresScale = useCallback(
    (presetIndex: number) =>
      STARTER_BUNDLE_PRESETS[presetIndex]?.sections.some((section) =>
        section.fields.some((field) => field.type === "scale")
      ) ?? false,
    []
  );

  const handleUpdateField = useCallback(
    (sectionIndex: number, fieldIndex: number, updatedField: BundleFieldDraft) => {
      onChange((current) => ({
        ...current,
        sections: current.sections.map((section, sIdx) => {
          if (sIdx !== sectionIndex) return section;
          return {
            ...section,
            fields: section.fields.map((field, fIdx) =>
              fIdx === fieldIndex ? updatedField : field
            ),
          };
        }),
      }));
    },
    [onChange]
  );

  const handleMoveField = useCallback(
    (sectionIndex: number, fieldIndex: number, direction: -1 | 1) => {
      onChange((current) => ({
        ...current,
        sections: current.sections.map((section, sIdx) =>
          sIdx === sectionIndex
            ? { ...section, fields: moveItem(section.fields, fieldIndex, direction) }
            : section
        ),
      }));
    },
    [onChange]
  );

  const handleDeleteField = useCallback(
    (sectionIndex: number, fieldIndex: number) => {
      onChange((current) => ({
        ...current,
        sections: current.sections.map((section, sIdx) =>
          sIdx === sectionIndex
            ? {
                ...section,
                fields: section.fields.filter((_, fIdx) => fIdx !== fieldIndex),
              }
            : section
        ),
      }));
    },
    [onChange]
  );

  return (
    <div className="space-y-6">
      {/* Starter Template Presets */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-950">Quick Starter Templates</span>
          </div>
          <span className="text-[10px] font-semibold text-indigo-500">1-Click Setup</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {STARTER_BUNDLE_PRESETS.map((preset, idx) => {
            const requiresScale = presetRequiresScale(idx);
            const isUnavailable = requiresScale && scaleTemplates.length === 0;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleLoadPreset(idx)}
                disabled={isUnavailable}
                title={isUnavailable ? "Create a reusable scale before using this preset." : undefined}
                className="px-3 py-1.5 rounded-xl border border-indigo-200/80 bg-white hover:bg-indigo-50 text-[11px] font-bold text-indigo-900 transition-all shadow-sm hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
              >
                + {preset.name}
              </button>
            );
          })}
        </div>
        {scaleTemplates.length === 0 ? (
          <p className="text-[11px] font-medium text-indigo-700">Create a reusable scale before using presets with rating fields.</p>
        ) : null}
      </div>

      <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <LayoutGrid className="w-4 h-4 text-slate-600" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Bundle Details</h2>
            <p className="text-xs font-medium text-slate-400">Name and describe this report card add-on bundle</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="group space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Bundle Name</span>
            <input
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="e.g. Affective & Behavioral Domain"
              value={draft.name}
            />
          </label>
          <label className="group space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Description (Optional)</span>
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
            Sections
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
                  <FieldEditor
                    key={field.key}
                    field={field}
                    fieldIndex={fieldIndex}
                    sectionIndex={sectionIndex}
                    scaleTemplates={scaleTemplates}
                    isFirst={fieldIndex === 0}
                    isLast={fieldIndex === section.fields.length - 1}
                    canDelete={section.fields.length > 1}
                    onUpdateField={handleUpdateField}
                    onMoveField={handleMoveField}
                    onDeleteField={handleDeleteField}
                  />
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
                  Add Field
                </button>
              </div>
            </AdminSurface>
          </div>
        ))}
      </div>
    </div>
  );
});
