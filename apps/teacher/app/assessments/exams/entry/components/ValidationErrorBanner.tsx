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
    // Exact match from states mockup State 04
    <div className="bg-red-50 border-2 border-red-200 text-red-900 rounded-3xl p-8 flex flex-col md:flex-row items-start gap-6">
      <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="space-y-4 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Submission Blocked</h3>
            <p className="text-red-700 font-medium">
              Some records contain invalid data. Please review the highlighted
              cells in the roster grid before finalizing the sheet.
            </p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-red-400 hover:text-red-600 shrink-0"
              aria-label="Dismiss errors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {/* Exact grid from states mockup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {errorSummaries.slice(0, 6).map((err, i) => (
            <div
              key={i}
              className="bg-white/50 border border-red-100 p-4 rounded-xl flex items-center gap-3"
            >
              <span className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-bold text-xs shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-xs font-bold">
                {err.studentName}: {err.message}
              </p>
            </div>
          ))}
        </div>
        {errorSummaries.length > 6 && (
          <p className="text-xs text-red-500 font-bold">
            ...and {errorSummaries.length - 6} more errors
          </p>
        )}
      </div>
    </div>
  );
}
