"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DraftStatus, FormDraftSummary } from "./types";
import { useDraftMemory } from "./DraftMemory";

export interface DraftConnection {
  /** Convex connectionState().isWebSocketConnected, not navigator.onLine. */
  connected: boolean;
  authenticated: boolean;
  /** Stable authenticated account ID. Never derive identity from a draft. */
  accountId: string | null;
}
export interface UseFormDraftOptions<T> {
  formKey: string;
  entityId?: string;
  contextKey: string;
  accountId: string;
  connection: DraftConnection;
  isDirty: boolean;
  currentData: T;
  parsePayload: (payload: unknown) => T;
  onSave: (payload: T, expectedRevision: number) => Promise<{ revision: number; lastSavedAt: number }>;
  /** undefined means recovery query is still loading. */
  serverDraft: FormDraftSummary | null | undefined;
  onRestore: (payload: T) => void;
  onDiscardServerDraft: (expectedRevision: number) => Promise<void>;
  onCommitServerDraft?: (expectedRevision: number) => Promise<void>;
  debounceMs?: number;
  /** Change only after this instance has been submitted/discarded to start a fresh draft in the same mounted form. */
  instanceKey?: string | number;
}
export function isLatestDraftSaveRequest(request: number, latest: number) { return request === latest; }
function errorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  if ("data" in error) return errorCode(error.data);
  return "code" in error ? error.code : undefined;
}
export function useFormDraft<T>(options: UseFormDraftOptions<T>) {
  const memory = useDraftMemory();
  const memoryKey = JSON.stringify([options.accountId, options.contextKey, options.formKey, options.entityId, options.instanceKey ?? 0]);
  const [memoryDraft, setMemoryDraft] = useState(() => {
    const found = memory?.get(memoryKey);
    return found && Date.now() - found.capturedAt < 30 * 60 * 1000 ? found : null;
  });
  const latest = useRef(options);
  latest.current = options;
  const initialContext = useRef(options.contextKey);
  const initialAccount = useRef(options.accountId);
  const initialInstance = useRef(options.instanceKey ?? 0);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const statusRef = useRef<DraftStatus>("idle");
  const updateStatus = (value: DraftStatus) => { statusRef.current = value; setStatus(value); };
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [activeServerDraft, setActiveServerDraft] = useState<FormDraftSummary | null>(null);
  const revision = useRef(0);
  const accepted = useRef(false);
  const closed = useRef(false);
  const finishing = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const savedData = useRef<T | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pause = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    const nextInstance = options.instanceKey ?? 0;
    if (nextInstance === initialInstance.current) return;
    if (inFlight.current || finishing.current) return;
    clearTimeout(timer.current);
    initialInstance.current = nextInstance;
    initialContext.current = options.contextKey;
    initialAccount.current = options.accountId;
    revision.current = 0;
    accepted.current = false;
    closed.current = false;
    pause.current = false;
    savedData.current = undefined;
    setMemoryDraft(null);
    setActiveServerDraft(null);
    setShowRecoveryModal(false);
    setLastSavedAt(null);
    updateStatus("idle");
  }, [options.instanceKey, options.contextKey, options.accountId]);
  useEffect(() => {
    if (!options.isDirty || closed.current || options.accountId !== initialAccount.current || options.contextKey !== initialContext.current || (options.instanceKey ?? 0) !== initialInstance.current || options.connection.accountId !== options.accountId) return;
    // Only the approved projection reaches the recovery cache. Invalid state stays in its form.
    try { memory?.set(memoryKey, { payload: options.parsePayload(options.currentData), revision: revision.current, capturedAt: Date.now() }); } catch { /* no unreviewed memory recovery */ }
  }, [memory, memoryKey, options.currentData, options.isDirty, options.parsePayload, options.accountId, options.contextKey, options.instanceKey, options.connection.accountId]);

  useEffect(() => {
    if (!accepted.current && options.serverDraft && options.accountId === initialAccount.current && options.contextKey === initialContext.current && (options.instanceKey ?? 0) === initialInstance.current) {
      setActiveServerDraft(options.serverDraft);
      setShowRecoveryModal(true);
    }
  }, [options.serverDraft, options.accountId, options.contextKey, options.instanceKey]);
  const sameContext = options.accountId === initialAccount.current && options.contextKey === initialContext.current && (options.instanceKey ?? 0) === initialInstance.current && options.connection.accountId === initialAccount.current;
  const available = options.connection.connected && options.connection.authenticated && sameContext;
  useEffect(() => {
    if (!available) {
      pause.current = true;
      updateStatus(options.connection.authenticated ? "connection_lost" : "reauth_required");
    }
    // A reconnect requires an explicit retry/recovery decision, never an automatic stale write.
  }, [available, options.connection.authenticated]);

  const retrySave = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    while (inFlight.current) { await inFlight.current; }
    const o = latest.current;
    if (closed.current || finishing.current) throw new Error("This draft instance is closed.");
    if (!o.connection.connected || !o.connection.authenticated || o.connection.accountId !== initialAccount.current || o.accountId !== initialAccount.current || o.contextKey !== initialContext.current || (o.instanceKey ?? 0) !== initialInstance.current) {
      updateStatus(o.connection.authenticated ? "connection_lost" : "reauth_required");
      throw new Error("Reconnect and sign in to the same account before saving. Edits remain in memory.");
    }
    if (o.serverDraft === undefined || (!accepted.current && o.serverDraft) || memoryDraft) throw new Error("Resolve draft recovery before saving.");
    if (statusRef.current === "conflict") throw new Error("Preview and load the latest draft before saving. Your current edits have not been overwritten.");
    if (savedData.current === o.currentData) return;
    const payload = o.parsePayload(o.currentData);
    accepted.current = true; // Subsequent reactive echoes belong to this editing instance, not recovery.
    const snapshot = o.currentData;
    updateStatus("saving");
    const operation = (async () => {
      try {
        const result = await o.onSave(payload, revision.current);
        revision.current = result.revision;
        savedData.current = snapshot;
        if (latest.current.currentData === snapshot) memory?.delete(memoryKey);
        else {
          const buffered = memory?.get(memoryKey);
          if (buffered) memory?.set(memoryKey, { ...buffered, revision: result.revision });
        }
        if (mounted.current) {
          setLastSavedAt(result.lastSavedAt);
          const now = latest.current;
          updateStatus(!now.connection.authenticated ? "reauth_required" : !now.connection.connected || now.connection.accountId !== now.accountId ? "connection_lost" : now.currentData === snapshot ? "saved" : "idle");
        }
        pause.current = false;
      } catch (error) {
        const code = errorCode(error);
        updateStatus(code === "CONFLICT" || code === "RECOVERY_REQUIRED" ? "conflict" : code === "EXPIRED" || code === "CLOSED" ? "expired" : !latest.current.connection.authenticated ? "reauth_required" : !latest.current.connection.connected ? "connection_lost" : "save_failed");
        pause.current = true;
        throw error;
      }
    })();
    inFlight.current = operation;
    try { await operation; } finally { if (inFlight.current === operation) inFlight.current = null; }
    // Save-and-leave must include edits made while the previous request was in flight.
    if (latest.current.currentData !== snapshot) await retrySave();
  }, [memoryDraft, memory, memoryKey]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!options.isDirty || memoryDraft || !available || closed.current || finishing.current || pause.current || options.serverDraft === undefined || (!accepted.current && options.serverDraft)) return;
    if (savedData.current === options.currentData) return;
    updateStatus("idle");
    timer.current = setTimeout(() => { void retrySave().catch(() => {}); }, Math.max(1000, Math.min(2000, options.debounceMs ?? 1500)));
    return () => clearTimeout(timer.current);
  }, [options.currentData, options.isDirty, options.serverDraft, options.debounceMs, available, retrySave, memoryDraft]);

  const handleResumeDraft = useCallback(() => {
    const draft = activeServerDraft;
    const o = latest.current;
    if (!draft || !o.connection.authenticated || o.connection.accountId !== initialAccount.current || o.accountId !== initialAccount.current || o.contextKey !== initialContext.current || (o.instanceKey ?? 0) !== initialInstance.current || draft.formKey !== o.formKey || draft.entityId !== o.entityId) return;
    if (draft.expiresAt && draft.expiresAt <= Date.now()) { updateStatus("expired"); return; }
    const restored = o.parsePayload(draft.payload);
    o.onRestore(restored);
    revision.current = draft.revision ?? 0;
    accepted.current = true;
    pause.current = false;
    savedData.current = restored;
    setLastSavedAt(new Date(draft.lastSavedAt).getTime());
    setShowRecoveryModal(false);
    updateStatus("saved");
  }, [activeServerDraft]);
  const finish = useCallback(async (kind: "discard" | "commit") => {
    clearTimeout(timer.current);
    finishing.current = true;
    try {
      if (inFlight.current) await inFlight.current;
      const o = latest.current;
      if (!o.connection.connected || !o.connection.authenticated || o.connection.accountId !== initialAccount.current || o.accountId !== initialAccount.current || o.contextKey !== initialContext.current || (o.instanceKey ?? 0) !== initialInstance.current) throw new Error("Reconnect before closing the draft.");
      const rev = !accepted.current && o.serverDraft ? o.serverDraft.revision ?? 0 : revision.current;
      if (kind === "discard") await o.onDiscardServerDraft(rev);
      else {
        if (!o.onCommitServerDraft) throw new Error("Submission must close the draft in its domain transaction.");
        await o.onCommitServerDraft(rev);
      }
      closed.current = true;
      memory?.delete(memoryKey);
      setMemoryDraft(null);
      setActiveServerDraft(null);
      setShowRecoveryModal(false);
      updateStatus("idle");
    } catch (error) {
      const code = errorCode(error);
      updateStatus(code === "CONFLICT" ? "conflict" : code === "EXPIRED" || code === "CLOSED" ? "expired" : "save_failed");
      pause.current = true;
      throw error;
    } finally { finishing.current = false; }
  }, [memory, memoryKey]);
  return {
    memoryDraft: sameContext ? memoryDraft : null,
    resumeMemoryDraft: () => {
      if (!memoryDraft || !sameContext || !latest.current.connection.authenticated) return;
      options.onRestore(options.parsePayload(memoryDraft.payload));
      revision.current = memoryDraft.revision;
      accepted.current = true;
      setMemoryDraft(null);
      updateStatus("idle");
      pause.current = true; // Compare latest server state or explicitly retry; revision check remains mandatory.
    },
    discardMemoryDraft: () => { memory?.delete(memoryKey); setMemoryDraft(null); },
    status, lastSavedAt, isOnline: available, showRecoveryModal: sameContext && showRecoveryModal, serverDraft: sameContext ? activeServerDraft : null,
    retrySave, handleResumeDraft,
    handleDiscardDraft: () => finish("discard"),
    handleCommitDraft: () => finish("commit"),
    /** Freeze autosave before domain submission; use revision in its atomic finish helper. */
    prepareSubmission: async () => { await retrySave(); finishing.current = true; return revision.current; },
    submissionFailed: () => { finishing.current = false; },
    submissionSucceeded: () => { memory?.delete(memoryKey); setMemoryDraft(null); closed.current = true; finishing.current = false; clearTimeout(timer.current); updateStatus("idle"); },
    previewLatest: () => { setActiveServerDraft(latest.current.serverDraft ?? null); setShowRecoveryModal(true); },
    dismissRecoveryModal: () => setShowRecoveryModal(false),
  };
}
