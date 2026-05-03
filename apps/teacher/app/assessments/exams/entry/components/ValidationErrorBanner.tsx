"use client";

import { AlertTriangle, X } from "lucide-react";

interface ValidationErrorBannerProps {
  errorSummaries: Array<{ studentName: string; message: string }>;
  onDismiss?: () => void;
}

export function ValidationErrorBanner({
  errorSummaries,
  onDismiss,
}: ValidationErrorBannerProps) {
  if (errorSummaries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black">Some scores still need attention</h3>
          <p className="mt-1 text-sm font-medium text-amber-800">
            {errorSummaries.length} field{errorSummaries.length === 1 ? "" : "s"} are not ready to save. Check the highlighted cells in the score grid.
          </p>
        </div>
        {onDismiss ? (
          <button
            onClick={onDismiss}
            className="text-amber-500 hover:text-amber-800"
            aria-label="Dismiss errors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
