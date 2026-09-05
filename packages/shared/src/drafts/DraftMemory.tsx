"use client";
import React, { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
export interface MemoryDraft { payload: unknown; revision: number; capturedAt: number }
const MemoryContext = createContext<Map<string, MemoryDraft> | null>(null);
/** RAM only, above auth-gated route children; never localStorage/sessionStorage/IndexedDB. */
export function DraftMemoryProvider({ children }: { children: ReactNode }) {
  const memory = useRef(new Map<string, MemoryDraft>());
  useEffect(() => {
    const timer = window.setInterval(() => {
      for (const [key, draft] of memory.current) {
        if (Date.now() - draft.capturedAt >= 30 * 60 * 1000) memory.current.delete(key);
      }
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);
  return <MemoryContext.Provider value={memory.current}>{children}</MemoryContext.Provider>;
}
export function useDraftMemory() { return useContext(MemoryContext); }
