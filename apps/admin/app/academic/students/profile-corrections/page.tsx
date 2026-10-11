"use client";
import { useState } from "react";
import Link from "next/link";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { getUserFacingErrorMessage } from "@school/shared";
import { CORRECTION_FIELD_LABELS, type ParentCorrectionField, type ChildCorrectionField } from "@school/shared/profile-corrections";
import { ProfileCorrectionChanges } from "@school/shared/components/ProfileCorrectionChanges";
import { useAuth } from "@/AuthProvider";
import { QueryErrorBoundary } from "../components/QueryErrorBoundary";
const refs = api.functions.academic.profileCorrections;
type State = "requested" | "granted" | "applied" | "rejected" | "revoked";
const states: State[] = ["requested", "granted", "applied", "rejected", "revoked"];
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50";
export default function ProfileCorrectionRequestsPage() {
  const { workspaceAccess } = useAuth();
  if (workspaceAccess?.state !== "ready") return <p role="status">Loading school access...</p>;
  if (!workspaceAccess.effectiveCapabilities.includes("enrollment.intakes.manage")) return <p role="alert">School-admin profile correction access is required.</p>;
  const schoolId = workspaceAccess.branch.schoolId as Id<"schools">;
  return <QueryErrorBoundary key={schoolId} message="Profile correction authority or current family links could not be verified."><CorrectionRequests schoolId={schoolId} /></QueryErrorBoundary>;
}
function CorrectionRequests({ schoolId }: { schoolId: Id<"schools"> }) {
  const [state, setState] = useState<State>("requested");
  const [requestId, setRequestId] = useState<Id<"profileCorrectionRequests">>();
  const { results, status, loadMore } = usePaginatedQuery(refs.listRequests, { schoolId, state }, { initialNumItems: 20 });
  const detail = useQuery(refs.getAdminRequest, requestId ? { schoolId, requestId } : "skip");
  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <Link href="/academic/students" className="text-sm underline">Back to students and families</Link>
    <h1 className="text-2xl font-bold">Parent profile corrections</h1>
    <p className="text-sm text-slate-600">Grant initial edit permission for selected fields. The parent's final submission applies those changes immediately. Applied history is read-only, not a second approval queue.</p>
    <label className="block text-sm">Request state<select className="ml-3 rounded border border-slate-300 p-2" value={state} onChange={e => { const next = states.find(s => s === e.target.value); if (next) { setState(next); setRequestId(undefined); } }}>{states.map(s => <option key={s} value={s}>{s === "requested" ? "Requested permission" : s === "applied" ? "Applied history" : s}</option>)}</select></label>
    {status === "LoadingFirstPage" ? <p role="status">Loading requests...</p> : !results.length ? <p>No {state} requests.</p> : <ul className="divide-y divide-slate-200">{results.map(r => <li key={r.requestId} className="py-3"><button className="text-left text-sm underline disabled:opacity-50" disabled={!r.currentAccess} onClick={() => setRequestId(r.requestId)}>Request {r.requestId.slice(-6)} · {new Date(r.createdAt).toLocaleDateString()} · {r.state}{!r.currentAccess && " · current access changed"}</button><p className="mt-1 text-xs text-slate-600">Requested parent fields: {r.requestedScope.parentFields.join(", ") || "none"}. Child fields: {r.requestedScope.childFields.join(", ") || "none"}.</p>{!r.currentAccess && (r.state === "requested" || r.state === "granted") && <InvalidCorrectionRequestAction schoolId={schoolId} request={r} />}</li>)}</ul>}
    {status === "CanLoadMore" && <button className={buttonClass} onClick={() => loadMore(20)}>More requests</button>}
    {status === "LoadingMore" && <p role="status">Loading more requests...</p>}
    {requestId && (detail ? <CorrectionDecision key={`${detail._id}:${detail.revision}`} schoolId={schoolId} request={detail} /> : <p role="status">Loading restricted request details...</p>)}
  </main>;
}
export function InvalidCorrectionRequestAction({ schoolId, request }: { schoolId: Id<"schools">; request: FunctionReturnType<typeof refs.listRequests>["page"][number] }) {
  const decide = useMutation(refs.decide);
  const [reason, setReason] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  return <div className="mt-3 space-y-2">
    <p className="text-sm">Current profile access changed. Only closing this permission is available. Profile values and draft details are withheld.</p>
    <label className="block text-sm">Reason to close invalid permission<input className="ml-2 rounded border border-slate-300 p-2" value={reason} maxLength={500} disabled={pending} onChange={e => setReason(e.target.value)} /></label>
    <button className={buttonClass} disabled={pending || !reason.trim()} onClick={async () => {
      setPending(true); setError("");
      try { await decide({ schoolId, requestId: request.requestId, expectedRevision: request.revision, decision: request.state === "requested" ? "reject" : "revoke", reason }); }
      catch (e) { setError(getUserFacingErrorMessage(e, "Permission could not be closed. Reload before retrying.")); }
      finally { setPending(false); }
    }}>Close invalid permission</button>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
export function CorrectionDecision({ schoolId, request }: { schoolId: Id<"schools">; request: FunctionReturnType<typeof refs.getAdminRequest> }) {
  const decide = useMutation(refs.decide);
  const [parentFields, setParentFields] = useState<ParentCorrectionField[]>([]);
  const [childFields, setChildFields] = useState<ChildCorrectionField[]>([]);
  const [reason, setReason] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  async function decision(value: "grant" | "reject" | "revoke") {
    setPending(true); setError("");
    try {
      await decide({ schoolId, requestId: request._id, expectedRevision: request.revision, decision: value,
        ...(value === "grant" ? { allowedScope: { parentFields, childFields,
          parentMemberId: parentFields.includes("address") ? request.requestedScope.parentMemberId : undefined,
          childId: childFields.length ? request.requestedScope.childId : undefined } } : { reason }) });
    } catch (e) { setError(getUserFacingErrorMessage(e, "Permission decision failed. Reload the request before retrying.")); } finally { setPending(false); }
  }
  return <section aria-label="Restricted correction request detail" className="space-y-4 border-t border-slate-200 pt-6">
    <h2 className="text-lg font-semibold">Request {request._id.slice(-6)} · {request.state}</h2>
    <p className="text-sm">Current parent: {request.requesterName}. {request.childName && `Current child: ${request.childName}.`}</p>
    <p className="text-xs text-slate-500">Requester ID: {request.requesterUserId}. {request.requestedScope.childId && `Child ID: ${request.requestedScope.childId}.`}</p>
    <p className="text-sm">Parent's reason: {request.reason}</p>
    {request.state === "requested" && <fieldset disabled={pending} className="space-y-3"><legend className="mb-3 font-semibold">Grant only these requested fields</legend>
      {request.requestedScope.parentFields.map(field => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={parentFields.includes(field)} onChange={e => setParentFields(e.target.checked ? [...parentFields, field] : parentFields.filter(f => f !== field))} />Parent · {CORRECTION_FIELD_LABELS[field]}</label>)}
      {request.requestedScope.childFields.map(field => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={childFields.includes(field)} onChange={e => setChildFields(e.target.checked ? [...childFields, field] : childFields.filter(f => f !== field))} />Child · {CORRECTION_FIELD_LABELS[field]}</label>)}
      <button className={buttonClass} disabled={!parentFields.length && !childFields.length} onClick={() => void decision("grant")}>Grant selected edit permission</button>
    </fieldset>}
    {request.allowedScope && <p className="text-sm">Granted parent fields: {request.allowedScope.parentFields.join(", ") || "none"}. Granted child fields: {request.allowedScope.childFields.join(", ") || "none"}.</p>}
    {request.state === "granted" && <p className="text-sm">Permission is available for the parent's one-shot submission. {request.stale ? "The parent must refresh the changed baseline and review again." : "No profile changes have been applied yet."}</p>}
    {(request.state === "requested" || request.state === "granted") && <div className="space-y-2"><label className="block text-sm">Reason to {request.state === "requested" ? "reject" : "revoke"}<textarea className="mt-1 block w-full rounded border border-slate-300 p-2" value={reason} maxLength={500} disabled={pending} onChange={e => setReason(e.target.value)} /></label><button className={buttonClass} disabled={pending || !reason.trim()} onClick={() => void decision(request.state === "requested" ? "reject" : "revoke")}>{request.state === "requested" ? "Reject permission request" : "Revoke unused permission"}</button></div>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {request.decisionReason && <p className="text-sm">Decision reason: {request.decisionReason}</p>}
    {request.applied && <div className="space-y-3"><h3 className="font-semibold">Immutable applied evidence</h3><p className="text-sm">Applied {new Date(request.applied.appliedAt).toLocaleString()}. Permission was consumed. No approval action remains.</p><ProfileCorrectionChanges changes={request.applied.changes} /></div>}
  </section>;
}
