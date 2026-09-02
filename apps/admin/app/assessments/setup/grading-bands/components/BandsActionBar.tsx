"use client";

import { useState, useCallback } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";

interface BandsActionBarProps {
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function BandsActionBar({
  hasUnsavedChanges,
  hasValidationErrors,
  onSave,
  onDiscard,
}: BandsActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || hasValidationErrors) return;

    setIsSaving(true);

    try {
      await onSave();
      appToast.success("Grading policy saved successfully", {
        id: "grading-bands-save-result",
      });
    } catch (error) {
      appToast.error("Unable to save grading policy", {
        id: "grading-bands-save-result",
        description: getErrorMessage(error, "Save failed."),
      });
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, hasValidationErrors, onSave]);

  if (!hasUnsavedChanges) return null;

  const isDisabled = hasValidationErrors || isSaving;

  return (
    <>
      {/* Mobile: Fixed bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 border-t border-slate-200/80 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3 z-40 shadow-2xl">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-wider px-3 py-2.5 disabled:opacity-40 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isDisabled}
          className="flex-1 bg-slate-900 text-white h-11 rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400" />
          )}
          {isSaving ? "Saving Policy..." : "Save Changes"}
        </button>
      </div>

      {/* Desktop: Floating action bar */}
      <div className="hidden lg:flex fixed bottom-8 right-8 items-center gap-3 z-50 bg-white/95 backdrop-blur-md p-2 pl-4 rounded-2xl border border-slate-200/80 shadow-2xl shadow-slate-900/10">
        <span className="text-xs font-medium text-slate-500 mr-1">
          {hasValidationErrors ? (
            <span className="text-rose-600 font-semibold">Resolve errors to save</span>
          ) : (
            <span>Unsaved changes</span>
          )}
        </span>
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 h-9 px-3.5 rounded-xl font-bold text-xs transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3 text-slate-500" />
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isDisabled}
          className="bg-slate-900 text-white h-9 px-5 rounded-xl font-bold text-xs hover:bg-slate-800 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          )}
          {isSaving ? "Saving Policy..." : "Save Changes"}
        </button>
      </div>
    </>
  );
}
