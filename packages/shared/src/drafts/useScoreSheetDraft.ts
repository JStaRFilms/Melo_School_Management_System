"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Session storage survives a query error boundary remount, but not a different browser session. */
export function useScoreSheetDraft<StudentId extends string, Field extends string>(key: string | null) {
  type Scores = Map<StudentId, Partial<Record<Field, number | null>>>;
  const read = useCallback((storageKey: string | null): Scores => {
    if (!storageKey || typeof window === "undefined") return new Map();
    try {
      const rows = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "[]") as unknown;
      if (!Array.isArray(rows)) return new Map();
      return new Map(rows.filter((row): row is [StudentId, Partial<Record<Field, number | null>>] =>
        Array.isArray(row) && typeof row[0] === "string" && row[1] !== null && typeof row[1] === "object"));
    } catch { return new Map(); }
  }, []);
  const [scores, setScores] = useState<Scores>(() => read(key));
  const current = useRef(scores);
  useEffect(() => {
    current.current = read(key);
    setScores(current.current);
  }, [key, read]);
  const update = useCallback((value: Scores | ((previous: Scores) => Scores)) => {
    const next = typeof value === "function" ? value(current.current) : value;
    current.current = next;
    // Write before returning to React: a guarded query can throw on the next render.
    if (key && typeof window !== "undefined") {
      try {
        if (next.size) window.sessionStorage.setItem(key, JSON.stringify([...next]));
        else window.sessionStorage.removeItem(key);
      } catch { /* Storage can be unavailable; the mounted draft still works. */ }
    }
    setScores(next);
  }, [key]);
  return [scores, update] as const;
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
