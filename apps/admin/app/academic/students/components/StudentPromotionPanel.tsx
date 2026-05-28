"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Layers,
  Calendar,
  BookOpen,
  ShieldCheck,
} from "lucide-react";

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

  const sourceClassName =
    classes.find((classDoc) => classDoc._id === sourceClassId)?.name ?? "Current Class";
  const sourceSessionName =
    sessions.find((session) => session._id === sourceSessionId)?.name ?? "Current Session";

  const targetClassName =
    classes.find((classDoc) => classDoc._id === targetClassId)?.name;
  const targetSessionName =
    sessions.find((session) => session._id === targetSessionId)?.name;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-xl shadow-slate-100/40 space-y-6">
      {/* Visual Accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

      {/* Header section with intent definition */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 shadow-sm flex items-center justify-center flex-shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              End-of-Session Student Promotion Workspace
            </h2>
            <p className="text-xs text-slate-500 max-w-xl mt-0.5 leading-relaxed">
              Batch promote students to their next academic level. Placements will become effective for target roster roles during next session rollover.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-indigo-50/60 border border-indigo-100/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-700 self-start sm:self-center shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
          </span>
          Cumulative Annual Active
        </div>
      </div>

      {/* Workspace Visual Pipeline */}
      <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-5 justify-between">
        {/* Source context node */}
        <div className="flex-1 min-w-0 bg-white border border-slate-200/60 p-3.5 rounded-xl shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100 flex-shrink-0">
            <Layers className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Current Source Roster</p>
            <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{sourceClassName}</p>
            <p className="text-xs text-slate-500 font-semibold truncate">{sourceSessionName}</p>
          </div>
        </div>

        {/* Pipeline transfer connector */}
        <div className="flex flex-col items-center justify-center flex-shrink-0 md:px-2 gap-1.5">
          <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm flex-shrink-0">
            <ArrowRight className="h-4.5 w-4.5" />
          </div>
          <div className="bg-indigo-600 text-white font-extrabold text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md shadow-indigo-600/10">
            {selectedCount} Prepared
          </div>
        </div>

        {/* Target destination node */}
        <div className={`flex-1 min-w-0 p-3.5 rounded-xl border transition-all duration-300 ${targetClassId && targetSessionId ? "bg-white border-slate-200/60 shadow-sm flex items-center gap-3" : "bg-white/40 border-dashed border-slate-200 flex items-center justify-center py-5"}`}>
          {targetClassId && targetSessionId ? (
            <>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 flex-shrink-0">
                <GraduationCap className="h-4.5 w-4.5 animate-in zoom-in-50 duration-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-wider text-indigo-500">Destination Class & Session</p>
                <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{targetClassName}</p>
                <p className="text-xs text-slate-500 font-semibold truncate">{targetSessionName}</p>
              </div>
            </>
          ) : (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-ping"></span>
              Select Target Destination...
            </p>
          )}
        </div>
      </div>

      {/* Quick selection workspace helpers */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50/20 border border-indigo-100/30 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-indigo-500 flex-shrink-0" />
          <p className="text-xs font-semibold text-slate-700">
            Roster Selection: <span className="text-indigo-600 font-extrabold">{selectedCount}</span> student(s) selected for promotion.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAllVisible}
            disabled={!hasSource || isPromoting}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none hover:border-slate-300 cursor-pointer"
          >
            Select Full Roster
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedCount === 0 || isPromoting}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none hover:text-slate-700 cursor-pointer"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Inputs Configuration form */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Layers className="h-3 w-3" />
            Target Class
          </span>
          <select
            value={targetClassId}
            onChange={(event) => onTargetClassChange(event.target.value)}
            className={fieldClassName}
            disabled={isPromoting}
            aria-label="Target Class for Promotion"
          >
            <option value="">Choose class...</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Target Session
          </span>
          <select
            value={targetSessionId}
            onChange={(event) => onTargetSessionChange(event.target.value)}
            className={fieldClassName}
            disabled={isPromoting}
            aria-label="Target Session for Promotion"
          >
            <option value="">Choose session...</option>
            {sessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.name}
                {session.isActive ? " (Active)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            New Subject Enrollment Mode
          </span>
          <select
            value={subjectMode}
            onChange={(event) =>
              onSubjectModeChange(event.target.value as PromotionSubjectMode)
            }
            className={fieldClassName}
            disabled={isPromoting}
            aria-label="New Subject Enrollment Mode"
          >
            <option value="all_target_class_subjects">Enroll all target-class subjects</option>
            <option value="matching_previous_subjects">Only matching old subjects</option>
            <option value="none">Do not enroll subjects yet</option>
          </select>
        </label>
      </div>

      {/* Safety messages and execution controls */}
      <div className="border-t border-slate-100 pt-5 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex gap-3 items-start bg-indigo-50/40 border border-indigo-100/50 rounded-xl p-3.5 w-full lg:flex-1">
          <ShieldCheck className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-800">Roster Protection Standard</p>
            <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
              Safe rollover enabled. Historical report cards, academic grades, and prior billing invoices are protected and will remain permanently unchanged.
            </p>
          </div>
        </div>

        <div className="w-full lg:w-auto">
          <button
            type="button"
            onClick={onPromote}
            disabled={!canPromote}
            className="w-full lg:w-auto flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-600/10 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-30 disabled:shadow-none disabled:pointer-events-none cursor-pointer"
          >
            {isPromoting ? "Executing Promotion..." : "Execute Promotion"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Validation Message */}
      {isSameContext && (
        <div className="flex gap-2 items-center bg-rose-50 border border-rose-100 text-rose-800 rounded-xl p-3 text-xs font-bold animate-pulse">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Destination class and session must differ from current class and session.</span>
        </div>
      )}
    </section>
  );
}

const fieldClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition shadow-sm hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 disabled:bg-slate-50";
