"use client";

import Link from "next/link";
import { ScoreNumberInput } from "@school/shared/drafts";
import type { ExamInputMode } from "@school/shared";
import { scoreRowPolicy, scoreRosterHasScaledColumn, type SessionScoringPolicy } from "@school/shared/exam-recording";
import { buildReportCardExtrasHref, buildReportCardHref } from "@school/shared";
import type {
  StudentRosterEntry,
  ScoreField,
  DraftScores,
  ValidationErrors,
  Id,
  GradingBandResponse,
} from "@/lib/types";
import { RosterGridRow } from "./RosterGridRow";
import { ExamModeIndicator } from "./ExamModeIndicator";
import { Calculator } from "lucide-react";
import {
  getEffectiveValue,
  computeDerivedValues,
} from "@/lib/exam-helpers";

interface RosterGridProps {
  roster: StudentRosterEntry[];
  examInputMode: ExamInputMode;
  policy?: SessionScoringPolicy;
  gradingBands: GradingBandResponse[];
  draftScores: DraftScores;
  validationErrors: ValidationErrors;
  sessionId?: string;
  termId?: string;
  classId?: string;
  isEditable?: boolean;
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

export function RosterGrid({
  roster,
  examInputMode,
  policy,
  gradingBands,
  draftScores,
  validationErrors,
  sessionId = "",
  termId = "",
  classId = "",
  isEditable = true,
  onScoreChange,
}: RosterGridProps) {
  const showScaledColumn = scoreRosterHasScaledColumn(examInputMode, policy, roster);
  const sheetWeights = scoreRowPolicy(examInputMode, policy);
  const mixedLegacy = roster.some(row => {
    const weights = scoreRowPolicy(examInputMode, policy, row.assessmentRecord);
    return weights.examRawMax !== sheetWeights.examRawMax || weights.ca1Max !== sheetWeights.ca1Max ||
      weights.ca2Max !== sheetWeights.ca2Max || weights.ca3Max !== sheetWeights.ca3Max ||
      weights.examContributionMax !== sheetWeights.examContributionMax;
  });
  const examLabel = mixedLegacy ? "Exam /row limit" : `Exam /${policy?.examRawMax ?? (examInputMode === "raw40" ? 40 : 60)}`;

  return (
    <div className="space-y-6">
      {/* Header row - exact match from desktop mockup */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-obsidian-950">
            Score Entry
          </h2>
          <p className="text-obsidian-500 font-medium font-body italic text-sm">
            {mixedLegacy ? "Legacy rows have different maxima. Check the limit shown on each row." : policy ? `Exam raw /${policy.examRawMax} contributes /${policy.examContributionMax} to the total.` : examInputMode === "raw40"
              ? "Direct entry into final exam contribution. No scaling column."
              : "Input out of 60; system displays read-only /40 contribution for total calculation."}
          </p>
        </div>
        {!policy && !mixedLegacy && <ExamModeIndicator examInputMode={examInputMode} />}
      </div>

      {/* ============ MOBILE: Card layout (exact match from mobile mockup) ============ */}
      <div className="md:hidden space-y-4">
        {roster.map((student) => {
          const rowPolicy = scoreRowPolicy(examInputMode, policy, student.assessmentRecord);
          const rowExamMax = rowPolicy.examRawMax;
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
          const derived = computeDerivedValues(
            ca1,
            ca2,
            ca3,
            examRaw,
            examInputMode,
            gradingBands,
            rowPolicy
          );
          const studentErrors =
            validationErrors.get(student.studentId) ?? {};
          const isIncomplete =
            ca1 === null && ca2 === null && ca3 === null && examRaw === null;
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

          return (
            <div
              key={student.studentId}
              className={`student-card p-4 space-y-4 ${isIncomplete ? "opacity-60" : ""}`}
            >
              {/* Student header - exact match from mobile mockup */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-obsidian-50 flex items-center justify-center font-black text-[10px] text-obsidian-500">
                    {getInitials(student.studentName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-obsidian-900 leading-none">
                      {student.studentName}
                    </h3>
                    {reportCardHref ? (
                      <Link
                        href={reportCardHref}
                        className="mt-1 inline-flex text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600"
                      >
                        View Report Card
                      </Link>
                    ) : null}
                    {reportCardExtrasHref ? (
                      <Link
                        href={reportCardExtrasHref}
                        className="ml-3 mt-1 inline-flex text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700"
                      >
                        Edit Report Card
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Score inputs - exact 4-column grid from mobile mockup */}
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label htmlFor={`mobile-${student.studentId}-ca1`} className="text-[8px] font-black editorial-spacing text-center block text-obsidian-400">
                    CA1 /{rowPolicy.ca1Max}
                  </label>
                  <ScoreNumberInput
                    id={`mobile-${student.studentId}-ca1`}
                    value={ca1}
                    min={0}
                    max={rowPolicy.ca1Max}
                    step="0.01"
                    disabled={!isEditable}
                    onScoreChange={(next) => onScoreChange(student.studentId, "ca1", next)}
                    placeholder="--"
                    className={`score-input-mobile ${studentErrors.ca1 ? "error" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`mobile-${student.studentId}-ca2`} className="text-[8px] font-black editorial-spacing text-center block text-obsidian-400">
                    CA2 /{rowPolicy.ca2Max}
                  </label>
                  <ScoreNumberInput
                    id={`mobile-${student.studentId}-ca2`}
                    value={ca2}
                    min={0}
                    max={rowPolicy.ca2Max}
                    step="0.01"
                    disabled={!isEditable}
                    onScoreChange={(next) => onScoreChange(student.studentId, "ca2", next)}
                    placeholder="--"
                    className={`score-input-mobile ${studentErrors.ca2 ? "error" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`mobile-${student.studentId}-ca3`} className="text-[8px] font-black editorial-spacing text-center block text-obsidian-400">
                    CA3 /{rowPolicy.ca3Max}
                  </label>
                  <ScoreNumberInput
                    id={`mobile-${student.studentId}-ca3`}
                    value={ca3}
                    min={0}
                    max={rowPolicy.ca3Max}
                    step="0.01"
                    disabled={!isEditable}
                    onScoreChange={(next) => onScoreChange(student.studentId, "ca3", next)}
                    placeholder="--"
                    className={`score-input-mobile ${studentErrors.ca3 ? "error" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`mobile-${student.studentId}-exam`} className="text-[8px] font-black editorial-spacing text-center block text-amber-700">
                    {mixedLegacy ? `Exam /${rowExamMax}` : examLabel}
                  </label>
                  <ScoreNumberInput
                    id={`mobile-${student.studentId}-exam`}
                    value={examRaw}
                    min={0}
                    max={rowExamMax}
                    step="0.01"
                    disabled={!isEditable}
                    onScoreChange={(next) => onScoreChange(student.studentId, "examRawScore", next)}
                    placeholder="--"
                    className={`score-input-mobile bg-amber-50/20 border-amber-200 ${studentErrors.examRawScore ? "error" : ""}`}
                  />
                </div>
              </div>

              {/* Read-only calculation bar - exact match from mobile mockup */}
              <div className="bg-obsidian-50 rounded-lg py-2 px-3 space-y-1.5">
                {rowPolicy.examRawMax !== rowPolicy.examContributionMax && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-3 h-3 text-obsidian-400" />
                      <span className="text-xs font-bold text-obsidian-500 uppercase tracking-tighter">
                        Scaled Score (/{rowPolicy.examContributionMax})
                      </span>
                    </div>
                    <span className="text-sm font-black text-indigo-600">
                      {derived.examScaledScore !== null
                        ? derived.examScaledScore.toFixed(2)
                        : "--"}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-obsidian-400 editorial-spacing">
                    Total /100
                  </span>
                  <span className="text-sm font-black text-obsidian-950">
                    {derived.total !== null ? derived.total.toFixed(2) : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-obsidian-400 editorial-spacing">
                    Grade
                  </span>
                  <span
                    className="text-sm font-black" style={{color: derived.gradeColor}}
                  >
                    {derived.gradeLetter ?? "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-obsidian-400 editorial-spacing">
                    Remark
                  </span>
                  <span className="text-[9px] font-bold text-obsidian-400 editorial-spacing">
                    {derived.remark ?? "--"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ DESKTOP: Table layout (exact match from desktop mockup) ============ */}
      <div className="hidden md:block roster-grid-wrapper custom-scrollbar">
        <table className="w-full border-separate border-spacing-0 roster-table">
          <thead>
            <tr>
              <th className="sticky-column">Student Profile</th>
              <th>
                CA1 <span className="text-obsidian-300 font-normal">{mixedLegacy ? "/row limit" : `/${policy?.ca1Max ?? 20}`}</span>
              </th>
              <th>
                CA2 <span className="text-obsidian-300 font-normal">{mixedLegacy ? "/row limit" : `/${policy?.ca2Max ?? 20}`}</span>
              </th>
              <th>
                CA3 <span className="text-obsidian-300 font-normal">{mixedLegacy ? "/row limit" : `/${policy?.ca3Max ?? 20}`}</span>
              </th>
              <th
                className="bg-amber-50/50 text-amber-900"
              >Exam <span className="font-normal">{mixedLegacy ? "/row limit" : `/${policy?.examRawMax ?? (examInputMode === "raw40" ? 40 : 60)}`}</span>
              </th>
              {showScaledColumn && (
                <th className="bg-indigo-50/50 text-indigo-700">
                  Scaled{" "}
                  <span className="text-indigo-400 font-normal">{mixedLegacy ? "/row limit" : `/${policy?.examContributionMax ?? 40}`}</span>
                </th>
              )}
              <th>
                Total{" "}
                <span className="text-indigo-600 font-normal">/100</span>
              </th>
              <th>Grade</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian-100">
            {roster.map((student) => (
              <RosterGridRow
                key={student.studentId}
                student={student}
                examInputMode={examInputMode}
                gradingBands={gradingBands}
                policy={policy}
                showScaledColumn={showScaledColumn}
                showRowLimits={mixedLegacy}
                draftScores={draftScores}
                validationErrors={validationErrors}
                sessionId={sessionId}
                termId={termId}
                classId={classId}
                isEditable={isEditable}
                onScoreChange={onScoreChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
