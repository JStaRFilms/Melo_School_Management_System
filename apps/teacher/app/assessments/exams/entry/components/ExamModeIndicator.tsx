"use client";

import { CheckCircle, Info } from "lucide-react";
import type { ExamInputMode } from "@school/shared";

interface ExamModeIndicatorProps {
  examInputMode: ExamInputMode;
}

export function ExamModeIndicator({ examInputMode }: ExamModeIndicatorProps) {
  if (examInputMode === "raw40") {
    return (
      <div className="bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-lg flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-indigo-600" />
        <span className="text-[10px] font-bold editorial-spacing text-indigo-700">
          Active Rule: ExamRawMode=raw40
        </span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg flex items-center gap-2">
      <Info className="w-4 h-4 text-amber-700" />
      <span className="text-[10px] font-bold editorial-spacing text-amber-800">
        Active Rule: ExamRawMode=raw60_scaled
      </span>
    </div>
  );
}
