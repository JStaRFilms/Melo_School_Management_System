"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { PromotionSubjectMode } from "./types";

interface PromotionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPromoting: boolean;
  studentCount: number;
  sourceClassName: string;
  sourceSessionName: string;
  targetClassName: string;
  targetSessionName: string;
  subjectMode: PromotionSubjectMode;
  alreadyPromotedStudents?: Array<{ studentName: string }>;
}

export function PromotionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isPromoting,
  studentCount,
  sourceClassName,
  sourceSessionName,
  targetClassName,
  targetSessionName,
  subjectMode,
  alreadyPromotedStudents = [],
}: PromotionConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const getSubjectModeDescription = () => {
    switch (subjectMode) {
      case "all_target_class_subjects":
        return "Enrolls students in all active subjects offered by the target class.";
      case "matching_previous_subjects":
        return "Enrolls students only in subjects matching their previous enrollment.";
      case "none":
        return "Promotes students without enrolling in subjects (configure later).";
      default:
        return "";
    }
  };

  const hasOverwriteWarning = alreadyPromotedStudents.length > 0;
  const previewNames = alreadyPromotedStudents
    .slice(0, 3)
    .map((s) => s.studentName)
    .join(", ");
  const extraCount =
    alreadyPromotedStudents.length > 3
      ? alreadyPromotedStudents.length - 3
      : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={isPromoting ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Confirm Cohort Promotion
              </h3>
              <p className="text-xs text-slate-500">
                Promote {studentCount} student{studentCount === 1 ? "" : "s"} to the next academic session.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPromoting}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Transfer Route Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 space-y-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Class & Session Placement
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Source */}
            <div className="space-y-0.5">
              <div className="text-[11px] font-medium text-slate-500">From</div>
              <div className="font-display text-sm font-bold text-slate-900">
                {sourceClassName}
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                {sourceSessionName}
              </div>
            </div>

            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shrink-0">
              <ArrowRight className="h-4 w-4 text-emerald-600" />
            </div>

            {/* Target */}
            <div className="space-y-0.5 sm:text-right">
              <div className="text-[11px] font-medium text-emerald-700">To</div>
              <div className="font-display text-sm font-bold text-emerald-950">
                {targetClassName}
              </div>
              <div className="text-[11px] font-semibold text-emerald-700">
                {targetSessionName}
              </div>
            </div>
          </div>
        </div>

        {/* Subject Enrollment Mode */}
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
          <BookOpen className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800">Subject Enrollment: </span>
            <span className="text-slate-600">{getSubjectModeDescription()}</span>
          </div>
        </div>

        {/* Warning if re-promoting already staged students */}
        {hasOverwriteWarning && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-bold">
                {alreadyPromotedStudents.length} student{alreadyPromotedStudents.length === 1 ? "" : "s"} already staged
              </p>
              <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                {previewNames}
                {extraCount > 0 ? ` and ${extraCount} other${extraCount === 1 ? "" : "s"}` : ""}{" "}
                already have a staged promotion. Continuing will update their target class to{" "}
                <span className="font-bold">{targetClassName}</span>.
              </p>
            </div>
          </div>
        )}

        {/* Reassurance Banner */}
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 pl-1">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Past report cards, scores, and prior invoices remain preserved.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isPromoting}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPromoting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 text-center"
          >
            {isPromoting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Promoting...</span>
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" />
                <span>
                  Promote {studentCount} Student{studentCount === 1 ? "" : "s"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
