"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function KnowledgeLibraryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Knowledge library route failed", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-surface-200 px-4 py-12">
      <div className="max-w-xl rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-xl ring-1 ring-slate-950/5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-rose-500">
          Failed to load library
        </p>
        <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-950">
          Knowledge console unavailable
        </h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
          The admin library could not load. Retry to refresh the Convex query layer, or return to the academic workspace.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-slate-800"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </div>
  );
}
