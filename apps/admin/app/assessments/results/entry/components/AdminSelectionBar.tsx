"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronDown } from "lucide-react";
import type { SelectionState, SelectorOption, Id } from "@/types";

interface AdminSelectionBarProps {
  sessions: SelectorOption[];
  terms: SelectorOption[];
  classes: SelectorOption[];
  subjects: SelectorOption[];
  selection: SelectionState;
  isLoadingSessions?: boolean;
  isLoadingTerms?: boolean;
  isLoadingClasses?: boolean;
  isLoadingSubjects?: boolean;
  onBeforeSelectionChange?: (nextSelection: SelectionState) => boolean;
}

export function AdminSelectionBar({
  sessions,
  terms,
  classes,
  subjects,
  selection,
  isLoadingSessions = false,
  isLoadingTerms = false,
  isLoadingClasses = false,
  isLoadingSubjects = false,
  onBeforeSelectionChange,
}: AdminSelectionBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSelection = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      if (key === "sessionId") {
        params.delete("termId");
        params.delete("classId");
        params.delete("subjectId");
      } else if (key === "termId") {
        params.delete("classId");
        params.delete("subjectId");
      } else if (key === "classId") {
        params.delete("subjectId");
      }

      const nextSelection: SelectionState = {
        sessionId: (params.get("sessionId") as Id<"academicSessions">) ?? null,
        termId: (params.get("termId") as Id<"academicTerms">) ?? null,
        classId: (params.get("classId") as Id<"classes">) ?? null,
        subjectId: (params.get("subjectId") as Id<"subjects">) ?? null,
      };

      if (onBeforeSelectionChange && !onBeforeSelectionChange(nextSelection)) {
        return;
      }

      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [onBeforeSelectionChange, router, searchParams]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {/* Session Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1 block">
            Protocol Session
          </label>
          <div className="relative group">
            <select
              value={selection.sessionId ?? ""}
              onChange={(e) =>
                updateSelection("sessionId", e.target.value || null)
              }
              disabled={isLoadingSessions}
              className="w-full h-10 px-3 bg-slate-50/50 border border-slate-200/60 rounded-md text-[11px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-0 disabled:opacity-50 appearance-none pr-8 cursor-pointer group-hover:bg-white group-hover:border-slate-400"
            >
              <option value="">
                {isLoadingSessions ? "..." : "SELECT SESSION"}
              </option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-slate-950 transition-colors" />
          </div>
        </div>

        {/* Term Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1 block">
            Academic Term
          </label>
          <div className="relative group">
            <select
              value={selection.termId ?? ""}
              onChange={(e) => updateSelection("termId", e.target.value || null)}
              disabled={!selection.sessionId || isLoadingTerms}
              className="w-full h-10 px-3 bg-slate-50/50 border border-slate-200/60 rounded-md text-[11px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-0 disabled:opacity-50 appearance-none pr-8 cursor-pointer group-hover:bg-white group-hover:border-slate-400"
            >
              <option value="">
                {!selection.sessionId
                  ? "AWAITING SESSION"
                  : isLoadingTerms
                    ? "..."
                    : "SELECT TERM"}
              </option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-slate-950 transition-colors" />
          </div>
        </div>

        {/* Class Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1 block">
            Class Stream
          </label>
          <div className="relative group">
            <select
              value={selection.classId ?? ""}
              onChange={(e) =>
                updateSelection("classId", e.target.value || null)
              }
              disabled={!selection.termId || isLoadingClasses}
              className="w-full h-10 px-3 bg-slate-50/50 border border-slate-200/60 rounded-md text-[11px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-0 disabled:opacity-50 appearance-none pr-8 cursor-pointer group-hover:bg-white group-hover:border-slate-400"
            >
              <option value="">
                {!selection.termId
                  ? "AWAITING TERM"
                  : isLoadingClasses
                    ? "..."
                    : "SELECT CLASS"}
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-slate-950 transition-colors" />
          </div>
        </div>

        {/* Subject Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1 block">
            Academic Subject
          </label>
          <div className="relative group">
            <select
              value={selection.subjectId ?? ""}
              onChange={(e) =>
                updateSelection("subjectId", e.target.value || null)
              }
              disabled={!selection.classId || isLoadingSubjects}
              className="w-full h-10 px-3 bg-slate-50/50 border border-slate-200/60 rounded-md text-[11px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-0 disabled:opacity-50 appearance-none pr-8 cursor-pointer group-hover:bg-white group-hover:border-slate-400"
            >
              <option value="">
                {!selection.classId
                  ? "AWAITING CLASS"
                  : isLoadingSubjects
                    ? "..."
                    : "SELECT SUBJECT"}
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none group-hover:text-slate-950 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
