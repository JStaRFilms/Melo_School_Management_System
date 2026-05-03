"use client";

import { useCallback, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";

interface SaveActionBarProps {
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  errorCount: number;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  dirtyCount: number;
  isEditingLocked?: boolean;
  lockMessage?: string;
}

export function SaveActionBar({
  hasUnsavedChanges,
  hasValidationErrors,
  errorCount,
  onSave,
  onCancel,
  dirtyCount,
  isEditingLocked = false,
  lockMessage,
}: SaveActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isHandledSaveError = (error: unknown): error is { toastHandled: true } =>
    typeof error === "object" && error !== null && "toastHandled" in error;

  const handleSave = useCallback(async () => {
    if (isEditingLocked || !hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    try {
      await onSave();
      appToast.success("Results saved", {
        id: "teacher-exam-entry-save-result",
        description: `${dirtyCount} student record${dirtyCount === 1 ? "" : "s"} saved successfully.`,
      });
    } catch (err) {
      if (!isHandledSaveError(err)) {
        appToast.error("Unable to save exam results", {
          id: "teacher-exam-entry-save-result",
          description: getErrorMessage(err, "Save failed."),
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [dirtyCount, hasUnsavedChanges, isEditingLocked, isSaving, onSave]);

  const isDisabled = isEditingLocked || !hasUnsavedChanges || isSaving;

  return (
    <>
      {/* Mobile: Fixed bottom bar - exact match from desktop mockup */}
      <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden bg-white/95 border-t border-obsidian-100 z-50">
        {isEditingLocked && lockMessage ? (
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            {lockMessage}
          </p>
        ) : null}
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
            : isEditingLocked
              ? "Editing Locked"
            : hasValidationErrors
              ? `${errorCount} Error${errorCount > 1 ? "s" : ""} to Fix`
              : hasUnsavedChanges
                ? "Save Changes"
                : "Save Changes"}
        </button>
      </div>

      {/* Desktop: Floating action bar - exact match from desktop mockup */}
      <div className="fixed bottom-8 right-8 hidden md:flex items-center gap-3 z-50">
        {isEditingLocked && lockMessage ? (
          <div className="max-w-xs rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 shadow-sm">
            {lockMessage}
          </div>
        ) : null}
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
            : isEditingLocked
              ? "Editing Locked"
            : hasValidationErrors
              ? "Fix Errors First"
              : "Finalize Sheet"}
        </button>
      </div>
    </>
  );
}
