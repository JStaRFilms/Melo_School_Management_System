"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  GripVertical,
  GraduationCap,
  BookOpen,
  FolderPlus,
  HeartHandshake,
  Activity,
  CalendarCheck,
  MessageSquareQuote,
  CheckCircle2,
  Calendar,
  Clock,
  FileText,
  ShieldCheck,
} from "lucide-react";
import type {
  BundleDraft,
  BundleFieldDraft,
  BundleSectionDraft,
  ScaleTemplateRecord,
} from "../types";
import {
  createEmptyField,
  createEmptySection,
  moveItem,
  STARTER_BUNDLE_PRESETS,
  getShortPresetName,
  createBundleDraftFromPreset,
  createSectionDraftsFromPreset,
  createSectionDraftFromPreset,
  systemAttendanceFieldOptions,
  systemTermFieldOptions,
} from "../utils";

function getPresetIcon(presetIndex: number) {
  switch (presetIndex) {
    case 0:
      return HeartHandshake;
    case 1:
      return Activity;
    case 2:
      return CalendarCheck;
    case 3:
      return MessageSquareQuote;
    default:
      return FileText;
  }
}

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

  const isDraftHasContent = useMemo(() => {
    if (draft.name.trim()) return true;
    if (draft.sections.length > 1) return true;
    const firstSection = draft.sections[0];
    if (!firstSection) return false;
    if (firstSection.label.trim()) return true;
    if (firstSection.fields.length > 0 && firstSection.fields.some((f) => Boolean(f.label.trim()))) {
      return true;
    }
    return false;
  }, [draft]);

  // Top bar preset loader:
  // If the draft has content, append as a new section!
  // If the draft is completely blank, initialize the draft.
  const handleLoadPreset = useCallback(
    (presetIndex: number) => {
      const preset = STARTER_BUNDLE_PRESETS[presetIndex];
      if (!preset) return;
      const defaultScale = scaleTemplates[0]?._id ?? null;

      onChange((current) => {
        const hasContent =
          Boolean(current.name.trim()) ||
          current.sections.length > 1 ||
          (current.sections[0] &&
            (Boolean(current.sections[0].label.trim()) ||
              current.sections[0].fields.some((f) => Boolean(f.label.trim()))));

        if (!hasContent) {
          return createBundleDraftFromPreset(preset, defaultScale);
        }

        const newSections = createSectionDraftsFromPreset(preset, defaultScale);
        return {
          ...current,
          name: current.name.trim() ? current.name : preset.name,
          sections: [...current.sections, ...newSections],
        };
      });
    },
    [onChange, scaleTemplates]
  );

  // Directly append a preset as a new section
  const handleAddPresetSection = useCallback(
    (presetIndex: number) => {
      const preset = STARTER_BUNDLE_PRESETS[presetIndex];
      if (!preset) return;
      const defaultScale = scaleTemplates[0]?._id ?? null;
      const newSections = createSectionDraftsFromPreset(preset, defaultScale);

      onChange((current) => ({
        ...current,
        name: current.name.trim() ? current.name : preset.name,
        sections: [...current.sections, ...newSections],
      }));
    },
    [onChange, scaleTemplates]
  );

  // Add a blank section (waiting for user setup or manual additions)
  const handleAddBlankSection = useCallback(() => {
    onChange((current) => ({
      ...current,
      sections: [...current.sections, createEmptySection(false)],
    }));
  }, [onChange]);

  // Apply a preset into a specific existing section
  const handleApplyPresetToSection = useCallback(
    (sectionIndex: number, presetIndex: number) => {
      const preset = STARTER_BUNDLE_PRESETS[presetIndex];
      if (!preset) return;
      const defaultScale = scaleTemplates[0]?._id ?? null;
      const newSectionData = createSectionDraftFromPreset(preset, defaultScale);

      onChange((current) => ({
        ...current,
        name: current.name.trim() ? current.name : preset.name,
        sections: current.sections.map((section, sIdx) => {
          if (sIdx !== sectionIndex) return section;
          return {
            ...section,
            label: newSectionData.label,
            fields: newSectionData.fields,
          };
        }),
      }));
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
    (
      sectionIndex: number,
      type: BundleFieldDraft["type"] = "scale",
      source: BundleFieldDraft["source"] = "teacher_manual"
    ) => {
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
      {/* Curriculum Templates Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 sm:px-4 sm:py-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Curriculum Templates
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-slate-500 border border-slate-200">
                {isDraftHasContent ? "Appends Section" : "1-Click Setup"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
          {STARTER_BUNDLE_PRESETS.map((preset, idx) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleLoadPreset(idx)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100/80 hover:border-slate-300 text-xs font-semibold text-slate-700 transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3 h-3 text-slate-400" />
              <span>{getShortPresetName(idx)}</span>
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
              onApplyPreset={(presetIdx) => handleApplyPresetToSection(sIdx, presetIdx)}
            />
          ))}

          {/* Add Section Bar */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Add Report Card Section
                  </h4>
                  <p className="text-[11px] font-medium text-slate-500">
                    Add a blank section or insert a standard curriculum domain
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddBlankSection}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Blank Section</span>
              </button>
            </div>

            <div className="pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                Or insert template:
              </span>
              {STARTER_BUNDLE_PRESETS.map((preset, idx) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleAddPresetSection(idx)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-xs font-semibold text-slate-700 transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-slate-400" />
                  <span>{getShortPresetName(idx)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Flow Navigation & Sheet Footer */}
        <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {onNavigateToScales ? (
            <button
              type="button"
              onClick={onNavigateToScales}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer"
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
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-2 cursor-pointer"
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
  onApplyPreset: (presetIndex: number) => void;
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
  onApplyPreset,
}: InteractiveSectionCardProps) {
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close preset dropdown on outside click
  useEffect(() => {
    if (!isPresetMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsPresetMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPresetMenuOpen]);

  const scaleFields = section.fields.filter((f) => f.type === "scale");
  const otherFields = section.fields.filter((f) => f.type !== "scale");
  const isSectionEmpty = section.fields.length === 0;

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
    <div className="rounded-2xl border border-slate-200 bg-white overflow-visible shadow-sm space-y-4 p-5 sm:p-6 transition-all hover:border-slate-300">
      {/* Section Header with Editable Title and Ordering */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
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

        {/* Section Actions: Presets Menu + Move + Delete */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Template dropdown switcher */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsPresetMenuOpen((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-600 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Load a template into this section"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Template</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isPresetMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-30 divide-y divide-slate-100">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  Replace Section #{sectionIndex + 1} Content
                </div>
                <div className="p-1 space-y-0.5">
                  {STARTER_BUNDLE_PRESETS.map((preset, pIdx) => {
                    const Icon = getPresetIcon(pIdx);
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setIsPresetMenuOpen(false);
                          onApplyPreset(pIdx);
                        }}
                        className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-start gap-2.5 transition-colors cursor-pointer"
                      >
                        <div className="p-1 rounded-md bg-slate-100 text-slate-600 mt-0.5 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="block font-bold text-slate-800 truncate">{preset.name}</span>
                          <span className="block text-[11px] text-slate-500 line-clamp-1">
                            {preset.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={sectionIndex === 0}
            onClick={() => onMoveSection(-1)}
            className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors cursor-pointer"
            title="Move section up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={sectionIndex === totalSections - 1}
            onClick={() => onMoveSection(1)}
            className="p-1.5 text-slate-400 hover:text-slate-900 disabled:opacity-20 transition-colors cursor-pointer"
            title="Move section down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={totalSections === 1}
            onClick={onDeleteSection}
            className="p-1.5 text-slate-300 hover:text-rose-600 disabled:opacity-20 transition-colors ml-1 cursor-pointer"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SECTION CONTENT: Empty State Setup OR Active Fields Table */}
      {isSectionEmpty ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-2xs">
            <BookOpen className="w-5 h-5 text-slate-500" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Section #{sectionIndex + 1} is Empty
            </h4>
            <p className="text-xs font-medium text-slate-500 max-w-md mx-auto">
              Select a curriculum template to populate this section, or add items manually.
            </p>
          </div>

          {/* Template Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {STARTER_BUNDLE_PRESETS.map((preset, idx) => {
              const Icon = getPresetIcon(idx);
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => onApplyPreset(idx)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-xs font-bold text-slate-800 transition-all shadow-2xs flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="w-12 h-px bg-slate-200" />
            <span>Or Start Manually</span>
            <span className="w-12 h-px bg-slate-200" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onAddField("scale", "teacher_manual")}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              + Rating Trait Table
            </button>
            <button
              type="button"
              onClick={() => onAddField("text", "teacher_manual")}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              + Written Remark
            </button>
            <button
              type="button"
              onClick={() => onAddField("text", "system_term")}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              + Resumption Date
            </button>
            <button
              type="button"
              onClick={() => onAddField("number", "system_attendance")}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              + Attendance Summary
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Trait Rating Scale Selector (if section has scale fields) */}
          {scaleFields.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Evaluation Scale:
                </span>
                <select
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-slate-400 shadow-2xs cursor-pointer"
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

              <div className="text-[11px] font-semibold text-slate-400">
                {scaleFields.length} {scaleFields.length === 1 ? "trait" : "traits"}
              </div>
            </div>
          )}

          {/* Scale Ratings Table */}
          {scaleFields.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="p-2 sm:p-3 w-1/2">Trait / Evaluation Item</th>
                    {scaleOptions.map((opt, idx) => (
                      <th key={opt.id ?? `scale-opt-${idx}`} className="p-2 text-center text-slate-600 font-bold">
                        <span className="block text-xs text-slate-900">{opt.shortLabel || opt.label}</span>
                        <span className="text-[9px] font-normal text-slate-400 uppercase truncate max-w-[80px] inline-block">
                          {opt.label}
                        </span>
                      </th>
                    ))}
                    <th className="p-2 sm:p-3 text-right">Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scaleFields.map((field) => {
                    const originalIndex = section.fields.findIndex((f) => f.key === field.key);
                    const scaleTraitIndex = scaleFields.findIndex((f) => f.key === field.key);
                    return (
                      <InteractiveTableRow
                        key={field.key}
                        field={field}
                        fieldIndex={originalIndex}
                        rowNumber={scaleTraitIndex + 1}
                        scaleOptions={scaleOptions}
                        onUpdate={(updated) => onUpdateField(originalIndex, updated)}
                        onMove={(dir) => onMoveField(originalIndex, dir)}
                        onDelete={() => onDeleteField(originalIndex)}
                        canDelete={section.fields.length > 1}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Free Text / System / Number Non-Scale Fields */}
          {otherFields.length > 0 && (
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Additional Observations & Narrative Fields:
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {otherFields.map((field) => {
                  const originalIndex = section.fields.findIndex((f) => f.key === field.key);
                  return (
                    <InteractiveCardField
                      key={field.key}
                      field={field}
                      fieldIndex={originalIndex}
                      onUpdate={(updated) => onUpdateField(originalIndex, updated)}
                      onMove={(dir) => onMoveField(originalIndex, dir)}
                      onDelete={() => onDeleteField(originalIndex)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Section Footer: Quick Add Trait or Field */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
              Add To Section:
            </span>
            <button
              type="button"
              onClick={() => onAddField("scale", "teacher_manual")}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              + Rating Trait
            </button>
            <button
              type="button"
              onClick={() => onAddField("text", "teacher_manual")}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              + Written Remark
            </button>
            <button
              type="button"
              onClick={() => onAddField("text", "system_term")}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              + Resumption Date
            </button>
            <button
              type="button"
              onClick={() => onAddField("number", "system_attendance")}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              + Attendance Summary
            </button>
            <button
              type="button"
              onClick={() => setIsPresetMenuOpen((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3 h-3 text-slate-500" />
              Template...
            </button>
          </div>
        </>
      )}
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
            onClick={() => onMove(-1)}
            className="p-1 text-slate-300 transition-colors hover:text-slate-700 cursor-pointer"
            title="Move trait up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            className="p-1 text-slate-300 transition-colors hover:text-slate-700 cursor-pointer"
            title="Move trait down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ ...field, printable: !field.printable })}
            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
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
            className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-20 transition-colors cursor-pointer"
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
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

const InteractiveCardField = memo(function InteractiveCardField({
  field,
  onUpdate,
  onMove,
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
            onClick={() => onMove(-1)}
            className="p-1 text-slate-300 transition-colors hover:text-slate-700 cursor-pointer"
            title="Move field up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            className="p-1 text-slate-300 transition-colors hover:text-slate-700 cursor-pointer"
            title="Move field down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onUpdate({ ...field, printable: !field.printable })}
            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer ${
              field.printable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {field.printable ? "Printed" : "Internal"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
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

      {canonicalOptions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
            Map to system value:
          </span>
          <select
            className="w-full h-7 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
            onChange={(e) => onUpdate({ ...field, systemKey: (e.target.value as any) || null })}
            value={field.systemKey ?? ""}
          >
            {canonicalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});
