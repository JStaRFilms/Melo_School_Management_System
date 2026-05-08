"use client";

import { ArrowRight, GraduationCap } from "lucide-react";

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
  const hasSource = Boolean(sourceClassId && sourceSessionId);
  const isSameContext =
    hasSource &&
    sourceClassId === targetClassId &&
    sourceSessionId === targetSessionId;
  const canPromote =
    selectedCount > 0 &&
    Boolean(targetClassId && targetSessionId) &&
    !isSameContext &&
    !isPromoting;

  return (
    <section className="rounded-2xl border border-indigo-100 bg-white/80 p-4 shadow-sm ring-1 ring-indigo-950/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-950">
                Promote students
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Move selected students without changing old report cards or invoices.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSelectAllVisible}
              disabled={!hasSource || isPromoting}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Select roster
            </button>
            <button
              type="button"
              onClick={onClearSelection}
              disabled={selectedCount === 0 || isPromoting}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Clear selection
            </button>
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700">
              {selectedCount} selected
            </span>
          </div>
        </div>

        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto]">
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              Target class
            </span>
            <select
              value={targetClassId}
              onChange={(event) => onTargetClassChange(event.target.value)}
              className={fieldClassName}
              disabled={isPromoting}
            >
              <option value="">Choose class</option>
              {classes.map((classDoc) => (
                <option key={classDoc._id} value={classDoc._id}>
                  {classDoc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              Target session
            </span>
            <select
              value={targetSessionId}
              onChange={(event) => onTargetSessionChange(event.target.value)}
              className={fieldClassName}
              disabled={isPromoting}
            >
              <option value="">Choose session</option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.name}{session.isActive ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              New subject enrollment
            </span>
            <select
              value={subjectMode}
              onChange={(event) =>
                onSubjectModeChange(event.target.value as PromotionSubjectMode)
              }
              className={fieldClassName}
              disabled={isPromoting}
            >
              <option value="all_target_class_subjects">Enroll all target-class subjects</option>
              <option value="matching_previous_subjects">Only matching old subjects</option>
              <option value="none">Do not enroll subjects yet</option>
            </select>
          </label>
          <button
            type="button"
            onClick={onPromote}
            disabled={!canPromote}
            className="flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-slate-950 px-4 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPromoting ? "Promoting..." : "Promote"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isSameContext ? (
        <p className="mt-3 text-[11px] font-bold text-amber-700">
          Choose a different class or session before promoting.
        </p>
      ) : null}
    </section>
  );
}

const fieldClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10";
