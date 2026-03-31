"use client";

import { Lock, Timer } from "lucide-react";
import type { ChangeEvent } from "react";
import type { AssessmentEditingPolicyDraft } from "./assessmentEditingPolicyDraft";

interface AssessmentEditingPolicyProps {
  draft: AssessmentEditingPolicyDraft;
  onToggleChange: (value: boolean) => void;
  onDateChange: (
    field: "editingStartsAt" | "editingEndsAt",
    value: string
  ) => void;
}

function handleCheckedChange(
  event: ChangeEvent<HTMLInputElement>,
  callback: (value: boolean) => void
) {
  callback(event.target.checked);
}

export function AssessmentEditingPolicy({
  draft,
  onToggleChange,
  onDateChange,
}: AssessmentEditingPolicyProps) {
  const isTargetReady = Boolean(draft.sessionId && draft.termId);

  return (
    <div className="space-y-8">
      {/* Editing Restrictions */}
      <div className="space-y-4">
        <div className="space-y-1 px-1">
          <div className="flex items-center gap-2 text-[10px] font-extrabold text-amber-600 uppercase tracking-[0.2em]">
            <Lock size={10} />
            Privilege Gate
          </div>
          <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Security Protocol</h3>
        </div>

        <div className="group relative flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 transition-all duration-300 hover:border-slate-300 shadow-sm overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 transition-colors ${draft.restrictionsEnabled ? "bg-amber-500" : "bg-slate-200"}`} />
          <div className="space-y-0.5">
            <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-tight">Access Gate</h4>
            <div className="flex items-center gap-2">
              <span className={`h-1 w-1 rounded-full ${draft.restrictionsEnabled ? "bg-amber-400 animate-pulse" : "bg-slate-300"}`} />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{draft.restrictionsEnabled ? "Hard Lock Enabled" : "Pass-through mode"}</span>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={draft.restrictionsEnabled}
              disabled={!isTargetReady}
              onChange={(event) => handleCheckedChange(event, onToggleChange)}
              className="peer sr-only"
            />
            <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 disabled:opacity-50"></div>
          </label>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              <Timer size={10} />
              Window Open
            </div>
            <input
              type="datetime-local"
              value={draft.editingStartsAt}
              disabled={!draft.restrictionsEnabled || !isTargetReady}
              onChange={(event) => onDateChange("editingStartsAt", event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              <Timer size={10} />
              Window Close
            </div>
            <input
              type="datetime-local"
              value={draft.editingEndsAt}
              disabled={!draft.restrictionsEnabled || !isTargetReady}
              onChange={(event) => onDateChange("editingEndsAt", event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-50 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
