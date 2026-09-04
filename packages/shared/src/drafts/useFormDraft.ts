"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { DraftStatus, FormDraftSummary } from "./types";

export interface UseFormDraftOptions<T extends Record<string, any>> {
  formKey: string;
  entityId?: string;
  isDirty: boolean;
  currentData: T;
  onSave: (
    payload: T,
    expectedRevision?: number
  ) => Promise<{ revision?: number; lastSavedAt?: number } | void>;
  serverDraft?: FormDraftSummary | null;
  onRestore?: (payload: T) => void;
  onDiscardServerDraft?: () => Promise<void> | void;
  debounceMs?: number; // Default: 1500ms
}

export function isLatestDraftSaveRequest(
  requestSequence: number,
  latestRequestSequence: number
): boolean {
  return requestSequence === latestRequestSequence;
}

export interface UseFormDraftReturn<T> {
  status: DraftStatus;
  lastSavedAt: number | null;
  isOnline: boolean;
  showRecoveryModal: boolean;
  serverDraft: FormDraftSummary | null;
  retrySave: () => void;
  handleResumeDraft: () => void;
  handleDiscardDraft: () => Promise<void>;
  dismissRecoveryModal: () => void;
}

/**
 * useFormDraft manages dirty-state persistence with 1.5s debounced autosave,
 * truthful connectivity reporting (zero false offline claims), and returning user draft recovery.
 */
export function useFormDraft<T extends Record<string, any>>({
  formKey,
  entityId,
  isDirty,
  currentData,
  onSave,
  serverDraft = null,
  onRestore,
  onDiscardServerDraft,
  debounceMs = 1500,
}: UseFormDraftOptions<T>): UseFormDraftReturn<T> {
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [activeServerDraft, setActiveServerDraft] = useState<FormDraftSummary | null>(serverDraft);

  const currentRevisionRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<T>(currentData);
  const isDirtyRef = useRef<boolean>(isDirty);
  const saveRequestSequenceRef = useRef(0);

  latestDataRef.current = currentData;
  isDirtyRef.current = isDirty;

  // Sync server draft to prompt returning user (never silently overwriting)
  useEffect(() => {
    if (serverDraft && !isDirtyRef.current) {
      setActiveServerDraft(serverDraft);
      setShowRecoveryModal(true);
      if (serverDraft.lastSavedAt) {
        setLastSavedAt(
          typeof serverDraft.lastSavedAt === "number"
            ? serverDraft.lastSavedAt
            : new Date(serverDraft.lastSavedAt).getTime()
        );
      }
      if (serverDraft.revision) {
        currentRevisionRef.current = serverDraft.revision;
      }
    }
  }, [serverDraft]);

  // Online / Offline listener enforcing Zero False Offline Claims
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      if (status === "connection_lost") {
        if (isDirtyRef.current) {
          triggerSave();
        } else {
          setStatus("idle");
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (isDirtyRef.current || status === "saving") {
        setStatus("connection_lost");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [status]);

  // Execute save logic
  const triggerSave = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("connection_lost");
      return;
    }

    const requestSequence = ++saveRequestSequenceRef.current;
    const payload = latestDataRef.current;
    const expectedRevision = currentRevisionRef.current;

    setStatus("saving");
    try {
      const result = await onSave(payload, expectedRevision);
      if (!isLatestDraftSaveRequest(requestSequence, saveRequestSequenceRef.current)) {
        return;
      }

      const savedTime = result?.lastSavedAt ?? Date.now();
      if (result?.revision !== undefined) {
        currentRevisionRef.current = result.revision;
      }

      setLastSavedAt(savedTime);
      setStatus("saved");
    } catch (err: unknown) {
      if (!isLatestDraftSaveRequest(requestSequence, saveRequestSequenceRef.current)) {
        return;
      }
      const error = err instanceof Error ? err : null;
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: unknown }).code
          : undefined;
      if (errorCode === "CONFLICT" || error?.message.includes("Conflict")) {
        setStatus("conflict");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("connection_lost");
      } else {
        setStatus("save_failed");
      }
    }
  }, [onSave]);

  // Debounced autosave watcher
  useEffect(() => {
    if (!isDirty) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("connection_lost");
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      triggerSave();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentData, isDirty, debounceMs, triggerSave]);

  const retrySave = useCallback(() => {
    triggerSave();
  }, [triggerSave]);

  const handleResumeDraft = useCallback(() => {
    if (activeServerDraft?.payload && onRestore) {
      onRestore(activeServerDraft.payload as T);
    }
    setShowRecoveryModal(false);
    setStatus("saved");
  }, [activeServerDraft, onRestore]);

  const handleDiscardDraft = useCallback(async () => {
    if (onDiscardServerDraft) {
      await onDiscardServerDraft();
    }
    setActiveServerDraft(null);
    setShowRecoveryModal(false);
    setStatus("idle");
  }, [onDiscardServerDraft]);

  const dismissRecoveryModal = useCallback(() => {
    setShowRecoveryModal(false);
  }, []);

  return {
    status,
    lastSavedAt,
    isOnline,
    showRecoveryModal,
    serverDraft: activeServerDraft,
    retrySave,
    handleResumeDraft,
    handleDiscardDraft,
    dismissRecoveryModal,
  };
}
