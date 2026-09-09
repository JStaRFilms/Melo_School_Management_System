"use client";

import React, { useId, useState } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { FileText, Clock, User, CheckSquare, Eye, EyeOff, Trash2, ArrowRight, Loader2, Info } from "lucide-react";

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
    year: "numeric",
    hour: "2-digit",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-150 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="h-5 w-5 text-slate-100" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-display">
              Unfinished Draft Detected
            </span>
            <h2
              id={titleId}
              className="text-base font-bold text-slate-950 tracking-tight mt-0.5"
            >
              Resume editing {formTitle}?
            </h2>
          </div>
        </div>

        {/* Description */}
        <p
          id={descriptionId}
          className="text-xs text-slate-500 leading-relaxed"
        >
          We found an unfinished draft from your session. You can restore your work or discard it to start fresh.
        </p>

        {/* Excluded Fields Callout */}
        {excludedFieldsNotice && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed font-medium">{excludedFieldsNotice}</p>
          </div>
        )}

        {/* Metadata Card */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-400 font-medium shrink-0">
              <Clock className="h-3.5 w-3.5" />
              Last Modified:
            </span>
            <span className="font-semibold text-slate-800 truncate">{formatDate(lastSavedAt)}</span>
          </div>

          {subjectName && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400 font-medium shrink-0">Draft Subject:</span>
              <strong className="text-slate-900 font-semibold truncate">{subjectName}</strong>
            </div>
          )}

          {authorName && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium shrink-0">
                <User className="h-3.5 w-3.5" />
                Author:
              </span>
              <span className="text-slate-800 font-medium truncate">{authorName}</span>
            </div>
          )}

          {completionSummary && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-slate-400 font-medium shrink-0">
                <CheckSquare className="h-3.5 w-3.5" />
                Progress:
              </span>
              <span className="text-slate-800 font-medium">{completionSummary}</span>
            </div>
          )}
        </div>

        {/* Expandable Preview Drawer */}
        {showInternalPreview && payload && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 text-slate-200 p-3.5 text-xs font-mono max-h-48 overflow-y-auto">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider mb-2">
              Draft Payload Preview
            </div>
            <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed text-slate-300">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}

        {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}

        {/* Action Controls */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          {/* Primary & Preview Actions */}
          <div className="flex items-center gap-2">
            {payload && (
              <button
                type="button"
                disabled={busy || isDiscarding}
                aria-expanded={showInternalPreview}
                onClick={handleTogglePreview}
                className="h-10 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer whitespace-nowrap active:scale-[0.98]"
              >
                {showInternalPreview ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                    Preview Draft
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={busy || isDiscarding}
              onClick={() => {
                try {
                  onResume();
                } catch {
                  setError("This draft cannot be resumed with the current form schema. Keep your current edits or discard the draft.");
                }
              }}
              className="flex-1 h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 transition active:scale-[0.98] cursor-pointer whitespace-nowrap"
            >
              Resume Editing Draft
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Secondary / Destructive Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              disabled={busy || isDiscarding}
              onClick={() => void discard()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 transition cursor-pointer whitespace-nowrap"
            >
              {isDiscarding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              )}
              Discard Draft & Start Fresh
            </button>

            {onStay && (
              <button
                type="button"
                data-dialog-initial
                disabled={busy || isDiscarding}
                onClick={onStay}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer whitespace-nowrap"
              >
                Keep current edits
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
