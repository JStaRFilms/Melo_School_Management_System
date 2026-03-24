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

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-5 flex items-start gap-3 shadow-sm">
      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h3 className="text-xs font-extrabold text-red-900 uppercase tracking-widest mb-1 leading-tight">
          Policy Error
        </h3>
        <p className="text-[11px] text-red-700 leading-normal">
          {errors[0].message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-red-400 hover:text-red-900 transition-colors"
      >
        <X className="w-4 h-4 text-red-300" />
      </button>
    </div>
  );
}
