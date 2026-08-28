import Image from "next/image";
import { BookOpen, GraduationCap, UserCog, X } from "lucide-react";
import { useEffect, useState } from "react";

import { humanNameFinalStrict } from "@/human-name";

import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionMobileEditorProps {
  matrix: EnrollmentMatrix;
  totalSubjects: number;
  selectedStudentId?: string | null;
  promotionStudentIds?: string[];
  isPromotionMode?: boolean;
  onSelectStudent?: (studentId: string) => void;
  onTogglePromotionStudent?: (studentId: string) => void;
  onCancelPromotion?: (studentId: string) => void;
  openUnifiedEditor: (studentId: string, tab: "subjects" | "profile") => void;
}

export function SubjectSelectionMobileEditor({
  matrix,
  totalSubjects,
  selectedStudentId,
  promotionStudentIds = [],
  isPromotionMode = false,
  onTogglePromotionStudent,
  onCancelPromotion,
  openUnifiedEditor,
}: SubjectSelectionMobileEditorProps) {
  const [editorStudentId, setEditorStudentId] = useState<string | null>(
    selectedStudentId ?? matrix.students[0]?._id ?? null
  );

  useEffect(() => {
    if (!matrix.students.length) {
      setEditorStudentId(null);
      return;
    }

    setEditorStudentId((current) => {
      if (selectedStudentId && matrix.students.some((student) => student._id === selectedStudentId)) {
        return selectedStudentId;
      }
      return current && matrix.students.some((student) => student._id === current)
        ? current
        : matrix.students[0]?._id ?? null;
    });
  }, [matrix, selectedStudentId]);

  const promotionStudentIdSet = new Set(promotionStudentIds);

  return (
    <div className="space-y-4 p-2 sm:p-3">
      {matrix.students.map((student) => {
        const selectedCount = student.selectedSubjectIds.length;
        const isActive = editorStudentId === student._id;
        const isSelectedForPromotion = promotionStudentIdSet.has(student._id);

        return (
          <article
            key={student._id}
            className={`rounded-2xl border p-4 shadow-xl transition-all duration-300 ring-1 ${
              isActive
                ? "border-indigo-100 bg-white scale-[1.01] shadow-indigo-950/5 ring-slate-950/5"
                : "border-slate-200 bg-white/60 backdrop-blur-sm shadow-none ring-slate-950/5"
            } ${isSelectedForPromotion ? "ring-2 ring-indigo-300" : ""}`}
          >
            <div className="flex items-start gap-4">
              {student.photoUrl ? (
                <Image
                  src={student.photoUrl}
                  alt={student.studentName}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black uppercase tracking-[0.08em] text-slate-500 border border-slate-200">
                  {studentInitials(humanNameFinalStrict(student.studentName))}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-black tracking-tight text-slate-950">
                      {humanNameFinalStrict(student.studentName)}
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      ID: {student.admissionNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openUnifiedEditor(student._id, "profile")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5 transition-all active:scale-[0.98] hover:border-indigo-200 hover:bg-slate-50"
                    aria-label="Edit Profile"
                  >
                    <UserCog className="h-4 w-4 text-slate-400" />
                  </button>
                </div>

                {/* Promotion Status Badge */}
                {student.promotionStatus?.isPromoted ? (
                  <div className="mt-2 flex items-center">
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
                  <div className="mt-2">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                      Unpromoted
                    </span>
                  </div>
                ) : null}
                
                <div className="mt-5 grid grid-cols-[auto_1fr] gap-2">
                  <button
                    type="button"
                    onClick={() => onTogglePromotionStudent?.(student._id)}
                    className={`h-11 rounded-xl border px-3 text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] ${
                      isSelectedForPromotion
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                    aria-pressed={isSelectedForPromotion}
                  >
                    {isSelectedForPromotion ? "Selected" : "Select"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openUnifiedEditor(student._id, "subjects")}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-lg shadow-slate-950/20 transition-all active:scale-[0.98]"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Subjects</span>
                    <span className="ml-1 opacity-40 font-black">({selectedCount}/{totalSubjects})</span>
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function studentInitials(name: string) {
  const parts = humanNameFinalStrict(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  return parts
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");
}
