"use client";

import { useEffect, useRef, useState } from "react";
import { useConvex, useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@school/convex/_generated/api";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { LifecycleContextFields, lifecycleButton, lifecycleInput, validLifecycleDay } from "@/components/lifecycle/LifecycleContextFields";
import { CapabilityChecklist } from "./CapabilityChecklist";

const staff = api.functions.academic.academicSetup;
export type StaffProfile = FunctionReturnType<typeof staff.getStaffServiceProfile>;
type Preview = FunctionReturnType<typeof staff.previewStaffRehirePermissions>;
type Decision = NonNullable<FunctionArgs<typeof staff.previewStaffRehirePermissions>["decision"]>;
type ReviewArgs = FunctionArgs<typeof staff.confirmStaffRehireReview>;
type ReviewResult = FunctionReturnType<typeof staff.confirmStaffRehireReview>;
type TransitionArgs = FunctionArgs<typeof staff.transitionStaffService>;
type Workspace = FunctionReturnType<typeof api.functions.academic.rbac.getPermissionWorkspace>;

export function StaffLifecycleActionModal({ profile, schoolId, action, onClose, onSaved }: {
  profile: StaffProfile; schoolId: TransitionArgs["schoolId"]; action: "depart" | "rehire"; onClose: () => void; onSaved: () => void;
}) {
  const convex = useConvex();
  const review = useMutation(staff.confirmStaffRehireReview);
  const transition = useMutation(staff.transitionStaffService);
  const returning = action === "rehire";
  const [previous, setPrevious] = useState<Preview>();
  const [preview, setPreview] = useState<Preview>();
  const [decision, setDecision] = useState<Decision>();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState(false);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(returning);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const attempt = useRef<{ intent: string; reviewArgs?: ReviewArgs; reviewResult?: ReviewResult; transitionArgs?: TransitionArgs }>();

  useEffect(() => {
    if (!returning) return;
    let alive = true;
    void convex.query(staff.previewStaffRehirePermissions, { schoolId, userId: profile.userId }).then(result => {
      if (!alive) return;
      setPrevious(result);
      setDecision({ mode: "retain", displayTitle: result.previous.displayTitle, roleTemplateIds: result.previous.roleTemplateIds, grants: result.previous.grants, restrictions: result.previous.restrictions });
    }).catch(err => { if (alive) setError(getUserFacingErrorMessage(err, "Access review is unavailable.")); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [convex, returning, schoolId, profile.userId]);

  const changeDecision = (next: Decision) => { setDecision(next); setPreview(undefined); setConfirmed(false); attempt.current = undefined; };
  const previewDecision = async () => {
    if (!decision || busy) return;
    setBusy(true); setError(""); setConfirmed(false);
    try { setPreview(await convex.query(staff.previewStaffRehirePermissions, { schoolId, userId: profile.userId, decision })); }
    catch (err) { setPreview(undefined); setError(getUserFacingErrorMessage(err, "The proposed access cannot be used. Review the decision.")); }
    finally { setBusy(false); }
  };
  const chooseMode = async (mode: Decision["mode"]) => {
    if (!decision || !previous) return;
    changeDecision(mode === "retain" ? { mode, displayTitle: previous.previous.displayTitle, roleTemplateIds: previous.previous.roleTemplateIds, grants: previous.previous.grants, restrictions: previous.previous.restrictions } : { ...decision, mode });
    if (mode === "replace" && !workspace) {
      setBusy(true); setError("");
      try { setWorkspace(await convex.query(api.functions.academic.rbac.getPermissionWorkspace, { schoolId })); }
      catch (err) { setError(getUserFacingErrorMessage(err, "The permission catalog is unavailable. Replacement needs separate access recovery.")); }
      finally { setBusy(false); }
    }
  };
  const valid = reason.trim().length >= (returning ? 8 : 1) && reason.trim().length <= (returning ? 240 : 500) && validLifecycleDay(correction, day) && (!returning || Boolean(preview && decision && confirmed));
  const submit = async () => {
    if (busy || stale || !valid) return;
    const draft = { schoolId, userId: profile.userId, action, reason: reason.trim(), ...(correction ? { effectiveDay: day } : {}) };
    const intent = JSON.stringify({ ...draft, decision });
    if (attempt.current?.intent !== intent) {
      attempt.current = { intent, ...(returning && preview && decision ? { reviewArgs: { schoolId, userId: profile.userId, expectedRevision: preview.revision, operationKey: crypto.randomUUID(), reason: reason.trim(), decision, expectedPermissionState: preview.permissionState } } : { transitionArgs: { ...draft, expectedRevision: profile.revision, operationKey: crypto.randomUUID() } }) };
    }
    const current = attempt.current;
    setBusy(true); setError("");
    try {
      if (current.reviewArgs && !current.reviewResult) {
        current.reviewResult = await review(current.reviewArgs);
        setReviewed(true);
      }
      if (!current.transitionArgs && current.reviewResult) current.transitionArgs = { ...draft, expectedRevision: current.reviewResult.revision, reviewedEventId: current.reviewResult.eventId, operationKey: crypto.randomUUID() };
      if (!current.transitionArgs) return;
      await transition(current.transitionArgs);
      // Replay results are historical. The subscribed profile owns the current projection.
      appToast.success("Service change confirmed");
      onSaved();
    } catch (err) {
      const message = getUserFacingErrorMessage(err, "The change could not be confirmed. An unchanged retry uses the same operation.");
      setError(message);
      appToast.error(message);
      if (/conflict|stale|changed|revision/i.test(message)) setStale(true);
    } finally { setBusy(false); }
  };
  return <ConfirmationModal isOpen onClose={onClose} onConfirm={() => void submit()} title={`${returning ? "Rehire" : "Record departure for"} ${profile.name}`} description={returning ? "Rehire opens a new service period on the same identity. Access review and rehire must use the same operator. Other-school access is unchanged." : "Departure closes service and ends operational access to this school. Historical records remain. It does not archive or globally suspend this person."} confirmLabel={returning ? "Confirm review and rehire" : "Record departure"} confirmVariant={returning ? "primary" : "danger"} isLoading={busy} confirmDisabled={loading || !valid || stale}>
    <div className="space-y-4 text-sm">
      <p>{profile.email} • {profile.role} • {profile.status}</p>
      <LifecycleContextFields sessionName={profile.context.sessionName} termName={profile.context.termName} reason={reason} onReasonChange={setReason} correction={correction} onCorrectionChange={setCorrection} effectiveDay={day} onDayChange={setDay} disabled={busy || reviewed} />
      {returning && <div className="space-y-3">
        {loading && <p role="status">Loading previous access...</p>}
        {previous && <PermissionSummary title="Previous permissions, not restored" configuration={previous.previous} />}
        {decision && <fieldset disabled={busy || reviewed} className="space-y-3">
          <legend className="font-semibold">Access decision</legend>
          <label className="block">Permission decision<select className={lifecycleInput} value={decision.mode} onChange={e => void chooseMode(e.target.value === "replace" ? "replace" : "retain")}><option value="retain">Retain reviewed previous configuration</option><option value="replace" disabled={!previous?.membershipId}>Replace configuration</option></select></label>
          {!previous?.membershipId && <p>Legacy identity supports retention only. Replacement needs a separately reviewed canonical mapping.</p>}
          {decision.mode === "replace" && workspace && <>
            <label className="block">Display title<input className={lifecycleInput} value={decision.displayTitle} onChange={e => changeDecision({ ...decision, displayTitle: e.target.value })} /></label>
            <fieldset><legend>Role templates</legend>{workspace.templates.map(template => <label key={template._id} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={decision.roleTemplateIds.includes(template._id)} onChange={e => changeDecision({ ...decision, roleTemplateIds: e.target.checked ? [...decision.roleTemplateIds, template._id] : decision.roleTemplateIds.filter(id => id !== template._id) })} />{template.name}</label>)}</fieldset>
            <CapabilityChecklist catalog={workspace.catalog} selected={decision.grants} onChange={grants => changeDecision({ ...decision, grants })} legend="Direct grants" />
            <CapabilityChecklist catalog={workspace.catalog} selected={decision.restrictions} onChange={restrictions => changeDecision({ ...decision, restrictions })} legend="Restrictions" />
          </>}
          <button type="button" className={lifecycleButton} disabled={decision.mode === "replace" && !workspace} onClick={() => void previewDecision()}>Preview access decision</button>
        </fieldset>}
        {preview && <PermissionSummary title="Proposed permissions after rehire" configuration={preview.proposed} />}
        {preview && <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={busy || reviewed} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed the previous and proposed access, including restrictions and compatibility grants.</label>}
        <p className="text-xs text-slate-600">Use an 8 to 240 character review reason. A review records evidence only; it does not restore access. Independent revocation, global suspension and archive restrictions remain.</p>
        {reviewed && <p role="status">Review recorded. Finish rehire with this unchanged request, or cancel. Access has not been restored by review alone.</p>}
      </div>}
      {error && <p role="alert" className="text-error">{error}</p>}
      {stale && <p role="alert">Close and reopen to review fresh status and permissions. Do not retry a stale decision.</p>}
    </div>
  </ConfirmationModal>;
}

function PermissionSummary({ title, configuration }: { title: string; configuration: Preview["previous"] }) {
  return <section className="space-y-1 rounded-lg border border-slate-200 p-3">
    <h4 className="font-semibold">{title}</h4>
    <p>Title: {configuration.displayTitle || "None"}</p>
    <p>Templates: {configuration.roleTemplateIds.join(", ") || "None"}</p>
    <p>Direct grants: {configuration.grants.join(", ") || "None"}</p>
    <p>Restrictions: {configuration.restrictions.join(", ") || "None"}</p>
    <p>Effective access: {configuration.effective.join(", ") || "None"}</p>
    <p>Delegation ceiling: {configuration.ceiling.join(", ") || "None"}</p>
    <p>Legacy baseline: {configuration.legacyBaseline ? "Yes" : "No"}</p>
    <ul>{configuration.compatibilityGrants.map(grant => <li key={grant.grantId}>{grant.capability} • {grant.scope}{grant.programmeId ? ` • programme ${grant.programmeId}` : ""}{grant.intakeId ? ` • intake ${grant.intakeId}` : ""} • {grant.revokedAt ? `Revoked ${new Date(grant.revokedAt).toLocaleString()}` : "Not revoked"} • {grant.expiresAt ? `Expires ${new Date(grant.expiresAt).toLocaleString()}` : "No expiry recorded"}</li>)}</ul>
  </section>;
}
