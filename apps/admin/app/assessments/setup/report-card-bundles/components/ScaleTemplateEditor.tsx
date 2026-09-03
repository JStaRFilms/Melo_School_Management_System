"use client";

import { memo, useCallback } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2,
  ListOrdered,
  Layers,
  Sparkles,
  CheckCircle2,
  Eye
} from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { 
  createEmptyScaleOption, 
  moveItem, 
  STARTER_SCALE_TEMPLATES, 
  createScaleDraftFromPreset 
} from "../utils";
import type { ScaleOptionDraft, ScaleTemplateDraft } from "../types";
import { ScaleLiveCanvas } from "./ScaleLiveCanvas";

interface ScaleTemplateEditorProps {
  draft: ScaleTemplateDraft;
  onChange: (draft: ScaleTemplateDraft | ((prev: ScaleTemplateDraft) => ScaleTemplateDraft)) => void;
  hidePreview?: boolean;
}

interface ScaleOptionRowProps {
  option: ScaleOptionDraft;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onUpdate: (index: number, label: string, shortLabel: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (index: number) => void;
}

const ScaleOptionRow = memo(function ScaleOptionRow({
  option,
  index,
  isFirst,
  isLast,
  canDelete,
  onUpdate,
  onMove,
  onDelete,
}: ScaleOptionRowProps) {
  return (
    <div className="group animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-3 border border-slate-200 bg-white p-3 rounded-xl hover:border-slate-300 hover:shadow-xs transition-all shadow-2xs">
        <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200/80 text-xs font-black text-slate-700 tabular-nums flex items-center justify-center shrink-0">
          {index + 1}
        </div>
        
        <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
              onChange={(event) => onUpdate(index, event.target.value, option.shortLabel)}
              placeholder="e.g. Excellent, Always, 5"
              value={option.label}
            />
          </div>
          <div>
            <input
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
              onChange={(event) => onUpdate(index, option.label, event.target.value)}
              placeholder="e.g. 5 or A (Table Column Key)"
              value={option.shortLabel}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20 transition-colors"
            disabled={isFirst}
            onClick={() => onMove(index, -1)}
            type="button"
            title="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-20 transition-colors"
            disabled={isLast}
            onClick={() => onMove(index, 1)}
            type="button"
            title="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 transition-colors"
            disabled={!canDelete}
            onClick={() => onDelete(index)}
            type="button"
            title="Remove level"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export const ScaleTemplateEditor = memo(function ScaleTemplateEditor({
  draft,
  onChange,
  hidePreview = false,
}: ScaleTemplateEditorProps) {
  const handleLoadPreset = useCallback((presetIndex: number) => {
    const preset = STARTER_SCALE_TEMPLATES[presetIndex];
    if (!preset) return;
    onChange(createScaleDraftFromPreset(preset));
  }, [onChange]);

  const handleUpdateOption = useCallback(
    (index: number, label: string, shortLabel: string) => {
      const nextOptions = draft.options.map((opt, i) => {
        if (i !== index) return opt;
        return { ...opt, label, shortLabel };
      });
      onChange({ ...draft, options: nextOptions });
    },
    [draft, onChange]
  );

  const handleMoveOption = useCallback(
    (index: number, direction: -1 | 1) => {
      onChange({ ...draft, options: moveItem(draft.options, index, direction) });
    },
    [draft, onChange]
  );

  const handleDeleteOption = useCallback(
    (index: number) => {
      onChange({ ...draft, options: draft.options.filter((_, i) => i !== index) });
    },
    [draft, onChange]
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Starter Rating Scales Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Sparkles className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Quick Setup
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600">
                  Presets
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                Standard Rating Scale Presets
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          {STARTER_SCALE_TEMPLATES.map((preset, idx) => (
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

      <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
            <Layers className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">Rating Scale Details</h2>
            <p className="text-[11px] font-medium text-slate-500">Define evaluation levels to reuse across report add-on tables</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Scale Name</span>
            <input
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400 placeholder:font-normal"
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="e.g. 5-Point Rating Scale"
              value={draft.name}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Description (Optional)</span>
            <input
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-400 placeholder:font-normal"
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder="e.g. Used for Primary affective evaluation"
              value={draft.description}
            />
          </label>
        </div>
      </AdminSurface>

      {/* Rating Levels Config Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Evaluation Levels ({draft.options.length})
            </h3>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition-all active:scale-95"
            onClick={() => onChange({ ...draft, options: [...draft.options, createEmptyScaleOption()] })}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Level
          </button>
        </div>

        {/* Column Headers */}
        <div className="hidden sm:grid grid-cols-[24px_1fr_1fr_90px] gap-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span>#</span>
          <span>Full Level Label (e.g. Excellent)</span>
          <span>Short Symbol / Column Key (e.g. 5 or A)</span>
          <span className="text-right">Reorder / Delete</span>
        </div>

        <div className="space-y-2">
          {draft.options.map((option, index) => (
            <ScaleOptionRow
              key={option.key}
              option={option}
              index={index}
              isFirst={index === 0}
              isLast={index === draft.options.length - 1}
              canDelete={draft.options.length > 1}
              onUpdate={handleUpdateOption}
              onMove={handleMoveOption}
              onDelete={handleDeleteOption}
            />
          ))}
        </div>

        {draft.options.length === 0 && (
          <div className="py-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-center p-6">
            <p className="text-xs font-bold text-slate-600">No evaluation levels defined</p>
            <button
              className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline"
              onClick={() => onChange({ ...draft, options: [...draft.options, createEmptyScaleOption()] })}
            >
              + Add First Rating Level
            </button>
          </div>
        )}
      </div>

      {/* Integrated In-flow Live Preview Section for smaller screens */}
      {!hidePreview && (
        <div className="pt-4 border-t border-slate-200/80 space-y-3 xl:hidden">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Eye className="w-4 h-4 text-slate-500" />
            <span>Live Scale Preview (How it looks on report cards)</span>
          </div>
          <ScaleLiveCanvas draft={draft} />
        </div>
      )}
    </div>
  );
});
