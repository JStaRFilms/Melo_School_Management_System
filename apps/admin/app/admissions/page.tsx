"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, ClipboardCopy, FileKey2, LockKeyhole, RefreshCw, ShieldAlert } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import {
  boundedQueueLimit,
  canRecordDecision,
  canRequestChanges,
  conversionAction,
  copyCanonicalApplicationLink,
  hasScopedCapability,
  pageRows,
  redactQueueRows,
  validateAdmissionsSettings,
  type AdmissionsSettingsDraft,
  type CapabilityGrant,
  type ConversionState,
  type QueueRow,
} from "@/admissions/models";

type Branding = { schoolId: string; name: string };
type CapabilityProjection = { membership: { schoolId: string } | null; capabilities: CapabilityGrant[] };
type ApplicationDetail = { applicationId: string; publicId: string; state: string; revision: number; decisionState: string | null; documentCount: number } | null;
type ApplicationLink = { href: string; availability: string; intakeSlug: string | null };

const initialDraft: AdmissionsSettingsDraft = {
  programme: { name: "", slug: "", status: "draft" },
  intake: { name: "", slug: "", cycleLabel: "", opensAt: "", closesAt: "", status: "draft" },
  product: { name: "Application slot", slug: "application", slotCount: 1, amountMinor: "", currency: "", feeDisclosure: "", refundPolicyKey: "" },
  fields: [],
  requirements: [],
  declaration: { title: "", body: "", purpose: "service", version: "1", mandatory: true },
};

function CapabilityDenied({ capability }: { capability: string }) {
  return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><div className="flex gap-2 font-bold"><LockKeyhole className="mt-0.5 h-4 w-4" />You need {capability}</div><p className="mt-1 text-xs">Access is denied until a school-, programme-, or intake-scoped grant is active.</p></div>;
}

function IntegrationRequired({ feature }: { feature: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><div className="flex gap-2 font-bold"><ShieldAlert className="mt-0.5 h-4 w-4 text-slate-500" />{feature} is awaiting the B6 integration.</div><p className="mt-1 text-xs text-slate-500">This surface deliberately does not invent a client-side workflow or bypass a missing tenant-scoped B1 API.</p></div>;
}

export default function AdmissionsPage() {
  const branding = useQuery("functions/academic/schoolBranding:getCurrentSchoolBranding" as never, {} as never) as Branding | undefined;
  const [schoolSlug, setSchoolSlug] = useState("");
  const [intakeId, setIntakeId] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(0);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialDraft);

  const capabilities = useQuery(
    "functions/foundation/auth:getViewerCapabilities" as never,
    branding?.schoolId ? ({ schoolId: branding.schoolId } as never) : ("skip" as never),
  ) as CapabilityProjection | undefined;
  const canonicalLink = useQuery(
    "functions/foundation/applicationLinks:getApplicationLink" as never,
    schoolSlug.trim() ? ({ schoolSlug: schoolSlug.trim() } as never) : ("skip" as never),
  ) as ApplicationLink | undefined;
  const queue = useQuery(
    "functions/admissions/staff:listQueue" as never,
    branding?.schoolId && intakeId.trim()
      ? ({ schoolId: branding.schoolId, intakeId: intakeId.trim(), state: state || undefined, limit: boundedQueueLimit(100) } as never)
      : ("skip" as never),
  ) as QueueRow[] | undefined;
  const detail = useQuery(
    "functions/admissions/staff:getApplicationDetail" as never,
    selectedApplicationId ? ({ applicationId: selectedApplicationId } as never) : ("skip" as never),
  ) as ApplicationDetail | undefined;

  const can = (capability: CapabilityGrant["capability"]) => hasScopedCapability(capabilities?.capabilities, capability, { intakeId });
  const rows = useMemo(() => pageRows(redactQueueRows(queue ?? []), page), [page, queue]);
  const settingsErrors = validateAdmissionsSettings(draft);

  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <AdminHeader label="Admissions" title="Admissions operations and settings" description={branding ? `Tenant-scoped workspace for ${branding.name}.` : "Loading your school context…"} />
        <section aria-label="Admissions context" className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <AdminSurface intensity="medium" rounded="2xl" className="p-5 space-y-4">
            <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Canonical public link</p><h2 className="text-base font-black text-slate-950">External-site application URL</h2></div>
            <label className="block text-xs font-bold text-slate-700">School slug<input value={schoolSlug} onChange={(event) => setSchoolSlug(event.target.value.toLowerCase())} placeholder="school-slug" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
            {canonicalLink && <CanonicalLinkPanel link={canonicalLink} />}
            <p className="text-xs text-slate-500">This is resolved only by B0’s configured application origin; administrators cannot enter an origin or redirect target.</p>
          </AdminSurface>
          <AdminSurface intensity="medium" rounded="2xl" className="p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Effective access</p>
            {capabilities === undefined ? <p className="text-sm text-slate-500">Checking scoped grants…</p> : capabilities.membership ? <ul className="flex flex-wrap gap-2">{capabilities.capabilities.length ? capabilities.capabilities.map((grant, index) => <li key={`${grant.capability}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{grant.capability} · {grant.scope}</li>) : <li className="text-sm text-slate-500">No admissions grants are active.</li>}</ul> : <CapabilityDenied capability="a school membership" />}
            <p className="text-xs text-slate-500">The interface only reflects grants. Every read and mutation is checked again by Convex with the selected programme/intake scope.</p>
          </AdminSurface>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
          <SettingsPanel draft={draft} setDraft={setDraft} errors={settingsErrors} allowed={can("admissions.catalogue.manage")} publishAllowed={can("admissions.publish")} />
          <QueuePanel intakeId={intakeId} setIntakeId={setIntakeId} state={state} setState={(value) => { setState(value); setPage(0); }} allowed={can("applications.list")} queueLoaded={queue !== undefined} rows={rows} onNext={() => setPage((current) => current + 1)} onPrevious={() => setPage((current) => Math.max(0, current - 1))} onSelect={setSelectedApplicationId} />
        </section>

        <ApplicationDetailPanel detail={detail} canView={can("applications.view_basic")} canReview={can("documents.review")} canDownload={can("documents.download")} canRecordReview={can("reviews.record")} canDecide={can("decisions.record")} canConvert={can("conversions.execute")} />
      </div>
    </main>
  );
}

function CanonicalLinkPanel({ link }: { link: ApplicationLink }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      const didCopy = await copyCanonicalApplicationLink(link);
      if (!didCopy) throw new Error("Clipboard access is unavailable");
      setCopied(true);
      appToast.success("Application link copied", { description: "Share this canonical public URL with your external-site administrator." });
    } catch (error) {
      appToast.error("Could not copy link", { description: getUserFacingErrorMessage(error, "Select and copy the URL manually.") });
    }
  };
  return <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"><p className="break-all text-sm font-semibold text-slate-900">{link.href}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-600">Availability: <strong>{link.availability}</strong></span><button type="button" onClick={copy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white"><ClipboardCopy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy link"}</button></div></div>;
}

function SettingsPanel({ draft, setDraft, errors, allowed, publishAllowed }: { draft: AdmissionsSettingsDraft; setDraft: (draft: AdmissionsSettingsDraft) => void; errors: string[]; allowed: boolean; publishAllowed: boolean }) {
  if (!allowed) return <AdminSurface intensity="medium" rounded="2xl" className="p-5"><h2 className="mb-4 text-base font-black">Admissions settings</h2><CapabilityDenied capability="admissions.catalogue.manage" /></AdminSurface>;
  const updateProgramme = (key: "name" | "slug", value: string) => setDraft({ ...draft, programme: { ...draft.programme, [key]: value } });
  const updateIntake = (key: "name" | "slug" | "cycleLabel" | "opensAt" | "closesAt", value: string) => setDraft({ ...draft, intake: { ...draft.intake, [key]: value } });
  const updateProduct = (key: "name" | "slug" | "amountMinor" | "currency" | "feeDisclosure" | "refundPolicyKey", value: string) => setDraft({ ...draft, product: { ...draft.product, [key]: value } });
  return <AdminSurface intensity="medium" rounded="2xl" className="p-5 space-y-5"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Typed catalogue draft</p><h2 className="text-base font-black">Programme, intake, product, form and declaration</h2></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Programme name" value={draft.programme.name} onChange={(value) => updateProgramme("name", value)} /><Field label="Programme slug" value={draft.programme.slug} onChange={(value) => updateProgramme("slug", value)} /><Field label="Intake name" value={draft.intake.name} onChange={(value) => updateIntake("name", value)} /><Field label="Intake slug" value={draft.intake.slug} onChange={(value) => updateIntake("slug", value)} /><Field label="Opens" type="datetime-local" value={draft.intake.opensAt} onChange={(value) => updateIntake("opensAt", value)} /><Field label="Closes" type="datetime-local" value={draft.intake.closesAt} onChange={(value) => updateIntake("closesAt", value)} /><Field label="Product name" value={draft.product.name} onChange={(value) => updateProduct("name", value)} /><Field label="Price (minor units)" inputMode="numeric" value={draft.product.amountMinor} onChange={(value) => updateProduct("amountMinor", value)} /><Field label="Currency" value={draft.product.currency} onChange={(value) => updateProduct("currency", value)} /><Field label="Disclosure key" value={draft.product.feeDisclosure} onChange={(value) => updateProduct("feeDisclosure", value)} /></div><div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><strong>One child, one slot.</strong> Slot count is fixed at 1. Form fields, document requirements, sensitive-data governance, declaration versioning, publish/rollback, and durable draft writes require B1 catalogue endpoints that are not present in the frozen API.</div>{errors.length ? <ul role="alert" className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-4 pl-8 text-xs text-amber-950">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"><Check className="mr-1 inline h-3.5 w-3.5" />Typed local draft is valid for preview; it has not been saved or published.</div>}<IntegrationRequired feature={publishAllowed ? "Save, preview, publish, rollback, form-field, document-requirement, and declaration APIs" : "Configuration publication"} /></AdminSurface>;
}

function Field({ label, value, onChange, type = "text", inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; inputMode?: "numeric" | "text" }) { return <label className="text-xs font-bold text-slate-700">{label}<input type={type} inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium" /></label>; }

function QueuePanel({ intakeId, setIntakeId, state, setState, allowed, queueLoaded, rows, onPrevious, onNext, onSelect }: { intakeId: string; setIntakeId: (value: string) => void; state: string; setState: (value: string) => void; allowed: boolean; queueLoaded: boolean; rows: ReturnType<typeof pageRows<QueueRow>>; onPrevious: () => void; onNext: () => void; onSelect: (id: string) => void }) {
  return <AdminSurface intensity="medium" rounded="2xl" className="p-5 space-y-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff queue</p><h2 className="text-base font-black">Redacted, bounded application triage</h2></div>{!allowed ? <CapabilityDenied capability="applications.list" /> : <><div className="grid gap-3 sm:grid-cols-2"><Field label="Intake scope" value={intakeId} onChange={setIntakeId} /><label className="text-xs font-bold text-slate-700">Workflow state<select value={state} onChange={(event) => setState(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">All states</option>{["draft", "submitted", "under_review", "changes_requested", "accepted", "rejected", "waitlisted"].map((item) => <option key={item}>{item}</option>)}</select></label></div><p className="text-xs text-slate-500">The intake handle is never trusted by the client: B1 verifies the active school, programme, and exact intake grant. Queue rows intentionally exclude child data and document metadata.</p>{!intakeId ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Choose an intake scope to load a bounded queue.</p> : !queueLoaded ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading safe queue rows…</p> : <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="pb-2">Reference</th><th className="pb-2">State</th><th className="pb-2">Updated</th><th /></tr></thead><tbody>{rows.items.map((row) => <tr key={row.applicationId} className="border-b border-slate-100"><td className="py-3 font-mono text-xs">{row.publicId}</td><td className="py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{row.state}</span></td><td className="py-3 text-xs text-slate-600">{new Date(row.updatedAt).toLocaleString()}</td><td className="py-3 text-right"><button type="button" onClick={() => onSelect(row.applicationId)} className="text-xs font-bold text-indigo-700 underline">Open</button></td></tr>)}</tbody></table></div>{!rows.items.length && <p className="text-sm text-slate-500">No applications match these filters.</p>}<div className="flex justify-end gap-2"><button type="button" disabled={!rows.hasPreviousPage} onClick={onPrevious} className="h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40">Previous</button><button type="button" disabled={!rows.hasNextPage} onClick={onNext} className="h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40">Next</button></div></>}</>}</AdminSurface>;
}

function ApplicationDetailPanel({ detail, canView, canReview, canDownload, canRecordReview, canDecide, canConvert }: { detail: ApplicationDetail | undefined; canView: boolean; canReview: boolean; canDownload: boolean; canRecordReview: boolean; canDecide: boolean; canConvert: boolean }) {
  if (detail === undefined) return null;
  if (!canView) return <AdminSurface intensity="medium" rounded="2xl" className="p-5"><h2 className="mb-4 text-base font-black">Application detail</h2><CapabilityDenied capability="applications.view_basic" /></AdminSurface>;
  if (!detail) return <AdminSurface intensity="medium" rounded="2xl" className="p-5"><p className="text-sm text-slate-600">This application is unavailable.</p></AdminSurface>;
  return <section className="grid gap-6 xl:grid-cols-2"><AdminSurface intensity="medium" rounded="2xl" className="p-5 space-y-4"><div><p className="font-mono text-xs text-slate-500">{detail.publicId}</p><h2 className="text-base font-black">Revision {detail.revision} · {detail.state}</h2><p className="mt-1 text-xs text-slate-500">Basic metadata only. Sensitive answers remain locked unless separately authorized and audited.</p></div><ChangeRequestForm applicationId={detail.applicationId} state={detail.state} allowed={canRecordReview} /><DecisionForm applicationId={detail.applicationId} state={detail.state} allowed={canDecide} /><IntegrationRequired feature="Assignee selection, assessment/interview outcomes, revision snapshots, and redacted audit timeline" /></AdminSurface><AdminSurface intensity="medium" rounded="2xl" className="p-5 space-y-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Restricted documents and conversion</p><h2 className="text-base font-black">Explicit access and one-time conversion</h2></div><DocumentAccessForm canReview={canReview} canDownload={canDownload} canRecordReview={canRecordReview} /><ConversionForm applicationId={detail.applicationId} accepted={detail.decisionState === "accepted" || detail.state === "accepted"} allowed={canConvert} /></AdminSurface></section>;
}

function ChangeRequestForm({ applicationId, state, allowed }: { applicationId: string; state: string; allowed: boolean }) { const requestChanges = useMutation("functions/admissions/staff:requestChanges" as never); const [message, setMessage] = useState(""); const submit = async () => { try { await requestChanges({ applicationId, message } as never); appToast.success("Changes requested", { description: "The guardian-safe message was recorded." }); } catch (error) { appToast.error("Could not request changes", { description: getUserFacingErrorMessage(error, "Refresh and try again.") }); } }; return <div className="border-t pt-4"><h3 className="text-sm font-black">Request changes</h3>{!allowed ? <CapabilityDenied capability="reviews.record" /> : <><textarea aria-label="Guardian-safe change request" value={message} onChange={(event) => setMessage(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 p-3 text-sm" placeholder="Name the editable item and the safe correction needed." /><button type="button" disabled={!canRequestChanges(state, message)} onClick={submit} className="mt-2 h-9 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40">Request changes</button></>}</div>; }

function DecisionForm({ applicationId, state, allowed }: { applicationId: string; state: string; allowed: boolean }) { const recordDecision = useMutation("functions/admissions/staff:recordDecision" as never); const [decision, setDecision] = useState("accepted"); const [reasonCode, setReasonCode] = useState(""); const [guardianMessage, setGuardianMessage] = useState(""); const submit = async () => { try { await recordDecision({ applicationId, state: decision, reasonCode, guardianMessage } as never); appToast.success("Decision recorded", { description: "This does not create a student." }); } catch (error) { appToast.error("Could not record decision", { description: getUserFacingErrorMessage(error, "Refresh the application status and try again.") }); } }; return <div className="border-t pt-4"><h3 className="text-sm font-black">Record decision</h3>{!allowed ? <CapabilityDenied capability="decisions.record" /> : <><div className="mt-2 grid gap-2 sm:grid-cols-3"><select aria-label="Decision" value={decision} onChange={(event) => setDecision(event.target.value)} className="h-10 rounded-lg border px-2 text-sm"><option value="accepted">Accept</option><option value="waitlisted">Waitlist</option><option value="rejected">Reject</option></select><input aria-label="Decision reason code" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} placeholder="Reason code" className="h-10 rounded-lg border px-3 text-sm" /><input aria-label="Guardian-safe decision message" value={guardianMessage} onChange={(event) => setGuardianMessage(event.target.value)} placeholder="Guardian-safe message" className="h-10 rounded-lg border px-3 text-sm" /></div><button type="button" disabled={!canRecordDecision({ applicationState: state, hasSnapshot: true, reasonCode, guardianMessage })} onClick={submit} className="mt-2 h-9 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40">Record decision</button></>}</div>; }

function DocumentAccessForm({ canReview, canDownload, canRecordReview }: { canReview: boolean; canDownload: boolean; canRecordReview: boolean }) { const access = useMutation("functions/admissions/staff:getDocumentAccess" as never); const review = useMutation("functions/admissions/staff:recordDocumentReview" as never); const [key, setKey] = useState(""); const [documentId, setDocumentId] = useState(""); const [result, setResult] = useState("accepted"); const [accessUrl, setAccessUrl] = useState<string | null>(null); const open = async (action: "view" | "download") => { try { const response = await access({ documentKey: key, action, reason: "Admissions review" } as never) as { status: string; url?: string }; if (response.status !== "available" || !response.url) throw new Error("Document unavailable"); setAccessUrl(response.url); } catch (error) { appToast.error("Document unavailable", { description: getUserFacingErrorMessage(error, "The file may be restricted or you may need additional access.") }); } }; const submitReview = async () => { try { await review({ documentId, result } as never); appToast.success("Document review recorded"); } catch (error) { appToast.error("Could not record document review", { description: getUserFacingErrorMessage(error, "Refresh and try again.") }); } }; if (!canReview && !canDownload) return <CapabilityDenied capability="documents.review or documents.download" />; return <div className="space-y-3"><p className="text-xs text-slate-600">Document keys are never placed in a route, queue, or audit timeline. Each checked access is audited before a temporary URL is returned.</p><input aria-label="Document key" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Checked document key" className="h-10 w-full rounded-lg border px-3 text-sm" /><div className="flex gap-2">{canReview && <button type="button" disabled={!key} onClick={() => open("view")} className="h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40">View file</button>}{canDownload && <button type="button" disabled={!key} onClick={() => open("download")} className="h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40">Download file</button>}</div>{accessUrl && <a href={accessUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 underline"><FileKey2 className="h-3.5 w-3.5" />Open temporary checked URL</a>}{canRecordReview && <div className="border-t pt-3"><input aria-label="Document record id" value={documentId} onChange={(event) => setDocumentId(event.target.value)} placeholder="Document record for review" className="h-10 w-full rounded-lg border px-3 text-sm" /><select aria-label="Document review result" value={result} onChange={(event) => setResult(event.target.value)} className="mt-2 h-10 rounded-lg border px-2 text-sm"><option value="accepted">Accept</option><option value="rejected">Reject</option><option value="needs_replacement">Needs replacement</option></select><button type="button" disabled={!documentId} onClick={submitReview} className="ml-2 h-9 rounded-lg border px-3 text-xs font-bold disabled:opacity-40">Record review</button></div>}</div>; }

function ConversionForm({ applicationId, accepted, allowed }: { applicationId: string; accepted: boolean; allowed: boolean }) { const execute = useMutation("functions/admissions/conversions:executeAcceptedConversion" as never); const [classId, setClassId] = useState(""); const [admissionNumber, setAdmissionNumber] = useState(""); const [confirmed, setConfirmed] = useState(false); const [conversionState, setConversionState] = useState<ConversionState | null>(null); const action = conversionAction(conversionState, accepted); const submit = async () => { if (!confirmed) return; try { const result = await execute({ applicationId, classId, admissionNumber, idempotencyKey: crypto.randomUUID() } as never) as { state: ConversionState; replayed: boolean }; setConversionState(result.state); appToast.success(result.replayed ? "Existing conversion recovered" : "Conversion completed", { description: result.replayed ? "The existing ledger was returned; no second student was created." : "The accepted application was explicitly converted." }); } catch (error) { appToast.error("Conversion needs resolution", { description: getUserFacingErrorMessage(error, "Check class, admission number, and family resolution. Do not start another conversion.") }); } }; if (!allowed) return <div className="border-t pt-4"><h3 className="text-sm font-black">Conversion</h3><CapabilityDenied capability="conversions.execute" /></div>; return <div className="border-t pt-4 space-y-2"><h3 className="text-sm font-black">Conversion</h3>{!accepted ? <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">An accepted decision is required. Acceptance is not conversion.</p> : action === "wait" ? <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Conversion is in progress. Refresh the same ledger; do not retry from the browser.</p> : <><Field label="Approved class" value={classId} onChange={setClassId} /><Field label="Admission number" value={admissionNumber} onChange={setAdmissionNumber} /><label className="flex gap-2 text-xs text-slate-700"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I checked the class, admission number, and family resolution. This creates or links canonical records once.</label><button type="button" disabled={!classId || !admissionNumber || !confirmed || action === "none"} onClick={submit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" />{action === "retry_same_ledger" ? "Retry same conversion" : "Confirm conversion"}</button></>}<p className="text-[11px] text-slate-500">B1 currently returns only terminal success/replay. Lease, recovery status, canonical IDs, and onboarding status are recorded for B6 rather than guessed here.</p></div>; }
