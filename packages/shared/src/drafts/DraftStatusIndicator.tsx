"use client";

import React, { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  CloudOff,
  AlertTriangle,
  Layers,
  Info,
} from "lucide-react";
import { DraftStatus, DRAFT_STATUS_CONFIGS } from "./types";

export interface DraftStatusIndicatorProps {
  status: DraftStatus;
  lastSavedAt?: number | Date | null;
  onRetry?: () => void;
  className?: string;
  showExplanation?: boolean;
}

function formatSavedTime(dateOrTimestamp?: number | Date | null): string {
  if (!dateOrTimestamp) return "";
  const date =
    typeof dateOrTimestamp === "number"
      ? new Date(dateOrTimestamp)
      : dateOrTimestamp;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * DraftStatusIndicator renders a truthful, WCAG-compliant status badge.
 * Enforces Zero False Offline Claims (D-04 §7.2.1):
 * When connectivity is lost, it displays "Connection lost • Recovery pending"
 * with an unambiguous explanation that data is retained in browser memory only.
 */
export function DraftStatusIndicator({
  status,
  lastSavedAt,
  onRetry,
  className = "",
  showExplanation = false,
}: DraftStatusIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = DRAFT_STATUS_CONFIGS[status] || DRAFT_STATUS_CONFIGS.idle;

  if (status === "idle") {
    return null;
  }

  const formattedTime = formatSavedTime(lastSavedAt);
  const displayLabel =
    status === "saved" && formattedTime
      ? `Draft saved at ${formattedTime}`
      : config.label;

  const renderIcon = () => {
    switch (status) {
      case "saving":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />;
      case "saved":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
      case "connection_lost":
        return <CloudOff className="h-3.5 w-3.5 text-amber-600" />;
      case "save_failed":
        return <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />;
      case "conflict":
        return <Layers className="h-3.5 w-3.5 text-amber-700" />;
      default:
        return null;
    }
  };

  return (
    <div className={`relative inline-flex flex-col items-start ${className}`}>
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${config.badgeClass}`}
        role="status"
        aria-live="polite"
      >
        {renderIcon()}
        <span>{displayLabel}</span>

        {status === "connection_lost" && (
          <button
            type="button"
            onClick={() => setShowTooltip((prev) => !prev)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="View connectivity recovery information"
            className="ml-0.5 text-amber-700 hover:text-amber-900 focus:outline-none"
          >
            <Info className="h-3 w-3" />
          </button>
        )}

        {status === "save_failed" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 underline font-semibold text-rose-800 hover:text-rose-950 focus:outline-none"
          >
            Retry
          </button>
        )}
      </div>

      {(showExplanation || showTooltip) && config.description && (
        <div className="absolute top-full left-0 mt-1 z-30 w-72 rounded-lg bg-slate-900 p-2.5 text-[11px] leading-relaxed text-slate-100 shadow-xl border border-slate-700">
          <p>{config.description}</p>
        </div>
      )}
    </div>
  );
}
