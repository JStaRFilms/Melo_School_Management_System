"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  History,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { TermCard, type TermRecord } from "./TermCard";
import { TermCreationModal } from "./TermCreationModal";
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
    <div
      className={`rounded-2xl border transition-all duration-200 ${
        session.isActive
          ? "border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-500/10"
          : "border-slate-200/80 bg-white shadow-2xs"
      }`}
    >
      {/* Session Top Bar */}
      <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
              session.isActive
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {session.isActive ? <Sparkles className="h-5 w-5" /> : <History className="h-5 w-5" />}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-display text-base font-bold text-slate-950 truncate">
                {session.name}
              </h3>

              {session.isActive ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Session
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Historical Record
                </span>
              )}

              {activeTerm && (
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50/80 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  Current Term: <strong className="font-bold">{activeTerm.name}</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span>{formatDateRange(session.startDate, session.endDate)}</span>
              <span>·</span>
              <span>{terms ? `${terms.length} Academic Term${terms.length === 1 ? "" : "s"}` : "Loading terms..."}</span>
            </div>
          </div>
        </div>

        {/* Right Session Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {!session.isActive && (
            <button
              type="button"
              onClick={() => onMakeActive(session._id)}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
            >
              Set As Active Session
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsAddTermModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Term</span>
          </button>

          <button
            type="button"
            onClick={() => onArchive(session._id)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
            title="Archive session"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition cursor-pointer md:hidden"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Terms Horizontal Timeline Grid */}
      {isExpanded && (
        <div className="p-5 md:p-6 bg-slate-50/40">
          <div className="flex items-center justify-between mb-3.5">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Academic Term Sequence
            </h4>
            <span className="text-[11px] font-bold text-slate-500">
              {terms?.length ?? 0} of 3 standard terms defined
            </span>
          </div>

          {terms === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-36 rounded-2xl bg-white border border-slate-200/60 animate-pulse" />
              ))}
            </div>
          ) : terms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mx-auto">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">No terms configured for this session yet</h4>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  Add First, Second, and Third terms to enable class assessments, attendance recording, and report card generation.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAutoFillTerms}
                  disabled={isAutoFilling}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isAutoFilling ? "Creating..." : "Auto-Generate Standard 3 Terms"}
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddTermModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Custom Term
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {terms.map((term) => (
                <TermCard key={term._id} term={term} sessionName={session.name} />
              ))}

              {terms.length < 3 && (
                <button
                  type="button"
                  onClick={() => setIsAddTermModalOpen(true)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/30 hover:text-indigo-600 transition cursor-pointer group min-h-[140px]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    <Plus className="h-4 w-4" />
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
  );
}
