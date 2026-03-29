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
  gradingBands,
  draftScores,
  validationErrors,
  sessionId = "",
  termId = "",
  classId = "",
  isEditable = true,
  onScoreChange,
}: RosterGridProps) {
  const showScaledColumn = examInputMode === "raw60_scaled_to_40";
  const examLabel = examInputMode === "raw40" ? "Exam /40" : "Exam /60";
  const examColHeader =
    examInputMode === "raw40"
      ? 'Exam <span class="text-amber-500 font-normal">/40</span>'
      : 'Exam <span class="text-amber-500 font-normal">/60</span>';

  return (
    <div className="space-y-6">
      {/* Header row - exact match from desktop mockup */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-obsidian-950">
            Score Entry
          </h2>
          <p className="text-obsidian-500 font-medium font-body italic text-sm">
            {examInputMode === "raw40"
              ? "Direct entry into final exam contribution. No scaling column."
              : "Input out of 60; system displays read-only /40 contribution for total calculation."}
          </p>
        </div>
        <ExamModeIndicator examInputMode={examInputMode} />
      </div>

      {/* ============ MOBILE: Card layout (exact match from mobile mockup) ============ */}
      <div className="md:hidden space-y-4">
        {roster.map((student) => {
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
            gradingBands
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
                        Report Extras
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Score inputs - exact 4-column grid from mobile mockup */}
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-black editorial-spacing text-center block text-obsidian-400">
                    CA1 /20
                  </label>
                  <input
                    type="number"
                    value={ca1 ?? ""}
                    min={0}
                    max={20}
                    step={1}
                    disabled={!isEditable}
                    onChange={(e) => {
                      const v =
                        e.target.value === ""
                          ? null
                          : parseInt(e.target.value, 10);
                      onScoreChange(
                        student.studentId,
                        "ca1",
                        isNaN(v as number) ? null : v
                      );
                    }}
                    placeholder="--"
                    className={`score-input-mobile ${studentErrors.ca1 ? "error" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black editorial-spacing text-center block text-obsidian-400">
                    CA2 /20
                  </label>
                  <input
                    type="number"
                    value={ca2 ?? ""}
                    min={0}
                    max={20}
                    step={1}
                    disabled={!isEditable}
                    onChange={(e) => {
                      const v =
                        e.target.value === ""
                          ? null
                          : parseInt(e.target.value, 10);
                      onScoreChange(
                        student.studentId,
                        "ca2",
                        isNaN(v as number) ? null : v
                      );
                    }}
                    placeholder="--"
                    className={`score-input-mobile ${studentErrors.ca2 ? "error" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black editorial-spacing text-center block text-obsidian-400">
                    CA3 /20
                  </label>
                  <input
                    type="number"
                    value={ca3 ?? ""}
                    min={0}
                    max={20}
                    step={1}
                    disabled={!isEditable}
                    onChange={(e) => {
                      const v =
                        e.target.value === ""
                          ? null
                          : parseInt(e.target.value, 10);
                      onScoreChange(
                        student.studentId,
                        "ca3",
                        isNaN(v as number) ? null : v
                      );
                    }}
                    placeholder="--"
                    className={`score-input-mobile ${studentErrors.ca3 ? "error" : ""}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black editorial-spacing text-center block text-amber-700">
                    {examLabel}
                  </label>
                  <input
                    type="number"
                    value={examRaw ?? ""}
                    min={0}
                    max={examInputMode === "raw40" ? 40 : 60}
                    step={1}
                    disabled={!isEditable}
                    onChange={(e) => {
                      const v =
                        e.target.value === ""
                          ? null
                          : parseInt(e.target.value, 10);
                      onScoreChange(
                        student.studentId,
                        "examRawScore",
                        isNaN(v as number) ? null : v
                      );
                    }}
                    placeholder="--"
                    className={`score-input-mobile bg-amber-50/20 border-amber-200 ${studentErrors.examRawScore ? "error" : ""}`}
                  />
                </div>
              </div>

              {/* Read-only calculation bar - exact match from mobile mockup */}
              <div className="bg-obsidian-50 rounded-lg py-2 px-3 space-y-1.5">
                {showScaledColumn && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-3 h-3 text-obsidian-400" />
                      <span className="text-xs font-bold text-obsidian-500 uppercase tracking-tighter">
                        Scaled Score (/40)
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
                    className={`text-sm font-black ${
                      derived.gradeLetter === "A"
                        ? "text-emerald-600"
                        : derived.gradeLetter === "B"
                          ? "text-blue-600"
                          : derived.gradeLetter === "C"
                            ? "text-amber-600"
                            : derived.gradeLetter === "D"
                              ? "text-orange-600"
                              : derived.gradeLetter === "F"
                                ? "text-red-600"
                                : "text-obsidian-300"
                    } italic`}
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
                CA1 <span className="text-obsidian-300 font-normal">/20</span>
              </th>
              <th>
                CA2 <span className="text-obsidian-300 font-normal">/20</span>
              </th>
              <th>
                CA3 <span className="text-obsidian-300 font-normal">/20</span>
              </th>
              <th
                className="bg-amber-50/50 text-amber-900"
                dangerouslySetInnerHTML={{ __html: examColHeader }}
              />
              {showScaledColumn && (
                <th className="bg-indigo-50/50 text-indigo-700">
                  Scaled{" "}
                  <span className="text-indigo-400 font-normal">/40</span>
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
