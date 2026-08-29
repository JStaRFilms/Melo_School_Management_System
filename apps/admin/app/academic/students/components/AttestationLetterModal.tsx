"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  Calendar,
  CheckCircle2,
  FileCheck,
  GraduationCap,
  Printer,
  School,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import type { AttestationData } from "./types";

interface AttestationLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AttestationData | null;
  isLoading?: boolean;
}

export function AttestationLetterModal({
  isOpen,
  onClose,
  data,
  isLoading = false,
}: AttestationLetterModalProps) {
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

  const handlePrint = () => {
    window.print();
  };

  const student = data?.student;
  const graduation = data?.graduation;
  const school = data?.school;

  const formattedIssueDate = data
    ? new Date(data.issuedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const formattedGraduationDate = graduation
    ? new Date(graduation.graduationDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Academic Session Completion";

  const formattedDOB = student?.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Action Bar (Hidden on print) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider font-display">
                Official Letter of Attestation
              </h3>
              <p className="text-[10px] text-slate-400">
                Print or export verified institutional certificate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !data}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Letter</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 md:p-12 print:p-0 print:overflow-visible bg-white text-slate-900 custom-scrollbar">
          {isLoading || !data ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Generating Attestation Record...
              </p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-8 print:max-w-none print:space-y-6">
              {/* ── SCHOOL LETTERHEAD ── */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 pb-6 border-b-2 border-slate-900 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {school?.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={school.logoUrl}
                      alt={school.name}
                      className="h-16 w-16 rounded-xl object-contain border border-slate-200 p-1"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-xl">
                      {school?.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 font-display uppercase">
                      {school?.name}
                    </h1>
                    {school?.motto && (
                      <p className="text-xs font-medium italic text-slate-600 mt-0.5">
                        &ldquo;{school.motto}&rdquo;
                      </p>
                    )}
                    <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                      {school?.address && <p>{school.address}</p>}
                      <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
                        {school?.contactEmail && <span>Email: {school.contactEmail}</span>}
                        {school?.contactPhone && <span>Tel: {school.contactPhone}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center sm:text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block font-mono">
                    Ref Code
                  </span>
                  <strong className="text-xs font-mono font-bold text-slate-900 block mt-0.5">
                    {data.referenceCode}
                  </strong>
                  <span className="text-[11px] font-semibold text-slate-500 block mt-1">
                    Date: {formattedIssueDate}
                  </span>
                </div>
              </div>

              {/* ── DOCUMENT TITLE ── */}
              <div className="text-center space-y-1 pt-2">
                <h2 className="text-base sm:text-lg font-black uppercase tracking-[0.2em] text-slate-950 underline decoration-2 underline-offset-8">
                  Letter of Attestation
                </h2>
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-800 pt-2">
                  Academic Tenure & Character Certification
                </p>
              </div>

              {/* ── ATTESTATION BODY ── */}
              <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-800 text-justify">
                <p>
                  This is to certify that <strong>{student?.fullName.toUpperCase()}</strong>, bearing Admission Number <strong className="font-mono">{student?.admissionNumber}</strong>{formattedDOB ? `, born on ${formattedDOB}` : ""}, was a registered student at <strong>{school?.name}</strong>.
                </p>

                <p>
                  During their academic residency, the student completed the prescribed curriculum and was enrolled in <strong>{graduation?.graduatingClassName || student?.className}</strong> during the <strong>{graduation?.graduatingSessionName || "academic"}</strong> academic session.
                </p>

                <p>
                  Official records confirm their graduation date as <strong>{formattedGraduationDate}</strong>
                  {graduation?.certificateNumber ? ` under Certificate Reference ${graduation.certificateNumber}` : ""}
                  {graduation?.honorsOrRemarks ? ` with distinctions/honors: "${graduation.honorsOrRemarks}"` : ""}.
                </p>

                <p>
                  Throughout their period of study at this institution, they demonstrated high academic responsibility, moral integrity, and exemplary character.
                </p>

                <p>
                  This attestation is issued upon verified request without prejudice, for whatever lawful academic, professional, or institutional purpose it may serve.
                </p>
              </div>

              {/* ── STUDENT DETAILS TABLE ── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student Name</span>
                  <strong className="font-bold text-slate-900 block truncate">{student?.fullName}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Admission No.</span>
                  <strong className="font-mono font-bold text-slate-900 block">{student?.admissionNumber}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Graduating Class</span>
                  <strong className="font-bold text-slate-900 block">{graduation?.graduatingClassName || student?.className}</strong>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status</span>
                  <strong className="font-bold text-emerald-800 uppercase block">Graduated / Alumnus</strong>
                </div>
              </div>

              {/* ── SEAL & SIGNATURE SECTION ── */}
              <div className="flex items-end justify-between pt-10 sm:pt-12">
                {/* Official Seal Mock */}
                <div className="flex flex-col items-center justify-center h-24 w-24 rounded-full border-2 border-dashed border-slate-300 text-slate-400 p-2 text-center select-none">
                  <ShieldCheck className="h-6 w-6 text-slate-300" />
                  <span className="text-[8px] font-bold uppercase tracking-widest mt-1">Official School Seal</span>
                </div>

                {/* Signature Block */}
                <div className="text-right space-y-1">
                  <div className="w-48 border-b border-slate-900 ml-auto pb-1">
                    <span className="font-serif italic text-base text-slate-700 block pr-2">
                      {school?.principalName || "School Authority"}
                    </span>
                  </div>
                  <strong className="text-xs font-bold text-slate-900 block uppercase">
                    {school?.principalName || "The Principal / Head of School"}
                  </strong>
                  <span className="text-[10px] font-medium text-slate-500 block">
                    {school?.name}
                  </span>
                </div>
              </div>

              {/* ── FOOTER SECURITY WATERMARK ── */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-widest font-mono">
                <span>Verified Institutional Attestation</span>
                <span>Ref: {data.referenceCode}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
