"use client";

import { AlertCircle, X } from "lucide-react";
import type { BandValidationError } from "@/types";

interface BandValidationBannerProps {
  errors: BandValidationError[];
  onDismiss: () => void;
}

export function BandValidationBanner({
  errors,
  onDismiss,
}: BandValidationBannerProps) {
  if (errors.length === 0) return null;

  // Deduplicate messages if multiple errors share the same message
  const uniqueMessages = Array.from(new Set(errors.map((e) => e.message)));

  return (
    <div
      id="band-validation-banner"
      className="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 sm:p-5 flex items-start gap-3.5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-xs font-black text-rose-950 uppercase tracking-wider leading-tight">
            Policy {uniqueMessages.length > 1 ? "Errors" : "Error"}
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-200 text-rose-900">
            {uniqueMessages.length} {uniqueMessages.length === 1 ? "issue" : "issues"}
          </span>
        </div>

        {uniqueMessages.length === 1 ? (
          <p className="text-xs font-medium text-rose-800 leading-relaxed">
            {uniqueMessages[0]}
          </p>
        ) : (
          <ul className="space-y-1.5 mt-2">
            {uniqueMessages.map((msg, index) => (
              <li
                key={index}
                className="text-xs font-medium text-rose-800 leading-relaxed flex items-start gap-2"
              >
                <span className="text-rose-500 font-bold select-none">•</span>
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="p-1 rounded-lg text-rose-400 hover:text-rose-900 hover:bg-rose-100 transition-colors shrink-0"
        title="Dismiss alert"
        type="button"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
