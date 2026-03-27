"use client";

import { Check, X } from "lucide-react";

import { humanNameFinalStrict } from "@/human-name";

import type { EnrollmentMatrix } from "./types";

interface StudentSubjectEditorSheetProps {
  activeStudent: EnrollmentMatrix["students"][number] | null;
  subjects: EnrollmentMatrix["subjects"];
  totalSubjects: number;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
}

export function StudentSubjectEditorSheet({
  activeStudent,
  subjects,
  totalSubjects,
  isOpen,
  onClose,
  onToggle,
  onSetStudentSubjects,
}: StudentSubjectEditorSheetProps) {
  if (!isOpen || !activeStudent) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45"
        aria-label="Close subject editor"
      />
      <section className="absolute inset-x-0 bottom-0 top-[10vh] overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 bg-white px-4 pb-4 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Subject Editor
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold text-slate-950">
                  {humanNameFinalStrict(activeStudent.studentName)}
                </h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  {activeStudent.admissionNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500"
                aria-label="Close subject editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Tap a subject to add or remove it. Changes save instantly.
              </p>
              <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">
                {activeStudent.selectedSubjectIds.length}/{totalSubjects}
              </span>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onSetStudentSubjects(
                    activeStudent._id,
                    subjects.map((subject) => subject._id)
                  )
                }
                disabled={
                  activeStudent.selectedSubjectIds.length === subjects.length
                }
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onSetStudentSubjects(activeStudent._id, [])}
                disabled={activeStudent.selectedSubjectIds.length === 0}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/70 p-4">
            {subjects.map((subject) => {
              const isSelected = activeStudent.selectedSubjectIds.includes(
                subject._id
              );

              return (
                <button
                  key={subject._id}
                  type="button"
                  onClick={() => onToggle(activeStudent._id, subject._id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-indigo-200 bg-indigo-50 text-indigo-950"
                      : "border-slate-200 bg-white text-slate-900"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-300"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{subject.name}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {subject.code}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
