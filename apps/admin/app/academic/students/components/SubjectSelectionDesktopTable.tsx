"use client";

import { humanNameFinalStrict } from "@/human-name";

import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionDesktopTableProps {
  matrix: EnrollmentMatrix;
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string) => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function SubjectSelectionDesktopTable({
  matrix,
  selectedStudentId,
  onSelectStudent,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionDesktopTableProps) {
  const allSubjectIds = matrix.subjects.map((subject) => subject._id);

  return (
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
              className={`transition-colors hover:bg-slate-50 ${
                selectedStudentId === student._id ? "bg-indigo-50/60" : ""
              }`}
            >
              <td className="sticky left-0 z-20 border-r-2 border-r-slate-100 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400">
                    {studentInitials(humanNameFinalStrict(student.studentName))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <button
                        type="button"
                        onClick={() => onSelectStudent?.(student._id)}
                        className="truncate text-left"
                      >
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {humanNameFinalStrict(student.studentName)}
                        </p>
                      </button>
                      <p className="truncate text-[10px] font-bold uppercase tracking-tight text-slate-400">
                        {student.admissionNumber}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          onSetStudentSubjects(student._id, allSubjectIds)
                        }
                        disabled={
                          student.selectedSubjectIds.length ===
                          matrix.subjects.length
                        }
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        aria-label={`Select all subjects for ${student.studentName}`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetStudentSubjects(student._id, [])}
                        disabled={student.selectedSubjectIds.length === 0}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300"
                        aria-label={`Clear all subjects for ${student.studentName}`}
                      >
                        Clear
                      </button>
                    </div>
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
  );
}

function studentInitials(name: string) {
  const parts = humanNameFinalStrict(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "ST";
  }

  return parts
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");
}
