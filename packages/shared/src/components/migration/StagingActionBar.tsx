import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Sparkles, ArrowRight, Loader2 } from "lucide-react";

export interface StagingActionBarProps {
  totalRecords: number;
  validRecords: number;
  warningRecords: number;
  errorRecords: number;
  isMerging: boolean;
  isGeneratingAdm: boolean;
  onAutoGenerateAdmission: () => void;
  onCommitMerge: () => void;
}

export function StagingActionBar({
  totalRecords,
  validRecords,
  warningRecords,
  errorRecords,
  isMerging,
  isGeneratingAdm,
  onAutoGenerateAdmission,
  onCommitMerge,
}: StagingActionBarProps) {
  const canCommit = totalRecords > 0 && errorRecords === 0 && warningRecords === 0 && !isMerging;

  const disabledReason = isMerging
    ? "Commit currently in progress..."
    : totalRecords === 0
    ? "No staged records to commit"
    : errorRecords > 0
    ? `Resolve ${errorRecords} blocking ${errorRecords === 1 ? "error" : "errors"} before committing`
    : warningRecords > 0
    ? `Resolve ${warningRecords} clash ${warningRecords === 1 ? "warning" : "warnings"} before committing`
    : undefined;

  return (
    <div className="sticky bottom-0 z-30 w-full border-t border-slate-200 bg-white/95 backdrop-blur-md px-6 py-4 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        {/* Live Counter Badges */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Workspace Status:
          </span>

          {errorRecords > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200/80 px-3 py-1 text-xs font-bold text-rose-700">
              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
              <span>{errorRecords} Blocking {errorRecords === 1 ? "Error" : "Errors"}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span>0 Errors</span>
            </div>
          )}

          {warningRecords > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-3 py-1 text-xs font-bold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span>{warningRecords} Unresolved {warningRecords === 1 ? "Warning" : "Warnings"}</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200/80 px-3 py-1 text-xs font-bold text-slate-700">
            <span>{validRecords} / {totalRecords} Records Ready</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {disabledReason && !isMerging && (
            <span className="text-xs font-medium text-amber-700 hidden lg:inline-block">
              {disabledReason}
            </span>
          )}

          <button
            type="button"
            onClick={onAutoGenerateAdmission}
            disabled={isGeneratingAdm || totalRecords === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            title="Sequentially assign admission numbers to all students missing one"
          >
            {isGeneratingAdm ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span>Auto-Generate Missing IDs</span>
          </button>

          <button
            type="button"
            onClick={onCommitMerge}
            disabled={!canCommit}
            title={disabledReason}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold shadow-xs transition-all ${
              canCommit
                ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Committing to School DB...</span>
              </>
            ) : (
              <>
                <span>Commit & Merge {validRecords} Records</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
