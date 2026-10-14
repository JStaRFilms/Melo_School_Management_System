"use client";
import { Component, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { getUserFacingErrorMessage } from "@school/shared";
import { PARENT_CORRECTION_FIELDS, CHILD_CORRECTION_FIELDS, CORRECTION_FIELD_LABELS, requiresCorrectionNamePair, toggleCorrectionField, type ParentCorrectionField, type ChildCorrectionField } from "@school/shared/profile-corrections";
import type { CorrectionScope } from "@school/convex/functions/academic/profileCorrectionContract";
import { ProfileCorrectionChanges } from "@school/shared/components/ProfileCorrectionChanges";
import { CorrectionEditor } from "./ProfileCorrectionEditor";

const refs = api.functions.academic.profileCorrections;
export type CorrectionWorkspace = FunctionReturnType<typeof refs.getWorkspace>;
export type CorrectionDetail = FunctionReturnType<typeof refs.getRequest>;
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50";
export function ProfileCorrections(props: { schoolId: Id<"schools">; studentId?: Id<"students"> }) {
  return <CorrectionQueryBoundary key={`${props.schoolId}:${props.studentId ?? "own"}`}><CorrectionWorkspacePanel {...props} /></CorrectionQueryBoundary>;
}
class CorrectionQueryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p role="alert">Profile correction access could not be verified. No successful apply has been confirmed. Reload to check your current school and family links.</p> : this.props.children;
  }
}
function CorrectionWorkspacePanel({ schoolId, studentId }: { schoolId: Id<"schools">; studentId?: Id<"students"> }) {
  const workspace = useQuery(refs.getWorkspace, { schoolId, studentId });
  const [selected, setSelected] = useState<Id<"profileCorrectionRequests">>();
  const requestId = selected ?? workspace?.requests.find(r => r.state === "requested" || r.state === "granted")?.requestId;
  const detail = useQuery(refs.getRequest, requestId ? { schoolId, requestId } : "skip");
  const targetWorkspace = useQuery(refs.getWorkspace, detail?.state === "granted" ? { schoolId, studentId: detail.requestedScope.childId } : "skip");
  if (!workspace) return <p role="status">Loading profile correction access...</p>;
  return <section aria-label="Profile corrections" className="mt-8 space-y-4 border-t border-slate-200 pt-6">
    <h2 className="text-lg font-bold">Your details and child profile</h2>
    <p className="text-sm text-slate-600">Your recorded name: {workspace.parent.name}. Child: {workspace.child?.name ?? "None selected"}.</p>
    <p className="text-sm text-slate-600">An admin must first grant specific fields. Saving a draft does not change your profile. Final submission applies changes immediately.</p>
    {requestId ? detail ? <>
      <p role="status">Correction request: {detail.state}</p>
      {detail.state === "requested" && <p>The school is reviewing your permission request. No profile changes have been submitted.</p>}
      {detail.state === "granted" && (targetWorkspace ? <CorrectionEditor key={`${schoolId}:${requestId}:${detail.revision}`} schoolId={schoolId} request={detail} workspace={targetWorkspace} /> : <p role="status">Loading granted targets...</p>)}
      {detail.applied && <div className="space-y-3"><h3 className="font-semibold">Applied receipt</h3><p className="text-sm">Applied {new Date(detail.applied.appliedAt).toLocaleString()}. This request is read-only.</p><ProfileCorrectionChanges changes={detail.applied.changes} /></div>}
      {detail.decisionReason && <p>School decision: {detail.decisionReason}</p>}
      {!["requested", "granted"].includes(detail.state) && <button className={buttonClass} onClick={() => setSelected(undefined)}>Start a new permission request</button>}
    </> : <p role="status">Loading correction request...</p> : <RequestCorrection key={`${schoolId}:${studentId ?? "own"}`} schoolId={schoolId} workspace={workspace} onRequested={setSelected} />}
    {!!workspace.requests.length && <details><summary className="cursor-pointer text-sm font-semibold">Recent request history</summary><ul className="mt-2 space-y-2">{workspace.requests.map(r => <li key={r.requestId}><button className="text-sm underline disabled:opacity-50" disabled={!r.currentAccess} onClick={() => setSelected(r.requestId)}>{r.state} · {new Date(r.createdAt).toLocaleDateString()} · {r.requestId.slice(-6)}{!r.currentAccess && " · access changed"}</button></li>)}</ul></details>}
  </section>;
}
function RequestCorrection({ schoolId, workspace, onRequested }: { schoolId: Id<"schools">; workspace: CorrectionWorkspace; onRequested: (id: Id<"profileCorrectionRequests">) => void }) {
  const request = useMutation(refs.requestCorrection);
  const [parentFields, setParentFields] = useState<ParentCorrectionField[]>([]);
  const [childFields, setChildFields] = useState<ChildCorrectionField[]>([]);
  const [memberId, setMemberId] = useState<Id<"familyMembers"> | undefined>(workspace.addresses[0]?.memberId);
  const [reason, setReason] = useState(""); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  function changed() { setRequestKey(crypto.randomUUID()); setError(""); }
  async function send() {
    setPending(true); setError("");
    try {
      const scope: CorrectionScope = { parentFields, childFields, parentMemberId: parentFields.includes("address") ? memberId : undefined, childId: childFields.length ? workspace.child?.studentId : undefined };
      onRequested(await request({ schoolId, scope, reason, requestKey }));
    } catch (e) { setError(getUserFacingErrorMessage(e, "Permission request could not be saved.")); } finally { setPending(false); }
  }
  return <div className="space-y-4">
    <fieldset disabled={pending} className="space-y-3"><legend className="font-semibold">Request changes to your details</legend>
      <div className="flex flex-wrap gap-4">{PARENT_CORRECTION_FIELDS.map(field => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={parentFields.includes(field)} disabled={field === "address" && !workspace.addresses.length} onChange={e => { changed(); setParentFields(toggleCorrectionField(parentFields, field, e.target.checked, requiresCorrectionNamePair(workspace.parent), PARENT_CORRECTION_FIELDS)); }} />{CORRECTION_FIELD_LABELS[field]}</label>)}</div>
      {requiresCorrectionNamePair(workspace.parent) && <p className="text-sm">Name corrections need both first and last names. Selecting a name field includes both; enter the parts yourself without splitting the recorded full name.</p>}
      {parentFields.includes("address") && <label className="block text-sm">Your household link<select className="ml-2 rounded border p-2" value={memberId ?? ""} onChange={e => { changed(); setMemberId(workspace.addresses.find(a => a.memberId === e.target.value)?.memberId); }}>{workspace.addresses.map(a => <option key={a.memberId} value={a.memberId}>{a.familyName}</option>)}</select></label>}
    </fieldset>
    {workspace.child && <fieldset disabled={pending}><legend className="mb-3 font-semibold">Request changes to {workspace.child.name}</legend>{requiresCorrectionNamePair(workspace.child) && <p className="mb-3 text-sm">Child name corrections need both first and last names. Selecting a name field includes both.</p>}<div className="flex flex-wrap gap-4">{CHILD_CORRECTION_FIELDS.map(field => <label key={field} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={childFields.includes(field)} onChange={e => { changed(); setChildFields(toggleCorrectionField(childFields, field, e.target.checked, requiresCorrectionNamePair(workspace.child ?? {}), CHILD_CORRECTION_FIELDS)); }} />{CORRECTION_FIELD_LABELS[field]}</label>)}</div></fieldset>}
    <label className="block text-sm">Reason for correction<textarea className="mt-1 block w-full rounded border border-slate-300 p-2" maxLength={500} value={reason} disabled={pending} onChange={e => { changed(); setReason(e.target.value); }} /></label>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button className={buttonClass} disabled={pending || !reason.trim() || (!parentFields.length && !childFields.length)} onClick={() => void send()}>{pending ? "Requesting..." : "Request edit permission"}</button>
  </div>;
}
