"use client";

import { Check } from "lucide-react";
import type { ExamInputMode } from "@school/shared";

interface ExamModeSelectorProps {
  currentMode: ExamInputMode | null;
  onModeChange: (mode: ExamInputMode) => void;
}

export function ExamModeSelector({
  currentMode,
  onModeChange,
}: ExamModeSelectorProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="section-heading">1. Input Mode</h2>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Direct /40 Entry */}
        <label
          className={`group relative bg-white border-2 rounded-xl p-4 sm:p-5 cursor-pointer block transition-all ${
            currentMode === "raw40"
              ? "border-blue-600"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <input
            type="radio"
            name="exam_mode"
            checked={currentMode === "raw40"}
            onChange={() => onModeChange("raw40")}
            className="hidden"
          />
          <div className="flex items-center gap-3 mb-3">
            {currentMode === "raw40" ? (
              <span className="bg-blue-600 text-white p-1 rounded-full">
                <Check className="w-3 h-3" />
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full border border-slate-200 group-hover:border-slate-400" />
            )}
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">
              Direct /40 Entry
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Teachers enter exam scores directly out of 40. Recommended for
            secondary schools.
          </p>
        </label>

        {/* Scaled /60 Entry */}
        <label
          className={`group relative bg-white border-2 rounded-xl p-4 sm:p-5 cursor-pointer block transition-all ${
            currentMode === "raw60_scaled_to_40"
              ? "border-blue-600"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <input
            type="radio"
            name="exam_mode"
            checked={currentMode === "raw60_scaled_to_40"}
            onChange={() => onModeChange("raw60_scaled_to_40")}
            className="hidden"
          />
          <div className="flex items-center gap-3 mb-3">
            {currentMode === "raw60_scaled_to_40" ? (
              <span className="bg-blue-600 text-white p-1 rounded-full">
                <Check className="w-3 h-3" />
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full border border-slate-200 group-hover:border-slate-400" />
            )}
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight">
              Scaled /60 Entry
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Teachers enter scores out of 60. System scales it to 40 for final
            total.
          </p>
        </label>
      </div>
    </section>
  );
}
