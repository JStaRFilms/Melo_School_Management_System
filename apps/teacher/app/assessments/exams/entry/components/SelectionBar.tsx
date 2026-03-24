"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { SelectionState, SelectorOption, Id } from "@/lib/types";

interface SelectionBarProps {
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

export function SelectionBar({
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
}: SelectionBarProps) {
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
    <div className="bg-white border border-obsidian-200 rounded-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Session Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold editorial-spacing text-obsidian-400">
            Session
          </label>
          <select
            value={selection.sessionId ?? ""}
            onChange={(e) =>
              updateSelection("sessionId", e.target.value || null)
            }
            disabled={isLoadingSessions}
            className="w-full h-10 px-3 bg-obsidian-50 border border-obsidian-200 rounded-md text-sm font-bold text-obsidian-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
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
        </div>

        {/* Term Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold editorial-spacing text-obsidian-400">
            Term
          </label>
          <select
            value={selection.termId ?? ""}
            onChange={(e) => updateSelection("termId", e.target.value || null)}
            disabled={!selection.sessionId || isLoadingTerms}
            className="w-full h-10 px-3 bg-obsidian-50 border border-obsidian-200 rounded-md text-sm font-bold text-obsidian-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
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
        </div>

        {/* Class Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold editorial-spacing text-obsidian-400">
            Class
          </label>
          <select
            value={selection.classId ?? ""}
            onChange={(e) => updateSelection("classId", e.target.value || null)}
            disabled={!selection.termId || isLoadingClasses}
            className="w-full h-10 px-3 bg-obsidian-50 border border-obsidian-200 rounded-md text-sm font-bold text-obsidian-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
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
        </div>

        {/* Subject Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold editorial-spacing text-obsidian-400">
            Subject
          </label>
          <select
            value={selection.subjectId ?? ""}
            onChange={(e) =>
              updateSelection("subjectId", e.target.value || null)
            }
            disabled={!selection.classId || isLoadingSubjects}
            className="w-full h-10 px-3 bg-obsidian-50 border border-obsidian-200 rounded-md text-sm font-bold text-obsidian-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50"
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
        </div>
      </div>
    </div>
  );
}
