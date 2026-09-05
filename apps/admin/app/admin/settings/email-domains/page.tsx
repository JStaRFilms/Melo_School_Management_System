"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useDirtyForm } from "@school/shared/drafts";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";

const emailApi = api.functions.academic.institutionalEmail;
type Template = "firstname.lastname" | "f.lastname";
type Provider = "none" | "google" | "microsoft" | "zoho";
const providerNames = { none: "No provider connected", google: "Google Workspace", microsoft: "Microsoft 365", zoho: "Zoho Mail" };
const mailboxLabels = {
  login_only: "Login-only identifier — no inbox",
  external_verified: "External mailbox evidence recorded",
  provider_provisioned: "Provider-provisioned mailbox evidence recorded",
};
const field = "block w-full rounded border border-slate-300 bg-white p-2 text-slate-950";
const button = "rounded border border-slate-300 px-3 py-2 disabled:opacity-50";

export default function EmailDomainsPage() {
  const { workspaceAccess } = useAuth();
  if (!workspaceAccess) return <p>Checking email workspace access…</p>;
  if (workspaceAccess.state !== "ready") return <p role="alert">Email workspace unavailable. Resolve sign-in or branch access first.</p>;
  return <EmailAccess key={workspaceAccess.branch.schoolId} schoolId={workspaceAccess.branch.schoolId as Id<"schools">} />;
}
function EmailAccess({ schoolId }: { schoolId: Id<"schools"> }) {
  const policy = useQuery(api.functions.academic.rbac.hasViewerCapability, { schoolId, capability: "settings.domains.manage" });
  const staff = useQuery(api.functions.academic.rbac.hasViewerCapability, { schoolId, capability: "staff.onboard" });
  const student = useQuery(api.functions.academic.rbac.hasViewerCapability, { schoolId, capability: "enrollment.intakes.manage" });
  if (policy === undefined || staff === undefined || student === undefined) return <p>Checking email permissions…</p>;
  if (!policy && !staff && !student) return <p role="alert">Email settings access denied. Ask the proprietor for scoped registrar, staff administrator, or domain policy authority.</p>;
  return <EmailWorkbench schoolId={schoolId} />;
}
function EmailWorkbench({ schoolId }: { schoolId: Id<"schools"> }) {
  const data = useQuery(emailApi.getEmailWorkbench, { schoolId });
  const register = useMutation(emailApi.registerEmailDomain);
  const savePolicy = useMutation(emailApi.saveEmailPolicy);
  const setSharing = useMutation(emailApi.setEmailDomainSharing);
  const approve = useMutation(emailApi.assignInstitutionalMailbox);
  const lifecycle = useMutation(emailApi.suspendOrArchiveMailbox);
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState<Provider>("none");
  const [policyDraft, setPolicyDraft] = useState<{ domainId: Id<"schoolEmailDomains">; staffTemplate: Template; studentTemplate: Template; expectedVersion: number } | null>(null);
  const [personId, setPersonId] = useState<Id<"persons"> | null>(null);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [minor, setMinor] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [aliasOfMailboxId, setAliasOfMailboxId] = useState<Id<"institutionalMailboxes"> | undefined>();
  const [reviewedVersion, setReviewedVersion] = useState(0);
  const [request, setRequest] = useState<{ personId: Id<"persons">; firstName: string; middleName: string; lastName: string; isMinor: boolean; minorPrivacyRequested: boolean } | null>(null);
  const proposals = useQuery(emailApi.proposeEmailAddresses, request ? { schoolId, persons: [request] } : "skip");
  const proposal = proposals?.[0];
  const [manual, setManual] = useState<string | null>(null);
  const localPart = manual ?? proposal?.localPart ?? "";
  const review = useQuery(emailApi.reviewEmailAddress, request && proposal && localPart ? {
    schoolId, personId: request.personId, localPart, expectedPolicyVersion: reviewedVersion,
  } : "skip");
  const [confirmation, setConfirmation] = useState<"domain" | "policy" | "approval" | null>(null);
  const [approvalEmail, setApprovalEmail] = useState("");
  const [sharing, setSharingIntent] = useState<{ domainId: Id<"schoolEmailDomains">; sharedWithGroup: boolean } | null>(null);
  const [departure, setDeparture] = useState<{ mailboxId: Id<"institutionalMailboxes">; action: "suspend" | "archive" } | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = Boolean(domain || policyDraft || personId || sharing || departure || pending);
  useDirtyForm({ name: "Institutional email review (not saved as a draft)", isDirty: dirty,
    discard: () => {
      if (pending) throw new Error("Wait for the current metadata operation to finish.");
      setDomain(""); setPolicyDraft(null); setPersonId(null); setRequest(null); setManual(null); setConfirmation(null); setDeparture(null); setSharingIntent(null); setAliasOfMailboxId(undefined);
    } });
  const run = async (operation: () => Promise<unknown>, success: string) => {
    if (pending) return;
    setPending(true); setMessage("");
    try { await operation(); setConfirmation(null); setDeparture(null); setSharingIntent(null); setMessage(success); }
    catch { setMessage("Operation failed or permission/policy changed. Your edits remain here. Reload policy or repeat dry run before retrying; no provider operation was sent."); }
    finally { setPending(false); }
  };
  const invalidate = () => { setRequest(null); setManual(null); setConfirmation(null); setAliasOfMailboxId(undefined); };
  if (!data) return <p>Loading institutional email settings…</p>;
  const defaultDomain = data.domains.find(d => d._id === data.policy?.domainId) ?? data.domains.find(d => d.schoolId === schoolId && d.isDefault);
  const value = policyDraft ?? (defaultDomain ? { domainId: defaultDomain._id, staffTemplate: data.policy?.staffTemplate ?? "firstname.lastname",
    studentTemplate: data.policy?.studentTemplate ?? "firstname.lastname", expectedVersion: data.policy?.version ?? 0 } : null);
  const selected = data.people.find(p => p.personId === personId);
  const duplicateDomain = data.domains.some(d => d.schoolId === schoolId && d.domain === domain.trim().toLowerCase());
  return <main className="mx-auto max-w-4xl space-y-6 p-4 text-slate-900">
    <header className="space-y-2"><h1 className="text-xl font-semibold">Institutional email policy and review</h1>
      <p>{data.groupName ? `Group: ${data.groupName}. ` : "Independent branch. "}Addresses share one permanent namespace wherever the same domain is used. Inheriting a domain does not move its ownership to this branch.</p>
      <p className="rounded border border-amber-300 bg-amber-50 p-3">Provider activation unavailable. Domain control, licensing, delegated authorization, provider-specific syntax, DPA/security and jurisdiction/minor-notice decisions remain gated. Melo operates no mail server. Registration, approval and lifecycle controls below update Melo metadata only.</p>
      <p>Login-only is not an inbox and approval does not change the canonical login, person, or membership. Do not send mail to login-only identifiers.</p>
      <p className="text-sm">Unsaved policy/review edits are protected by the leave guard, not saved as drafts. Never enter provider credentials here.</p>
    </header>
    {message && <p role="status" className="rounded border p-3">{message}</p>}
    <section className="space-y-3" aria-labelledby="domains-title"><h2 id="domains-title" className="font-semibold">Domains and shared-group inheritance</h2>
      {!data.domains.length && <p>No domains registered. A domain policy administrator must register one before address review.</p>}
      <ul className="space-y-2">{data.domains.map(d => <li key={d._id} className="rounded border p-3 break-words"><strong>{d.domain}</strong> · {d.schoolId === schoolId ? "Branch-owned" : "Shared group branch domain"} · {d.status.replaceAll("_", " ")}<br />
        {providerNames[d.provider]} {d.provider !== "none" && "(declared intent, not a connected provider)"}. DNS status is not mailbox evidence.
        {d.schoolId === schoolId && data.permissions.policy && data.groupName && <div className="mt-2"><button className={button} disabled={pending} onClick={() => setSharingIntent({ domainId: d._id, sharedWithGroup: !d.sharedWithGroup })}>{d.sharedWithGroup ? "Review stopping group sharing" : "Review sharing with this group"}</button></div>}
        {sharing?.domainId === d._id && <div className="space-y-2"><p>{sharing.sharedWithGroup ? "Allow administrators in this active group to inherit this domain for login-only address policy? Provider delegation remains unavailable." : "Stop shared-domain inheritance for new approvals? Existing allocations remain reserved and unchanged; inheriting branches must review policy."}</p><button className={button} disabled={pending} onClick={() => void run(() => setSharing({ ...sharing, confirmed: true }), "Group domain sharing policy recorded. No provider authorization changed.")}>Confirm sharing policy</button> <button className={button} disabled={pending} onClick={() => setSharingIntent(null)}>Cancel</button></div>}
      </li>)}</ul>
      {data.permissions.policy ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); setConfirmation("domain"); }}>
        <fieldset disabled={pending} className="space-y-3"><legend>Register a domain intent (no verification)</legend>
          <label className="block">Domain<input className={field} required maxLength={253} placeholder="school.example" value={domain} onChange={e => { setDomain(e.target.value); setConfirmation(null); }} /></label>
          <label className="block">Intended provider<select className={field} value={provider} onChange={e => { const next = e.target.value; if (next === "none" || next === "google" || next === "microsoft" || next === "zoho") setProvider(next); setConfirmation(null); }}>
            {Object.entries(providerNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
          </select></label>
          {duplicateDomain && <p role="alert">Domain already registered in this branch. Use its existing policy entry.</p>}
          <button className={button} disabled={duplicateDomain}>Review registration</button>
        </fieldset>
      </form> : <p>Read-only domain context. Only delegated domain policy authority can register or change policy.</p>}
      {confirmation === "domain" && <div className="space-y-2 rounded border p-3"><p>Register {domain} as an unverified intent? No provider will be contacted.</p><button className={button} disabled={pending || duplicateDomain} onClick={() => void run(async () => { await register({ schoolId, domain, provider }); setDomain(""); }, "Domain intent registered. Verification remains unavailable.")}>Confirm registration</button> <button className={button} disabled={pending} onClick={() => setConfirmation(null)}>Cancel</button></div>}
    </section>
    <section className="space-y-3" aria-labelledby="policy-title"><h2 id="policy-title" className="font-semibold">Staff and student address templates</h2>
      <p>Version {data.policy?.version ?? 0} · default firstname.lastname. New proposals only; existing addresses and historical attribution are never rewritten. Initials reduce exposure but do not establish legal compliance or anonymity.</p>
      {data.policyDomainUnavailable && <p role="alert">Inherited domain is no longer available. Its owner must restore sharing or this branch must save a reviewed replacement policy before new approvals.</p>}
      {value && <fieldset disabled={pending || !data.permissions.policy} className="space-y-3">
        <label className="block">Branch domain / explicit inheritance<select className={field} value={value.domainId} onChange={e => { const option = data.domains.find(d => d._id === e.target.value); if (option) setPolicyDraft({ ...value, domainId: option._id }); setConfirmation(null); }}>
          {data.domains.map(d => <option key={d._id} value={d._id}>{d.domain} — {d.schoolId === schoolId ? "branch" : "inherit shared group domain"}</option>)}
        </select></label>
        {(["staffTemplate", "studentTemplate"] as const).map(key => <label className="block" key={key}>{key === "staffTemplate" ? "Staff template" : "Student template"}<select className={field} value={value[key]} onChange={e => { const template = e.target.value; if (template === "firstname.lastname" || template === "f.lastname") setPolicyDraft({ ...value, [key]: template }); setConfirmation(null); }}><option>firstname.lastname</option><option>f.lastname</option></select></label>)}
        <button className={button} type="button" onClick={() => { setPolicyDraft({ ...value }); setConfirmation("policy"); }}>Review policy</button>
      </fieldset>}
      {confirmation === "policy" && value && <div className="space-y-2 rounded border p-3"><p>Confirm authority and review of student/minor naming and jurisdiction-specific notice requirements. Apply this policy to future proposals only?</p><button className={button} disabled={pending} onClick={() => void run(async () => { await savePolicy({ schoolId, ...value, confirmed: true }); setPolicyDraft(null); setRequest(null); }, "Address policy saved. Repeat dry run before approval; external activation remains gated.")}>Confirm policy</button> <button className={button} disabled={pending} onClick={() => setConfirmation(null)}>Cancel</button></div>}
    </section>
    <section className="space-y-3" aria-labelledby="review-title"><h2 id="review-title" className="font-semibold">Address proposal · dry run and human approval</h2>
      <p>Only existing canonical branch members within your student/staff authority are shown (first {data.limit}). AI/import proposals never provision a mailbox. Deterministic results have no AI confidence score.</p>
      {!data.people.length && <p>No eligible people in this review window. Complete onboarding or resolve membership classification with an administrator.</p>}
      <form onSubmit={e => { e.preventDefault(); if (personId) { setReviewedVersion(data.policy?.version ?? 0); setRequest({ personId, firstName, middleName, lastName, isMinor: minor, minorPrivacyRequested: privacy }); setManual(null); setConfirmation(null); } }}>
        {!data.policy && <p>Save a reviewed address policy before running proposals.</p>}
        <fieldset disabled={pending || !data.policy || data.policyDomainUnavailable || !defaultDomain || !data.people.length} className="space-y-3">
          <label className="block">Person<select className={field} required value={personId ?? ""} onChange={e => { const person = data.people.find(p => p.personId === e.target.value); setPersonId(person?.personId ?? null); const parts = person?.name.trim().split(/\s+/) ?? []; setFirstName(parts[0] ?? ""); setLastName(parts.length > 1 ? parts[parts.length - 1] : ""); setMiddleName(parts.slice(1, -1).join(" ")); setMinor(person?.kind === "student"); setPrivacy(false); invalidate(); }}><option value="">Select a member</option>{data.people.map(p => <option key={p.personId} value={p.personId}>{p.name} ({p.kind})</option>)}</select></label>
          {selected?.kind === "unclassified" && <p role="alert">Recipient classification requires reconciliation. Both student and staff approval authority are required.</p>}
          <div className="grid gap-3 sm:grid-cols-3">{[{ label: "First name", value: firstName, set: setFirstName, required: true }, { label: "Middle name", value: middleName, set: setMiddleName, required: false }, { label: "Last name", value: lastName, set: setLastName, required: true }].map(input => <label key={input.label}>{input.label}<input className={field} required={input.required} maxLength={100} value={input.value} onChange={e => { input.set(e.target.value); invalidate(); }} /></label>)}</div>
          <p>These name fields are proposal inputs only; they never rename the person. Transliteration and single-name cases require manual review.</p>
          <label className="block"><input type="checkbox" checked={minor} onChange={e => { setMinor(e.target.checked); invalidate(); }} /> Student/minor naming review required</label>
          <label className="block"><input type="checkbox" checked={privacy} onChange={e => { setPrivacy(e.target.checked); invalidate(); }} /> Request first initial for minor privacy</label>
          <button className={button}>Run address dry run</button>
        </fieldset>
      </form>
      {request && !proposals && <p role="status">Computing deterministic proposals…</p>}
      {request && proposal && <div className="space-y-3 rounded border p-3">
        <p><strong>{proposal.proposedEmail}</strong> · {proposal.retainedExistingAddress ? "Existing reservation — consult its source mailbox evidence and lifecycle" : mailboxLabels.login_only}</p><p>{proposal.reason} · stage {proposal.stage}. Policy version {proposal.policyVersion}.</p>
        <p>Candidate sequence (not reservations): {proposal.alternatives.join(", ")}</p>
        <label className="block">Review / manually edit local part<input className={field} disabled={pending} maxLength={64} value={localPart} onChange={e => { setManual(e.target.value); setConfirmation(null); }} /></label>
        <p>{review ? review.reason : "Checking syntax, reserved names and shared-domain uniqueness…"}</p>
        <p>Approval reserves an additional address, not a rename. Old addresses remain frozen. Provider aliases, forwarding and login changes are unavailable.</p>
        <label className="block">Additional-address / alias metadata for<select className={field} disabled={pending} value={aliasOfMailboxId ?? ""} onChange={e => { const source = data.mailboxes.find(m => m._id === e.target.value && m.personId === request.personId); setAliasOfMailboxId(source?._id); setConfirmation(null); }}><option value="">No existing address relation</option>{data.mailboxes.filter(m => m.personId === request.personId).map(m => <option key={m._id} value={m._id}>{m.email} — preserve old allocation</option>)}</select></label>
        <button className={button} disabled={pending || !review?.valid} onClick={() => { setApprovalEmail(review?.email ?? ""); setConfirmation("approval"); }}>Review approval</button>
        {confirmation === "approval" && <div className="space-y-2">{review?.email !== approvalEmail && <p role="alert">Candidate changed after review. Review the current address again before confirming.</p>}<p>Approve {approvalEmail} as login-only metadata? I have reviewed the recipient, collision alternative and student/minor privacy. This creates no inbox or external alias.</p><button className={button} disabled={pending || !review?.valid || review.email !== approvalEmail} onClick={() => void run(async () => { if (!review?.valid || review.email !== approvalEmail) return; await approve({ schoolId, personId: request.personId, email: approvalEmail, expectedPolicyVersion: reviewedVersion, aliasOfMailboxId, isMinor: request.isMinor, minorPrivacyRequested: request.minorPrivacyRequested }); setRequest(null); setPersonId(null); setManual(null); setAliasOfMailboxId(undefined); }, "Address approved as login-only metadata. No inbox created; canonical identity unchanged.")}>Confirm login-only approval</button> <button className={button} disabled={pending} onClick={() => setConfirmation(null)}>Cancel</button></div>}
      </div>}
    </section>
    <section className="space-y-3" aria-labelledby="lifecycle-title"><h2 id="lifecycle-title" className="font-semibold">Allocations, lifecycle and reconciliation</h2>
      <p>First {data.limit} branch allocations within your authority. Suspended/archived addresses are never reused. Evidence badges describe the last recorded state, not current delivery or access verification.</p>
      {!data.mailboxes.length && <p>No approved address allocations in this review window.</p>}
      <ul className="space-y-3">{data.mailboxes.map(mailbox => <li key={mailbox._id} className="space-y-2 rounded border p-3 break-words"><strong>{mailbox.email}</strong><p>{mailboxLabels[mailbox.state]} · {mailbox.status} · {providerNames[mailbox.providerType]}</p>
        {mailbox.aliasOfMailboxId && <p>Approved additional-address relation; external alias activation unavailable. Original address remains reserved.</p>}
        {mailbox.reconciliationRequired && <p role="alert">Provider failure / unknown outcome: reconciliation required. {mailbox.failureClass === "transient" ? "Transient failure recorded; controlled backoff/retry is unavailable until provider authorization." : mailbox.failureClass === "permanent" ? "Permanent failure recorded; operator review is required, not automatic retry." : "Outcome unknown; reconcile by provider identifier/address before retrying create."} Do not retry create blindly. Identity and membership preserved; authorized operator must reconcile provider evidence before any external retry.</p>}
        <p>External retry, alias activation and provider suspension/archive unavailable. These controls record local lifecycle intent only; provider access may remain unchanged.</p>
        {(mailbox.kind === "student" ? data.permissions.student : data.permissions.lifecycle) && mailbox.status !== "archived" && <div className="flex flex-wrap gap-2">{(["suspend", "archive"] as const).map(action => <button className={button} key={action} disabled={pending || (action === "suspend" && mailbox.status === "suspended")} onClick={() => setDeparture({ mailboxId: mailbox._id, action })}>{action === "suspend" ? "Record suspension" : "Record archive"}</button>)}</div>}
        {departure?.mailboxId === mailbox._id && <div><p>Confirm local {departure.action} for {mailbox.email}? Address attribution remains frozen. This does not revoke provider or Melo login access.</p><button className={button} disabled={pending} onClick={() => void run(() => lifecycle(departure), "Local lifecycle recorded. External reconciliation remains gated; no account access was changed.")}>Confirm lifecycle</button> <button className={button} disabled={pending} onClick={() => setDeparture(null)}>Cancel</button></div>}
      </li>)}</ul>
    </section>
  </main>;
}
