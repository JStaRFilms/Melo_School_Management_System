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
import { AdminRosterGridRow } from "./AdminRosterGridRow";
import {
  getEffectiveValue,
  computeDerivedValues,
  getInitials,
  getGradeColorClass,
} from "@/exam-helpers";
import { humanNameFinalStrict } from "@/human-name";

interface AdminRosterGridProps {
  roster: StudentRosterEntry[];
  examInputMode: ExamInputMode;
  gradingBands: GradingBandResponse[];
  draftScores: DraftScores;
  validationErrors: ValidationErrors;
  sheetLabel: string;
  sessionId: string;
  termId: string;
  classId: string;
  onScoreChange: (
    studentId: Id<"students">,
    field: ScoreField,
    value: number | null
  ) => void;
}

export function AdminRosterGrid({
  roster,
  examInputMode,
  gradingBands,
  draftScores,
  validationErrors,
  sheetLabel,
  sessionId,
  termId,
  classId,
  onScoreChange,
}: AdminRosterGridProps) {
  const showScaledColumn = examInputMode === "raw60_scaled_to_40";
  const examLabel = examInputMode === "raw40" ? "/40" : "/60";

  return (
    <section className="space-y-4">
      {/* Mobile: Jump to Student (hidden on desktop) */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            Jump to Student
          </span>
          <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest leading-none">
            {roster.filter((s) => s.assessmentRecord).length} / {roster.length}{" "}
            Complete
          </span>
        </div>
        <div className="relative group">
          <select className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 appearance-none font-bold text-xs text-slate-900 focus:border-blue-600 outline-none pr-10 shadow-sm transition-all active:scale-95">
            {roster.map((student) => (
              <option key={student.studentId} value={student.studentId}>
          {humanNameFinalStrict(student.studentName)}
              </option>
            ))}
          </select>
          <span className="absolute right-4 top-3 text-slate-400 pointer-events-none">
            &#8964;
          </span>
        </div>
      </div>

      {/* Desktop Intro (hidden on mobile) */}
      <div className="hidden md:block space-y-1">
        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
          <a href="#" className="hover:text-slate-900 transition-colors">
            Assessments
          </a>
          <span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-900 uppercase">Global Score Overwrite</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {sheetLabel}
        </h1>
      </div>

      {/* Desktop: Spreadsheet Table (hidden on mobile) */}
      <div className="hidden md:block roster-grid-wrapper custom-scrollbar">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky-column">Student</th>
              <th>
                CA1 <span className="font-light italic">/20</span>
              </th>
              <th>
                CA2 <span className="font-light italic">/20</span>
              </th>
              <th>
                CA3 <span className="font-light italic">/20</span>
              </th>
              <th className="bg-amber-50/50 text-amber-900">
                Exam{" "}
                <span className="text-blue-500 font-normal italic">
                  {examLabel}
                </span>
              </th>
              {showScaledColumn && (
                <th className="bg-indigo-50/50 text-indigo-700">
                  Scaled <span className="text-indigo-400 font-normal">/40</span>
                </th>
              )}
              <th className="text-center bg-slate-50/50">Total</th>
              <th className="text-center">Gr.</th>
              <th>Protocol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {roster.map((student) => (
              <AdminRosterGridRow
                key={student.studentId}
                student={student}
                examInputMode={examInputMode}
                gradingBands={gradingBands}
                draftScores={draftScores}
                validationErrors={validationErrors}
                sessionId={sessionId}
                termId={termId}
                classId={classId}
                onScoreChange={onScoreChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Swipeable Focus Cards (hidden on desktop) */}
      <div className="md:hidden mobile-focus-container space-y-6">
        {roster.map((student) => {
          const ca1 = getEffectiveValue(
            student.studentId,
            "ca1",
            draftScores,
            [student]
          );
          const ca2 = getEffectiveValue(
            student.studentId,
            "ca2",
            draftScores,
            [student]
          );
          const ca3 = getEffectiveValue(
            student.studentId,
            "ca3",
            draftScores,
            [student]
          );
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

          return (
            <div
              key={student.studentId}
              className={`active-student-card space-y-6 ${isIncomplete ? "opacity-60" : ""}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-bold text-xs text-white uppercase shadow-lg">
                    {getInitials(student.studentName)}
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-bold text-sm text-slate-900 leading-none">
                      {student.studentName}
                    </h3>
                    <Link
                      href={`/assessments/report-cards?studentId=${student.studentId}&sessionId=${sessionId}&termId=${termId}&classId=${classId}`}
                      className="mt-1 inline-flex text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600"
                    >
                      View Report Card
                    </Link>
                    <Link
                      href={`/assessments/report-card-extras?studentId=${student.studentId}&sessionId=${sessionId}&termId=${termId}&classId=${classId}`}
                      className="ml-3 mt-1 inline-flex text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700"
                    >
                      Report Extras
                    </Link>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {student.assessmentRecord
                        ? "Standard Entry"
                        : "Admin Override"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">
                    Current Avg
                  </div>
                  <div className="text-lg font-bold text-slate-900 tracking-tighter italic">
                    {derived.total !== null ? `${derived.total.toFixed(1)}%` : "--"}
                  </div>
                </div>
              </div>

              {/* Score Entry Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <label className="card-label">CA 1 Contribution</label>
                  <input
                    type="number"
                    value={ca1 ?? ""}
                    min={0}
                    max={20}
                    step={1}
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
                    className={`w-full h-12 bg-white border border-slate-200 rounded-lg text-center font-bold text-lg text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all ${studentErrors.ca1 ? "error-border" : ""}`}
                  />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <label className="card-label">CA 2 Contribution</label>
                  <input
                    type="number"
                    value={ca2 ?? ""}
                    min={0}
                    max={20}
                    step={1}
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
                    className={`w-full h-12 bg-white border border-slate-200 rounded-lg text-center font-bold text-lg text-slate-900 outline-none ${studentErrors.ca2 ? "error-border" : ""}`}
                  />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <label className="card-label">CA 3 Contribution</label>
                  <input
                    type="number"
                    value={ca3 ?? ""}
                    min={0}
                    max={20}
                    step={1}
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
                    className={`w-full h-12 bg-white border border-slate-200 rounded-lg text-center font-bold text-lg text-slate-900 outline-none ${studentErrors.ca3 ? "error-border" : ""}`}
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                  <label className="card-label text-blue-600 font-extrabold">
                    Final Exam {examLabel}
                  </label>
                  <input
                    type="number"
                    value={examRaw ?? ""}
                    min={0}
                    max={examInputMode === "raw40" ? 40 : 60}
                    step={1}
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
                    className={`w-full h-12 bg-white border-2 border-blue-200 rounded-lg text-center font-black text-lg text-blue-600 outline-none focus:border-blue-600 transition-all ${studentErrors.examRawScore ? "error-border" : ""}`}
                  />
                </div>
              </div>

              {/* Calculation Preview */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm uppercase ${
                      derived.gradeLetter === "A"
                        ? "bg-emerald-100 text-emerald-800"
                        : derived.gradeLetter === "B"
                          ? "bg-blue-100 text-blue-800"
                          : derived.gradeLetter === "C"
                            ? "bg-amber-100 text-amber-800"
                            : derived.gradeLetter === "D"
                              ? "bg-slate-100 text-slate-800"
                              : derived.gradeLetter === "F"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {derived.gradeLetter ?? "--"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                    {derived.remark ?? "--"}
                  </span>
                </div>
                <div className="text-[9px] font-medium text-slate-300 italic">
                  Audit: Admin Security active
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
