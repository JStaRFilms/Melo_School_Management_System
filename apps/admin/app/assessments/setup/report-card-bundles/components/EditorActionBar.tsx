"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import { Loader2, UploadCloud, X, CheckCircle2, AlertCircle } from "lucide-react";

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
        <div className="fixed right-6 z-[100] animate-in slide-in-from-right-4 duration-500" style={{ bottom: `${actionBarHeight + 16}px` }}>
          <div
            className={`flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border ${
              result.success
                ? "bg-emerald-500/90 border-emerald-400 text-white"
                : "bg-rose-500/90 border-rose-400 text-white"
            }`}
          >
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest opacity-60">Status Message</span>
              <span className="text-sm font-bold">{result.message}</span>
            </div>
            <button className="ml-2 p-1 hover:bg-white/10 rounded-lg" onClick={() => setResult(null)} type="button">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={actionBarRef}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 lg:p-6 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent pointer-events-none"
      >
        <div className="mx-auto max-w-[1500px] w-full flex items-center justify-between lg:justify-end gap-4 pointer-events-auto">
          {dirty && (
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Uncommitted Changes</span>
            </div>
          )}

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              className="flex-1 lg:flex-none h-12 px-6 text-xs font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-0 pointer-events-auto"
              disabled={isSaving || !dirty}
              onClick={onDiscard}
              type="button"
            >
              Discard
            </button>
            <button
              className={`flex-1 lg:flex-none h-12 min-w-[180px] flex items-center justify-center gap-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 ${
                !dirty || isSaving
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800"
              }`}
              disabled={!dirty || isSaving}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin opacity-40" /> : <UploadCloud className={`w-4 h-4 ${dirty ? "text-emerald-400" : "opacity-20"}`} />}
              {isSaving ? "Processing..." : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
