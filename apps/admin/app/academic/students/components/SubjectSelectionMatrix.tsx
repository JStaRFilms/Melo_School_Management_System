"use client";

import { SubjectSelectionDesktopTable } from "./SubjectSelectionDesktopTable";
import { SubjectSelectionMobileEditor } from "./SubjectSelectionMobileEditor";
import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionMatrixProps {
  matrix: EnrollmentMatrix | undefined;
  totalStudents: number;
  totalSubjects: number;
  isIssueVisible: boolean;
  studentsWithNoSubjects: number;
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string) => void;
  onOpenUnifiedEditor: (studentId: string, tab: "subjects" | "profile") => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function SubjectSelectionMatrix({
  matrix,
  totalStudents,
  totalSubjects,
  isIssueVisible,
  studentsWithNoSubjects,
  selectedStudentId,
  onSelectStudent,
  onOpenUnifiedEditor,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionMatrixProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            Subject Selection
          </h2>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            On phones, edit one student at a time with larger tap targets. On
            bigger screens, the full class matrix stays available.
          </p>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300 md:hidden">
          Tap a student to edit subjects
        </p>
      </div>

      {isIssueVisible ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">
            {studentsWithNoSubjects}{" "}
            {studentsWithNoSubjects === 1
              ? "student still needs"
              : "students still need"}{" "}
            at least one subject.
          </span>{" "}
          Review the incomplete students below.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {!matrix ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading enrollment data...
          </div>
        ) : matrix.subjects.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No subjects are offered for this class yet. Add subject offerings in
            Classes first.
          </div>
        ) : matrix.students.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No students are in this class yet. Add one above to begin.
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <SubjectSelectionMobileEditor
                matrix={matrix}
                totalSubjects={totalSubjects}
                selectedStudentId={selectedStudentId}
                onSelectStudent={onSelectStudent}
                openUnifiedEditor={onOpenUnifiedEditor}
              />
            </div>
            <div className="hidden md:block">
              <SubjectSelectionDesktopTable
                matrix={matrix}
                selectedStudentId={selectedStudentId}
                onSelectStudent={onSelectStudent}
                onToggle={onToggle}
                onSetStudentSubjects={onSetStudentSubjects}
              />
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 p-4 font-medium">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Showing {totalStudents} students • {totalSubjects} subjects
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
