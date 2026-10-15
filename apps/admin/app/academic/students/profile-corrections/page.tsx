"use client";
import { useState } from "react";
import Link from "next/link";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { QueryErrorBoundary } from "../components/QueryErrorBoundary";
import { CorrectionDecision, InvalidCorrectionRequestAction } from "./CorrectionActions";
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
    <p className="text-sm text-slate-600">Grant initial edit permission for selected fields. The parent&apos;s final submission applies those changes immediately. Applied history is read-only, not a second approval queue.</p>
    <label className="block text-sm">Request state<select className="ml-3 rounded border border-slate-300 p-2" value={state} onChange={e => { const next = states.find(s => s === e.target.value); if (next) { setState(next); setRequestId(undefined); } }}>{states.map(s => <option key={s} value={s}>{s === "requested" ? "Requested permission" : s === "applied" ? "Applied history" : s}</option>)}</select></label>
    {status === "LoadingFirstPage" ? <p role="status">Loading requests...</p> : !results.length ? <p>No {state} requests.</p> : <ul className="divide-y divide-slate-200">{results.map(r => <li key={r.requestId} className="py-3"><button className="text-left text-sm underline disabled:opacity-50" disabled={!r.currentAccess} onClick={() => setRequestId(r.requestId)}>Request {r.requestId.slice(-6)} · {new Date(r.createdAt).toLocaleDateString()} · {r.state}{!r.currentAccess && " · current access changed"}</button><p className="mt-1 text-xs text-slate-600">Requested parent fields: {r.requestedScope.parentFields.join(", ") || "none"}. Child fields: {r.requestedScope.childFields.join(", ") || "none"}.</p>{!r.currentAccess && (r.state === "requested" || r.state === "granted") && <InvalidCorrectionRequestAction schoolId={schoolId} request={r} />}</li>)}</ul>}
    {status === "CanLoadMore" && <button className={buttonClass} onClick={() => loadMore(20)}>More requests</button>}
    {status === "LoadingMore" && <p role="status">Loading more requests...</p>}
    {requestId && (detail ? <CorrectionDecision key={`${detail._id}:${detail.revision}`} schoolId={schoolId} request={detail} /> : <p role="status">Loading restricted request details...</p>)}
  </main>;
}
