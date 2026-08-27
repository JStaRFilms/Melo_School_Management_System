"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { TermCard, type TermRecord } from "./TermCard";
import { TermCreationModal } from "./TermCreationModal";
import { ConfirmationModal } from "./ConfirmationModal";
import type { SessionRecord } from "@/types";

interface SessionTimelineCardProps {
  session: SessionRecord;
  onMakeActive: (id: string) => void;
  onArchive: (id: string) => void;
  defaultExpanded?: boolean;
}

function formatDateRange(start: number, end: number) {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  const endStr = e.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function SessionTimelineCard({
  session,
  onMakeActive,
  onArchive,
  defaultExpanded = true,
}: SessionTimelineCardProps) {
  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    { sessionId: session._id } as never
  ) as TermRecord[] | undefined;

  const createTerm = useMutation("functions/academic/academicSetup:createTerm" as never);

  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Modern Confirmation Modals
  const [isActivateSessionConfirmOpen, setIsActivateSessionConfirmOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

  // Visual Session Activation Transition
  const [justActivated, setJustActivated] = useState(false);
  const prevIsActive = useRef(session.isActive);

  useEffect(() => {
    if (!prevIsActive.current && session.isActive) {
      setJustActivated(true);
      setIsExpanded(true);
      const timer = setTimeout(() => setJustActivated(false), 2400);
      return () => clearTimeout(timer);
    }
    prevIsActive.current = session.isActive;
  }, [session.isActive]);

  const activeTerm = terms?.find((t) => t.isActive);

  const handleAutoFillTerms = async () => {
    const yr = new Date(session.startDate).getFullYear();
    const nextYr = yr + 1;

    setIsAutoFilling(true);
    try {
      // First Term
      await createTerm({
        sessionId: session._id,
        name: "First Term",
        startDate: new Date(yr, 8, 8).getTime(),
        endDate: new Date(yr, 11, 19).getTime(),
        isActive: true,
        resultCalculationMode: "standalone",
      } as never);

      // Second Term
      await createTerm({
        sessionId: session._id,
        name: "Second Term",
        startDate: new Date(nextYr, 0, 12).getTime(),
        endDate: new Date(nextYr, 3, 17).getTime(),
        isActive: false,
        resultCalculationMode: "standalone",
      } as never);

      // Third Term
      await createTerm({
        sessionId: session._id,
        name: "Third Term",
        startDate: new Date(nextYr, 4, 4).getTime(),
        endDate: new Date(nextYr, 6, 24).getTime(),
        isActive: false,
        resultCalculationMode: "cumulative_annual",
      } as never);

      appToast.success("Terms Auto-Generated", {
        description: "Created First, Second, and Third Terms for " + session.name,
      });
    } catch (err) {
      appToast.error("Failed to auto-generate terms", {
        description: getUserFacingErrorMessage(err, "Could not create standard terms"),
      });
    } finally {
      setIsAutoFilling(false);
    }
  };

  return (
    <>
      <div
        className={`rounded-2xl border transition-all duration-500 ease-out overflow-hidden ${
          justActivated
            ? "border-emerald-500 bg-white shadow-xl shadow-emerald-500/10 ring-4 ring-emerald-400/50 scale-[1.005]"
            : session.isActive
              ? "border-slate-300/80 bg-white shadow-xs"
              : "border-slate-200/80 bg-white shadow-2xs hover:border-slate-300"
        }`}
      >
        {/* Session Top Bar (Clickable to toggle expansion) */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-4 sm:p-5 md:p-6 border-b border-slate-100 flex flex-col gap-3.5 cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
        >
          {/* Main Top Header: Icon + Title + Status Badges + Chevron */}
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
                  session.isActive
                    ? "bg-brand-primary text-white shadow-xs"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {session.isActive ? (
                  <CalendarCheck className="h-5 w-5 animate-in zoom-in-75 duration-300" />
                ) : (
                  <History className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <h3 className="font-display text-sm sm:text-base font-bold text-slate-950 leading-snug break-words">
                  {session.name}
                </h3>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {session.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200 animate-in fade-in zoom-in-95 duration-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Session
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Historical Record
                    </span>
                  )}

                  {activeTerm && (
                    <span
                      key={activeTerm._id}
                      className="inline-flex text-[10px] sm:text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 animate-in fade-in zoom-in-90 duration-300"
                    >
                      Current: <strong className="font-bold text-slate-900 ml-1">{activeTerm.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Expand / Collapse Chevron indicator */}
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 text-slate-500 hover:bg-slate-100 transition-colors">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>

          {/* Date Range & Metadata Subtitle */}
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-500 pl-0 sm:pl-1 flex-wrap">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-medium">{formatDateRange(session.startDate, session.endDate)}</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium">{terms ? `${terms.length} Academic Term${terms.length === 1 ? "" : "s"}` : "Loading terms..."}</span>
          </div>

          {/* Dedicated Action Button Bar (Clean Responsive Row) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 pt-2 border-t border-slate-100/80 flex-wrap"
          >
            {!session.isActive && (
              <button
                type="button"
                onClick={() => setIsActivateSessionConfirmOpen(true)}
                className="flex-1 sm:flex-initial rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition cursor-pointer text-center"
              >
                Set As Active Session
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAddTermModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Term</span>
            </button>

            {!session.isActive && (
              <button
                type="button"
                onClick={() => setIsArchiveConfirmOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
                title="Archive session"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Terms Unified Flat Sequence */}
        {isExpanded && (
          <div className="border-t border-slate-100 bg-white animate-in fade-in duration-300">
            {/* Header strip */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-50/60 border-b border-slate-100">
              <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Academic Term Sequence
              </h4>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                {terms?.length ?? 0} of 3 terms defined
              </span>
            </div>

            {terms === undefined ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 p-5 animate-pulse bg-slate-50/20" />
                ))}
              </div>
            ) : terms.length === 0 ? (
              <div className="p-8 sm:p-10 text-center space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 mx-auto">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900">No terms configured for this session yet</h4>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Add First, Second, and Third terms to enable class assessments, attendance recording, and report cards.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleAutoFillTerms}
                    disabled={isAutoFilling}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    {isAutoFilling ? "Creating..." : "Auto-Generate Standard 3 Terms"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddTermModalOpen(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Custom Term
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                {terms.map((term) => (
                  <TermCard key={term._id} term={term} sessionName={session.name} />
                ))}

                {terms.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setIsAddTermModalOpen(true)}
                    className="flex items-center justify-center gap-2 p-5 text-slate-400 hover:bg-slate-50/80 hover:text-slate-900 transition cursor-pointer group min-h-[64px] lg:min-h-[140px]"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 group-hover:border-slate-400 group-hover:text-slate-900 transition-colors shrink-0">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-bold">Add Next Term</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Contextual Term Creation Modal */}
        <TermCreationModal
          isOpen={isAddTermModalOpen}
          onClose={() => setIsAddTermModalOpen(false)}
          sessionId={session._id}
          sessionName={session.name}
          sessionStartDate={session.startDate}
          sessionEndDate={session.endDate}
          existingTermCount={terms?.length ?? 0}
        />
      </div>

      {/* Confirmation Modal for Session Activation */}
      <ConfirmationModal
        isOpen={isActivateSessionConfirmOpen}
        onClose={() => setIsActivateSessionConfirmOpen(false)}
        onConfirm={() => {
          setIsActivateSessionConfirmOpen(false);
          onMakeActive(session._id);
        }}
        title={`Activate ${session.name}?`}
        description={`Set ${session.name} as the school's primary active session.\n\nThe previously active session will be moved to history, and all attendance and grading features will sync to this session.`}
        confirmLabel="Set As Active"
        confirmVariant="emerald"
      />

      {/* Confirmation Modal for Session Archiving */}
      <ConfirmationModal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={() => {
          setIsArchiveConfirmOpen(false);
          onArchive(session._id);
        }}
        title={`Archive ${session.name}?`}
        description="Historical transcripts and report cards will remain preserved in the system, but this session will be moved out of the active setup workflow."
        confirmLabel="Archive Session"
        confirmVariant="danger"
      />
    </>
  );
}
