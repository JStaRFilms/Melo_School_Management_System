"use client";

import {
computeDerivedValues,
getEffectiveValue,
getInitials,
} from "@/exam-helpers";
import { humanNameFinalStrict } from "@/human-name";
import type {
DraftScores,
GradingBandResponse,
Id,
ScoreField,
StudentRosterEntry,
ValidationErrors,
} from "@/types";
import type { ExamInputMode } from "@school/shared";
import { buildReportCardExtrasHref,buildReportCardHref } from "@school/shared";
import Link from "next/link";
import { useEffect,useState } from "react";
import { AdminRosterGridRow } from "./AdminRosterGridRow";

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
  isEditable?: boolean;
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

  sessionId,
  termId,
  classId,
  isEditable = true,
  onScoreChange,
}: AdminRosterGridProps) {
  const showScaledColumn = examInputMode === "raw60_scaled_to_40";
  const examLabel = examInputMode === "raw40" ? "/40" : "/60";
  const [selectedStudentId, setSelectedStudentId] = useState(roster[0]?.studentId ?? "");

  useEffect(() => {
    if (roster.length === 0) {
      setSelectedStudentId("");
      return;
    }

    setSelectedStudentId((current) =>
      roster.some((student) => student.studentId === current)
        ? current
        : roster[0].studentId
    );
  }, [roster]);

  return (
    <section className="space-y-4">
      {/* Mobile: Jump to Student (hidden on desktop) */}
      <div className="md:hidden space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] leading-none mb-1">
              Active Protocol
            </span>
            <span className="text-[11px] font-bold text-slate-900 uppercase">
              {roster.filter((s) => s.assessmentRecord).length} / {roster.length} Synced
            </span>
          </div>
          <div className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">
            Roster
          </div>
        </div>
        <div className="relative group px-1">
          <select
            value={selectedStudentId}
            onChange={(event) => {
              const nextStudentId = event.target.value;
              setSelectedStudentId(nextStudentId);
              document.getElementById(`student-${nextStudentId}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 appearance-none font-bold text-xs text-slate-900 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 outline-none shadow-sm transition-all active:scale-[0.98]"
          >
            {roster.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {humanNameFinalStrict(student.studentName)}
              </option>
            ))}
          </select>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Desktop: Spreadsheet Table (hidden on mobile) */}
      <div className="hidden md:block roster-grid-wrapper custom-scrollbar border border-slate-100 rounded-lg overflow-hidden">
        <table className="w-full border-separate border-spacing-0">
          <thead className="bg-slate-50/80 backdrop-blur-sm">
            <tr>
              <th className="sticky-column !bg-slate-50/80 border-b border-slate-200 pl-6">
                 <span className="text-[10px] font-black tracking-[0.2em] text-slate-400">ENROLLED ROSTER</span>
              </th>
              <th className="border-b border-slate-200">
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black text-slate-900 leading-none mb-1">CA 01</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">CONTRIB /20</span>
                </div>
              </th>
              <th className="border-b border-slate-200">
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black text-slate-900 leading-none mb-1">CA 02</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">CONTRIB /20</span>
                </div>
              </th>
              <th className="border-b border-slate-200">
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black text-slate-900 leading-none mb-1">CA 03</span>
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">CONTRIB /20</span>
                </div>
              </th>
              <th className="bg-amber-50/50 text-amber-900 border-b border-amber-100 border-x border-amber-100/50">
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black leading-none mb-1">EXAM</span>
                   <span className="text-[8px] font-bold text-amber-600/70 uppercase tracking-tighter whitespace-nowrap">RECORDED {examLabel}</span>
                </div>
              </th>
              {showScaledColumn && (
                <th className="bg-indigo-50/50 text-indigo-700 border-b border-indigo-100">
                  <div className="flex flex-col items-center">
                     <span className="text-[10px] font-black leading-none mb-1">SCALED</span>
                     <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-tighter whitespace-nowrap">SYSTEM /40</span>
                  </div>
                </th>
              )}
              <th className="text-center bg-slate-950 text-white border-none py-3">
                 <span className="text-[10px] font-black tracking-[0.1em]">TOTAL</span>
              </th>
              <th className="text-center border-b border-slate-200">
                 <span className="text-[10px] font-black text-slate-900">GR.</span>
              </th>
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
                isEditable={isEditable}
                onScoreChange={onScoreChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Swipeable Focus Cards (hidden on desktop) */}
      <div className="md:hidden mobile-focus-container space-y-4 pb-20">
        {roster.map((student) => {
          const ca1 = getEffectiveValue(student.studentId, "ca1", draftScores, [student]);
          const ca2 = getEffectiveValue(student.studentId, "ca2", draftScores, [student]);
          const ca3 = getEffectiveValue(student.studentId, "ca3", draftScores, [student]);
          const examRaw = getEffectiveValue(student.studentId, "examRawScore", draftScores, [student]);
          const derived = computeDerivedValues(ca1,ca2,ca3,examRaw,examInputMode,gradingBands);
          const studentErrors = validationErrors.get(student.studentId) ?? {};
          const isIncomplete = ca1 === null && ca2 === null && ca3 === null && examRaw === null;
          const reportCardHref = buildReportCardHref({ studentId: student.studentId, sessionId, termId, classId });
          const reportCardExtrasHref = buildReportCardExtrasHref({ studentId: student.studentId, sessionId, termId, classId });
          const mobileFields: Array<{
            field: ScoreField;
            label: string;
            value: number | null;
            max: number;
            isExam?: boolean;
          }> = [
            { field: "ca1", label: "01", value: ca1, max: 20 },
            { field: "ca2", label: "02", value: ca2, max: 20 },
            { field: "ca3", label: "03", value: ca3, max: 20 },
            {
              field: "examRawScore",
              label: "EX",
              value: examRaw,
              max: examInputMode === "raw40" ? 40 : 60,
              isExam: true,
            },
          ];

          return (
            <div
              key={student.studentId}
              id={`student-${student.studentId}`}
              className={`p-3 rounded-xl border transition-all ${
                isIncomplete ? "border-slate-100 bg-slate-50/20 grayscale" : "border-slate-200 bg-white"
              }`}
            >
              {/* Header: Name & Identity */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-[10px] text-white">
                    {getInitials(student.studentName)}
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 leading-none mb-1">
                      {humanNameFinalStrict(student.studentName)}
                    </h3>
                    <div className="flex gap-3">
                       {reportCardHref && (
                        <Link href={reportCardHref} className="text-[8px] font-bold uppercase tracking-widest text-indigo-500 underline underline-offset-2">
                          Report
                        </Link>
                      )}
                      {reportCardExtrasHref && (
                        <Link href={reportCardExtrasHref} className="text-[8px] font-bold uppercase tracking-widest text-emerald-600 underline underline-offset-2">
                          Extras
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-right">
                     <div className="text-[14px] font-black text-slate-950 italic leading-none">
                       {derived.total !== null ? `${derived.total.toFixed(0)}%` : "--"}
                     </div>
                   </div>
                   <div className={`w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black ${derived.gradeLetter === 'F' ? 'text-red-500' : 'text-slate-950'}`}>
                     {derived.gradeLetter ?? "-"}
                   </div>
                </div>
              </div>

              {/* Input Row: Horizontal Tactical Zone */}
              <div className="grid grid-cols-4 gap-1.5">
                {mobileFields.map((input) => {
                  const inputError = studentErrors[input.field];
                  return (
                    <div
                      key={input.field}
                      className={`relative p-2 rounded-lg border flex flex-col items-center ${
                        input.isExam ? "bg-indigo-50/30 border-indigo-100" : "bg-slate-50 border-slate-100"
                      } ${inputError ? "border-rose-200 bg-rose-50/50" : ""}`}
                    >
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        {input.label}
                      </span>
                      <input
                        type="number"
                        value={input.value ?? ""}
                        disabled={!isEditable}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = raw === "" ? null : Number(raw);
                          onScoreChange(
                            student.studentId,
                            input.field,
                            parsed === null || Number.isNaN(parsed) ? null : parsed
                          );
                        }}
                        placeholder="--"
                        aria-invalid={Boolean(inputError)}
                        className={`w-full bg-transparent text-center font-black text-sm text-slate-900 outline-none tabular-nums p-0 ${
                          inputError ? "text-rose-700" : ""
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
