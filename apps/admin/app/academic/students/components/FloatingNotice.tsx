"use client";

import { CheckCircle2, AlertCircle, X } from "lucide-react";

import type { EnrollmentNotice } from "./types";

interface FloatingNoticeProps {
  notice: EnrollmentNotice | null;
  onDismiss: () => void;
}

export function FloatingNotice({
  notice,
  onDismiss,
}: FloatingNoticeProps) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.tone === "success";
  const isWarning = notice.tone === "warning";

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] justify-end">
      <div
        className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${
          isSuccess
            ? "border-emerald-200 bg-white text-emerald-950 shadow-emerald-950/10"
            : isWarning
              ? "border-amber-200 bg-white text-amber-950 shadow-amber-950/10"
              : "border-red-200 bg-white text-red-950 shadow-red-950/10"
        }`}
        role="status"
        aria-live="polite"
      >
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isSuccess
              ? "bg-emerald-100 text-emerald-700"
              : isWarning
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isWarning ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {isSuccess ? "Saved" : isWarning ? "Saved with reminders" : "Something went wrong"}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">{notice.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 transition hover:text-slate-700"
          aria-label="Dismiss notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
