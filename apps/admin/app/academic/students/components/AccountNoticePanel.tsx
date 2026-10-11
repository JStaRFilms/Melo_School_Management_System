"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getUserFacingErrorMessage } from "@school/shared";
import { QueryErrorBoundary } from "./QueryErrorBoundary";

const noticeLabels = {
  pending: "Notice queued",
  sending: "Notice submission in progress",
  accepted: "Email provider accepted the notice. Delivery is not confirmed.",
  failed: "Notice submission failed. Account credentials are unchanged.",
  not_configured: "Notice email is not configured. Account credentials are unchanged.",
  suppressed: "Notice suppressed by the five-minute recipient cooldown. Account credentials are unchanged.",
  ineligible: "No eligible notice recipient. Account credentials are unchanged.",
  reconciliation_required: "Notice needs operator review. Account credentials are unchanged.",
};

export function AccountNoticePanel({ userId }: { userId: Id<"users"> }) {
  return <QueryErrorBoundary message="Could not check the account notice. Credential status is separate."><NoticeContent key={userId} userId={userId} /></QueryErrorBoundary>;
}

function NoticeContent({ userId }: { userId: Id<"users"> }) {
  const state = useQuery(api.functions.academic.accountNotices.getAccountNoticeState, { userId });
  const enqueue = useMutation(api.functions.academic.accountNotices.enqueueAccountNotice);
  const retry = useMutation(api.functions.academic.accountNotices.retryAccountNotice);
  const [guardianUserId, setGuardianUserId] = useState<Id<"users"> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (!state?.operationId || !state.linked || pending || state.student && !state.notice && !guardianUserId) return;
    setPending(true); setError("");
    try {
      if (state.notice) await retry({ outboxId: state.notice.id });
      else await enqueue({ userId, operationId: state.operationId, ...(state.student && guardianUserId ? { guardianUserId } : {}) });
    } catch (failure) { setError(getUserFacingErrorMessage(failure, "Could not queue the account notice. Credentials remain available.")); }
    finally { setPending(false); }
  };
  if (!state) return <p role="status" className="text-xs text-slate-500">Checking account notice...</p>;
  if (!state.operationId) return <p className="text-xs text-slate-500">No notice operation recorded. Login IDs are not treated as inboxes.</p>;
  const canRetry = state.linked && state.notice && ["failed", "not_configured", "suppressed"].includes(state.notice.state) && state.notice.attemptCount < 5;
  const canQueue = state.linked && !state.notice && (state.student ? state.guardians.some(parent => parent.userId === guardianUserId) : Boolean(state.ownRecipient));
  return <div className="space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600" aria-label="Account notice">
    <p role="status">{state.notice ? noticeLabels[state.notice.state] : "Account committed. No notice queued."}</p>
    {!state.linked && <p>Notice unavailable: account linkage needs review. Credentials are unchanged.</p>}
    {state.notice?.recipientEmail && <p>Notice recipient: {state.notice.recipientEmail}</p>}
    {!state.notice && state.student && <label className="block">Notify a linked parent or guardian
      <select className="mt-1 block h-9 w-full rounded-lg border border-slate-200 bg-white px-2" value={guardianUserId ?? ""} onChange={event => setGuardianUserId(state.guardians.find(parent => parent.userId === event.target.value)?.userId ?? null)}>
        <option value="">Select an authorized recipient</option>
        {state.guardians.map(parent => <option key={parent.userId} value={parent.userId}>{parent.name} · {parent.email}</option>)}
      </select>
    </label>}
    {!state.notice && state.student && state.guardians.length === 0 && <p>No linked parent or guardian has an eligible address. The student login ID cannot receive notices.</p>}
    {(canQueue || canRetry) && <button type="button" disabled={pending} onClick={() => void send()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold disabled:opacity-50">{pending ? "Queuing..." : state.notice ? "Retry notice" : "Queue account notice"}</button>}
    <p>Notices contain no password or setup/reset link. Use the private manual handoff for credentials.</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
  </div>;
}
