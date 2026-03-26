"use client";

import Link from "next/link";
import type { ExamInputMode } from "@school/shared";
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

  const derived = computeDerivedValues(
    ca1,
    ca2,
    ca3,
    examRaw,
    examInputMode,
    gradingBands
  );

  const studentErrors = validationErrors.get(student.studentId) ?? {};

  return (
    <tr className="hover:bg-slate-50/50 transition-all cursor-pointer">
      <td className="sticky-column">
        <span className="font-semibold text-slate-900">
          {displayStudentName}
        </span>
        <div className="mt-1">
          <Link
            href={`/assessments/report-cards?studentId=${student.studentId}&sessionId=${sessionId}&termId=${termId}&classId=${classId}`}
            className="text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-600"
          >
            View Report Card
          </Link>
        </div>
        <p className="text-[8px] font-medium text-slate-400 uppercase mt-0.5 tracking-tighter">
          {student.assessmentRecord
            ? "Standard Entry"
            : "Admin Override"}
        </p>
      </td>
      <td>
        <input
          type="number"
          value={ca1 ?? ""}
          min={0}
          max={20}
          step={1}
          onChange={(e) => {
            const v =
              e.target.value === "" ? null : parseInt(e.target.value, 10);
            onScoreChange(
              student.studentId,
              "ca1",
              isNaN(v as number) ? null : v
            );
          }}
          placeholder="--"
          className={`score-input ${studentErrors.ca1 ? "error" : ""}`}
        />
      </td>
      <td>
        <input
          type="number"
          value={ca2 ?? ""}
          min={0}
          max={20}
          step={1}
          onChange={(e) => {
            const v =
              e.target.value === "" ? null : parseInt(e.target.value, 10);
            onScoreChange(
              student.studentId,
              "ca2",
              isNaN(v as number) ? null : v
            );
          }}
          placeholder="--"
          className={`score-input ${studentErrors.ca2 ? "error" : ""}`}
        />
      </td>
      <td>
        <input
          type="number"
          value={ca3 ?? ""}
          min={0}
          max={20}
          step={1}
          onChange={(e) => {
            const v =
              e.target.value === "" ? null : parseInt(e.target.value, 10);
            onScoreChange(
              student.studentId,
              "ca3",
              isNaN(v as number) ? null : v
            );
          }}
          placeholder="--"
          className={`score-input ${studentErrors.ca3 ? "error" : ""}`}
        />
      </td>
      <td>
        <input
          type="number"
          value={examRaw ?? ""}
          min={0}
          max={examInputMode === "raw40" ? 40 : 60}
          step={1}
          onChange={(e) => {
            const v =
              e.target.value === "" ? null : parseInt(e.target.value, 10);
            onScoreChange(
              student.studentId,
              "examRawScore",
              isNaN(v as number) ? null : v
            );
          }}
          placeholder="--"
          className={`score-input border-blue-100 bg-blue-50/10 ${studentErrors.examRawScore ? "error" : ""}`}
        />
      </td>
      {showScaledColumn && (
        <td className="text-center font-bold text-indigo-600">
          {derived.examScaledScore !== null
            ? derived.examScaledScore.toFixed(2)
            : "--"}
        </td>
      )}
      <td className="text-center font-bold text-slate-900">
        {derived.total !== null ? derived.total.toFixed(1) : "--"}
      </td>
      <td className="text-center">
        <span
          className={`font-bold ${getGradeColorClass(derived.gradeLetter)}`}
        >
          {derived.gradeLetter ?? "--"}
        </span>
      </td>
      <td className="text-[8px] text-slate-400 uppercase font-medium">
        {student.assessmentRecord ? "Standard Entry" : "Admin Override"}
      </td>
    </tr>
  );
}
