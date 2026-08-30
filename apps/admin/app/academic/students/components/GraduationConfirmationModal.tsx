"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";

interface GraduationConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isGraduating: boolean;
  studentCount: number;
  className?: string;
  sessionName?: string;
  sourceClassName?: string;
  sourceSessionName?: string;
  graduationDate: number;
  certificateNumber?: string;
  honorsOrRemarks?: string;
  alreadyGraduatedStudents?: Array<{ studentName: string }>;
}

export function GraduationConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isGraduating,
  studentCount,
  className,
  sessionName,
  sourceClassName,
  sourceSessionName,
  graduationDate,
  certificateNumber,
  honorsOrRemarks,
  alreadyGraduatedStudents = [],
}: GraduationConfirmationModalProps) {
  const displayClassName = sourceClassName || className || "Current Class";
  const displaySessionName = sourceSessionName || sessionName || "Current Session";
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

  const formattedGradDate = new Date(graduationDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={isGraduating ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-slate-950">
                Confirm Cohort Graduation
              </h3>
              <p className="text-xs text-slate-500">
                Transition {studentCount} student{studentCount === 1 ? "" : "s"} to Graduated / Alumni status.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGraduating}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Cohort Summary Card */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Graduating Cohort Details
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Class & Stream</span>
              <strong className="font-bold text-slate-900">{displayClassName}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Academic Session</span>
              <strong className="font-bold text-slate-900">{displaySessionName}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduation Date</span>
              <strong className="font-bold text-emerald-900 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formattedGradDate}
              </strong>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduating Size</span>
              <strong className="font-bold text-slate-900">{studentCount} Students</strong>
            </div>
          </div>

          {(certificateNumber || honorsOrRemarks) && (
            <div className="pt-2 border-t border-emerald-200/60 text-xs space-y-1">
              {certificateNumber && (
                <div className="flex items-center gap-1.5 text-emerald-950">
                  <Award className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-mono font-semibold">Ref: {certificateNumber}</span>
                </div>
              )}
              {honorsOrRemarks && (
                <div className="text-[11px] text-emerald-800 font-medium italic">
                  &ldquo;{honorsOrRemarks}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Life-Cycle Guarantees */}
        <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs text-slate-600">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Institutional Life-Cycle Rules
          </div>
          <div className="flex items-start gap-2 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <span>
              <strong>Graduating Session Retention:</strong> Students remain in the {sessionName} roster with all exam records and report cards intact, displaying an emerald 🎓 Graduated badge.
            </span>
          </div>
          <div className="flex items-start gap-2 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <span>
              <strong>Subsequent Session Exclusion:</strong> Automatically excluded from future active classroom rosters (they do not occupy seats in the new year).
            </span>
          </div>
          <div className="flex items-start gap-2 text-[11px]">
            <FileText className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
            <span>
              <strong>Official Attestation:</strong> Unlocks high-fidelity printable Letter of Attestation and Alumni Transcript.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isGraduating}
            className="w-full sm:w-auto h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isGraduating || studentCount === 0}
            className="w-full sm:w-auto h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isGraduating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Graduating Cohort...</span>
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" />
                <span>Graduate {studentCount} Student{studentCount === 1 ? "" : "s"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
