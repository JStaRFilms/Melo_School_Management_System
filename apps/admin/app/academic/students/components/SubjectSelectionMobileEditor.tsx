"use client";

import { useEffect, useState } from "react";
import { BookOpen, UserCog } from "lucide-react";
import { humanNameFinalStrict } from "@/human-name";
import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionMobileEditorProps {
  matrix: EnrollmentMatrix;
  totalSubjects: number;
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string) => void;
  openUnifiedEditor: (studentId: string, tab: "subjects" | "profile") => void;
}

export function SubjectSelectionMobileEditor({
  matrix,
  totalSubjects,
  selectedStudentId,
  onSelectStudent,
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

  return (
    <div className="space-y-4 p-2 sm:p-3">
      {matrix.students.map((student) => {
        const selectedCount = student.selectedSubjectIds.length;
        const isActive = editorStudentId === student._id;

        return (
          <article
            key={student._id}
            className={`rounded-2xl border p-4 shadow-xl transition-all duration-300 ring-1 ring-slate-950/5 ${
              isActive
                ? "border-indigo-100 bg-white scale-[1.01] shadow-indigo-950/5"
                : "border-slate-200 bg-white/60 backdrop-blur-sm shadow-none"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black uppercase tracking-[0.08em] text-slate-500 border border-slate-200">
                {studentInitials(humanNameFinalStrict(student.studentName))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black tracking-tight text-slate-950">
                    {humanNameFinalStrict(student.studentName)}
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                    ID: {student.admissionNumber}
                  </p>
                </div>
                
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openUnifiedEditor(student._id, "subjects")}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-lg shadow-slate-950/20 active:scale-[0.98] transition-all"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Subjects</span>
                    <span className="ml-1 opacity-40 font-black">({selectedCount}/{totalSubjects})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openUnifiedEditor(student._id, "profile")}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5 transition-all active:scale-[0.98] hover:border-indigo-200 hover:bg-slate-50"
                    aria-label="Edit Profile"
                  >
                    <UserCog className="h-4 w-4 text-slate-400" />
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
