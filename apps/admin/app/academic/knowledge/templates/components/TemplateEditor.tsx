"use client";

import { BookOpenText, Plus, Layers3, GripVertical, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { cn } from "@/utils";
import type { 
  InstructionTemplateDraft, 
  InstructionTemplateScope, 
  InstructionTemplateSectionDraft 
} from "../types";
import { 
  instructionTemplateScopeOptions,
  moveTemplateItem
} from "../utils";

interface TemplateEditorProps {
  draft: InstructionTemplateDraft;
  subjectLabel: string;
  scopeSummary: string;
  subjects: Array<{ _id: string; name: string; code: string }>;
  levelOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<InstructionTemplateDraft>) => void;
  onScopeChange: (scope: InstructionTemplateScope) => void;
  onSectionChange: (index: number, patch: Partial<InstructionTemplateSectionDraft>) => void;
  onAddSection: () => void;
  onRemoveSection: (index: number) => void;
  onMoveSection: (index: number, direction: -1 | 1) => void;
  onToggleSectionRequired: (index: number, required: boolean) => void;
}

export function TemplateEditor({
  draft,
  subjectLabel,
  scopeSummary,
  subjects,
  levelOptions,
  onChange,
  onScopeChange,
  onSectionChange,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onToggleSectionRequired,
}: TemplateEditorProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Identity & Configuration Section */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">

          <AdminSurface intensity="low" className="p-4 lg:p-6 space-y-4 lg:space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 lg:h-10 lg:w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                <BookOpenText className="h-4 w-4 lg:h-5 lg:w-5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] text-slate-400">Identity</h2>
                <p className="text-xs lg:text-sm font-bold text-slate-900">Configure core template details</p>
              </div>
            </div>

            <div className="grid gap-3 lg:gap-4 sm:grid-cols-2">
              <label className="group sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-slate-950 transition-colors">Title</span>
                <input
                  className="mt-1.5 h-10 lg:h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-medium outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                  onChange={(e) => onChange({ title: e.target.value })}
                  placeholder="e.g. Term 2 Math Lesson Plan"
                  value={draft.title}
                />
              </label>
              
              <label className="group sm:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-slate-950 transition-colors">Internal Description</span>
                <textarea
                  className="mt-1.5 min-h-[60px] lg:min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition focus:border-slate-950 focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                  onChange={(e) => onChange({ description: e.target.value })}
                  placeholder="Optional notes for other admins..."
                  value={draft.description}
                />
              </label>
            </div>
          </AdminSurface>

          <AdminSurface intensity="low" className="p-3 lg:p-6 space-y-3 lg:space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 lg:h-10 lg:w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Layers3 className="h-4 w-4 lg:h-5 lg:w-5" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] text-slate-400">Section Rules</h2>
                <p className="text-xs lg:text-sm font-bold text-slate-900">Define structured content requirements</p>
              </div>
              <button
                onClick={onAddSection}
                className="ml-auto flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-1.5 lg:py-2 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 active:scale-95"
              >
                <Plus className="h-3 w-3" />
                Add Row
              </button>
            </div>

            <div className="space-y-2">
              {draft.sections.map((section, index) => (
                <SectionRow 
                  key={section.key} 
                  section={section} 
                  index={index}
                  totalCount={draft.sections.length}
                  onSectionChange={onSectionChange}
                  onMoveSection={onMoveSection}
                  onRemoveSection={onRemoveSection}
                  onToggleSectionRequired={onToggleSectionRequired}
                />
              ))}
              
              <button
                onClick={onAddSection}
                className="group flex w-full items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-slate-400 hover:bg-white hover:shadow-sm active:scale-[0.99]"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-colors group-hover:bg-slate-950 group-hover:text-white">
                  <Plus className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors group-hover:text-slate-950">
                  Append New Section
                </span>
              </button>
            </div>
          </AdminSurface>
        </div>

        {/* Sidebar Configuration */}
        <div className="space-y-6">
          <div className="sticky top-6 space-y-6">
            <AdminSurface intensity="low" className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Parameters</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scope Mode</span>
                  <select
                    className="h-9 lg:h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-slate-950"
                    onChange={(e) => onScopeChange(e.target.value as InstructionTemplateScope)}
                    value={draft.templateScope}
                  >
                    {instructionTemplateScopeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Subject</span>
                  <select
                    disabled={draft.templateScope === "level_only" || draft.templateScope === "school_default"}
                    className="h-9 lg:h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-slate-950 disabled:opacity-30"
                    onChange={(e) => onChange({ subjectId: e.target.value || null })}
                    value={draft.subjectId ?? ""}
                  >
                    <option value="">No Subject</option>
                    {subjects.map((s) => (
                      <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Level</span>
                  <select
                    disabled={draft.templateScope === "subject_only" || draft.templateScope === "school_default"}
                    className="h-9 lg:h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-slate-950 disabled:opacity-30"
                    onChange={(e) => onChange({ level: e.target.value })}
                    value={draft.level}
                  >
                    <option value="">No Level</option>
                    {levelOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => onChange({ isSchoolDefault: !draft.isSchoolDefault })}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 lg:py-3 transition-all",
                    draft.isSchoolDefault 
                      ? "border-slate-950 bg-slate-950 text-white shadow-xl shadow-slate-900/10"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">School Default</span>
                  <div className={cn("h-1.5 w-1.5 rounded-full", draft.isSchoolDefault ? "bg-emerald-400" : "bg-slate-200")} />
                </button>
              </div>
            </AdminSurface>

            <AdminSurface intensity="low" className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Rules</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4">
                <NumberField 
                  label="Min. Objectives"
                  value={draft.objectiveMinimums.minimumObjectives}
                  onChange={(val) => onChange({ objectiveMinimums: { ...draft.objectiveMinimums, minimumObjectives: val } })}
                />
                <NumberField 
                  label="Min. Sources"
                  value={draft.objectiveMinimums.minimumSourceMaterials}
                  onChange={(val) => onChange({ objectiveMinimums: { ...draft.objectiveMinimums, minimumSourceMaterials: val } })}
                />
                <NumberField 
                  label="Min. Total Sections"
                  value={draft.objectiveMinimums.minimumSections}
                  onChange={(val) => onChange({ objectiveMinimums: { ...draft.objectiveMinimums, minimumSections: val } })}
                />
              </div>
            </AdminSurface>

            <div className="flex items-center justify-between px-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Template Status</span>
              <button
                onClick={() => onChange({ isActive: !draft.isActive })}
                className="group flex items-center gap-3 outline-none"
              >
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest transition-colors",
                  draft.isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"
                )}>
                  {draft.isActive ? "Active" : "Inactive"}
                </span>
                <div className={cn(
                  "relative h-5 w-9 rounded-full transition-all duration-300",
                  draft.isActive ? "bg-emerald-500 shadow-sm shadow-emerald-500/20" : "bg-slate-200"
                )}>
                  <div className={cn(
                    "absolute top-1 h-3 w-3 rounded-full bg-white transition-all duration-300",
                    draft.isActive ? "left-5" : "left-1"
                  )} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionRow({
  section,
  index,
  totalCount,
  onSectionChange,
  onMoveSection,
  onRemoveSection,
  onToggleSectionRequired,
}: {
  section: InstructionTemplateSectionDraft;
  index: number;
  totalCount: number;
  onSectionChange: (index: number, patch: Partial<InstructionTemplateSectionDraft>) => void;
  onMoveSection: (index: number, direction: -1 | 1) => void;
  onRemoveSection: (index: number) => void;
  onToggleSectionRequired: (index: number, required: boolean) => void;
}) {
  return (
    <div
      className="group relative flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 rounded-xl lg:rounded-2xl border border-slate-100 bg-white p-3 lg:p-2 transition-all hover:border-slate-200 hover:shadow-sm"
    >
      {/* Action Sidebar / Header */}
      <div className="flex items-center lg:flex-col gap-2 shrink-0">
        <div className="flex lg:flex-col gap-0.5">
          <button
            disabled={index === 0}
            onClick={() => onMoveSection(index, -1)}
            className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-0"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={index === totalCount - 1}
            onClick={() => onMoveSection(index, 1)}
            className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-0"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
        
        {/* Mobile Trash Action */}
        <button
          disabled={totalCount === 1}
          onClick={() => onRemoveSection(index)}
          className="ml-auto lg:hidden flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid flex-1 gap-4 grid-cols-1 md:grid-cols-[1fr_140px_100px]">
        {/* Label Field */}
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Section Label</span>
          <input
            className="h-8 lg:h-9 w-full bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:text-slate-200"
            onChange={(e) => onSectionChange(index, { label: e.target.value })}
            placeholder="e.g. Introduction"
            value={section.label}
          />
        </div>

        {/* Requirements Grid (Mobile 2-col) */}
        <div className="grid grid-cols-2 md:contents gap-4">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Requirement</span>
            <button
              onClick={() => onToggleSectionRequired(index, !section.required)}
              className={cn(
                "flex h-8 lg:h-9 w-full items-center justify-between rounded-lg border px-3 text-[10px] font-bold transition-all",
                section.required ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-400 hover:text-slate-900"
              )}
            >
              {section.required ? "Required" : "Optional"}
              <div className={cn("h-1.5 w-1.5 rounded-full", section.required ? "bg-emerald-400" : "bg-slate-200")} />
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Min. Words</span>
            <input
              type="number"
              className="h-8 lg:h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5"
              onChange={(e) => onSectionChange(index, { minimumWordCount: e.target.value })}
              value={section.minimumWordCount}
            />
          </div>
        </div>
      </div>

      {/* Desktop Trash Action */}
      <button
        disabled={totalCount === 1}
        onClick={() => onRemoveSection(index)}
        className="hidden lg:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-0"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (val: string) => void }) {
  return (
    <label className="group flex items-center justify-between gap-4">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 transition-colors group-focus-within:text-slate-950">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-16 rounded-lg border border-slate-100 bg-white px-2 text-right text-xs font-bold text-slate-900 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5"
      />
    </label>
  );
}
