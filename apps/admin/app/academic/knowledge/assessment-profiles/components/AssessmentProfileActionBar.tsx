"use client";

import { Save, Loader2, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/utils";
import { getUserFacingErrorMessage } from "@school/shared";

interface AssessmentProfileActionBarProps {
  dirty: boolean;
  saveLabel: string;
  successLabel: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function AssessmentProfileActionBar({
  dirty,
  saveLabel,
  successLabel,
  onSave,
  onDiscard,
}: AssessmentProfileActionBarProps) {
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
    return () => window.removeEventListener("resize", updateHeight);
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
        <div 
          className="fixed right-6 z-[100] animate-in slide-in-from-right-4 duration-500" 
          style={{ bottom: `${actionBarHeight + 16}px` }}
        >
          <div className={cn(
            "flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border",
            result.success ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-rose-500/90 border-rose-400 text-white"
          )}>
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-bold">{result.message}</span>
            <button onClick={() => setResult(null)} className="ml-2 p-1 hover:bg-white/10 rounded-lg">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={actionBarRef}
        className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent pointer-events-none"
      >
        <div className="mx-auto max-w-[1500px] flex items-center justify-end gap-4 pointer-events-auto">
          {dirty && (
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl animate-in fade-in slide-in-from-bottom-2">
              <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Unsaved Draft</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              disabled={isSaving || !dirty}
              onClick={onDiscard}
              className="h-11 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-0"
            >
              Discard Changes
            </button>
            <button
              disabled={!dirty || isSaving}
              onClick={handleSave}
              className={cn(
                "flex h-11 min-w-[180px] items-center justify-center gap-3 rounded-xl px-8 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95",
                !dirty || isSaving
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-slate-950 text-white shadow-slate-950/20 hover:bg-slate-800"
              )}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving..." : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
