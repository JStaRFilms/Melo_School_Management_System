"use client";

import { useCallback, useRef, useState } from "react";
import type { ScoreRowBaseline } from "./scoreRowBaseline";

/** Session storage survives a query error boundary remount, but not a different browser session. */
export function useScoreSheetDraft<StudentId extends string, Field extends string>(key: string | null) {
  type Scores = Map<StudentId, Partial<Record<Field, number | null>>>;
  type Baselines = Map<StudentId, ScoreRowBaseline>;
  type Draft = { key: string | null; scores: Scores; baselines: Baselines };
  const read = useCallback((storageKey: string | null): Draft => {
    const empty = (): Draft => ({ key: storageKey, scores: new Map(), baselines: new Map() });
    if (!storageKey || typeof window === "undefined") return empty();
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]") as unknown;
      const rows = Array.isArray(stored) ? stored : stored && typeof stored === "object" && "scores" in stored ? stored.scores : null;
      const baselines = !Array.isArray(stored) && stored && typeof stored === "object" && "baselines" in stored ? stored.baselines : null;
      if (!Array.isArray(rows)) return empty();
      const validRows = rows.filter((row): row is [StudentId, Partial<Record<Field, number | null>>] =>
        Array.isArray(row) && typeof row[0] === "string" && row[1] !== null && typeof row[1] === "object");
      const validBaselines: Baselines = new Map();
      if (Array.isArray(baselines)) for (const row of baselines) {
        if (!Array.isArray(row) || typeof row[0] !== "string") continue;
        const value = row[1];
        if (value === null || (value && typeof value === "object" &&
          typeof value.id === "string" && Number.isFinite(value.updatedAt) &&
          ["ca1", "ca2", "ca3", "examRawScore"].every(field => Number.isFinite(value[field])))) {
          validBaselines.set(row[0] as StudentId, value as ScoreRowBaseline);
        }
      }
      return { key: storageKey, scores: new Map(validRows), baselines: validBaselines };
    } catch { return empty(); }
  }, []);
  const [, rerender] = useState(0);
  const current = useRef<Draft | null>(null);
  // Resolve a new sheet during render, before callers can observe or edit the old sheet.
  if (!current.current || current.current.key !== key) current.current = read(key);
  const { scores, baselines } = current.current;
  const persist = useCallback((draft: Draft) => {
    current.current = draft;
    // Write before returning to React: a guarded query can throw on the next render.
    if (key && typeof window !== "undefined") {
      try {
        if (draft.scores.size) window.sessionStorage.setItem(key, JSON.stringify({ scores: [...draft.scores], baselines: [...draft.baselines] }));
        else window.sessionStorage.removeItem(key);
      } catch { /* Storage can be unavailable; the mounted draft still works. */ }
    }
    rerender(version => version + 1);
  }, [key]);
  const update = useCallback((value: Scores | ((previous: Scores) => Scores)) => {
    if (current.current?.key !== key) return;
    const next = typeof value === "function" ? value(current.current.scores) : value;
    persist({ key, scores: next, baselines: new Map([...current.current.baselines].filter(([id]) => next.has(id))) });
  }, [key, persist]);
  const captureBaseline = useCallback((studentId: StudentId, baseline: ScoreRowBaseline) => {
    if (current.current?.key !== key || current.current.scores.has(studentId) || current.current.baselines.has(studentId)) return;
    const next = new Map(current.current.baselines);
    next.set(studentId, baseline);
    persist({ ...current.current, baselines: next });
  }, [key, persist]);
  return [scores, update, baselines, captureBaseline] as const;
}

export function readScoreSheetPolicyStamp(key: string | null): string | null {
  try { return key && typeof window !== "undefined" ? window.sessionStorage.getItem(`${key}:policy`) : null; }
  catch { return null; }
}

export function writeScoreSheetPolicyStamp(key: string | null, stamp: string | null) {
  if (!key || typeof window === "undefined") return;
  try {
    if (stamp === null) window.sessionStorage.removeItem(`${key}:policy`);
    else window.sessionStorage.setItem(`${key}:policy`, stamp);
  } catch { /* Storage may be unavailable. */ }
}

export function scoreSheetDraftKey(schoolId: string, sessionId: string | null, termId: string | null, classId: string | null, subjectId: string | null) {
  if (!sessionId || !termId || !classId || !subjectId) return null;
  return `score-sheet-draft:${JSON.stringify([schoolId, sessionId, termId, classId, subjectId])}`;
}
