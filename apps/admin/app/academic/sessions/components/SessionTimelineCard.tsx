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
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { useDepartureGuard, useDirtyForm } from "@school/shared/drafts";
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

function formatDateInput(timestamp: number) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(start: number, end: number) {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  const endStr = e.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function parseDateInputToTimestamp(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

export function SessionTimelineCard({
  session,
  onMakeActive,
  onArchive,
  defaultExpanded = true,
}: SessionTimelineCardProps) {
  const { requestDeparture } = useDepartureGuard();
  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    { sessionId: session._id } as never
  ) as TermRecord[] | undefined;

  const createTerm = useMutation("functions/academic/academicSetup:createTerm" as never);
  const updateSessionDates = useMutation("functions/academic/academicSetup:updateSessionDates" as never);

  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isAutoFilling, setIsAutoFilling] = useState(false);

  // Session Dates / Info Edit State
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [sessionName, setSessionName] = useState(session.name);
  const [startDate, setStartDate] = useState(formatDateInput(session.startDate));
  const [endDate, setEndDate] = useState(formatDateInput(session.endDate));
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [isSaveDatesConfirmOpen, setIsSaveDatesConfirmOpen] = useState(false);

  useEffect(() => {
    if (isEditingDates) return;
    setSessionName(session.name);
    setStartDate(formatDateInput(session.startDate));
    setEndDate(formatDateInput(session.endDate));
  }, [isEditingDates, session.name, session.startDate, session.endDate]);

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

  const handleRequestSaveDates = (e: React.FormEvent) => {
    e.preventDefault();
    const startTs = parseDateInputToTimestamp(startDate);
    const endTs = parseDateInputToTimestamp(endDate);

    if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
      appToast.error("Invalid Dates", {
        description: "Please provide valid calendar start and end dates.",
      });
      return;
    }

    if (startTs >= endTs) {
      appToast.error("Validation Error", {
        description: "Session end date must be after the start date.",
      });
      return;
    }

    setIsSaveDatesConfirmOpen(true);
  };

  const saveDates = async () => {
    const startTs = parseDateInputToTimestamp(startDate);
    const endTs = parseDateInputToTimestamp(endDate);
    if (Number.isNaN(startTs) || Number.isNaN(endTs) || startTs >= endTs) {
      throw new Error("Session end date must be after a valid start date.");
    }
    setIsSavingDates(true);
    try {
      await updateSessionDates({
        sessionId: session._id,
        name: sessionName.trim() || session.name,
        startDate: startTs,
        endDate: endTs,
        expectedUpdatedAt: session.updatedAt,
      } as never);
      setIsEditingDates(false);
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleConfirmSaveDates = async () => {
    try {
      await saveDates();
      appToast.success("Session dates updated", {
        description: "Session calendar boundaries updated and recorded in audit trail.",
      });
    } catch (error) {
      appToast.error("Date update failed", {
        description: getUserFacingErrorMessage(error, "Unable to update session dates"),
      });
    }
  };

  const cancelDateEditing = () => {
    setSessionName(session.name);
    setStartDate(formatDateInput(session.startDate));
    setEndDate(formatDateInput(session.endDate));
    setIsEditingDates(false);
  };

  const toggleDateEditing = async () => {
    if (!isEditingDates) {
      setIsEditingDates(true);
      return;
    }
    if (await requestDeparture({ kind: "close" })) setIsEditingDates(false);
  };

  const datesDirty = isEditingDates && (
    sessionName !== session.name ||
    startDate !== formatDateInput(session.startDate) ||
    endDate !== formatDateInput(session.endDate)
  );
  useDirtyForm({
    name: `Session dates for ${session.name}`,
    isDirty: datesDirty,
    save: saveDates,
    discard: () => {
      if (isSavingDates) throw new Error("Wait for the session date save to finish before discarding.");
      cancelDateEditing();
    },
  });

  const handleAutoFillTerms = async () => {
    const yr = new Date(session.startDate).getFullYear();
    const nextYr = yr + 1;

    setIsAutoFilling(true);
    try {
      // First Term
      await createTerm({
        sessionId: session._id,
        name: "First Term",
        startDate: new Date(yr, 8, 8, 12, 0, 0).getTime(),
        endDate: new Date(yr, 11, 19, 12, 0, 0).getTime(),
        isActive: true,
        resultCalculationMode: "standalone",
      } as never);

      // Second Term
      await createTerm({
        sessionId: session._id,
        name: "Second Term",
        startDate: new Date(nextYr, 0, 12, 12, 0, 0).getTime(),
        endDate: new Date(nextYr, 3, 17, 12, 0, 0).getTime(),
        isActive: false,
        resultCalculationMode: "standalone",
      } as never);

      // Third Term
      await createTerm({
        sessionId: session._id,
        name: "Third Term",
        startDate: new Date(nextYr, 4, 4, 12, 0, 0).getTime(),
        endDate: new Date(nextYr, 6, 24, 12, 0, 0).getTime(),
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
          className="p-4 sm:p-5 md:p-6 border-b border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors select-none space-y-3 md:space-y-0"
        >
          {/* DESKTOP VIEW (>= md): Unified Balanced Row */}
          <div className="hidden md:flex md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${
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
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-base font-bold text-slate-950 leading-snug">
                    {session.name}
                  </h3>

                  {session.isActive ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200 animate-in fade-in zoom-in-95 duration-300 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active Session
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                      Historical Record
                    </span>
                  )}

                  {activeTerm && (
                    <span
                      key={activeTerm._id}
                      className="inline-flex text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 animate-in fade-in zoom-in-90 duration-300 shrink-0"
                    >
                      Current: <strong className="font-bold text-slate-900 ml-1">{activeTerm.name}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium">{formatDateRange(session.startDate, session.endDate)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleDateEditing();
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                    title="Edit session dates & name"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <span className="text-slate-300">·</span>
                  <span className="font-medium">{terms ? `${terms.length} Academic Term${terms.length === 1 ? "" : "s"}` : "Loading terms..."}</span>
                </div>
              </div>
            </div>

            {/* Desktop Actions */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={() => void toggleDateEditing()}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition cursor-pointer whitespace-nowrap"
                title="Edit session dates and name"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>Edit Dates</span>
              </button>

              {!session.isActive && (
                <button
                  type="button"
                  onClick={() => setIsActivateSessionConfirmOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Set As Active Session</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsAddTermModalOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
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

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label={isExpanded ? "Collapse session" : "Expand session"}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Inline Session Date Editor */}
          {isEditingDates && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5 text-amber-600" />
                  Modify Session Calendar & Dates
                </p>
                <span className="text-[10px] text-amber-700/80 font-medium">Recorded in timeline audit trail</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={sessionName}
                    disabled={isSavingDates}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                    placeholder="e.g. 2026/2027"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    disabled={isSavingDates}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    disabled={isSavingDates}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelDateEditing}
                  disabled={isSavingDates}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRequestSaveDates}
                  disabled={isSavingDates}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-900 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-amber-950 transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingDates ? "Saving..." : "Save Session Dates"}
                </button>
              </div>
            </div>
          )}

          {/* MOBILE VIEW (< md): Left-Aligned, Space-Efficient Stack */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {/* Top row: Icon + Title + Chevron */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${
                    session.isActive
                      ? "bg-brand-primary text-white shadow-xs"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {session.isActive ? (
                    <CalendarCheck className="h-4 w-4 animate-in zoom-in-75 duration-300" />
                  ) : (
                    <History className="h-4 w-4" />
                  )}
                </div>

                <h3 className="font-display text-sm font-bold text-slate-950 truncate">
                  {session.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label={isExpanded ? "Collapse session" : "Expand session"}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* Badges and Dates (Directly under the icon on the left, using full width) */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {session.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Session
                  </span>
                ) : (
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                    Historical Record
                  </span>
                )}

                {activeTerm && (
                  <span
                    key={activeTerm._id}
                    className="inline-flex text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shrink-0"
                  >
                    Current: <strong className="font-bold text-slate-900 ml-1">{activeTerm.name}</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="font-medium">{formatDateRange(session.startDate, session.endDate)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleDateEditing();
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                  title="Edit session dates & name"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <span className="text-slate-300">·</span>
                <span className="font-medium">{terms ? `${terms.length} Academic Terms` : "Loading..."}</span>
              </div>
            </div>

            {/* Mobile Actions: Never cuts off or overflows */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="pt-2 border-t border-slate-100"
            >
              {session.isActive ? (
                <div className="grid grid-cols-[auto_1fr] gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => void toggleDateEditing()}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                  >
                    <Pencil className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span>Edit Dates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddTermModalOpen(true)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2.5 px-4 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Term</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={() => setIsActivateSessionConfirmOpen(true)}
                    className="flex items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:scale-95 transition truncate"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Set Active</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleDateEditing()}
                    className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
                    title="Edit session dates & name"
                  >
                    <Pencil className="h-4 w-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddTermModalOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2.5 px-3 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition shadow-xs whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>Add Term</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsArchiveConfirmOpen(true)}
                    className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition shrink-0"
                    title="Archive session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
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

      {/* Confirmation Modal for Session Date Changes */}
      <ConfirmationModal
        isOpen={isSaveDatesConfirmOpen}
        onClose={() => setIsSaveDatesConfirmOpen(false)}
        onConfirm={() => {
          setIsSaveDatesConfirmOpen(false);
          void handleConfirmSaveDates();
        }}
        title={`Update Dates for ${session.name}?`}
        description={`You are modifying the calendar dates for ${session.name}.\n\nThis update will adjust the academic calendar boundaries for all enrolled terms and will be recorded in the audit trail.`}
        confirmLabel="Save Changes"
        confirmVariant="primary"
      />
    </>
  );
}
