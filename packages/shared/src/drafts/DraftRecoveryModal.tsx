"use client";

import React, { useId, useState } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { FileText, Clock, User, CheckSquare, Eye, EyeOff, Trash2, ArrowRight, Loader2 } from "lucide-react";

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
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * DraftRecoveryModal prompts returning users when an active server draft exists.
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
  const titleId = useId(); const descriptionId = useId();
  const [showInternalPreview, setShowInternalPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useDialogFocus(isOpen, () => { if (!busy && !isDiscarding) onStay?.(); });
  const discard = async () => {
    setBusy(true); setError(null);
    try { await onDiscard(); } catch { setError("Discard failed. Your draft is still available; please retry."); }
    finally { setBusy(false); }
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
              Unfinished Draft Detected
            </span>
            <h2
              id={titleId}
              className="text-lg font-bold text-slate-900 mt-0.5"
            >
              Resume editing {formTitle}?
            </h2>
          </div>
        </div>

        {/* Description & Invariant notice */}
        <p
          id={descriptionId}
          className="text-sm text-slate-600 leading-relaxed mb-4"
        >
          We found an unfinished draft. Resume replaces the current form only when you choose it; stay here to keep current edits.
        </p>

        {excludedFieldsNotice && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            {excludedFieldsNotice}
          </p>
        )}

        {/* Metadata Card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs text-slate-700 mb-5">
          {subjectName && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500 w-24 shrink-0">Draft Subject:</span>
              <strong className="text-slate-900 font-medium truncate">{subjectName}</strong>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-500 w-24 shrink-0">Last Modified:</span>
            <span className="text-slate-800 font-mono">{formatDate(lastSavedAt)}</span>
          </div>

          {authorName && (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-500 w-24 shrink-0">Author:</span>
              <span className="text-slate-800 truncate">{authorName}</span>
            </div>
          )}

          {completionSummary && (
            <div className="flex items-center gap-2">
              <CheckSquare className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-500 w-24 shrink-0">Progress:</span>
              <span className="text-slate-800 font-medium">{completionSummary}</span>
            </div>
          )}
        </div>

        {/* Expandable Preview Drawer */}
        {showInternalPreview && payload && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-3.5 text-xs font-mono max-h-48 overflow-y-auto">
            <div className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-wider mb-2">
              Draft Payload Preview
            </div>
            <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>
        )}

        {error && <p role="alert" className="mb-3 text-sm text-rose-700">{error}</p>}
        {onStay && <button type="button" data-dialog-initial disabled={busy || isDiscarding} onClick={onStay} className="min-h-11 px-3">Keep current edits</button>}
        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={busy || isDiscarding}
            onClick={() => void discard()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
          >
            {isDiscarding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            )}
            Discard Draft & Start Fresh
          </button>

          <div className="flex items-center gap-2 sm:justify-end">
            {payload && (
              <button
                type="button"
                disabled={busy || isDiscarding}
                aria-expanded={showInternalPreview}
                onClick={handleTogglePreview}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
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
              onClick={() => { try { onResume(); } catch { setError("This draft cannot be resumed with the current form schema. Keep your current edits or discard the draft."); } }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[color:var(--school-primary,#0f172a)] text-xs font-semibold text-white hover:opacity-95 shadow-sm transition"
            >
              Resume Editing Draft
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
