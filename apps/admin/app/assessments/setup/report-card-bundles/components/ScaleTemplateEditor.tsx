"use client";

import { memo, useCallback } from "react";
import { 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Trash2,
  ListOrdered,
  Layers,
  Sparkles
} from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { 
  createEmptyScaleOption, 
  moveItem, 
  STARTER_SCALE_TEMPLATES, 
  createScaleDraftFromPreset 
} from "../utils";
import type { ScaleOptionDraft, ScaleTemplateDraft } from "../types";

interface ScaleTemplateEditorProps {
  draft: ScaleTemplateDraft;
  onChange: (draft: ScaleTemplateDraft) => void;
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
      <AdminSurface intensity="none" className="flex items-center gap-4 border border-slate-100 bg-white p-3 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all">
        <div className="text-xs font-black text-slate-300 tabular-nums w-4">
          {index + 1}
        </div>
        
        <div className="flex-1 grid gap-4 grid-cols-2">
          <input
            className="h-9 w-full bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:text-slate-200 focus:text-slate-900"
            onChange={(event) => onUpdate(index, event.target.value, option.shortLabel)}
            placeholder="Option Label (e.g. Excellent)"
            value={option.label}
          />
          <input
            className="h-9 w-full bg-transparent text-xs font-medium text-slate-400 outline-none border-l border-slate-50 pl-4 placeholder:text-slate-200 focus:text-slate-600"
            onChange={(event) => onUpdate(index, option.label, event.target.value)}
            placeholder="Short Display (e.g. 5 or A)"
            value={option.shortLabel}
          />
        </div>

        <div className="flex items-center gap-1 opacity-20 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <button
            className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-20 transition-colors"
            disabled={isFirst}
            onClick={() => onMove(index, -1)}
            type="button"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            className="p-1 text-slate-300 hover:text-slate-900 disabled:opacity-20 transition-colors"
            disabled={isLast}
            onClick={() => onMove(index, 1)}
            type="button"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            className="ml-1 p-1 text-slate-200 hover:text-rose-600 disabled:opacity-20 transition-colors"
            disabled={!canDelete}
            onClick={() => onDelete(index)}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </AdminSurface>
    </div>
  );
});

export const ScaleTemplateEditor = memo(function ScaleTemplateEditor({ draft, onChange }: ScaleTemplateEditorProps) {
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
      {/* Quick Scale Presets */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-xs font-bold text-indigo-950">Standard Scale Presets</span>
          </div>
          <span className="text-[10px] font-semibold text-indigo-500">1-Click Load</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {STARTER_SCALE_TEMPLATES.map((preset, idx) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleLoadPreset(idx)}
              className="px-3 py-1.5 rounded-xl border border-indigo-200/80 bg-white hover:bg-indigo-50 text-[11px] font-bold text-indigo-900 transition-all shadow-sm hover:shadow"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      </div>

      <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <Layers className="w-4 h-4 text-slate-600" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Rating Scale Details</h2>
            <p className="text-xs font-medium text-slate-400">Define evaluation levels to reuse across bundles</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="group space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Scale Name</span>
            <input
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ ...draft, name: event.target.value })}
              placeholder="e.g. 5-Point Behavior Scale"
              value={draft.name}
            />
          </label>
          <label className="group space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Description (Optional)</span>
            <input
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder="Internal usage details"
              value={draft.description}
            />
          </label>
        </div>
      </AdminSurface>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            <ListOrdered className="w-3 h-3 opacity-50" />
            Rating Levels
          </h3>
          <button
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
            onClick={() => onChange({ ...draft, options: [...draft.options, createEmptyScaleOption()] })}
            type="button"
          >
            <Plus className="h-3 w-3" />
            Add Level
          </button>
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
          <div className="py-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No levels defined</p>
            <button
              className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline"
              onClick={() => onChange({ ...draft, options: [...draft.options, createEmptyScaleOption()] })}
            >
              + Add First Rating Level
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
