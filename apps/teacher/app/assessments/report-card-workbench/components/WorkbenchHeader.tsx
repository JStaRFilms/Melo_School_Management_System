"use client";

import type { SelectorOption, StudentOption } from "./types";

export function WorkbenchHeader({
  sessionName,
  termName,
  classOptions,
  studentOptions,
  selectedClassId,
  selectedStudentId,
  isLoadingClasses,
  isLoadingStudents,
  onClassChange,
  onStudentChange,
  onNextStudent,
  printHref,
}: {
  sessionName: string;
  termName: string;
  classOptions: SelectorOption[];
  studentOptions: StudentOption[];
  selectedClassId: string | null;
  selectedStudentId: string | null;
  isLoadingClasses: boolean;
  isLoadingStudents: boolean;
  onClassChange: (classId: string | null) => void;
  onStudentChange: (studentId: string | null) => void;
  onNextStudent: () => void;
  printHref?: string;
}) {
  const currentIndex = studentOptions.findIndex(
    (s) => s.id === selectedStudentId
  );
  const studentPosition =
    selectedStudentId && currentIndex >= 0
      ? `${currentIndex + 1} of ${studentOptions.length}`
      : null;

  return (
    <header className="flex flex-col gap-4 mb-2">
      {/* ---- Title / Actions row ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Report Card Workbench
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {sessionName}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {termName}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {printHref ? (
            <a
              href={printHref}
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200"
            >
              Print view
            </a>
          ) : null}

          <button
            type="button"
            onClick={onNextStudent}
            disabled={studentOptions.length < 2}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            {studentPosition ? (
              <span className="bg-slate-800 border border-slate-700 text-[10px] px-1.5 py-0.5 rounded text-slate-200 font-bold tracking-wide">
                {studentPosition}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* ---- Selector row with floating labels to save space ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
        <label className="relative block rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all">
          <span className="absolute top-2 left-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Class
          </span>
          <select
            value={selectedClassId ?? ""}
            onChange={(e) => onClassChange(e.target.value || null)}
            disabled={isLoadingClasses}
            className="w-full bg-transparent px-4 pt-6 pb-2 text-sm font-semibold text-slate-900 outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {isLoadingClasses ? "Loading..." : "Select class"}
            </option>
            {classOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>

        <label className="relative block rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-slate-900 focus-within:border-slate-900 transition-all">
          <span className="absolute top-2 left-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Student
          </span>
          <select
            value={selectedStudentId ?? ""}
            onChange={(e) => onStudentChange(e.target.value || null)}
            disabled={!selectedClassId || isLoadingStudents}
            className="w-full bg-transparent px-4 pt-6 pb-2 text-sm font-semibold text-slate-900 outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">
              {!selectedClassId
                ? "Pick a class"
                : isLoadingStudents
                  ? "Loading..."
                  : "Select student"}
            </option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.admissionNumber})
              </option>
            ))}
          </select>
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>
      </div>
    </header>
  );
}
