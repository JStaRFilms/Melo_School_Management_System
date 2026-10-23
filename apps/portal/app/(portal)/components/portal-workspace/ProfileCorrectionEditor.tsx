"use client";
import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";
import { api } from "@school/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { CorrectionPayload } from "@school/convex/functions/academic/profileCorrectionContract";
import { getUserFacingErrorMessage } from "@school/shared";
import { PROFILE_CORRECTION_WARNING, CORRECTION_FIELD_LABELS } from "@school/shared/profile-corrections";
import { ProfileCorrectionChanges } from "@school/shared/components/ProfileCorrectionChanges";
import { DraftHeaderStatus, DraftStatusIndicator } from "@school/shared/drafts";
import type { CorrectionDetail, CorrectionWorkspace } from "./ProfileCorrections";
const refs = api.functions.academic.profileCorrections;
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50";
const inputClass = "mt-1 block w-full rounded border border-slate-300 p-2";
export function CorrectionEditor({ schoolId, request, workspace }: { schoolId: Id<"schools">; request: CorrectionDetail; workspace: CorrectionWorkspace }) {
  const convex = useConvex(); const save = useMutation(refs.saveDraft); const discard = useMutation(refs.discardDraft); const refresh = useMutation(refs.refreshBaseline); const submit = useMutation(refs.submit);
  const [payload, setPayload] = useState<CorrectionPayload>({});
  const [knownRevision, setKnownRevision] = useState(request.draft ? -1 : request.draftRevision);
  const [savedFingerprint, setSavedFingerprint] = useState("{}");
  const [pending, setPending] = useState(false); const busy = useRef(false); const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState<FunctionReturnType<typeof refs.review>>();
  const [reviewStamp, setReviewStamp] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID());
  const scope = request.allowedScope;
  const dirty = JSON.stringify(payload) !== savedFingerprint;
  const recoveryRequired = request.draftRevision > knownRevision;
  const matchingRevision = request.draftRevision === knownRevision;
  const contextStamp = JSON.stringify([schoolId, workspace.parent, workspace.child, workspace.addresses, request.revision, request.draftRevision, request.stale]);
  useEffect(() => { setAcknowledged(false); setReviewed(undefined); }, [contextStamp]);
  function edit(next: CorrectionPayload) { setPayload(next); setReviewed(undefined); setAcknowledged(false); setSubmissionKey(crypto.randomUUID()); setError(""); }
  async function operation(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { await action(); } catch (e) { setError(getUserFacingErrorMessage(e, "The correction could not be saved. No changes were submitted.")); }
    finally { busy.current = false; setPending(false); }
  }
  const version = { schoolId, requestId: request._id, expectedRevision: request.revision, expectedDraftRevision: knownRevision };
  if (!scope) return null;
  const member = workspace.addresses.find(a => a.memberId === scope.parentMemberId);
  return <div className="space-y-4">
    <DraftHeaderStatus><DraftStatusIndicator status={recoveryRequired ? "recovery_pending" : pending && dirty ? "saving" : error ? "save_failed" : dirty ? "recovery_pending" : request.lastSavedAt ? "saved" : "idle"} lastSavedAt={request.lastSavedAt} /></DraftHeaderStatus>
    <p className="text-sm">You can edit only the fields your school approved{scope.childFields.length ? ` for ${workspace.child?.name ?? "this child"}` : " in your own details"}. These drafts are saved to your account, not just this browser.</p>
    {recoveryRequired && <div className="space-y-2"><p role="status">A draft saved to your account is available, or it changed in another tab. Recover it before editing. Unsaved changes in this browser will be replaced.</p><button className={buttonClass} disabled={pending} onClick={() => { edit(request.draft ?? {}); setSavedFingerprint(JSON.stringify(request.draft ?? {})); setKnownRevision(request.draftRevision); }}>Recover saved draft</button></div>}
    {request.stale && <div className="space-y-2"><p role="alert">The profile changed since permission was granted. Your draft has not been applied. Save or recover it, then reload the current profile and review the changes.</p><button className={buttonClass} disabled={pending || dirty || !matchingRevision} onClick={() => void operation(async () => { setAcknowledged(false); setReviewed(undefined); await refresh(version); })}>Reload current profile</button></div>}
    <fieldset disabled={pending || recoveryRequired} className="space-y-4">
      <legend className="mb-2 font-semibold">Fields you can change</legend>
      {scope.parentFields.filter(f => f !== "address").map(field => {
        const draft = payload.parent?.[field];
        const value = draft === undefined ? workspace.parent[field] : draft;
        return <label key={field} className="block text-sm">Your {CORRECTION_FIELD_LABELS[field].toLowerCase()}<input className={inputClass} maxLength={field === "phone" ? 40 : 100} value={value ?? ""} onChange={e => {
          const next = e.target.value; edit({ ...payload, parent: { ...payload.parent, [field]: (field === "middleName" || field === "phone") && !next ? null : next } });
        }} /></label>;
      })}
      {scope.parentFields.includes("address") && <AddressInput label="Your personal address" address={payload.parentAddress} current={member?.mode === "residential" ? member.residential : member?.value} residential={member?.residential} onChange={address => edit({ ...payload, parentAddress: address })} />}
      {scope.childFields.length > 0 && <h3 className="font-semibold">Granted child: {workspace.child?.name}</h3>}
      {scope.childFields.filter(f => f !== "address").map(field => {
        const current = workspace.child?.[field];
        const value = payload.child?.[field] === undefined ? current : payload.child[field];
        if (field === "gender") return <label key={field} className="block text-sm">Child gender<select className={inputClass} value={value ?? ""} onChange={e => edit({ ...payload, child: { ...payload.child, gender: e.target.value === "Male" ? "Male" : e.target.value === "Female" ? "Female" : null } })}><option value="">Not recorded</option>{typeof current === "string" && !["Male", "Female"].includes(current) && <option value={current}>{current} · recorded legacy value</option>}<option>Male</option><option>Female</option></select></label>;
        return <label key={field} className="block text-sm">Child {CORRECTION_FIELD_LABELS[field].toLowerCase()}<input className={inputClass} type={field === "dateOfBirth" ? "date" : "text"} maxLength={100} value={field === "dateOfBirth" ? typeof value === "number" ? new Date(value).toISOString().slice(0, 10) : "" : value ?? ""} onChange={e => {
          if (field === "dateOfBirth") edit({ ...payload, child: { ...payload.child, dateOfBirth: e.target.value ? Date.parse(`${e.target.value}T00:00:00Z`) : null } });
          else edit({ ...payload, child: { ...payload.child, [field]: field === "middleName" && !e.target.value ? null : e.target.value } });
        }} /></label>;
      })}
      {scope.childFields.includes("address") && <AddressInput label="Child personal address" address={payload.child?.address} current={workspace.child?.addressMode === "residential" ? workspace.child.residential : workspace.child?.address} residential={workspace.child?.residential} onChange={address => edit({ ...payload, child: { ...payload.child, address } })} />}
    </fieldset>
    <div className="flex flex-wrap gap-2">
      <button className={buttonClass} disabled={pending || !dirty || !matchingRevision} onClick={() => void operation(async () => {
        const result = await save({ ...version, payload }); setKnownRevision(result.draftRevision); setSavedFingerprint(JSON.stringify(payload)); setAcknowledged(false); setReviewed(undefined);
      })}>Save draft</button>
      <button className={buttonClass} disabled={pending || !matchingRevision} onClick={() => void operation(async () => { await discard(version); edit({}); setKnownRevision(knownRevision + 1); setSavedFingerprint("{}"); })}>Discard draft</button>
      <button className={buttonClass} disabled={pending || dirty || !matchingRevision || request.stale} onClick={() => void operation(async () => { setAcknowledged(false); setReviewed(await convex.query(refs.review, version)); setReviewStamp(contextStamp); })}>Review saved changes</button>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {reviewed && reviewStamp === contextStamp && <section aria-label="Review profile changes" className="space-y-4">
      <h3 className="font-semibold">Review actual changes</h3><ProfileCorrectionChanges changes={reviewed.changes} />
      <p><strong>{PROFILE_CORRECTION_WARNING}</strong></p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} disabled={pending} onChange={e => setAcknowledged(e.target.checked)} />I understand and want to apply these changes now.</label>
      <button className={buttonClass} disabled={pending || !acknowledged || dirty || !matchingRevision || request.stale} onClick={() => void operation(async () => { await submit({ ...version, reviewToken: reviewed.reviewToken, submissionKey, acknowledged }); })}>{pending ? "Applying..." : "Apply changes now"}</button>
    </section>}
  </div>;
}
function AddressInput({ label, address, current, residential, onChange }: { label: string; address: CorrectionPayload["parentAddress"]; current?: string | null; residential?: string | null; onChange: (address: CorrectionPayload["parentAddress"]) => void }) {
  return <div className="space-y-2"><p className="text-sm">{label} · Current: {current ?? "Not recorded"}</p><label className="block text-sm">{label} choice<select className={inputClass} value={address?.mode ?? ""} onChange={e => onChange(e.target.value === "residential" ? { mode: "residential" } : e.target.value === "different" ? { mode: "different", value: "" } : undefined)}><option value="">Keep recorded address</option><option value="residential">Use household address</option><option value="different">Use a personal override</option></select></label>
    {address?.mode === "residential" && <p className="text-sm">Inherited household address: {residential ?? "Not recorded"}. The household address will not change.</p>}
    {address?.mode === "different" && <label className="block text-sm">{label} override<textarea className={inputClass} maxLength={500} value={address.value ?? ""} onChange={e => onChange({ mode: "different", value: e.target.value })} /></label>}
  </div>;
}
