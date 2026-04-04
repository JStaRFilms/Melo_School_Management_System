"use client";

import React from "react";
import { Printer } from "lucide-react";

export type ReportCardBatchStudent = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
};

export function ReportCardBatchNavigator({
  students,
  activeStudentId,
  className,
  sessionName,
  termName,
  isLoading,
  isPrintingFullClass,
  onSelectStudent,
  onPrintFullClass,
  extrasHref,
}: {
  students: ReportCardBatchStudent[];
  activeStudentId: string;
  className: string;
  sessionName: string;
  termName: string;
  isLoading?: boolean;
  isPrintingFullClass?: boolean;
  onSelectStudent: (studentId: string) => void;
  onPrintFullClass?: () => void;
  extrasHref?: string;
}) {
  const activeIndex = students.findIndex(
    (student) => student.studentId === activeStudentId
  );
  const previousStudent =
    activeIndex > 0 ? students[activeIndex - 1] : null;
  const nextStudent =
    activeIndex >= 0 && activeIndex < students.length - 1
      ? students[activeIndex + 1]
      : null;

  return (
    <div className="rc-no-print select-none">
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Batch Control</span>
            <span className="text-[10px] font-bold text-slate-400 opacity-60">
              {isLoading ? "Loading..." : `${students.length} Total`}
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-950">
            {className}
          </h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {sessionName} · {termName}
          </p>
        </div>

        <div className="space-y-3">
          <div className="relative group">
            <select
              value={activeStudentId}
              onChange={(event) => onSelectStudent(event.target.value)}
              disabled={isLoading || students.length === 0}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 pr-10 text-[13px] font-bold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:opacity-60 appearance-none"
            >
              {students.length === 0 ? (
                <option value={activeStudentId}>No students available</option>
              ) : null}
              {students.map((student, index) => (
                <option key={student.studentId} value={student.studentId}>
                  {index + 1}. {student.studentName}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 group-hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => previousStudent && onSelectStudent(previousStudent.studentId)}
              disabled={!previousStudent}
              className="h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-[0.98]"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => nextStudent && onSelectStudent(nextStudent.studentId)}
              disabled={!nextStudent}
              className="h-10 flex items-center justify-center rounded-xl bg-slate-950 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-md active:scale-[0.98]"
            >
              Next
            </button>
          </div>

          {onPrintFullClass && (
            <button
              type="button"
              onClick={onPrintFullClass}
              disabled={isLoading || students.length === 0 || isPrintingFullClass}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed shadow-md active:scale-[0.98]"
            >
              {isPrintingFullClass ? (
                 <span className="animate-pulse">Preparing Run...</span>
              ) : (
                <>
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Class</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
