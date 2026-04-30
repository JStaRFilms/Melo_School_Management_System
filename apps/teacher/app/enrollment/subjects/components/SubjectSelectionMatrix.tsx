"use client";

import { SubjectSelectionDesktopTable } from "./SubjectSelectionDesktopTable";
import { SubjectSelectionMobileEditor } from "./SubjectSelectionMobileEditor";
import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionMatrixProps {
  matrix: EnrollmentMatrix | undefined;
  studentsWithNoSubjects: number;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function SubjectSelectionMatrix({
  matrix,
  studentsWithNoSubjects,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionMatrixProps) {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-950/5 pb-2">
        <h3 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          Roster Matrix
        </h3>
        <p className="hidden px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:block">
          Live Update
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5">
        {!matrix ? (
          <div className="flex flex-col items-center justify-center p-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Loading Matrix...
            </p>
          </div>
        ) : matrix.subjects.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-500">
              No subjects are offered for this class yet.
            </p>
          </div>
        ) : matrix.students.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-500">
              No students are in this class yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Admin will need to add students to the roster first.
            </p>
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <SubjectSelectionMobileEditor
                matrix={matrix}
                totalSubjects={matrix.subjects.length}
                onToggle={onToggle}
                onSetStudentSubjects={onSetStudentSubjects}
              />
            </div>
            <div className="hidden md:block">
              <SubjectSelectionDesktopTable
                matrix={matrix}
                onToggle={onToggle}
                onSetStudentSubjects={onSetStudentSubjects}
              />
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400/80">
                {matrix.students.length} Students • {matrix.subjects.length} Subjects
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
