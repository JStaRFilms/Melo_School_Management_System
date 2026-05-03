"use client";

import { Loader2 } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";
import { useCallback,useState } from "react";

interface AdminSaveActionBarProps {
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  errorCount: number;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  dirtyCount: number;
  isEditingLocked?: boolean;
  lockMessage?: string;
}

export function AdminSaveActionBar({
  hasUnsavedChanges,
  hasValidationErrors,
  errorCount,
  onSave,
  onCancel,
  dirtyCount,
  isEditingLocked = false,

}: AdminSaveActionBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const isHandledSaveError = (error: unknown): error is { toastHandled: true } =>
    typeof error === "object" &&
    error !== null &&
    (error as { toastHandled?: unknown }).toastHandled === true;

  const handleSave = useCallback(async () => {
    if (isEditingLocked || !hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    try {
      await onSave();
      appToast.success("Results saved", {
        id: "admin-results-entry-save-result",
        description: `${dirtyCount} student record${dirtyCount === 1 ? "" : "s"} saved successfully.`,
      });
    } catch (err) {
      if (!isHandledSaveError(err)) {
        appToast.error("Unable to save results", {
          id: "admin-results-entry-save-result",
          description: getErrorMessage(err, "Save failed."),
        });
      }
    } finally {
      setIsSaving(false);
    }
  }, [dirtyCount, hasUnsavedChanges, isEditingLocked, isSaving, onSave]);

  const isDisabled = isEditingLocked || !hasUnsavedChanges || isSaving;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Action Bar Content */}
      <div className="flex flex-col sm:flex-row items-center justify-between w-full h-auto py-2 px-1">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          {hasUnsavedChanges ? (
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                 <span className="text-[10px] font-black text-slate-950 uppercase tracking-[0.15em] leading-none whitespace-nowrap">
                   MODIFICATIONS PENDING
                 </span>
              </div>
               <p className="hidden sm:block mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
                 {dirtyCount} local modification{dirtyCount !== 1 ? "s" : ""} pending commit
               </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-40">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               <span className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em]">Synced</span>
            </div>
          )}

          {hasUnsavedChanges && (
            <div className="sm:hidden ml-auto">
              <button
                onClick={onCancel}
                disabled={isSaving}
                className="h-8 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 active:bg-slate-200 transition-all"
              >
                Discard
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 sm:mt-0 flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onCancel}
            disabled={isSaving || !hasUnsavedChanges}
            className="hidden sm:block h-10 px-6 rounded-md text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200 transition-all disabled:opacity-0 disabled:pointer-events-none"
          >
            Discard
          </button>
          
          <button
            onClick={handleSave}
            disabled={isDisabled}
            className={`flex-1 sm:flex-none justify-center h-10 sm:h-10 px-8 rounded-xl sm:rounded-md font-black text-[11px] uppercase tracking-[0.15em] transition-all flex items-center gap-2 shadow-xl shadow-slate-950/10 active:scale-95 ${
              hasUnsavedChanges 
                ? "bg-slate-950 text-white hover:bg-slate-800" 
                : "bg-slate-100 text-slate-400 pointer-events-none opacity-50"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>SAVING...</span>
              </>
            ) : (
              <>
                {isEditingLocked ? "LOCKED" : hasValidationErrors ? "FIX SCORES" : "COMMIT BATCH"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
