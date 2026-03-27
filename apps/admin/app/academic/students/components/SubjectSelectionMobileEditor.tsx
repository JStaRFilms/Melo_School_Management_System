"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { humanNameFinalStrict } from "@/human-name";

import { StudentSubjectEditorSheet } from "./StudentSubjectEditorSheet";
import type { EnrollmentMatrix } from "./types";

interface SubjectSelectionMobileEditorProps {
  matrix: EnrollmentMatrix;
  totalSubjects: number;
  selectedStudentId?: string | null;
  onSelectStudent?: (studentId: string) => void;
  onOpenProfile?: (studentId: string) => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function SubjectSelectionMobileEditor({
  matrix,
  totalSubjects,
  selectedStudentId,
  onSelectStudent,
  onOpenProfile,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionMobileEditorProps) {
  const [editorStudentId, setEditorStudentId] = useState<string | null>(
    selectedStudentId ?? matrix.students[0]?._id ?? null
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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

  const activeStudent = useMemo(
    () =>
      matrix.students.find((student) => student._id === editorStudentId) ?? null,
    [editorStudentId, matrix.students]
  );

  const openEditor = (studentId: string) => {
    setEditorStudentId(studentId);
    onSelectStudent?.(studentId);
    setIsEditorOpen(true);
  };

  return (
    <>
      <div className="space-y-3 p-3">
        {matrix.students.map((student) => {
          const selectedCount = student.selectedSubjectIds.length;
          const isActive = editorStudentId === student._id;

          return (
            <article
              key={student._id}
              className={`rounded-3xl border p-4 shadow-sm transition ${
                isActive
                  ? "border-indigo-200 bg-indigo-50/70 shadow-indigo-950/5"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
                  {studentInitials(humanNameFinalStrict(student.studentName))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-950">
                        {humanNameFinalStrict(student.studentName)}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {student.admissionNumber}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      {selectedCount}/{totalSubjects}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {selectedCount === 0
                      ? "No subjects selected yet."
                      : `${selectedCount} subject${selectedCount === 1 ? "" : "s"} selected.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => openEditor(student._id)}
                    className="mt-4 inline-flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <span>Edit Subjects</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditorStudentId(student._id);
                      onSelectStudent?.(student._id);
                      onOpenProfile?.(student._id);
                    }}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <StudentSubjectEditorSheet
        activeStudent={activeStudent}
        subjects={matrix.subjects}
        totalSubjects={totalSubjects}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onOpenProfile={(studentId) => {
          setIsEditorOpen(false);
          onOpenProfile?.(studentId);
        }}
        onToggle={onToggle}
        onSetStudentSubjects={onSetStudentSubjects}
      />
    </>
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
