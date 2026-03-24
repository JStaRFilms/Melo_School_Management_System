"use client";

import type { ExamInputMode } from "@school/shared";

interface ComputedColumnsProps {
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  examScaledScore: number | null;
  total: number | null;
  gradeLetter: string | null;
  remark: string | null;
  examInputMode: ExamInputMode;
}

export function ComputedColumns({
  ca1,
  ca2,
  ca3,
  examScaledScore,
  total,
  gradeLetter,
  remark,
  examInputMode,
}: ComputedColumnsProps) {
  const showScaledColumn = examInputMode === "raw60_scaled_to_40";
  const isComplete =
    ca1 !== null && ca2 !== null && ca3 !== null && examScaledScore !== null;

  return (
    <>
      {/* Scaled /40 - exact mockup: bg-indigo-50/20, font-heading font-black text-xs text-indigo-600 */}
      {showScaledColumn && (
        <td className="bg-indigo-50/20 text-center font-heading font-black text-xs text-indigo-600 leading-none">
          {examScaledScore !== null ? examScaledScore.toFixed(2) : "--"}
        </td>
      )}

      {/* Total /100 - exact mockup: font-heading font-black text-lg text-obsidian-950 */}
      <td className="text-center font-heading font-black text-lg text-obsidian-950">
        {isComplete && total !== null ? total.toFixed(2) : "--"}
      </td>

      {/* Grade - exact mockup: text-sm font-black text-emerald-600 italic lg:not-italic */}
      <td>
        <span
          className={`text-sm font-black ${gradeLetter === "A" ? "text-emerald-600" : gradeLetter === "B" ? "text-blue-600" : gradeLetter === "C" ? "text-amber-600" : gradeLetter === "D" ? "text-orange-600" : gradeLetter === "F" ? "text-red-600" : "text-obsidian-300"} italic lg:not-italic`}
        >
          {gradeLetter ?? "--"}
        </span>
      </td>

      {/* Remark - exact mockup: text-[9px] font-bold editorial-spacing text-obsidian-400 */}
      <td>
        <span className="text-[9px] font-bold editorial-spacing text-obsidian-400">
          {remark ?? "--"}
        </span>
      </td>
    </>
  );
}
