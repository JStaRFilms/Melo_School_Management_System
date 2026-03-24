"use client";

import { useState, useCallback } from "react";
import { Save, Loader2, X } from "lucide-react";

interface SaveActionBarProps {
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  errorCount: number;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  dirtyCount: number;
}

export function SaveActionBar({
  hasUnsavedChanges,
  hasValidationErrors,
  errorCount,
  onSave,
  onCancel,
  dirtyCount,
}: SaveActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const handleSave = useCallback(async () => {
    if (hasValidationErrors || !hasUnsavedChanges) return;

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
  }, [hasValidationErrors, hasUnsavedChanges, onSave, dirtyCount]);

  const isDisabled = !hasUnsavedChanges || hasValidationErrors || isSaving;

  return (
    <>
      {/* Success Banner - exact match from states mockup State 03 */}
      {saveResult?.success && (
        <div className="bg-emerald-600 text-white rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-900/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
              <Save className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{saveResult.message}</h3>
              <p className="text-emerald-100/80 text-sm font-medium">
                All {saveResult.count ?? 0} student record
                {(saveResult.count ?? 0) > 1 ? "s" : ""} have been updated and
                are safely stored.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="bg-white text-emerald-700 font-bold h-12 px-6 rounded-xl hover:bg-emerald-50 transition-colors">
              View Audit Log
            </button>
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

      {/* Mobile: Fixed bottom bar - exact match from desktop mockup */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden bg-white/95 border-t border-obsidian-100 z-50">
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="w-full bg-obsidian-950 text-white h-12 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isSaving
            ? "Saving..."
            : hasValidationErrors
              ? `${errorCount} Error${errorCount > 1 ? "s" : ""} to Fix`
              : hasUnsavedChanges
                ? "Save Changes"
                : "Save Changes"}
        </button>
      </div>

      {/* Desktop: Floating action bar - exact match from desktop mockup */}
      <div className="fixed bottom-8 right-8 hidden md:flex items-center gap-3 z-50">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="bg-white border border-obsidian-200 text-obsidian-700 h-10 px-4 rounded-md font-bold text-xs hover:bg-obsidian-50 shadow-sm disabled:opacity-40"
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
          ) : (
            <Save className="w-3 h-3" />
          )}
          {isSaving
            ? "Saving..."
            : hasValidationErrors
              ? "Fix Errors First"
              : "Finalize Sheet"}
        </button>
      </div>
    </>
  );
}
