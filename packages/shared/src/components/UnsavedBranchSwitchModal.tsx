"use client";
import React, { useEffect, useId, useState } from "react";
import { useDialogFocus } from "../drafts/useDialogFocus";

export interface UnsavedBranchSwitchModalProps {
  isOpen: boolean;
  formName: string;
  targetBranchName: string;
  lastSavedText?: string;
  supportsDraftSave?: boolean;
  onStay: () => void;
  onDiscardAndSwitch: () => void | Promise<void>;
  onSaveDraftAndSwitch?: () => Promise<void>;
}
export function UnsavedBranchSwitchModal({ isOpen, formName, targetBranchName, lastSavedText, supportsDraftSave = false, onStay, onDiscardAndSwitch, onSaveDraftAndSwitch }: UnsavedBranchSwitchModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId(); const descriptionId = useId();
  const ref = useDialogFocus(isOpen, onStay);
  useEffect(() => { if (isOpen) { setBusy(false); setError(null); } }, [isOpen]);
  if (!isOpen) return null;
  const run = async (action: () => void | Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); }
    catch { setError("Could not complete the request. Your edits are still here. Stay and retry, or discard when available."); }
    finally { setBusy(false); }
  };
  const button = "min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50 focus-visible:outline focus-visible:outline-2";
  return <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
      <h2 id={titleId} className="font-semibold text-slate-900">Unsaved changes</h2>
      <p id={descriptionId} className="mt-3 text-sm text-slate-700">{formName} has unsaved changes. Save a private draft or discard before leaving for {targetBranchName}.</p>
      {lastSavedText && <p className="mt-2 text-xs">{lastSavedText}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <p role="status" className="text-sm">{busy ? "Please wait. Do not close this tab." : ""}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" data-dialog-initial className={button} onClick={onStay}>Stay here</button>
        {supportsDraftSave && onSaveDraftAndSwitch && <button type="button" disabled={busy} className={button} onClick={() => void run(onSaveDraftAndSwitch)}>Save draft and leave</button>}
        <button type="button" disabled={busy} className={`${button} text-rose-700`} onClick={() => void run(onDiscardAndSwitch)}>Discard and leave</button>
      </div>
    </div>
  </div>;
}
