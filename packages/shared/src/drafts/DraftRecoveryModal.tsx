"use client";

import React, { useId, useState } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { Clock, User, CheckSquare, Eye, EyeOff, Trash2, ArrowRight, Loader2, Info, FileText } from "lucide-react";

export interface DraftRecoveryModalProps {
  isOpen: boolean;
  formTitle: string;
  lastSavedAt: number | Date;
  authorName?: string;
  subjectName?: string;
  completionSummary?: string;
  payload?: Record<string, unknown>;
  onResume: () => void;
  onDiscard: () => void | Promise<void>;
  onPreview?: () => void;
  isDiscarding?: boolean;
  onStay?: () => void;
  excludedFieldsNotice?: string;
}

function formatDate(dateOrTimestamp: number | Date): string {
  const date =
    typeof dateOrTimestamp === "number"
      ? new Date(dateOrTimestamp)
      : dateOrTimestamp;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * DraftRecoveryModal prompts returning users when an active draft exists.
 *
 * Governing Invariant (D-04 §1.3 I3 & §7.3):
 * A draft NEVER silently overwrites a fresh blank form.
 * The user explicitly chooses to Resume, Preview, or Discard.
 */
export function DraftRecoveryModal({
  isOpen,
  formTitle,
  lastSavedAt,
  authorName,
  subjectName,
  completionSummary,
  payload,
  onResume,
  onDiscard,
  onPreview,
  isDiscarding = false,
  onStay,
  excludedFieldsNotice,
}: DraftRecoveryModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [showInternalPreview, setShowInternalPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useDialogFocus(isOpen, () => {
    if (!busy && !isDiscarding) onStay?.();
  });

  const discard = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDiscard();
    } catch {
      setError("Discard failed. Your draft is still available; please retry.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const handleTogglePreview = () => {
    setShowInternalPreview((prev) => !prev);
    if (onPreview) {
      onPreview();
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-busy={busy || isDiscarding}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-150 space-y-3.5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <FileText className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-sm font-bold text-slate-950 tracking-tight leading-snug"
            >
              Resume editing {formTitle}?
            </h2>
            <p
              id={descriptionId}
              className="text-xs text-slate-500 mt-0.5 leading-relaxed"
            >
              We found an unfinished draft. Do you want to restore your edits?
            </p>
          </div>
        </div>

        {/* Excluded Fields Note */}
        {excludedFieldsNotice && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="leading-snug">{excludedFieldsNotice}</span>
          </div>
        )}

        {/* Metadata Card */}
        <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Clock className="h-3 w-3 text-slate-400" />
              Last saved:
            </span>
            <span className="font-semibold text-slate-800 text-[11px]">{formatDate(lastSavedAt)}</span>
          </div>

          {subjectName && (
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Subject:</span>
              <strong className="font-semibold text-slate-900 truncate max-w-[180px]">{subjectName}</strong>
            </div>
          )}

          {authorName && (
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span className="flex items-center gap-1.5">
                <User className="h-3 w-3 text-slate-400" />
                Author:
              </span>
              <span className="font-medium text-slate-800 truncate max-w-[180px]">{authorName}</span>
            </div>
          )}

          {completionSummary && (
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span className="flex items-center gap-1.5">
                <CheckSquare className="h-3 w-3 text-slate-400" />
                Progress:
              </span>
              <span className="font-medium text-slate-800">{completionSummary}</span>
            </div>
          )}
        </div>

        {/* Human-Readable Draft Preview */}
        {showInternalPreview && payload && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs max-h-48 overflow-y-auto space-y-2 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Draft Preview
            </div>
            <div className="divide-y divide-slate-100">
              {Object.entries(payload).map(([key, val]) => {
                if (val === null || val === undefined || val === "") return null;
                const displayVal = typeof val === "object" ? JSON.stringify(val) : String(val);
                const label = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/_/g, " ")
                  .replace(/^\w/, (c) => c.toUpperCase());
                return (
                  <div key={key} className="flex items-start justify-between gap-3 py-1.5 text-xs">
                    <span className="text-slate-500 font-medium shrink-0">{label}:</span>
                    <span className="font-semibold text-slate-900 text-right break-words">{displayVal}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}

        {/* Action Controls */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={busy || isDiscarding}
            onClick={() => {
              try {
                onResume();
              } catch {
                setError("This draft cannot be resumed with current form schema.");
              }
            }}
            className="w-full h-9 rounded-xl bg-slate-950 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            Resume Editing Draft
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              disabled={busy || isDiscarding}
              onClick={() => void discard()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline disabled:opacity-50 transition cursor-pointer"
            >
              {isDiscarding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3 text-rose-500" />
              )}
              Discard Draft & Start Fresh
            </button>

            <div className="flex items-center gap-2">
              {payload && (
                <button
                  type="button"
                  disabled={busy || isDiscarding}
                  aria-expanded={showInternalPreview}
                  onClick={handleTogglePreview}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-950 transition cursor-pointer"
                >
                  {showInternalPreview ? (
                    <>
                      <EyeOff className="h-3 w-3" />
                      Hide Preview
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3" />
                      Preview Draft
                    </>
                  )}
                </button>
              )}

              {onStay && (
                <button
                  type="button"
                  data-dialog-initial
                  disabled={busy || isDiscarding}
                  onClick={onStay}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  Keep current edits
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
