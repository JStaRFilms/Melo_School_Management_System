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

      // Clear downstream selectors when upstream changes
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
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Session Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
            Session
          </label>
          <div className="relative">
            <select
              value={selection.sessionId ?? ""}
              onChange={(e) =>
                updateSelection("sessionId", e.target.value || null)
              }
              disabled={isLoadingSessions}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 appearance-none pr-8"
            >
              <option value="">
                {isLoadingSessions ? "Loading..." : "Select Session"}
              </option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Term Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
            Term
          </label>
          <div className="relative">
            <select
              value={selection.termId ?? ""}
              onChange={(e) => updateSelection("termId", e.target.value || null)}
              disabled={!selection.sessionId || isLoadingTerms}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 appearance-none pr-8"
            >
              <option value="">
                {!selection.sessionId
                  ? "Select Session first"
                  : isLoadingTerms
                    ? "Loading..."
                    : "Select Term"}
              </option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Class Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
            Class
          </label>
          <div className="relative">
            <select
              value={selection.classId ?? ""}
              onChange={(e) =>
                updateSelection("classId", e.target.value || null)
              }
              disabled={!selection.termId || isLoadingClasses}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 appearance-none pr-8"
            >
              <option value="">
                {!selection.termId
                  ? "Select Term first"
                  : isLoadingClasses
                    ? "Loading..."
                    : "Select Class"}
              </option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Subject Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
            Subject
          </label>
          <div className="relative">
            <select
              value={selection.subjectId ?? ""}
              onChange={(e) =>
                updateSelection("subjectId", e.target.value || null)
              }
              disabled={!selection.classId || isLoadingSubjects}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/10 disabled:opacity-50 appearance-none pr-8"
            >
              <option value="">
                {!selection.classId
                  ? "Select Class first"
                  : isLoadingSubjects
                    ? "Loading..."
                    : "Select Subject"}
              </option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
