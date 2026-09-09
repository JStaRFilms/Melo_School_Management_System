"use client";

import {
  DraftRecoveryModal,
  DraftStatusIndicator,
} from "@school/shared/drafts";
import type { PersistentFormDraftController } from "@/usePersistentFormDraft";

interface PersistentFormDraftControlsProps {
  draft: PersistentFormDraftController;
  formTitle: string;
  isDirty: boolean;
  excludedFieldsNotice?: string;
  onDiscard: () => Promise<void>;
  /** "compact" renders a clean inline draft indicator without the defensive text box */
  variant?: "default" | "compact";
}

export function PersistentFormDraftControls({
  draft,
  formTitle,
  isDirty,
  excludedFieldsNotice,
  onDiscard,
  variant = "default",
}: PersistentFormDraftControlsProps) {
  const memoryPayload = draft.memoryDraft?.payload;
  const memoryPreview =
    typeof memoryPayload === "object" && memoryPayload !== null && !Array.isArray(memoryPayload)
      ? (memoryPayload as Record<string, unknown>)
      : undefined;

  if (variant === "compact") {
    return (
      <>
        <div className="flex items-center gap-2">
          {(draft.status === "conflict" || draft.status === "expired") && (
            <button
              type="button"
              onClick={draft.previewLatest}
              className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
            >
              Preview latest draft
            </button>
          )}
          <DraftStatusIndicator
            status={draft.status}
            lastSavedAt={draft.lastSavedAt}
            onRetry={() => void draft.retrySave().catch(() => {})}
          />
        </div>

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
            formTitle={`${formTitle} (this tab)`}
            lastSavedAt={draft.memoryDraft.capturedAt}
            payload={memoryPreview}
            onResume={draft.resumeMemoryDraft}
            onDiscard={draft.discardMemoryDraft}
            excludedFieldsNotice={excludedFieldsNotice}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!isDirty || draft.status === "saving"}
          onClick={() => void draft.retrySave().catch(() => {})}
          className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          Save draft
        </button>
        {(draft.status === "conflict" || draft.status === "expired") && (
          <button
            type="button"
            onClick={draft.previewLatest}
            className="min-h-10 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-800"
          >
            Preview latest draft
          </button>
        )}
        <DraftStatusIndicator
          status={draft.status}
          lastSavedAt={draft.lastSavedAt}
          onRetry={() => void draft.retrySave().catch(() => {})}
        />
      </div>
      {excludedFieldsNotice && (
        <p className="text-[11px] leading-relaxed text-slate-600">{excludedFieldsNotice}</p>
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
          formTitle={`${formTitle} (this tab)`}
          lastSavedAt={draft.memoryDraft.capturedAt}
          payload={memoryPreview}
          onResume={draft.resumeMemoryDraft}
          onDiscard={draft.discardMemoryDraft}
          excludedFieldsNotice={excludedFieldsNotice}
        />
      )}
    </div>
  );
}
