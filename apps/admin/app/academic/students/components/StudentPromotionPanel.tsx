"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Layers,
  PlusCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/utils";

import type { ClassSummary, SessionSummary } from "./types";

export type PromotionSubjectMode =
  | "all_target_class_subjects"
  | "matching_previous_subjects"
  | "none";

interface StudentPromotionPanelProps {
  classes: ClassSummary[];
  sessions: SessionSummary[];
  selectedCount: number;
  totalRosterCount?: number;
  promotedCount?: number;
  unpromotedCount?: number;
  graduatedCount?: number;
  sourceClassId: string | null;
  sourceSessionId: string | null;
  targetClassId: string;
  targetSessionId: string;
  subjectMode: PromotionSubjectMode;
  isPromoting: boolean;
  onTargetClassChange: (value: string) => void;
  onTargetSessionChange: (value: string) => void;
  onSubjectModeChange: (value: PromotionSubjectMode) => void;
  onSelectAllVisible: () => void;
  onSelectUnpromotedOnly?: () => void;
  onClearSelection: () => void;
  onPromote: () => void;
  onGraduate?: (data: {
    graduationDate?: number;
    certificateNumber?: string;
    honorsOrRemarks?: string;
  }) => void;
}

export function StudentPromotionPanel({
  classes,
  sessions,
  selectedCount,
  totalRosterCount,
  promotedCount = 0,
  unpromotedCount = 0,
  graduatedCount = 0,
  sourceClassId,
  sourceSessionId,
  targetClassId,
  targetSessionId,
  subjectMode,
  isPromoting,
  onTargetClassChange,
  onTargetSessionChange,
  onSubjectModeChange,
  onSelectAllVisible,
  onSelectUnpromotedOnly,
  onClearSelection,
  onPromote,
  onGraduate,
}: StudentPromotionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [panelMode, setPanelMode] = useState<"promotion" | "graduation">("promotion");
  const [graduationDate, setGraduationDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [certificateNumber, setCertificateNumber] = useState("");
  const [honorsOrRemarks, setHonorsOrRemarks] = useState("");

  const hasSource = Boolean(sourceClassId && sourceSessionId);
  const sourceSession = sessions.find((s) => s._id === sourceSessionId);
  const targetSession = sessions.find((s) => s._id === targetSessionId);

  const isPastSession = Boolean(
    sourceSession?.startDate !== undefined &&
    targetSession?.startDate !== undefined &&
    targetSession.startDate < sourceSession.startDate
  );

  const upcomingSessions = sessions.filter((s) => {
    if (s._id === sourceSessionId) return false;
    if (
      sourceSession?.startDate !== undefined &&
      s.startDate !== undefined &&
      s.startDate < sourceSession.startDate
    ) {
      return false;
    }
    return true;
  });

  const pastSessions = sessions.filter((s) => {
    if (s._id === sourceSessionId) return false;
    if (
      sourceSession?.startDate !== undefined &&
      s.startDate !== undefined &&
      s.startDate < sourceSession.startDate
    ) {
      return true;
    }
    return false;
  });

  const isSameSession = Boolean(
    hasSource && targetSessionId && sourceSessionId === targetSessionId
  );
  const isSameClass = Boolean(
    hasSource && targetClassId && sourceClassId === targetClassId
  );

  const canPromote =
    selectedCount > 0 &&
    Boolean(targetClassId && targetSessionId) &&
    !isSameSession &&
    !isSameClass &&
    !isPastSession &&
    !isPromoting;

  const canGraduate =
    selectedCount > 0 &&
    hasSource &&
    Boolean(graduationDate) &&
    !isPromoting;

  const sourceClassName =
    classes.find((c) => c._id === sourceClassId)?.name ?? "Current Class";
  const sourceSessionName =
    sourceSession?.name ?? "Current Session";

  const targetClassName = classes.find((c) => c._id === targetClassId)?.name;
  const targetSessionName = targetSession?.name;

  const handleGraduationSubmit = () => {
    if (!onGraduate || !canGraduate) return;
    const parsedDate = graduationDate ? new Date(graduationDate).getTime() : Date.now();
    onGraduate({
      graduationDate: parsedDate,
      certificateNumber: certificateNumber.trim() || undefined,
      honorsOrRemarks: honorsOrRemarks.trim() || undefined,
    });
  };

  const renderPanelForm = (isMobileSheet = false) => (
    <div className="space-y-4">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 w-fit">
        <button
          type="button"
          onClick={() => setPanelMode("promotion")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
            panelMode === "promotion"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <span>✨ Annual Promotion (Next Class)</span>
        </button>
        <button
          type="button"
          onClick={() => setPanelMode("graduation")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
            panelMode === "graduation"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span>🎓 Terminal Graduation (Class of {sourceSessionName.slice(0, 4) || "2026"})</span>
        </button>
      </div>

      {panelMode === "promotion" ? (
        <>
          {/* Missing Upcoming Session Warning */}
          {upcomingSessions.length === 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Next Academic Session Required</p>
                  <p className="text-[11px] text-amber-800 font-medium">
                    Annual promotions require creating the upcoming academic session (e.g. next year&apos;s session).
                  </p>
                </div>
              </div>
              <Link
                href="/academic/sessions"
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-amber-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-amber-950 transition-colors shrink-0"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Create Next Session</span>
              </Link>
            </div>
          )}

          {/* Source & Destination Summary Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">Source:</span>
              <strong className="font-bold text-slate-800">{sourceClassName}</strong>
              <span className="text-slate-400">({sourceSessionName})</span>
            </div>
            <ArrowRight className="hidden sm:block h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-display">Target:</span>
              <strong className={cn("font-bold", targetClassName ? "text-indigo-700" : "text-slate-400")}>
                {targetClassName || "Select class below"}
              </strong>
              {targetSessionName && (
                <span className="text-slate-500">({targetSessionName})</span>
              )}
            </div>
          </div>

          {/* Quick Roster Selection Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-600 font-medium">
                <strong className="text-slate-900 font-bold">{selectedCount}</strong> student(s) selected from roster
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onSelectUnpromotedOnly && (
                <button
                  type="button"
                  onClick={onSelectUnpromotedOnly}
                  disabled={!hasSource || isPromoting || unpromotedCount === 0}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Select Unpromoted ({unpromotedCount})
                </button>
              )}
              <button
                type="button"
                onClick={onSelectAllVisible}
                disabled={!hasSource || isPromoting}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Select All ({totalRosterCount ?? 0})
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedCount === 0 || isPromoting}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Form Configuration Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
            <label className="space-y-1 block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Target Class *
              </span>
              <select
                value={targetClassId}
                onChange={(e) => onTargetClassChange(e.target.value)}
                className={fieldClassName}
                disabled={isPromoting}
              >
                <option value="">Select destination class...</option>
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Upcoming Academic Session *
              </span>
              <select
                value={targetSessionId}
                onChange={(e) => onTargetSessionChange(e.target.value)}
                className={fieldClassName}
                disabled={isPromoting}
              >
                <option value="">Select upcoming session...</option>
                {upcomingSessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.isActive ? "(Active)" : ""}
                  </option>
                ))}
                {sourceSessionId && (
                  <option value={sourceSessionId} disabled>
                    {sourceSessionName} (Current Session — Promotion Not Allowed)
                  </option>
                )}
                {pastSessions.map((s) => (
                  <option key={s._id} value={s._id} disabled>
                    {s.name} (Previous Session — Backwards Promotion Blocked)
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block sm:col-span-2 lg:col-span-1">
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Subject Registration for New Class
              </span>
              <select
                value={subjectMode}
                onChange={(e) =>
                  onSubjectModeChange(e.target.value as PromotionSubjectMode)
                }
                className={fieldClassName}
                disabled={isPromoting}
              >
                <option value="all_target_class_subjects">
                  Enroll in all subjects for new class (Standard)
                </option>
                <option value="matching_previous_subjects">
                  Keep continuing subjects only
                </option>
                <option value="none">
                  Do not register subjects now (Manual later)
                </option>
              </select>
            </label>
          </div>

          {/* Validation Warnings */}
          {isPastSession && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-900 shadow-sm animate-pulse">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p>Backwards Promotion Blocked</p>
                <p className="font-medium text-[11px] text-red-800 mt-0.5">
                  You cannot promote students into a previous academic session ({targetSessionName}). Annual promotions must advance forward to an upcoming academic session.
                </p>
              </div>
            </div>
          )}

          {isSameSession && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Students cannot be promoted to a higher grade within the current session. Select an upcoming academic session.
              </span>
            </div>
          )}

          {isSameClass && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Destination class cannot be the same as current source class.
              </span>
            </div>
          )}

          {/* Footer Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
              <span>Historical report cards and prior session invoices remain locked and protected.</span>
            </div>

            <button
              type="button"
              onClick={() => {
                onPromote();
                if (isMobileSheet) setIsExpanded(false);
              }}
              disabled={!canPromote}
              className="w-full sm:w-auto flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              <span>{isPromoting ? "Promoting..." : `Promote ${selectedCount} Student${selectedCount === 1 ? "" : "s"}`}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        /* ── GRADUATION WORKFLOW FORM ── */
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-950 font-display flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-emerald-600" />
                  Terminal Cohort Graduation Flow
                </h4>
                <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  Graduate students from <strong>{sourceClassName}</strong> ({sourceSessionName}).
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                Class of {sourceSessionName.slice(0, 4) || "2026"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 pt-1">
              <label className="space-y-1 block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800 font-display">
                  Graduation Date *
                </span>
                <input
                  type="date"
                  value={graduationDate}
                  onChange={(e) => setGraduationDate(e.target.value)}
                  className={fieldClassName}
                  disabled={isPromoting}
                />
              </label>

              <label className="space-y-1 block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800 font-display">
                  Certificate Ref (Optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. CERT/2026/042"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  className={fieldClassName}
                  disabled={isPromoting}
                />
              </label>

              <label className="space-y-1 block">
                <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-800 font-display">
                  Honors / Remarks (Optional)
                </span>
                <input
                  type="text"
                  placeholder="e.g. High Honors, WASSCE Completed"
                  value={honorsOrRemarks}
                  onChange={(e) => setHonorsOrRemarks(e.target.value)}
                  className={fieldClassName}
                  disabled={isPromoting}
                />
              </label>
            </div>
          </div>

          {/* Quick Roster Selection Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-600 font-medium">
                <strong className="text-slate-900 font-bold">{selectedCount}</strong> student(s) selected for graduation
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onSelectAllVisible}
                disabled={!hasSource || isPromoting}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Select All ({totalRosterCount ?? 0})
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedCount === 0 || isPromoting}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Graduation Footer Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Graduated students remain in {sourceSessionName} with full exam records & unlock Attestation Letters.
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                handleGraduationSubmit();
                if (isMobileSheet) setIsExpanded(false);
              }}
              disabled={!canGraduate}
              className="w-full sm:w-auto flex h-9 items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              <GraduationCap className="h-4 w-4" />
              <span>{isPromoting ? "Graduating..." : `Graduate ${selectedCount} Student${selectedCount === 1 ? "" : "s"}`}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all">
        {/* ── HEADER ACCORDION BAR ── */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex cursor-pointer items-center justify-between gap-3 p-3.5 md:p-4 bg-slate-50/70 hover:bg-slate-50 transition-colors select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                  End-of-Session Promotion & Graduation Rollover
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700 uppercase">
                  Term 3 Active
                </span>
                {totalRosterCount !== undefined && totalRosterCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                    {promotedCount} Promoted · {graduatedCount} Graduated
                  </span>
                )}
                {selectedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                    {selectedCount} student(s) selected
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                Batch promote students to next grade or graduate final-year cohorts.
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </button>
        </div>

        {/* ── DESKTOP EXPANDABLE BODY (>= lg) ── */}
        {isExpanded && (
          <div className="hidden lg:block border-t border-slate-200/80 p-5 space-y-4 animate-in fade-in slide-in-from-top-1">
            {renderPanelForm(false)}
          </div>
        )}
      </section>

      {/* ── MOBILE SLIDE-UP BOTTOM SHEET (< lg) ── */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm animate-overlay-fade-in"
            onClick={() => setIsExpanded(false)}
          />

          <div className="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-2xl space-y-4 animate-sheet-slide-up">
            <div className="flex justify-center -mt-1 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shadow-sm">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                    Promotion & Graduation
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Session Rollover Configuration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {renderPanelForm(true)}
          </div>
        </div>
      )}
    </>
  );
}

const fieldClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 disabled:opacity-40 shadow-sm";

