import Image from "next/image";
import Link from "next/link";
import { GraduationCap, X } from "lucide-react";

import { humanNameFinalStrict } from "@/human-name";

import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionDesktopTableProps {
  matrix: EnrollmentMatrix;
  selectedStudentId?: string | null;
  promotionStudentIds?: string[];
  isPromotionMode?: boolean;
  onSelectStudent?: (studentId: string) => void;
  onTogglePromotionStudent?: (studentId: string) => void;
  onCancelPromotion?: (studentId: string) => void;
  onCancelGraduation?: (studentId: string) => void;
  onViewAttestation?: (studentId: string) => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function SubjectSelectionDesktopTable({
  matrix,
  selectedStudentId,
  promotionStudentIds = [],
  isPromotionMode = false,
  onSelectStudent,
  onTogglePromotionStudent,
  onCancelPromotion,
  onCancelGraduation,
  onViewAttestation,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionDesktopTableProps) {
  const allSubjectIds = matrix.subjects.map((subject) => subject._id);
  const promotionStudentIdSet = new Set(promotionStudentIds);

  return (
    <div className="relative overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-30 min-w-[340px] w-[340px] border-b border-r-2 border-b-slate-200 border-r-slate-100 bg-slate-50 px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.15em] text-slate-950">
              Student Identity & Enrollment
            </th>
            {matrix.subjects.length === 0 ? (
              <th className="border-b border-b-slate-200 bg-slate-50 p-3 text-left text-[9px] font-extrabold uppercase tracking-[0.05em] text-slate-500">
                Subject Enrollment Status
              </th>
            ) : (
              matrix.subjects.map((subject) => (
                <th
                  key={subject._id}
                  className="min-w-[64px] border-b border-b-slate-200 bg-slate-50 p-3 text-center text-[9px] font-extrabold uppercase tracking-[0.05em] text-slate-600"
                >
                  <div className="truncate" title={subject.name}>
                    {subject.code}
                  </div>
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {matrix.students.map((student) => {
            const isSelectedForPromotion = promotionStudentIdSet.has(student._id);

            return (
              <tr
                key={student._id}
                className={`transition-colors hover:bg-slate-50/80 ${
                  selectedStudentId === student._id ? "bg-indigo-50/60" : ""
                } ${isSelectedForPromotion ? "bg-indigo-50/30 ring-1 ring-inset ring-indigo-200" : ""}`}
              >
                <td className="sticky left-0 z-20 min-w-[340px] w-[340px] border-r-2 border-r-slate-100 bg-white p-3.5">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelectedForPromotion}
                        onChange={() => onTogglePromotionStudent?.(student._id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        aria-label={`Select ${student.studentName} for promotion`}
                      />
                    </div>

                    {/* Avatar */}
                    {student.photoUrl ? (
                      <Image
                        src={student.photoUrl}
                        alt={student.studentName}
                        width={36}
                        height={36}
                        unoptimized
                        className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-500">
                        {studentInitials(humanNameFinalStrict(student.studentName))}
                      </div>
                    )}

                    {/* Identity & Actions Container */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Top Row: Name + All/Clear quick pills */}
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectStudent?.(student._id)}
                          className="min-w-0 flex-1 truncate text-left group cursor-pointer"
                        >
                          <p className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {humanNameFinalStrict(student.studentName)}
                          </p>
                          <p className="truncate text-[10px] font-semibold text-slate-400">
                            {student.admissionNumber}
                          </p>
                        </button>

                        {/* Compact inline All / Clear subject pills */}
                        {matrix.subjects.length > 0 ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onSetStudentSubjects(student._id, allSubjectIds)
                              }
                              disabled={
                                student.selectedSubjectIds.length ===
                                matrix.subjects.length
                              }
                              className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600 transition hover:border-slate-300 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title={`Select all subjects for ${student.studentName}`}
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => onSetStudentSubjects(student._id, [])}
                              disabled={student.selectedSubjectIds.length === 0}
                              className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 transition hover:border-slate-300 hover:bg-white hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title={`Clear subjects for ${student.studentName}`}
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {/* Bottom Row: Promotion Badge or Status */}
                      {student.graduationStatus?.isGraduated ? (
                        <div className="flex items-center pt-0.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-950 max-w-full shadow-2xs">
                            <GraduationCap className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            <span className="truncate">
                              🎓 Graduated (Alumnus)
                            </span>
                            {onViewAttestation && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewAttestation(student._id);
                                }}
                                className="ml-1 text-[9px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                                title="View Official Letter of Attestation"
                              >
                                Attestation
                              </button>
                            )}
                            {onCancelGraduation && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCancelGraduation(student._id);
                                }}
                                className="ml-1 rounded p-0.5 text-emerald-700 hover:bg-emerald-200/80 hover:text-rose-700 transition cursor-pointer shrink-0"
                                title="Cancel graduation"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        </div>
                      ) : student.promotionStatus?.isPromoted ? (
                        <div className="flex items-center pt-0.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 text-[10px] font-medium text-emerald-900 max-w-full">
                            <GraduationCap className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">
                              Promoted &rarr;{" "}
                              <strong className="font-bold text-emerald-950">
                                {student.promotionStatus.targetClassName}
                              </strong>
                              {student.promotionStatus.targetSessionName && (
                                <span className="ml-1 text-emerald-700/80 font-normal">
                                  (
                                  {student.promotionStatus.targetSessionName
                                    .replace(/ Academic Session/i, "")
                                    .replace(/ Session/i, "")}
                                  )
                                </span>
                              )}
                            </span>
                            {onCancelPromotion && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCancelPromotion(student._id);
                                }}
                                className="ml-1 rounded p-0.5 text-emerald-700 hover:bg-emerald-200/60 hover:text-rose-700 transition cursor-pointer shrink-0"
                                title="Cancel staged promotion"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        </div>
                      ) : isPromotionMode ? (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                            Unpromoted
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </td>
                {matrix.subjects.length === 0 ? (
                  <td className="border-b border-b-slate-100 p-3.5 text-xs text-slate-400 bg-white">
                    <div className="flex items-center gap-2">
                      <span>No subjects offered for this class yet.</span>
                      <Link
                        href="/academic/classes"
                        className="inline-flex items-center font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Assign subjects in Classes &rarr;
                      </Link>
                    </div>
                  </td>
                ) : (
                  matrix.subjects.map((subject) => {
                    const isSelected = student.selectedSubjectIds.includes(subject._id);

                    return (
                      <td
                        key={`${student._id}-${subject._id}`}
                        className="border-b border-b-slate-100 p-3 text-center"
                      >
                        <button
                          type="button"
                          onClick={() => onToggle(student._id, subject._id)}
                          className={`relative inline-flex h-5 w-5 rounded border-[2px] transition-all cursor-pointer ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 shadow-xs"
                              : "border-slate-200 hover:border-slate-400 bg-white"
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
                  })
                )}
              </tr>
            );
          })}
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
