"use client";

import Link from "next/link";
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
  promotionStudentIds?: string[];
  isPromotionMode?: boolean;
  onSelectStudent?: (studentId: string) => void;
  onTogglePromotionStudent?: (studentId: string) => void;
  onCancelPromotion?: (studentId: string) => void;
  onCancelGraduation?: (studentId: string) => void;
  onViewAttestation?: (studentId: string) => void;
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
  promotionStudentIds = [],
  isPromotionMode = false,
  onSelectStudent,
  onTogglePromotionStudent,
  onCancelPromotion,
  onCancelGraduation,
  onViewAttestation,
  onOpenUnifiedEditor,
  onToggle,
  onSetStudentSubjects,
}: SubjectSelectionMatrixProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-0.5">
          <h2 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">
            Roster Matrix
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Manage subject enrollments for the active session.
          </p>
        </div>
      </div>

      {totalSubjects === 0 && matrix && matrix.students.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            No subjects are currently offered for this class. Add subject offerings in Classes to configure subject enrollments.
          </span>
          <Link
            href="/academic/classes"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0"
          >
            Configure Classes &rarr;
          </Link>
        </div>
      ) : isIssueVisible && totalSubjects > 0 ? (
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/50 shadow-sm">
        {!matrix ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading enrollment data...
          </div>
        ) : matrix.students.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {totalSubjects === 0
              ? "No students or subjects are in this class yet. Add a student above or configure subjects in Classes."
              : "No students are in this class yet. Add one above to begin."}
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <SubjectSelectionMobileEditor
                matrix={matrix}
                totalSubjects={totalSubjects}
                selectedStudentId={selectedStudentId}
                promotionStudentIds={promotionStudentIds}
                isPromotionMode={isPromotionMode}
                onSelectStudent={onSelectStudent}
                onTogglePromotionStudent={onTogglePromotionStudent}
                onCancelPromotion={onCancelPromotion}
                onCancelGraduation={onCancelGraduation}
                onViewAttestation={onViewAttestation}
                openUnifiedEditor={onOpenUnifiedEditor}
              />
            </div>
            <div className="hidden md:block">
              <SubjectSelectionDesktopTable
                matrix={matrix}
                selectedStudentId={selectedStudentId}
                promotionStudentIds={promotionStudentIds}
                isPromotionMode={isPromotionMode}
                onSelectStudent={onSelectStudent}
                onTogglePromotionStudent={onTogglePromotionStudent}
                onCancelPromotion={onCancelPromotion}
                onCancelGraduation={onCancelGraduation}
                onViewAttestation={onViewAttestation}
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
