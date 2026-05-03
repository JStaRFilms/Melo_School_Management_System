"use client";

import Link from "next/link";
import type { ExamInputMode } from "@school/shared";
import { buildReportCardExtrasHref, buildReportCardHref } from "@school/shared";
import type {
  StudentRosterEntry,
  ScoreField,
  DraftScores,
  ValidationErrors,
  Id,
  GradingBandResponse,
} from "@/types";
import { getEffectiveValue, computeDerivedValues, getGradeColorClass } from "@/exam-helpers";
import { humanNameFinalStrict } from "@/human-name";

interface AdminRosterGridRowProps {
  student: StudentRosterEntry;
  examInputMode: ExamInputMode;
  gradingBands: GradingBandResponse[];
  draftScores: DraftScores;
  validationErrors: ValidationErrors;
  sessionId: string;
  termId: string;
  classId: string;
  isEditable: boolean;
  onScoreChange: (
    studentId: Id<"students">,
    field: ScoreField,
    value: number | null
  ) => void;
}

export function AdminRosterGridRow({
  student,
  examInputMode,
  gradingBands,
  draftScores,
  validationErrors,
  sessionId,
  termId,
  classId,
  isEditable,
  onScoreChange,
}: AdminRosterGridRowProps) {
  const showScaledColumn = examInputMode === "raw60_scaled_to_40";
  const displayStudentName = humanNameFinalStrict(student.studentName);

  const ca1 = getEffectiveValue(student.studentId, "ca1", draftScores, [student]);
  const ca2 = getEffectiveValue(student.studentId, "ca2", draftScores, [student]);
  const ca3 = getEffectiveValue(student.studentId, "ca3", draftScores, [student]);
  const examRaw = getEffectiveValue(
    student.studentId,
    "examRawScore",
    draftScores,
    [student]
  );
  const reportCardHref = buildReportCardHref({
    studentId: student.studentId,
    sessionId,
    termId,
    classId,
  });
  const reportCardExtrasHref = buildReportCardExtrasHref({
    studentId: student.studentId,
    sessionId,
    termId,
    classId,
  });

  const derived = computeDerivedValues(
    ca1,
    ca2,
    ca3,
    examRaw,
    examInputMode,
    gradingBands
  );

  const studentErrors = validationErrors.get(student.studentId) ?? {};

  const parseScoreValue = (raw: string) => {
    if (raw === "") return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const renderScoreInput = (field: ScoreField, value: number | null, max: number, isExam = false) => {
    const error = studentErrors[field];

    return (
      <div className="flex flex-col items-center gap-1">
        <input
          type="number"
          value={value ?? ""}
          min={0}
          max={max}
          step={1}
          disabled={!isEditable}
          onChange={(e) => {
            onScoreChange(student.studentId, field, parseScoreValue(e.target.value));
          }}
          placeholder="--"
          title={error ?? undefined}
          className={`score-input ${isExam ? "score-input-exam" : ""} ${error ? "error" : ""} ${
            !isEditable ? "cursor-not-allowed opacity-60" : ""
          }`}
        />
      </div>
    );
  };

  return (
    <tr className="group hover:bg-slate-50/50 transition-all cursor-pointer">
      <td className="sticky-column pl-6">
        <div className="flex flex-col">
          <span className="font-bold text-slate-950 text-sm tracking-tight">
            {displayStudentName}
          </span>
          <div className="flex gap-2.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {reportCardHref && (
              <Link
                href={reportCardHref}
                className="text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-900"
              >
                Report
              </Link>
            )}
            {reportCardExtrasHref && (
              <Link
                href={reportCardExtrasHref}
                className="text-[9px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900"
              >
                Extras
              </Link>
            )}
          </div>
        </div>
      </td>
      <td className="text-center">{renderScoreInput("ca1", ca1, 20)}</td>
      <td className="text-center">{renderScoreInput("ca2", ca2, 20)}</td>
      <td className="text-center">{renderScoreInput("ca3", ca3, 20)}</td>
      <td className="text-center">
        {renderScoreInput(
          "examRawScore",
          examRaw,
          examInputMode === "raw40" ? 40 : 60,
          true
        )}
      </td>
      {showScaledColumn && (
        <td className="text-center font-bold text-indigo-600">
          {derived.examScaledScore !== null
            ? derived.examScaledScore.toFixed(1)
            : "--"}
        </td>
      )}
      <td className="text-center font-black text-white bg-slate-950 border-r border-white/10 tabular-nums">
        {derived.total !== null ? derived.total.toFixed(0) : "--"}
      </td>
      <td className="text-center">
        <span
          className={`font-black text-sm ${getGradeColorClass(derived.gradeLetter)}`}
        >
          {derived.gradeLetter ?? "--"}
        </span>
      </td>
    </tr>
  );
}
