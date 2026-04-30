"use client";

import { humanNameFinalStrict } from "@/lib/human-name";

import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionDesktopTableProps {
  matrix: EnrollmentMatrix;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function SubjectSelectionDesktopTable({
  matrix,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionDesktopTableProps) {
  const allSubjectIds = matrix.subjects.map((subject) => subject._id);

  return (
    <div className="relative overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: "thin" }}>
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-30 min-w-[240px] border-b border-r border-slate-200 border-r-slate-100 bg-slate-50/80 backdrop-blur-sm p-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Student Identity
            </th>
            {matrix.subjects.map((subject) => (
              <th
                key={subject._id}
                className="min-w-[70px] border-b border-slate-200 bg-slate-50/80 backdrop-blur-sm p-3 text-center text-[9px] font-black uppercase tracking-[0.1em] text-slate-400"
                title={subject.name}
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
              className="group transition-colors hover:bg-slate-50/50"
            >
              <td className="sticky left-0 z-20 border-r border-r-slate-100 bg-white p-4 transition-colors group-hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-bold text-slate-400 ring-1 ring-slate-950/5">
                    {studentInitials(humanNameFinalStrict(student.studentName))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold tracking-tight text-slate-950">
                      {humanNameFinalStrict(student.studentName)}
                    </p>
                    <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-70">
                      {student.admissionNumber}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onSetStudentSubjects(student._id, allSubjectIds)
                        }
                        disabled={
                          student.selectedSubjectIds.length ===
                          matrix.subjects.length
                        }
                        className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-indigo-600 transition-all hover:bg-indigo-600 hover:text-white disabled:opacity-0"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetStudentSubjects(student._id, [])}
                        disabled={student.selectedSubjectIds.length === 0}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-0"
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
                    className="border-b border-slate-50 p-3 text-center"
                  >
                    <button
                      type="button"
                      onClick={() => onToggle(student._id, subject._id)}
                      className={`relative inline-flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all active:scale-90 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 shadow-[0_0_12px_rgba(79,70,229,0.3)]"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                      aria-label={`${isSelected ? "Remove" : "Add"} ${subject.name} for ${student.studentName}`}
                    >
                      {isSelected ? (
                        <svg
                          width="12"
                          height="9"
                          viewBox="0 0 12 9"
                          fill="none"
                          className="animate-in zoom-in-50 duration-200"
                        >
                          <path
                            d="M1 4.5L4.5 8L11 1.5"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <div className="h-1 w-1 rounded-full bg-slate-200 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
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
