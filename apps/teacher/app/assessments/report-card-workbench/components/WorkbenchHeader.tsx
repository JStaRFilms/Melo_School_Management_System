"use client";

import type { SelectorOption, StudentOption } from "./types";
import { WorkbenchSelectorField } from "./WorkbenchSelectorField";

interface WorkbenchHeaderProps {
  sessionName: string;
  termName: string;
  sessionOptions: SelectorOption[];
  termOptions: SelectorOption[];
  classOptions: SelectorOption[];
  studentOptions: StudentOption[];
  selectedSessionId: string | null;
  selectedTermId: string | null;
  selectedClassId: string | null;
  selectedStudentId: string | null;
  isLoadingSessions: boolean;
  isLoadingTerms: boolean;
  isLoadingClasses: boolean;
  isLoadingStudents: boolean;
  onSessionChange: (sessionId: string | null) => void;
  onTermChange: (termId: string | null) => void;
  onClassChange: (classId: string | null) => void;
  onStudentChange: (studentId: string | null) => void;
  onNextStudent: () => void;
  printHref?: string;
}

export function WorkbenchHeader({
  sessionName,
  termName,
  sessionOptions,
  termOptions,
  classOptions,
  studentOptions,
  selectedSessionId,
  selectedTermId,
  selectedClassId,
  selectedStudentId,
  isLoadingSessions,
  isLoadingTerms,
  isLoadingClasses,
  isLoadingStudents,
  onSessionChange,
  onTermChange,
  onClassChange,
  onStudentChange,
  onNextStudent,
  printHref,
}: WorkbenchHeaderProps) {
  const currentIndex = studentOptions.findIndex(
    (student) => student.id === selectedStudentId
  );
  const studentPosition =
    selectedStudentId && currentIndex >= 0
      ? `${currentIndex + 1} of ${studentOptions.length}`
      : null;

  return (
    <header className="mb-2 flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">
            Report Card Workbench
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContextBadge label={sessionName} />
            <ContextBadge label={termName} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {printHref ? (
            <a
              href={printHref}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50"
            >
              Print view
            </a>
          ) : null}

          <button
            type="button"
            onClick={onNextStudent}
            disabled={studentOptions.length < 2}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            {studentPosition ? (
              <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-200">
                {studentPosition}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WorkbenchSelectorField
          label="Session"
          value={selectedSessionId}
          options={sessionOptions}
          placeholder={isLoadingSessions ? "Loading..." : "Select session"}
          disabled={isLoadingSessions}
          onChange={onSessionChange}
        />
        <WorkbenchSelectorField
          label="Term"
          value={selectedTermId}
          options={termOptions}
          placeholder={
            !selectedSessionId
              ? "Pick a session"
              : isLoadingTerms
                ? "Loading..."
                : "Select term"
          }
          disabled={!selectedSessionId || isLoadingTerms}
          onChange={onTermChange}
        />
        <WorkbenchSelectorField
          label="Class"
          value={selectedClassId}
          options={classOptions}
          placeholder={isLoadingClasses ? "Loading..." : "Select class"}
          disabled={!selectedTermId || isLoadingClasses}
          onChange={onClassChange}
        />
        <WorkbenchSelectorField
          label="Student"
          value={selectedStudentId}
          options={studentOptions.map((student) => ({
            id: student.id,
            name: `${student.name} (${student.admissionNumber})`,
          }))}
          placeholder={
            !selectedClassId
              ? "Pick a class"
              : isLoadingStudents
                ? "Loading..."
                : "Select student"
          }
          disabled={!selectedClassId || isLoadingStudents}
          onChange={onStudentChange}
        />
      </div>
    </header>
  );
}

function ContextBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
      {label}
    </span>
  );
}
