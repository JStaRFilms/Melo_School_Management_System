"use client";

import Link from "next/link";
import type { ExamInputMode } from "@school/shared";
import { scoreRowPolicy, type SessionScoringPolicy } from "@school/shared/exam-recording";
import { buildReportCardExtrasHref, buildReportCardHref } from "@school/shared";
import type {
  StudentRosterEntry,
  ScoreField,
  DraftScores,
  ValidationErrors,
  Id,
  GradingBandResponse,
} from "@/lib/types";
import { humanNameFinalStrict } from "@/lib/human-name";
import { ScoreInput } from "./ScoreInput";
import { ComputedColumns } from "./ComputedColumns";
import { getEffectiveValue, computeDerivedValues } from "@/lib/exam-helpers";

interface RosterGridRowProps {
  student: StudentRosterEntry;
  examInputMode: ExamInputMode;
  policy?: SessionScoringPolicy;
  showScaledColumn?: boolean;
  showRowLimits?: boolean;
  gradingBands: GradingBandResponse[];
  draftScores: DraftScores;
  validationErrors: ValidationErrors;
  sessionId?: string;
  termId?: string;
  classId?: string;
  isEditable: boolean;
  onScoreChange: (
    studentId: Id<"students">,
    field: ScoreField,
    value: number | null
  ) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function RosterGridRow({
  student,
  examInputMode,
  policy,
  showScaledColumn = false,
  showRowLimits = false,
  gradingBands,
  draftScores,
  validationErrors,
  sessionId = "",
  termId = "",
  classId = "",
  isEditable,
  onScoreChange,
}: RosterGridRowProps) {
  const rowPolicy = scoreRowPolicy(examInputMode, policy, student.assessmentRecord);
  const examMax = rowPolicy.examRawMax;
  const displayStudentName = humanNameFinalStrict(student.studentName);
  const studentErrors = validationErrors.get(student.studentId) ?? {};

  const ca1 = getEffectiveValue(student.studentId, "ca1", draftScores, [
    student,
  ]);
  const ca2 = getEffectiveValue(student.studentId, "ca2", draftScores, [
    student,
  ]);
  const ca3 = getEffectiveValue(student.studentId, "ca3", draftScores, [
    student,
  ]);
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
    gradingBands,
    rowPolicy
  );

  return (
    <tr className="roster-row">
      {/* Student - exact mockup: sticky-column, w-6 h-6 rounded bg-obsidian-50 */}
      <td className="sticky-column">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-obsidian-50 flex items-center justify-center font-bold text-[8px] text-obsidian-500">
            {getInitials(displayStudentName)}
          </div>
          <div>
            <span className="font-bold text-sm text-obsidian-900">
              {displayStudentName}
            </span>
            <div>
              {reportCardHref ? (
                <Link
                  href={reportCardHref}
                  className="text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-600"
                >
                  View Report Card
                </Link>
              ) : null}
              {reportCardExtrasHref ? (
                <Link
                  href={reportCardExtrasHref}
                  className="ml-3 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700"
                >
                  Edit Report Card
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </td>

      {/* CA1 */}
      <td>
        <ScoreInput
          studentName={displayStudentName}
          showMaxLabel={showRowLimits}
          field="ca1"
          value={ca1}
          max={rowPolicy.ca1Max}
          disabled={!isEditable}
          onChange={(v) => onScoreChange(student.studentId, "ca1", v)}
          validationError={studentErrors.ca1 ?? null}
        />
      </td>

      {/* CA2 */}
      <td>
        <ScoreInput
          studentName={displayStudentName}
          showMaxLabel={showRowLimits}
          field="ca2"
          value={ca2}
          max={rowPolicy.ca2Max}
          disabled={!isEditable}
          onChange={(v) => onScoreChange(student.studentId, "ca2", v)}
          validationError={studentErrors.ca2 ?? null}
        />
      </td>

      {/* CA3 */}
      <td>
        <ScoreInput
          studentName={displayStudentName}
          showMaxLabel={showRowLimits}
          field="ca3"
          value={ca3}
          max={rowPolicy.ca3Max}
          disabled={!isEditable}
          onChange={(v) => onScoreChange(student.studentId, "ca3", v)}
          validationError={studentErrors.ca3 ?? null}
        />
      </td>

      {/* Exam - exact mockup: bg-amber-50/20 border-amber-200 */}
      <td>
        <ScoreInput
          studentName={displayStudentName}
          showMaxLabel={showRowLimits}
          field="examRawScore"
          value={examRaw}
          max={examMax}
          disabled={!isEditable}
          onChange={(v) =>
            onScoreChange(student.studentId, "examRawScore", v)
          }
          isExamField
          validationError={studentErrors.examRawScore ?? null}
        />
      </td>

      {/* Computed columns */}
      <ComputedColumns
        ca1={ca1}
        ca2={ca2}
        ca3={ca3}
        examScaledScore={derived.examScaledScore}
        total={derived.total}
        gradeLetter={derived.gradeLetter}
        gradeColor={derived.gradeColor}
        remark={derived.remark}
        examInputMode={examInputMode}
        policy={rowPolicy}
        showScaledColumn={showScaledColumn}
        showMaxLabel={showRowLimits}
      />
    </tr>
  );
}
