"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface UnsavedBranchSwitchModalProps {
  isOpen: boolean;
  formName: string;
  targetBranchName: string;
  lastSavedText?: string;
  supportsDraftSave?: boolean;
  onStay: () => void;
  onDiscardAndSwitch: () => void;
  onSaveDraftAndSwitch?: () => Promise<void>;
}

/**
 * Dirty-Form Interception Modal (D-04 §3.2).
 * Guards against data loss when a user initiates a branch context switch
 * while working inside a form with unsaved changes.
 */
export function UnsavedBranchSwitchModal({
  isOpen,
  formName,
  targetBranchName,
  lastSavedText,
  supportsDraftSave = false,
  onStay,
  onDiscardAndSwitch,
  onSaveDraftAndSwitch,
}: UnsavedBranchSwitchModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSaveAndSwitch = async () => {
    if (!onSaveDraftAndSwitch) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveDraftAndSwitch();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to save draft. Please stay on the current branch or discard changes.";
      setSaveError(message);
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-switch-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/60 shrink-0">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2
            id="branch-switch-title"
            className="text-lg font-bold text-slate-900 tracking-tight"
          >
            Unsaved Changes Pending
          </h2>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          You are attempting to switch to{" "}
          <strong className="text-slate-900">{targetBranchName}</strong>, but{" "}
          <strong className="text-slate-900">{formName}</strong> contains
          unsaved modifications.
        </p>

        {lastSavedText && (
          <p className="mt-2 text-xs text-slate-500 font-mono">
            {lastSavedText}
          </p>
        )}

        {saveError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            {saveError}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {supportsDraftSave && onSaveDraftAndSwitch && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAndSwitch}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--school-primary,#0f172a)] px-4 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Draft & Switch Branch
            </button>
          )}

          <button
            type="button"
            disabled={isSaving}
            onClick={onDiscardAndSwitch}
            className="w-full h-11 inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
          >
            Discard Changes & Switch
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={onStay}
            className="w-full h-11 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            Stay on Current Branch
          </button>
        </div>
      </div>
    </div>
  );
}
