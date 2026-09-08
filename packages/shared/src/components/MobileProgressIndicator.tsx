"use client";

import React from "react";
import { CheckCircle2, Loader2, CloudOff, AlertTriangle, Layers } from "lucide-react";
import { DraftStatus } from "../drafts/types";

export interface WizardSection {
  id: string;
  title: string;
  isValid: boolean;
  isCurrent?: boolean;
  optional?: boolean;
  hasError?: boolean;
}

export type MobileProgressMode = "scroll" | "sections";

export interface MobileProgressIndicatorProps {
  mode: MobileProgressMode;
  /**
   * Mode A: Viewport scroll percentage (0 - 100)
   */
  scrollPercentage?: number;
  /**
   * Mode B: Validated wizard sections
   */
  sections?: WizardSection[];
  currentStepIndex?: number;
  totalSteps?: number;
  currentStepTitle?: string;
  /**
   * Integrated draft persistence status
   */
  draftStatus?: DraftStatus;
  lastSavedAt?: number | Date | null;
  saveStatusText?: string;
  /**
   * Layout customization
   */
  topOffset?: string;
  className?: string;
  /** Suppress a duplicate mobile stepper or a short form indicator. */
  hidden?: boolean;
}

function formatStatusTime(timestamp?: number | Date | null): string {
  if (!timestamp) return "";
  const d = typeof timestamp === "number" ? new Date(timestamp) : timestamp;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * MobileProgressIndicator is a compact sticky sub-header bar (<768px, height <= 32px)
 * docking directly below the WorkspaceNavbar (D-04 §8).
 *
 * Strict Progress Semantics (D-04 §1.3 I2 & §8.2):
 * - Mode A (Scroll Progress): Viewport scroll depth for reading documents.
 * - Mode B (Validated Section Completion): Multi-step wizard completion.
 *   Steps mark complete ONLY when validation rules pass, never when scrolled past.
 */
export function MobileProgressIndicator({
  mode,
  scrollPercentage = 0,
  sections,
  currentStepIndex = 0,
  totalSteps,
  currentStepTitle,
  draftStatus,
  lastSavedAt,
  saveStatusText,
  topOffset = "top-14",
  className = "",
  hidden = false,
}: MobileProgressIndicatorProps) {
  if (hidden) return null;
  let progressPercent = 0;
  let primaryLabel = "";

  if (mode === "scroll") {
    progressPercent = Number.isFinite(scrollPercentage) ? Math.max(0, Math.min(100, Math.round(scrollPercentage))) : 0;
    primaryLabel = `Page position ${progressPercent}% (not completion)`;
  } else {
    // Mode B: Validated Section Completion
    if (sections && sections.length > 0) {
      const required = sections.filter(s => !s.optional);
      const validCount = required.filter(s => s.isValid && !s.hasError).length;
      const total = sections.length;
      progressPercent = required.length ? Math.round((validCount / required.length) * 100) : 0;

      const stepIdx = currentStepIndex + 1;
      const title = currentStepTitle || sections[currentStepIndex]?.title;
      primaryLabel = title
        ? `Step ${stepIdx} of ${total}: ${title}`
        : `${validCount} of ${total} sections complete`;
    } else {
      const total = totalSteps || 1;
      const stepIdx = currentStepIndex + 1;
      // Orientation alone is never evidence of validation.
      progressPercent = 0;
      primaryLabel = currentStepTitle
        ? `Step ${stepIdx} of ${total}: ${currentStepTitle}`
        : `Step ${stepIdx} of ${total}`;
    }
  }

  // Determine compact status pill content
  const renderStatusPill = () => {
    if (saveStatusText) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
          {saveStatusText}
        </span>
      );
    }

    if (!draftStatus || draftStatus === "idle") {
      return null;
    }

    const timeStr = formatStatusTime(lastSavedAt);

    switch (draftStatus) {
      case "saving":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
            <Loader2 className="h-2.5 w-2.5 animate-spin text-slate-400" />
            Saving...
          </span>
        );
      case "saved":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
            {timeStr ? `Saved ${timeStr}` : "Saved"}
          </span>
        );
      case "connection_lost":
        return (
          <span
            title="Connection lost • Recovery pending"
            className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium"
          >
            <CloudOff className="h-2.5 w-2.5 text-amber-600" />
            Recovery pending
          </span>
        );
      case "reauth_required":
        return <span className="text-[10px] text-amber-800">Sign in again · Edits in memory</span>;
      case "expired":
        return <span className="text-[10px] text-amber-800">Draft expired or closed</span>;
      case "save_failed":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700 font-medium">
            <AlertTriangle className="h-2.5 w-2.5 text-rose-600" />
            Save failed
          </span>
        );
      case "conflict":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 font-medium">
            <Layers className="h-2.5 w-2.5 text-amber-700" />
            Conflict
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`sticky ${topOffset} z-30 block md:hidden w-full h-8 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 select-none ${className}`}
      role="region"
      aria-label="Mobile progress and persistence status"
    >
      {/* 2px-4px Track */}
      <div
        className="w-full h-1 bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={mode === "scroll" ? "Page position, not completion" : "Required sections validated"}
        aria-valuetext={mode === "scroll" ? primaryLabel : `${progressPercent}% of required sections validated`}
      >
        <div
          className="h-full bg-[color:var(--school-accent,#475569)] transition-all duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {mode === "sections" && sections && <ol className="sr-only" aria-label="Section states">{sections.map((section, index) => <li key={section.id} aria-current={section.isCurrent || index === currentStepIndex ? "step" : undefined}>{section.title}: {section.hasError ? "error" : section.isValid ? "complete" : "incomplete"}{section.optional ? " (optional)" : ""}</li>)}</ol>}
      {/* 28px Content Line */}
      <div className="h-7 px-3 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-800 truncate">
          {primaryLabel}
        </span>
        <div className="shrink-0 flex items-center" role="status">{renderStatusPill()}</div>
      </div>
    </div>
  );
}
