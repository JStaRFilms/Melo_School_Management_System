"use client";

import { useState, useCallback } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";

interface SettingsActionBarProps {
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function SettingsActionBar({
  hasUnsavedChanges,
  onSave,
  onDiscard,
}: SettingsActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    setSaveResult(null);

    try {
      await onSave();
      setSaveResult({ success: true, message: "Settings updated" });
      setTimeout(() => setSaveResult(null), 5000);
    } catch (err) {
      setSaveResult({
        success: false,
        message: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setIsSaving(false);
    }
  }, [hasUnsavedChanges, onSave]);

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

      {/* Floating Action Bar - exact match from mockup */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between sm:justify-end bg-white border-t border-slate-200 lg:bg-transparent lg:border-none z-50">
        <button
          onClick={onDiscard}
          disabled={isSaving}
          className="text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest px-4 py-3 disabled:opacity-40"
        >
          Discard
        </button>
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-bold shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 text-white/50 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4 text-white/50" />
          )}
          Commit Settings
        </button>
      </div>
    </>
  );
}
