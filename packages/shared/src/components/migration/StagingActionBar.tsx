import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, ArrowRight, Loader2, ClipboardCheck } from "lucide-react";

export interface StagingActionBarProps {
  status: string;
  totalRecords: number;
  reviewedRecords: number;
  validRecords: number;
  warningRecords: number;
  errorRecords: number;
  isMerging: boolean;
  isApproving: boolean;
  isReopening: boolean;
  onApprovePlan: () => void;
  onCommitMerge: () => void;
  onReopenReview: () => void;
}

export function StagingActionBar({
  status,
  totalRecords,
  reviewedRecords,
  validRecords,
  warningRecords,
  errorRecords,
  isMerging,
  isApproving,
  isReopening,
  onApprovePlan,
  onCommitMerge,
  onReopenReview,
}: StagingActionBarProps) {
  const allReviewed = totalRecords > 0 && reviewedRecords === totalRecords && errorRecords === 0;
  const planReady = status === "ready" || status === "committing";
  const canApprove = allReviewed && !planReady && !isApproving && !isMerging;
  const canCommit = planReady && !isMerging && !isApproving;

  return (
    <div className="sticky bottom-0 z-30 w-full border-t border-slate-200 bg-white/95 px-6 py-4 shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Reviewed plan:</span>
          {errorRecords > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700"><AlertCircle className="h-3.5 w-3.5" />{errorRecords} errors</span>
          ) : warningRecords > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />{warningRecords} pending decisions</span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />No deterministic errors</span>
          )}
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{reviewedRecords} / {totalRecords} explicitly reviewed</span>
          <span className="text-xs text-slate-500">{validRecords} rows currently valid</span>
        </div>
        <div className="flex items-center gap-3">
          {status === "committing" && (
            <button type="button" onClick={onReopenReview} disabled={isMerging || isReopening} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 disabled:opacity-50">
              {isReopening ? "Reopening…" : "Reconcile incomplete rows"}
            </button>
          )}
          <button type="button" onClick={onApprovePlan} disabled={!canApprove} title={!allReviewed ? "Review every row and correct all errors first" : undefined} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            {isApproving ? "Freezing reviewed plan…" : planReady ? "Plan approved" : "Approve reviewed plan"}
          </button>
          <button type="button" onClick={onCommitMerge} disabled={!canCommit} title={!planReady ? "Commit is unavailable until the reviewed plan is approved" : undefined} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">
            {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {isMerging ? "Committing reviewed batch…" : "Commit approved plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
