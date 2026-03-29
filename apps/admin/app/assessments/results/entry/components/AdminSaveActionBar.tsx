"use client";

import { useState, useCallback } from "react";
import { Loader2, X } from "lucide-react";

interface AdminSaveActionBarProps {
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  errorCount: number;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  dirtyCount: number;
  isEditingLocked?: boolean;
  lockMessage?: string;
}

export function AdminSaveActionBar({
  hasUnsavedChanges,
  hasValidationErrors,
  errorCount,
  onSave,
  onCancel,
  dirtyCount,
  isEditingLocked = false,
  lockMessage,
}: AdminSaveActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const handleSave = useCallback(async () => {
    if (isEditingLocked || hasValidationErrors || !hasUnsavedChanges) return;

    setIsSaving(true);
    setSaveResult(null);

    try {
      await onSave();
      setSaveResult({
        success: true,
        message: "Changes Synced Successfully",
        count: dirtyCount,
      });
      setTimeout(() => setSaveResult(null), 5000);
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setIsSaving(false);
    }
  }, [dirtyCount, hasUnsavedChanges, hasValidationErrors, isEditingLocked, onSave]);

  const isDisabled =
    isEditingLocked || !hasUnsavedChanges || hasValidationErrors || isSaving;

  return (
    <>
      {/* Success Banner */}
      {saveResult?.success && (
        <div className="bg-emerald-600 text-white rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-900/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
              &#10003;
            </div>
            <div>
              <h3 className="text-xl font-bold">{saveResult.message}</h3>
              <p className="text-emerald-100/80 text-sm font-medium">
                All {saveResult.count ?? 0} valid student record
                {(saveResult.count ?? 0) > 1 ? "s" : ""} have been updated.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setSaveResult(null)}
              className="bg-emerald-500 border border-white/20 text-white font-bold h-12 px-6 rounded-xl hover:bg-emerald-400 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Error toast */}
      {saveResult && !saveResult.success && (
        <div className="bg-red-600 text-white rounded-xl px-6 py-4 flex items-center justify-between gap-3 shadow-xl">
          <p className="font-bold text-sm">{saveResult.message}</p>
          <button
            onClick={() => setSaveResult(null)}
            className="text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile: Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden bg-white/95 border-t border-slate-100 z-50">
        {isEditingLocked && lockMessage ? (
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            {lockMessage}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-900 uppercase tracking-tighter">
              Administrator Session
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase italic">
              Batch entry safeguards active
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={isDisabled}
            className="bg-indigo-600 text-white h-12 px-8 rounded-xl font-bold text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {isEditingLocked ? "Editing Locked" : "Commit Batch"}
          </button>
        </div>
      </div>

      {/* Desktop: Floating action bar */}
      <div className="fixed bottom-8 right-8 hidden md:flex items-center gap-3 z-50">
        {isEditingLocked && lockMessage ? (
          <div className="max-w-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 shadow-sm">
            {lockMessage}
          </div>
        ) : null}
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="bg-white border border-slate-200 text-slate-700 h-10 px-4 rounded-md font-bold text-xs hover:bg-slate-50 shadow-sm disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="bg-indigo-600 text-white h-10 px-6 rounded-md font-bold text-xs hover:bg-indigo-700 shadow-xl shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : null}
          {isSaving
            ? "Saving..."
            : isEditingLocked
              ? "Editing Locked"
            : hasValidationErrors
              ? "Fix Errors First"
              : "Commit Batch"}
        </button>
      </div>
    </>
  );
}
