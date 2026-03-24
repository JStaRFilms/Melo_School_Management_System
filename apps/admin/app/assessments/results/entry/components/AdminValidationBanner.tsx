"use client";

import { AlertTriangle, X } from "lucide-react";

interface AdminValidationBannerProps {
  errorSummaries: Array<{ studentName: string; message: string }>;
  onDismiss?: () => void;
}

export function AdminValidationBanner({
  errorSummaries,
  onDismiss,
}: AdminValidationBannerProps) {
  if (errorSummaries.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 text-red-900 rounded-2xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="space-y-3 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide">
              Submission Blocked
            </h3>
            <p className="text-sm text-red-700 font-medium">
              Review the highlighted roster rows before committing this batch.
            </p>
          </div>
          {onDismiss ? (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-600 shrink-0"
              aria-label="Dismiss errors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {errorSummaries.slice(0, 6).map((error, index) => (
            <div
              key={`${error.studentName}-${index}`}
              className="bg-white border border-red-100 rounded-xl px-4 py-3"
            >
              <p className="text-xs font-bold">
                {error.studentName}: {error.message}
              </p>
            </div>
          ))}
        </div>
        {errorSummaries.length > 6 ? (
          <p className="text-xs font-bold text-red-500">
            ...and {errorSummaries.length - 6} more issues
          </p>
        ) : null}
      </div>
    </div>
  );
}
