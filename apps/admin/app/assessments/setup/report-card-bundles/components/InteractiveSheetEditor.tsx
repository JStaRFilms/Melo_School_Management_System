"use client";

import { memo, useCallback, useMemo } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2, 
  GripVertical, 
  GraduationCap, 
  Sparkles, 
  CheckCircle2, 
  Eye, 
  Calendar, 
  Clock, 
  FileText,
  Layers,
  Settings2,
  ShieldCheck
} from "lucide-react";
import type { 
  BundleDraft, 
  BundleFieldDraft, 
  BundleSectionDraft, 
  ScaleTemplateRecord 
} from "../types";
import { 
  createEmptyField, 
  createEmptySection, 
  moveItem, 
  STARTER_BUNDLE_PRESETS, 
  createBundleDraftFromPreset,
  getCanonicalFieldConfig,
  systemAttendanceFieldOptions,
  systemTermFieldOptions
} from "../utils";

interface InteractiveSheetEditorProps {
  draft: BundleDraft;
  scaleTemplates: ScaleTemplateRecord[];
  onChange: (draft: BundleDraft | ((prev: BundleDraft) => BundleDraft)) => void;
  onProceedToDistribution?: () => void;
  onNavigateToScales?: () => void;
}

export const InteractiveSheetEditor = memo(function InteractiveSheetEditor({
  draft,
  scaleTemplates,
  onChange,
  onProceedToDistribution,
  onNavigateToScales,
}: InteractiveSheetEditorProps) {
  const scaleMap = useMemo(() => {
    const map: Record<string, ScaleTemplateRecord> = {};
    for (const scale of scaleTemplates) {
      map[scale._id] = scale;
    }
    return map;
  }, [scaleTemplates]);

  const handleLoadPreset = useCallback(
    (presetIndex: number) => {
      const preset = STARTER_BUNDLE_PRESETS[presetIndex];
      if (!preset) return;
      const defaultScale = scaleTemplates[0]?._id ?? null;
      onChange(createBundleDraftFromPreset(preset, defaultScale));
    },
    [onChange, scaleTemplates]
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

  const handleAddField = useCallback(
    (sectionIndex: number, type: BundleFieldDraft["type"] = "scale", source: BundleFieldDraft["source"] = "teacher_manual") => {
      onChange((current) => ({
        ...current,
        sections: current.sections.map((section, sIdx) => {
          if (sIdx !== sectionIndex) return section;
          const newField = createEmptyField();
          newField.type = type;
          newField.source = source;
          newField.scaleTemplateId = type === "scale" ? (scaleTemplates[0]?._id ?? null) : null;
          if (source === "system_term") {
            newField.systemKey = "next_term_begins";
            newField.label = "Next Term Begins";
          } else if (source === "system_attendance") {
            newField.systemKey = "times_present";
            newField.label = "Times Present";
            newField.type = "number";
          }
          return {
            ...section,
            fields: [...section.fields, newField],
          };
        }),
      }));
    },
    [onChange, scaleTemplates]
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

  const handleUpdateSectionScale = useCallback(
    (sectionIndex: number, scaleTemplateId: string) => {
      onChange((current) => ({
        ...current,
        sections: current.sections.map((section, sIdx) => {
          if (sIdx !== sectionIndex) return section;
          return {
            ...section,
            fields: section.fields.map((field) =>
              field.type === "scale" ? { ...field, scaleTemplateId } : field
            ),
          };
        }),
      }));
    },
    [onChange]
  );

  return (
    <div className="w-full space-y-6">
      {/* Starter Templates Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Sparkles className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Starter Templates
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600">
                  1-Click Load
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                Standard Curriculum Add-ons
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {STARTER_BUNDLE_PRESETS.map((preset, idx) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleLoadPreset(idx)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 text-xs font-bold text-slate-800 transition-all shadow-2xs active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* THE INTERACTIVE A4 REPORT CARD SHEET */}
      <div className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-2xl shadow-slate-900/5 space-y-8 transition-all">
        {/* Official Report Card Top Header */}
        <div className="border-b-2 border-slate-900/10 pb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-base shadow-lg shadow-slate-900/10 shrink-0">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Melo Comprehensive Academy
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Official Student Termly Assessment Report
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Interactive Document Sheet
              </span>
            </div>
          </div>

          {/* Sample Student Details Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/90 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-600 font-medium">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Student Name:</span>
              <span className="font-bold text-slate-900">Favour Adebayo</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Class / Arm:</span>
              <span className="font-bold text-slate-900">Primary 4B</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Academic Session:</span>
              <span className="font-bold text-slate-900">2026/2027</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Term:</span>
              <span className="font-bold text-slate-900">First Term</span>
            </div>
          </div>
        </div>

        {/* INLINE EDITABLE ADD-ON HEADER */}
        <div className="space-y-3 bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-100/80">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Report Card Add-on Name (Click to edit)
            </span>
            <input
              className="w-full bg-transparent text-lg sm:text-xl font-black text-slate-900 outline-none border-b border-dashed border-slate-300 focus:border-slate-900 py-1 transition-colors placeholder:text-slate-300"
              onChange={(e) => onChange((current) => ({ ...current, name: e.target.value }))}
              placeholder="e.g. Primary Affective & Behavioral Domain"
              value={draft.name}
            />
          </div>
          <div>
            <input
              className="w-full bg-transparent text-xs font-medium text-slate-500 outline-none border-b border-transparent focus:border-slate-200 py-0.5 placeholder:text-slate-300"
              onChange={(e) => onChange((current) => ({ ...current, description: e.target.value }))}
              placeholder="Optional notes: e.g. Used for all primary classes across 1st, 2nd, and 3rd terms."
              value={draft.description}
            />
          </div>
        </div>

        {/* INTERACTIVE SECTIONS LIST */}
        <div className="space-y-8">
          {draft.sections.map((section, sIdx) => (
            <InteractiveSectionCard
              key={section.key}
              section={section}
              sectionIndex={sIdx}
              totalSections={draft.sections.length}
              scaleTemplates={scaleTemplates}
              scaleMap={scaleMap}
              onUpdateSectionLabel={(label) => {
                onChange((current) => ({
                  ...current,
                  sections: current.sections.map((s, idx) =>
                    idx === sIdx ? { ...s, label } : s
                  ),
                }));
              }}
              onMoveSection={(direction) => {
                onChange((current) => ({
                  ...current,
                  sections: moveItem(current.sections, sIdx, direction),
                }));
              }}
              onDeleteSection={() => {
                onChange((current) => ({
                  ...current,
                  sections: current.sections.filter((_, idx) => idx !== sIdx),
                }));
              }}
              onUpdateSectionScale={(scaleId) => handleUpdateSectionScale(sIdx, scaleId)}
              onUpdateField={(fIdx, updated) => handleUpdateField(sIdx, fIdx, updated)}
              onAddField={(type, source) => handleAddField(sIdx, type, source)}
              onMoveField={(fIdx, dir) => handleMoveField(sIdx, fIdx, dir)}
              onDeleteField={(fIdx) => handleDeleteField(sIdx, fIdx)}
            />
          ))}

          {/* Add Section Button on Sheet */}
          <button
            type="button"
            onClick={() => onChange((current) => ({ ...current, sections: [...current.sections, createEmptySection()] }))}
            className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Another Report Card Section
          </button>
        </div>

        {/* Flow Navigation & Sheet Footer */}
        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {onNavigateToScales ? (
            <button
              type="button"
              onClick={onNavigateToScales}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5"
            >
              ← Step 1: Manage Rating Scales
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Official Report Card Schema
            </span>
          )}

          {onProceedToDistribution && (
            <button
              type="button"
              onClick={onProceedToDistribution}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              <span>Next: Assign to Classes</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

interface InteractiveSectionCardProps {
  section: BundleSectionDraft;
  sectionIndex: number;
  totalSections: number;
  scaleTemplates: ScaleTemplateRecord[];
  scaleMap: Record<string, ScaleTemplateRecord>;
  onUpdateSectionLabel: (label: string) => void;
  onMoveSection: (direction: -1 | 1) => void;
  onDeleteSection: () => void;
  onUpdateSectionScale: (scaleId: string) => void;
  onUpdateField: (fieldIndex: number, updated: BundleFieldDraft) => void;
  onAddField: (type?: BundleFieldDraft["type"], source?: BundleFieldDraft["source"]) => void;
  onMoveField: (fieldIndex: number, direction: -1 | 1) => void;
  onDeleteField: (fieldIndex: number) => void;
}

const InteractiveSectionCard = memo(function InteractiveSectionCard({
  section,
  sectionIndex,
  totalSections,
  scaleTemplates,
  scaleMap,
  onUpdateSectionLabel,
  onMoveSection,
  onDeleteSection,
  onUpdateSectionScale,
  onUpdateField,
  onAddField,
  onMoveField,
  onDeleteField,
}: InteractiveSectionCardProps) {
  const scaleFields = section.fields.filter((f) => f.type === "scale");
  const otherFields = section.fields.filter((f) => f.type !== "scale");

  const currentScaleId = scaleFields[0]?.scaleTemplateId ?? scaleTemplates[0]?._id ?? "";
  const activeScale = currentScaleId ? scaleMap[currentScaleId] : null;
  const scaleOptions = activeScale?.options ?? [
    { id: "5", label: "Excellent", shortLabel: "5", order: 0 },
    { id: "4", label: "Good", shortLabel: "4", order: 1 },
    { id: "3", label: "Fair", shortLabel: "3", order: 2 },
    { id: "2", label: "Poor", shortLabel: "2", order: 3 },
    { id: "1", label: "Very Poor", shortLabel: "1", order: 4 },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm space-y-4 p-5 sm:p-6 transition-all hover:border-slate-300">
      {/* Section Header with Editable Title and Ordering */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider shrink-0">
            #{sectionIndex + 1}
          </span>
          <input
            className="flex-1 text-sm font-black uppercase tracking-wider text-slate-900 bg-transparent outline-none border-b border-transparent focus:border-slate-400 py-0.5 placeholder:text-slate-300"
            onChange={(e) => onUpdateSectionLabel(e.target.value)}
            placeholder="Section Title (e.g. Affective & Behavioral Domain)"
            value={section.label}
          />
        </div>

        {/* Section Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={sectionIndex === 0}
            onClick={() => onMoveSection(-1)}
            className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            title="Move section up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={sectionIndex === totalSections - 1}
            onClick={() => onMoveSection(1)}
            className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors"
            title="Move section down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={totalSections === 1}
            onClick={onDeleteSection}
            className="p-1.5 text-slate-300 hover:text-rose-600 disabled:opacity-20 transition-colors ml-1"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RATING SCALE MATRIX TABLE (If section has scale fields or empty) */}
      {(scaleFields.length > 0 || otherFields.length === 0) && (
        <div className="space-y-3">
          {/* Table Controls (Rating scale switcher) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Evaluation Scale:
              </span>
              <select
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                onChange={(e) => onUpdateSectionScale(e.target.value)}
                value={currentScaleId}
              >
                {scaleTemplates.map((template) => (
                  <option key={template._id} value={template._id}>
                    {template.name} ({template.options.length} levels)
                  </option>
                ))}
              </select>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {scaleFields.length} {scaleFields.length === 1 ? "Trait" : "Traits"}
            </span>
          </div>

          {/* Direct Interactive Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="p-3 text-left">Trait / Evaluation Item</th>
                  {scaleOptions.map((opt, optIdx) => (
                    <th key={opt.id ?? `opt-${optIdx}`} className="p-2 text-center w-12 sm:w-16" title={opt.label}>
                      <span className="block font-black text-slate-800">{opt.shortLabel || opt.label}</span>
                      <span className="text-[8px] font-semibold text-slate-400 hidden sm:block truncate">{opt.label}</span>
                    </th>
                  ))}
                  <th className="p-3 text-right w-28">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {section.fields
                  .map((field, originalIdx) => ({ field, originalIdx }))
                  .filter(({ field }) => field.type === "scale")
                  .map(({ field, originalIdx }, rowIdx) => (
                    <InteractiveTableRow
                      key={field.key}
                      field={field}
                      fieldIndex={originalIdx}
                      rowNumber={rowIdx + 1}
                      scaleOptions={scaleOptions}
                      onUpdate={(updated) => onUpdateField(originalIdx, updated)}
                      onMove={(dir) => onMoveField(originalIdx, dir)}
                      onDelete={() => onDeleteField(originalIdx)}
                      canDelete={section.fields.length > 1}
                    />
                  ))}
              </tbody>
            </table>

            {/* In-table "+ Add Trait" row */}
            <button
              type="button"
              onClick={() => onAddField("scale", "teacher_manual")}
              className="w-full py-2.5 px-4 bg-slate-50/50 hover:bg-slate-50 border-t border-slate-100 text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Trait Row to Table
            </button>
          </div>
        </div>
      )}

      {/* OTHER FIELDS (Written Remarks & Attendance Metrics) */}
      {otherFields.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Written Remarks & Metrics
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.fields
              .map((field, originalIdx) => ({ field, originalIdx }))
              .filter(({ field }) => field.type !== "scale")
              .map(({ field, originalIdx }) => (
                <InteractiveCardField
                  key={field.key}
                  field={field}
                  fieldIndex={originalIdx}
                  onUpdate={(updated) => onUpdateField(originalIdx, updated)}
                  onDelete={() => onDeleteField(originalIdx)}
                />
              ))}
          </div>
        </div>
      )}

      {/* Section Quick Add Menu */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          + Add Section Item:
        </span>
        <button
          type="button"
          onClick={() => onAddField("scale", "teacher_manual")}
          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors"
        >
          + Rating Trait
        </button>
        <button
          type="button"
          onClick={() => onAddField("text", "teacher_manual")}
          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors"
        >
          + Written Remark
        </button>
        <button
          type="button"
          onClick={() => onAddField("text", "system_term")}
          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors"
        >
          + Resumption Date
        </button>
        <button
          type="button"
          onClick={() => onAddField("number", "system_attendance")}
          className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors"
        >
          + Attendance Summary
        </button>
      </div>
    </div>
  );
});

interface InteractiveTableRowProps {
  field: BundleFieldDraft;
  fieldIndex: number;
  rowNumber: number;
  scaleOptions: Array<{ id?: string; label: string; shortLabel: string | null }>;
  onUpdate: (updated: BundleFieldDraft) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  canDelete: boolean;
}

const InteractiveTableRow = memo(function InteractiveTableRow({
  field,
  rowNumber,
  scaleOptions,
  onUpdate,
  onMove,
  onDelete,
  canDelete,
}: InteractiveTableRowProps) {
  return (
    <tr className="group/row hover:bg-slate-50/50 transition-colors">
      {/* Trait Name Input */}
      <td className="p-2 sm:p-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-300 w-4 tabular-nums">
            {rowNumber}
          </span>
          <input
            className="flex-1 h-8 bg-transparent text-xs font-bold text-slate-900 outline-none border-b border-transparent focus:border-indigo-500 placeholder:text-slate-300 px-1"
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            placeholder="e.g. Attentiveness & Focus"
            value={field.label}
          />
        </div>
      </td>

      {/* Simulated Scale Rating Bubbles */}
      {scaleOptions.map((opt, optIdx) => (
        <td key={opt.id ?? `opt-${optIdx}`} className="p-2 text-center">
          <div className="flex items-center justify-center">
            {optIdx === 0 ? (
              <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 hover:border-slate-300" />
            )}
          </div>
        </td>
      ))}

      {/* Actions & Visibility */}
      <td className="p-2 sm:p-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onUpdate({ ...field, printable: !field.printable })}
            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors ${
              field.printable
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
            title={field.printable ? "Printed on Report Card" : "Internal only"}
          >
            {field.printable ? "Printed" : "Internal"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-20 transition-colors"
            title="Delete trait"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
});

interface InteractiveCardFieldProps {
  field: BundleFieldDraft;
  fieldIndex: number;
  onUpdate: (updated: BundleFieldDraft) => void;
  onDelete: () => void;
}

const InteractiveCardField = memo(function InteractiveCardField({
  field,
  onUpdate,
  onDelete,
}: InteractiveCardFieldProps) {
  const canonicalOptions =
    field.source === "system_term"
      ? systemTermFieldOptions
      : field.source === "system_attendance"
        ? systemAttendanceFieldOptions
        : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 space-y-2 relative group/card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {field.source === "system_term" && <Calendar className="w-3.5 h-3.5 text-indigo-600" />}
          {field.source === "system_attendance" && <Clock className="w-3.5 h-3.5 text-emerald-600" />}
          {field.source.includes("manual") && <FileText className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {field.source === "system_term"
              ? "System Term"
              : field.source === "system_attendance"
                ? "System Attendance"
                : "Narrative Remark"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdate({ ...field, printable: !field.printable })}
            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
              field.printable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {field.printable ? "Printed" : "Internal"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        className="w-full h-8 bg-white rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 placeholder:text-slate-300"
        onChange={(e) => onUpdate({ ...field, label: e.target.value })}
        placeholder="Field Label (e.g. Class Teacher's Remark)"
        value={field.label}
      />

      {(field.source === "system_term" || field.source === "system_attendance") && (
        <select
          className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
          onChange={(e) => {
            const nextKey = e.target.value as NonNullable<typeof field.systemKey>;
            const canonical = getCanonicalFieldConfig(nextKey);
            onUpdate({
              ...field,
              systemKey: nextKey,
              label: canonical?.label ?? field.label,
              type: canonical?.type ?? field.type,
            });
          }}
          value={field.systemKey ?? ""}
        >
          {canonicalOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === "text" && field.source.includes("manual") && (
        <div className="text-[11px] font-medium text-slate-400 bg-white p-2.5 rounded-lg border border-slate-100 italic">
          “Teacher will type termly narrative remarks in this box for each student.”
        </div>
      )}
    </div>
  );
});
