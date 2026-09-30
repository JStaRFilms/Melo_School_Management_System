"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";

type Quote = { attemptId: Id<"usageOperationAttempts">; estimate: number; modelProfile: string; expiresAt: number; status: string; availableUnits: number; remainingAfterHold: number };
type Pending = { quote: Quote; sourceCount: number; output: string; resolve: (id: Id<"usageOperationAttempts">) => void; reject: (reason: Error) => void };

export function useAiSpendReview(formKey: string) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Id<"usageOperationAttempts"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const recover = useAction(api.functions.academic.documentGeneration.recoverTeacherGenerationDraft);
  const confirm = useMutation(api.functions.academic.aiSpend.confirm);
  const cancel = useMutation(api.functions.academic.aiSpend.cancel);
  const status = useQuery(api.functions.academic.aiSpend.status, lastAttempt ? { attemptId: lastAttempt } : "skip");
  // Form edits invalidate the review, including a profile change made while the dialog is open.
  useEffect(() => {
    if (!pending) return;
    pending.reject(new Error("The form changed. Review a new quote."));
    void cancel({ attemptId: pending.quote.attemptId }).catch(() => {});
    setPending(null);
    // Only edits, not a newly returned quote, invalidate this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);
  function review(quote: Quote, output: string, sourceCount: number): Promise<Id<"usageOperationAttempts">> {
    if (pending) return Promise.reject(new Error("Finish or cancel the current quote first."));
    setMessage("");
    setLastAttempt(quote.attemptId);
    return new Promise((resolve, reject) => setPending({ quote, output, sourceCount, resolve, reject }));
  }
  async function approve() {
    if (!pending || busy) return;
    setBusy(true);
    try {
      await confirm({ attemptId: pending.quote.attemptId, expectedUnits: pending.quote.estimate, confirmation: "CONFIRM" });
      pending.resolve(pending.quote.attemptId);
      setPending(null);
      setMessage("Reserved. Generating once; check status if the connection drops.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Confirmation failed.");
    } finally { setBusy(false); }
  }
  async function dismiss() {
    if (!pending || busy) return;
    setBusy(true);
    try { await cancel({ attemptId: pending.quote.attemptId }); pending.reject(new Error("Generation cancelled before dispatch.")); setPending(null); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Cancellation failed. Check the attempt status."); }
    finally { setBusy(false); }
  }
  const reviewDialog = <>
    {pending && <div role="dialog" aria-modal="true" aria-label="Review AI generation allowance" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-6 text-slate-900 shadow-xl">
        <h2 className="text-lg font-semibold">Review AI generation</h2>
        <p>{pending.output} from {pending.sourceCount} selected source{pending.sourceCount === 1 ? "" : "s"}.</p>
        <p>Model: {pending.quote.modelProfile}. Reviewed hold: {pending.quote.estimate.toLocaleString()} ai_tokens. Available now: {pending.quote.availableUnits.toLocaleString()}; expected after confirmation: {pending.quote.remainingAfterHold.toLocaleString()}. The balance can change before confirmation. Unused hold returns after measured settlement. Actual provider usage can exceed the hold and will block new AI work for review. This is not a money charge.</p>
        <p>Quote expires at {new Date(pending.quote.expiresAt).toLocaleTimeString()}. One confirmed call will run. If usage is uncertain, Platform must review it before the hold can be released.</p>
        <div className="flex gap-3"><button type="button" disabled={busy} onClick={() => void approve()} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">Confirm and generate</button>
          <button type="button" disabled={busy} onClick={() => void dismiss()} className="rounded border px-4 py-2">Cancel</button></div>
        <p role="alert">{message}</p>
      </div>
    </div>}
    {lastAttempt && !pending && <p role="status" className="px-4 py-2 text-xs text-slate-700">AI attempt: {status?.status ?? "checking"}. Reviewed hold {status?.estimate?.toLocaleString() ?? "…"} ai_tokens{status?.actualUnits != null ? `, measured ${status.actualUnits.toLocaleString()} tokens` : ""}{status?.resultId ? `. Draft ${status.resultId}` : ""}. {status?.status === "needs_reconciliation" ? "Platform must reconcile unknown provider usage. If a measured draft was staged, recover it below." : message}{!status?.resultId && (status?.status === "settled" || status?.status === "needs_reconciliation") && <button type="button" className="ml-2 underline" onClick={() => { void recover({ attemptId: lastAttempt }).catch(error => setMessage(error instanceof Error ? error.message : "Recovery unavailable. Contact Platform.")); }}>Recover saved draft without another AI call</button>}</p>}
  </>;
  return { review, reviewDialog };
}
