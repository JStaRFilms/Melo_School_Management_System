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
    <div className="bg-red-50/50 border border-red-100 text-red-950 rounded-xl p-4 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-900 leading-none mb-1.5">
                Submission Protocol Blocked
              </h3>
              <p className="text-[11px] font-bold text-red-700/80 leading-relaxed max-w-xl">
                The current batch contains validation conflicts that must be resolved within the roster grid before commitment is permitted.
              </p>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-red-300 hover:text-red-900 transition-colors p-1"
                aria-label="Dismiss errors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {errorSummaries.slice(0, 6).map((error, index) => (
              <div
                key={`${error.studentName}-${index}`}
                className="bg-white/60 border border-red-100/50 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <div className="w-1 h-1 rounded-full bg-red-400" />
                <p className="text-[10px] font-bold truncate">
                  <span className="text-red-900 uppercase opacity-60 mr-1">{error.studentName}:</span>
                  {error.message}
                </p>
              </div>
            ))}
          </div>

          {errorSummaries.length > 6 && (
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-1">
              + {errorSummaries.length - 6} additional protocol violations identified
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
