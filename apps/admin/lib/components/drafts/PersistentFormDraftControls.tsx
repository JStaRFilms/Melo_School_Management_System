"use client";

import {
  DraftRecoveryModal,
  DraftStatusIndicator,
} from "@school/shared/drafts";
import type { PersistentFormDraftController } from "@/usePersistentFormDraft";
import { Info } from "lucide-react";

interface PersistentFormDraftControlsProps {
  draft: PersistentFormDraftController;
  formTitle: string;
  isDirty: boolean;
  excludedFieldsNotice?: string;
  onDiscard: () => Promise<void>;
  /** "compact" renders a clean inline draft indicator without manual save buttons */
  variant?: "default" | "compact";
  /** When true (default), healthy saved/saving states stay invisible to eliminate layout shift and visual noise */
  silentOnSuccess?: boolean;
  className?: string;
}

export function PersistentFormDraftControls({
  draft,
  formTitle,
  isDirty,
  excludedFieldsNotice,
  onDiscard,
  variant = "default",
  silentOnSuccess = true,
  className = "",
}: PersistentFormDraftControlsProps) {
  const memoryPayload = draft.memoryDraft?.payload;
  const memoryPreview =
    typeof memoryPayload === "object" && memoryPayload !== null && !Array.isArray(memoryPayload)
      ? (memoryPayload as Record<string, unknown>)
      : undefined;

  const renderNoticeTooltip = () => {
    if (!excludedFieldsNotice) return null;
    return (
      <div className="group relative inline-flex items-center">
        <span
          tabIndex={0}
          role="button"
          aria-label="Draft policy info"
          className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 focus:text-slate-600 cursor-help p-0.5 rounded transition"
        >
          <Info className="h-3 w-3" />
        </span>
        <div className="pointer-events-none absolute right-0 top-full mt-1.5 hidden group-hover:block group-focus:block group-focus-within:block z-30 w-64 rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-[11px] leading-relaxed font-normal text-slate-100 shadow-xl whitespace-normal">
          {excludedFieldsNotice}
        </div>
      </div>
    );
  };

  const hasIssue =
    draft.status === "connection_lost" ||
    draft.status === "save_failed" ||
    draft.status === "conflict" ||
    draft.status === "expired" ||
    draft.status === "reauth_required";

  const showManualSave = variant === "default" && isDirty && draft.status !== "saving";
  const shouldRenderIndicator =
    hasIssue || (!silentOnSuccess && draft.status !== "idle") || showManualSave;

  return (
    <>
      {shouldRenderIndicator && (
        <div className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
          {showManualSave && (
            <button
              type="button"
              onClick={() => void draft.retrySave().catch(() => {})}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer whitespace-nowrap"
            >
              Save draft
            </button>
          )}

          {(draft.status === "conflict" || draft.status === "expired") && (
            <button
              type="button"
              onClick={draft.previewLatest}
              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer whitespace-nowrap"
            >
              Preview draft
            </button>
          )}

          <DraftStatusIndicator
            status={draft.status}
            lastSavedAt={draft.lastSavedAt}
            silentOnSuccess={silentOnSuccess}
            onRetry={() => void draft.retrySave().catch(() => {})}
            className="whitespace-nowrap shrink-0 [&_div]:whitespace-nowrap [&_div]:text-[10px] [&_div]:py-0.5 [&_div]:px-2.5 [&_div]:leading-tight [&_div.absolute]:right-0 [&_div.absolute]:left-auto"
          />

          {draft.status !== "connection_lost" && renderNoticeTooltip()}
        </div>
      )}

      {draft.serverDraft && (
        <DraftRecoveryModal
          isOpen={!draft.memoryDraft && draft.showRecoveryModal}
          formTitle={formTitle}
          lastSavedAt={draft.serverDraft.lastSavedAt}
          payload={draft.serverDraft.payload}
          onResume={draft.handleResumeDraft}
          onDiscard={onDiscard}
          onStay={draft.dismissRecoveryModal}
          excludedFieldsNotice={excludedFieldsNotice}
        />
      )}
      {draft.memoryDraft && (
        <DraftRecoveryModal
          isOpen
          formTitle={formTitle}
          subjectName="Unsaved session edits"
          lastSavedAt={draft.memoryDraft.capturedAt}
          payload={memoryPreview}
          onResume={draft.resumeMemoryDraft}
          onDiscard={draft.discardMemoryDraft}
          onStay={draft.dismissRecoveryModal}
          excludedFieldsNotice={excludedFieldsNotice}
        />
      )}
    </>
  );
}
