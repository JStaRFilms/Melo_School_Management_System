"use client";

import { useCallback, useState } from "react";
import { appToast, getErrorMessage } from "../toast/index";

export interface SaveActionMessages {
  toastId: string;
  errorTitle: string;
}

/**
 * Shared save-action state machine (consolidation P21). Owns the isSaving
 * lifecycle, the locked/clean re-entry guard, and toast reporting. Copy and
 * titles stay with each caller through messages.
 */
export function useSaveAction({
  hasUnsavedChanges,
  isEditingLocked,
  dirtyCount,
  onSave,
  messages,
}: {
  hasUnsavedChanges: boolean;
  isEditingLocked: boolean;
  dirtyCount: number;
  onSave: () => Promise<unknown>;
  messages: SaveActionMessages;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (isEditingLocked || !hasUnsavedChanges || isSaving) return;

    setIsSaving(true);
    try {
      await onSave();
      appToast.success("Results saved", {
        id: messages.toastId,
        description: `${dirtyCount} student record${dirtyCount === 1 ? "" : "s"} saved successfully.`,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        (error as { toastHandled?: unknown }).toastHandled === true
      ) {
        return;
      }
      appToast.error(messages.errorTitle, {
        id: messages.toastId,
        description: getErrorMessage(error, "Save failed."),
      });
    } finally {
      setIsSaving(false);
    }
  }, [dirtyCount, hasUnsavedChanges, isEditingLocked, isSaving, onSave, messages]);

  return { isSaving, handleSave };
}
