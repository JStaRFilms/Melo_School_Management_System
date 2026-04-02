"use client";

import { Check, Info } from "lucide-react";
import type { ExamInputMode } from "@school/shared";

interface ExamModeSelectorProps {
  currentMode: ExamInputMode | null;
  onModeChange: (mode: ExamInputMode) => void;
}

const MODES = [
  {
    id: "raw40" as const,
    label: "Direct /40 Entry",
    description: "Scores entered directly out of 40.",
  },
  {
    id: "raw60_scaled_to_40" as const,
    label: "Scaled /60 Entry",
    description: "Scores entered out of 60, scaled down to 40.",
  },
];

export function ExamModeSelector({
  currentMode,
  onModeChange,
}: ExamModeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1 px-1">
        <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">
          <Info size={10} />
          Input Strategy
        </div>
        <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Exam Scoring Mode</h3>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          return (
            <label
              key={mode.id}
              className={`group relative flex items-center justify-between bg-white border rounded-xl p-4 cursor-pointer transition-all duration-300 focus-within:ring-4 focus-within:ring-blue-50 ${
                isActive
                  ? "border-blue-600 ring-4 ring-blue-50/50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
              }`}
            >
              <input
                type="radio"
                name="exam_mode"
                checked={isActive}
                onChange={() => onModeChange(mode.id)}
                className="sr-only peer"
              />
              <div className="flex flex-col gap-0.5">
                <span className={`text-[11px] font-bold tracking-tight transition-colors ${
                  isActive ? "text-blue-600" : "text-slate-900 group-hover:text-slate-950"
                }`}>
                  {mode.label}
                </span>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  {mode.description}
                </p>
              </div>
              
              <div className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                isActive
                  ? "bg-blue-600 border-blue-600 shadow-sm"
                  : "border-slate-200 group-hover:border-slate-300"
              } peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100`}>
                {isActive && <Check className="w-3 h-3 text-white" />}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
