"use client";

import { useState, useEffect } from "react";
import { Check, X, UserCog, BookOpen, Users } from "lucide-react";
import { humanNameFinalStrict } from "@/human-name";
import { StudentProfileEditor } from "./StudentProfileEditor";
import type { EnrollmentMatrix, ClassSummary, EnrollmentNotice } from "./types";

interface StudentUnifiedEditorSheetProps {
  activeStudent: EnrollmentMatrix["students"][number] | null;
  subjects: EnrollmentMatrix["subjects"];
  totalSubjects: number;
  isOpen: boolean;
  onClose: () => void;
  onToggle: (studentId: string, subjectId: string) => void;
  onSetStudentSubjects: (studentId: string, subjectIds: string[]) => void;
  // Profile Editor Props
  classes: ClassSummary[];
  onNotice: (notice: EnrollmentNotice) => void;
  onStudentArchived?: (studentId: string) => void;
  initialTab?: "subjects" | "profile" | "family";
}

export function StudentUnifiedEditorSheet({
  activeStudent,
  subjects,
  totalSubjects,
  isOpen,
  onClose,
  onToggle,
  onSetStudentSubjects,
  classes,
  onNotice,
  onStudentArchived,
  initialTab = "subjects",
}: StudentUnifiedEditorSheetProps) {
  const [activeTab, setActiveTab] = useState<"subjects" | "profile" | "family">(initialTab);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setActiveTab(initialTab);
      // Small delay to trigger the enter transitions
      const timer = setTimeout(() => setIsAnimating(true), 20);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      // Wait for exit transition duration before unmounting
      const timer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialTab]);

  if (!shouldRender || !activeStudent) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      {/* Backdrop with Fade */}
      <button
        type="button"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-md transition-all duration-500 ${
          isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Close editor"
      />
      
      {/* Bottom Sheet with Slide */}
      <section 
        className={`
          absolute inset-x-0 bottom-0 top-12 flex flex-col overflow-hidden rounded-t-[32px] border-t border-slate-200 bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.12)] 
          transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)
          ${isAnimating ? "translate-y-0" : "translate-y-full"}
        `}
      >
        <div className="flex shrink-0 flex-col border-b border-slate-100 bg-white px-4 pb-0 pt-3">
          {/* Grab Handle */}
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200/80" />
          
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-black tracking-tight text-slate-950">
                {humanNameFinalStrict(activeStudent.studentName)}
              </h3>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                ID: {activeStudent.admissionNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Unified Tabs */}
          <div className="flex p-1 bg-slate-100/50 rounded-xl mb-4 self-start">
            <button
              onClick={() => setActiveTab("subjects")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "subjects"
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                  : "text-slate-400 select-none active:text-slate-600"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Subjects
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "profile"
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                  : "text-slate-400 select-none active:text-slate-600"
              }`}
            >
              <UserCog className="h-3.5 w-3.5" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("family")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "family"
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                  : "text-slate-400 select-none active:text-slate-600"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Family
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/40 pb-safe">
          {activeTab === "subjects" ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                  Toggle subjects for the active session. Changes persist immediately.
                </p>
                <div className="shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-sm">
                  <span className="text-xs font-black">{activeStudent.selectedSubjectIds.length}</span>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-50">/{totalSubjects}</span>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    onSetStudentSubjects(
                      activeStudent._id,
                      subjects.map((s) => s._id)
                    )
                  }
                  className="flex-1 h-11 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white shadow-lg shadow-slate-950/10 active:scale-[0.98] transition-all"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => onSetStudentSubjects(activeStudent._id, [])}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 active:scale-[0.98] transition-all shadow-sm"
                >
                  Clear Selection
                </button>
              </div>

              <div className="grid gap-2.5 pt-2">
                {subjects.map((subject) => {
                  const isSelected = activeStudent.selectedSubjectIds.includes(subject._id);
                  return (
                    <button
                      key={subject._id}
                      type="button"
                      onClick={() => onToggle(activeStudent._id, subject._id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                        isSelected
                          ? "border-indigo-200 bg-indigo-50/50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 shadow-sm"
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 scale-100"
                          : "border-slate-100 bg-slate-50 text-slate-200 scale-95"
                      }`}>
                        <Check className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-950">{subject.name}</p>
                        <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                          {subject.code}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 px-5">
              <StudentProfileEditor
                studentId={activeStudent._id}
                classes={classes}
                onNotice={onNotice}
                onStudentArchived={onStudentArchived}
                variant="inline"
                activeTab={activeTab === "family" ? "family" : "profile"}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
