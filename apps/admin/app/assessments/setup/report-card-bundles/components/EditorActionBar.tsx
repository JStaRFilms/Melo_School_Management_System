"use client";

import { useCallback, useState } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import { Loader2, UploadCloud, X } from "lucide-react";

interface EditorActionBarProps {
  dirty: boolean;
  saveLabel: string;
  successLabel: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function EditorActionBar({
  dirty,
  saveLabel,
  successLabel,
  onSave,
  onDiscard,
}: EditorActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = useCallback(async () => {
    if (!dirty) {
      return;
    }

    setIsSaving(true);
    setResult(null);

    try {
      await onSave();
      setResult({ success: true, message: successLabel });
      setTimeout(() => setResult(null), 4000);
    } catch (error) {
      setResult({
        success: false,
        message: getUserFacingErrorMessage(error, "Save failed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [dirty, onSave, successLabel]);

  return (
    <>
      {result && (
        <div
          className={[
            "fixed right-4 top-4 z-50 flex items-center gap-3 rounded-xl px-5 py-4 text-sm font-semibold text-white shadow-xl",
            result.success ? "bg-emerald-600" : "bg-rose-600",
          ].join(" ")}
        >
          <span>{result.message}</span>
          <button className="text-white/70 hover:text-white" onClick={() => setResult(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 sm:p-6 lg:border-none lg:bg-transparent">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 lg:justify-end">
          <button
            className="px-4 py-3 text-xs font-bold uppercase tracking-[0.3em] text-slate-400 transition hover:text-slate-900 disabled:opacity-40"
            disabled={isSaving}
            onClick={onDiscard}
            type="button"
          >
            Discard
          </button>
          <button
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-xs font-bold text-white shadow-xl transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!dirty || isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            ) : (
              <UploadCloud className="h-4 w-4 text-white/60" />
            )}
            {saveLabel}
          </button>
        </div>
      </div>
    </>
  );
}
