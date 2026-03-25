"use client";

import { humanNameFinalStrict } from "@/human-name";

import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionMatrixProps {
  matrix: EnrollmentMatrix | undefined;
  totalStudents: number;
  totalSubjects: number;
  isIssueVisible: boolean;
  studentsWithNoSubjects: number;
  onToggle: (studentId: string, subjectId: string) => void;
}

export function SubjectSelectionMatrix({
  matrix,
  totalStudents,
  totalSubjects,
  isIssueVisible,
  studentsWithNoSubjects,
  onToggle,
}: SubjectSelectionMatrixProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            Subject Selection Grid
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tick subjects for each student. Changes save instantly; there is no
            separate commit step.
          </p>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300 md:hidden">
          Swipe right to view subjects
        </p>
      </div>

      {isIssueVisible ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-semibold">
            {studentsWithNoSubjects} {studentsWithNoSubjects === 1 ? "student still needs" : "students still need"} at least one subject.
          </span>{" "}
          Review the empty rows in the grid below.
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
            <div className="relative overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-30 min-w-[220px] border-b border-r-2 border-b-slate-200 border-r-slate-100 bg-slate-50 p-4 text-left text-[9px] font-black uppercase tracking-[0.15em] text-slate-950">
                      Student Identity
                    </th>
                    {matrix.subjects.map((subject) => (
                      <th
                        key={subject._id}
                        className="min-w-[60px] border-b border-b-slate-200 bg-slate-50 p-3 text-center text-[8px] font-extrabold uppercase tracking-[0.05em] text-slate-500"
                      >
                        {subject.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrix.students.map((student) => (
                    <tr
                      key={student._id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="sticky left-0 z-20 border-r-2 border-r-slate-100 bg-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400">
                            {studentInitials(humanNameFinalStrict(student.studentName))}
                          </div>
                          <div className="truncate">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {humanNameFinalStrict(student.studentName)}
                            </p>
                            <p className="truncate text-[10px] font-bold uppercase tracking-tight text-slate-400">
                              {student.admissionNumber}
                            </p>
                          </div>
                        </div>
                      </td>
                      {matrix.subjects.map((subject) => {
                        const isSelected = student.selectedSubjectIds.includes(subject._id);

                        return (
                          <td
                            key={`${student._id}-${subject._id}`}
                            className="border-b border-b-slate-50 p-3 text-center"
                          >
                            <button
                              type="button"
                              onClick={() => onToggle(student._id, subject._id)}
                              className={`relative inline-flex h-5 w-5 rounded border-[2.5px] transition-all ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-600"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                              aria-label={`${isSelected ? "Remove" : "Add"} ${subject.name} for ${student.studentName}`}
                            >
                              {isSelected ? (
                                <svg
                                  className="absolute inset-0 m-auto"
                                  width="10"
                                  height="5"
                                  viewBox="0 0 10 5"
                                  fill="none"
                                >
                                  <path
                                    d="M1 1L4 4L9 1"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 p-4">
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

function studentInitials(name: string) {
  const parts = humanNameFinalStrict(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "ST";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
