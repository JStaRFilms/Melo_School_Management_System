"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import { Loader2, Check, X, CheckCircle2, AlertCircle } from "lucide-react";

interface EditorActionBarProps {
  dirty: boolean;
  saveLabel: string;
  successLabel: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function EditorActionBar({ dirty, saveLabel, successLabel, onSave, onDiscard }: EditorActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const actionBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateHeight = () => {
      setActionBarHeight(actionBarRef.current?.clientHeight ?? 0);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleSave = useCallback(async () => {
    if (!dirty) return;

    setIsSaving(true);
    setResult(null);

    try {
      await onSave();
      setResult({ success: true, message: successLabel });
    } catch (error) {
      setResult({
        success: false,
        message: getUserFacingErrorMessage(error, "Operation Failed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [dirty, onSave, successLabel]);

  return (
    <>
      {result && (
        <div className="fixed right-6 z-[100] animate-in slide-in-from-right-4 duration-300" style={{ bottom: `${actionBarHeight + 20}px` }}>
          <div
            className={`flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl backdrop-blur-xl border ${
              result.success
                ? "bg-emerald-600 text-white border-emerald-500"
                : "bg-rose-600 text-white border-rose-500"
            }`}
          >
            {result.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="text-xs font-semibold">{result.message}</span>
            <button className="ml-2 p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer" onClick={() => setResult(null)} type="button">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Dock */}
      <div
        ref={actionBarRef}
        className="fixed bottom-6 right-6 z-50 pointer-events-auto"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-all">
          {dirty ? (
            <div className="flex items-center gap-2 pl-1 pr-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-xs font-semibold text-slate-700">
                Unsaved changes
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-1 pr-1.5 text-slate-400">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs font-medium text-slate-500">
                All saved
              </span>
            </div>
          )}

          <div className="h-4 w-px bg-slate-200" />

          <button
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            disabled={isSaving || !dirty}
            onClick={onDiscard}
            type="button"
          >
            Discard
          </button>

          <button
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              !dirty || isSaving
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/15"
            }`}
            disabled={!dirty || isSaving}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>{isSaving ? "Saving..." : saveLabel}</span>
          </button>
        </div>
      </div>
    </>
  );
}
