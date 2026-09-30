"use client";

import type { ExamInputMode } from "@school/shared";
import type { SessionScoringPolicy } from "@school/shared/exam-recording";

interface ComputedColumnsProps {
  ca1: number | null;
  ca2: number | null;
  ca3: number | null;
  examScaledScore: number | null;
  total: number | null;
  gradeLetter: string | null;
  gradeColor?: string;
  remark: string | null;
  examInputMode: ExamInputMode;
  policy?: SessionScoringPolicy;
  showScaledColumn?: boolean;
  showMaxLabel?: boolean;
}

export function ComputedColumns({
  ca1,
  ca2,
  ca3,
  examScaledScore,
  total,
  gradeLetter,
  gradeColor,
  remark,
  examInputMode,
  policy,
  showScaledColumn = policy ? policy.examRawMax !== policy.examContributionMax : examInputMode === "raw60_scaled_to_40",
  showMaxLabel = false,
}: ComputedColumnsProps) {
  const isComplete =
    ca1 !== null && ca2 !== null && ca3 !== null && examScaledScore !== null;

  return (
    <>
      {/* Scaled /40 - exact mockup: bg-indigo-50/20, font-heading font-black text-xs text-indigo-600 */}
      {showScaledColumn && (
        <td className="bg-indigo-50/20 text-center font-heading font-black text-xs text-indigo-600 leading-none">
          {examScaledScore !== null ? examScaledScore.toFixed(2) : "--"}
          {showMaxLabel && <span className="block text-[10px]">/{policy?.examContributionMax ?? 40}</span>}
        </td>
      )}

      {/* Total /100 - exact mockup: font-heading font-black text-lg text-obsidian-950 */}
      <td className="text-center font-heading font-black text-lg text-obsidian-950">
        {isComplete && total !== null ? total.toFixed(2) : "--"}
      </td>

      {/* Grade - exact mockup: text-sm font-black text-emerald-600 italic lg:not-italic */}
      <td>
        <span
          className="text-sm font-black italic lg:not-italic" style={{color: gradeColor}}
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
