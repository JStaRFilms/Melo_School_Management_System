"use client";

import { Save, Loader2, CheckCircle2, AlertTriangle, X, RotateCcw } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/utils";
import { getUserFacingErrorMessage } from "@school/shared";

interface TemplateActionBarProps {
  dirty: boolean;
  validationIssue: string | null;
  saveLabel: string;
  successLabel: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

export function TemplateActionBar({
  dirty,
  validationIssue,
  saveLabel,
  successLabel,
  onSave,
  onDiscard,
}: TemplateActionBarProps) {
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
    if (!dirty || validationIssue) return;
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
  }, [dirty, onSave, successLabel, validationIssue]);

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
        className="fixed bottom-0 right-0 z-50 w-full border-t border-slate-200/60 bg-white/80 p-3 lg:p-4 backdrop-blur-xl lg:w-[calc(100%-400px)] transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        <div className="mx-auto flex max-w-[1150px] items-center justify-between gap-2 lg:gap-4">
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-2 rounded-lg px-2 lg:px-3 py-1.5", dirty ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
              <div className={cn("h-1.5 w-1.5 rounded-full", dirty ? "bg-amber-400" : "bg-emerald-500")} />
              <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                {dirty ? (
                  <span className="hidden sm:inline">Unsaved Changes</span>
                ) : (
                  <span className="hidden sm:inline">Everything Saved</span>
                )}
                {dirty ? (
                  <span className="sm:hidden">Unsaved</span>
                ) : (
                  <span className="sm:hidden">Saved</span>
                )}
              </span>
            </div>
            {validationIssue && (
              <span className="text-[9px] lg:text-[10px] font-bold text-rose-500 truncate max-w-[100px] lg:max-w-none">{validationIssue}</span>
            )}
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <button
              disabled={isSaving || !dirty}
              onClick={onDiscard}
              className="flex h-9 lg:h-10 items-center gap-2 rounded-xl px-3 lg:px-4 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Discard</span>
            </button>
            <button
              disabled={!dirty || isSaving || Boolean(validationIssue)}
              onClick={handleSave}
              className={cn(
                "flex h-9 lg:h-10 min-w-[100px] lg:min-w-[160px] items-center justify-center gap-2 rounded-xl px-4 lg:px-6 text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95",
                !dirty || isSaving || validationIssue
                  ? "bg-slate-100 text-slate-300 shadow-none"
                  : "bg-slate-950 text-white shadow-slate-950/10 hover:bg-slate-800"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span className={cn(dirty ? "inline" : "hidden sm:inline")}>{saveLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
