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
  onClearSelection: () => void;
  onPromote: () => void;
}

export function StudentPromotionPanel({
  classes,
  sessions,
  selectedCount,
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
  onClearSelection,
  onPromote,
}: StudentPromotionPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasSource = Boolean(sourceClassId && sourceSessionId);
  const upcomingSessions = sessions.filter(
    (session) => session._id !== sourceSessionId
  );

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
    !isPromoting;

  const sourceClassName =
    classes.find((c) => c._id === sourceClassId)?.name ?? "Current Class";
  const sourceSessionName =
    sessions.find((s) => s._id === sourceSessionId)?.name ?? "Current Session";

  const targetClassName = classes.find((c) => c._id === targetClassId)?.name;
  const targetSessionName = sessions.find((s) => s._id === targetSessionId)?.name;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all">
      {/* ── HEADER ACCORDION BAR ── */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex cursor-pointer items-center justify-between gap-3 p-4 bg-slate-50/70 hover:bg-slate-50 transition-colors border-b border-slate-200/80 select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 font-display">
                End-of-Session Promotion Rollover
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700 uppercase">
                Term 3 Active
              </span>
              {selectedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  {selectedCount} student(s) selected
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
              Batch roll students over into the upcoming academic session for next year.
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* ── EXPANDABLE WORKSPACE BODY ── */}
      {isExpanded && (
        <div className="p-4 md:p-5 space-y-4 animate-in fade-in slide-in-from-top-1">
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
                href="/academic/classes"
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSelectAllVisible}
                disabled={!hasSource || isPromoting}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                disabled={selectedCount === 0 || isPromoting}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Form Configuration Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
            {/* Target Class */}
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

            {/* Target Session */}
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
              </select>
            </label>

            {/* Subject Enrollment Mode */}
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
          {isSameSession && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Students cannot be promoted to a higher grade within the current session. Select an upcoming academic session. For mid-session transfers, edit the student record directly.
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
              onClick={onPromote}
              disabled={!canPromote}
              className="w-full sm:w-auto flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <span>{isPromoting ? "Promoting..." : `Promote ${selectedCount} Student${selectedCount === 1 ? "" : "s"}`}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const fieldClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 disabled:opacity-40 shadow-sm";

