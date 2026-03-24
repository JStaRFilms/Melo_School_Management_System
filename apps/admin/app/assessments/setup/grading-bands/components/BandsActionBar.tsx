"use client";

import { useState, useCallback } from "react";
import { Loader2, X } from "lucide-react";

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
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || hasValidationErrors) return;

    setIsSaving(true);
    setSaveResult(null);

    try {
      await onSave();
      setSaveResult({ success: true, message: "Grading bands updated" });
      setTimeout(() => setSaveResult(null), 5000);
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, hasValidationErrors, onSave]);

  const isDisabled = !hasUnsavedChanges || hasValidationErrors || isSaving;

  return (
    <>
      {/* Success Toast */}
      {saveResult?.success && (
        <div className="fixed top-4 right-4 bg-emerald-600 text-white rounded-xl px-6 py-4 flex items-center justify-between gap-3 shadow-xl z-50">
          <p className="font-bold text-sm">{saveResult.message}</p>
          <button
            onClick={() => setSaveResult(null)}
            className="text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Toast */}
      {saveResult && !saveResult.success && (
        <div className="fixed top-4 right-4 bg-red-600 text-white rounded-xl px-6 py-4 flex items-center justify-between gap-3 shadow-xl z-50">
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
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between gap-3 z-40">
        <button
          onClick={onDiscard}
          disabled={isSaving}
          className="text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest px-4 py-3 disabled:opacity-40"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="flex-1 bg-slate-900 text-white h-12 rounded-xl text-xs font-bold shadow-xl active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          Commit Global Policy
        </button>
      </div>

      {/* Desktop: Floating action bar */}
      <div className="hidden lg:flex fixed bottom-8 right-8 items-center gap-3 z-50">
        <button
          onClick={onDiscard}
          disabled={isSaving}
          className="bg-white border border-slate-200 text-slate-700 h-10 px-4 rounded-md font-bold text-xs hover:bg-slate-50 shadow-sm disabled:opacity-40"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={isDisabled}
          className="bg-slate-900 text-white h-10 px-6 rounded-md font-bold text-xs hover:bg-slate-800 shadow-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : null}
          Commit Global Policy
        </button>
      </div>
    </>
  );
}
