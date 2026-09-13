"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";
import { hasEffectiveCapability } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAuth } from "@/AuthProvider";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  closeCampaignRef, createCampaignDraftRef, createReplacementDraftRef, editCampaignDraftRef, listCampaignsRef, listQueuePageRef, publishCampaignRef,
  type CampaignBundle, type CampaignInput,
} from "@school/convex/functions/admissions/refs";
import { EMPTY_CAMPAIGN, parseDefinitions, validateCampaign, type CampaignEditorValues } from "./admissions-model";

const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass = "inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass = "inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function localDate(value: number) { const offset = new Date(value).getTimezoneOffset() * 60_000; return new Date(value - offset).toISOString().slice(0, 16); }
function editorFrom(bundle: CampaignBundle): CampaignEditorValues { return { programmeSlug: bundle.programmeSlug, programmeName: bundle.programmeName, programmeDescription: bundle.programmeDescription ?? "", intakeSlug: bundle.intakeSlug, intakeName: bundle.intakeName, cycleLabel: bundle.cycleLabel, opensAt: localDate(bundle.opensAt), closesAt: localDate(bundle.closesAt), schemaVersion: bundle.schemaVersion, declarationTitle: bundle.declarationTitle, declarationBody: bundle.declarationBody, declarationPurpose: bundle.declarationPurpose, productSlug: bundle.productSlug, productName: bundle.productName, amount: String(bundle.amountMinor / 100), currency: bundle.currency, refundPolicyKey: bundle.refundPolicyKey, feeDisclosure: bundle.feeDisclosure, priceApprovalEvidenceId: bundle.priceApprovalEvidenceId ? String(bundle.priceApprovalEvidenceId) : "", priceApprovalSubjectKey: bundle.priceApprovalSubjectKey, fieldsJson: JSON.stringify(bundle.fields, null, 2), requirementsJson: JSON.stringify(bundle.requirements, null, 2) }; }
function errorText(error: unknown) { return error instanceof Error ? error.message : "The operation could not be completed."; }
function approvalEvidenceId(value: string) { const normalized = value.trim(); return normalized ? normalized as Id<"schoolApprovalEvidence"> : undefined; }
function statusLabel(value: string) { return value.replaceAll("_", " "); }
function useOfferingNow() { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []); return now; }

function campaignBadge(lifecycle: CampaignBundle["lifecycle"]) {
  switch (lifecycle) {
    case "published":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "draft":
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

function queueBadge(state: string) {
  switch (state) {
    case "accepted":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "changes_requested":
      return "border-orange-200 bg-orange-50 text-orange-800";
    case "waitlisted":
      return "border-purple-200 bg-purple-50 text-purple-800";
    case "submitted":
    default:
      return "border-sky-200 bg-sky-50 text-sky-800";
  }
}

export function AdmissionsDashboard() {
  const { workspaceAccess } = useAuth();
  const ready = workspaceAccess?.state === "ready" ? workspaceAccess : null;
  const schoolId = ready?.branch.schoolId as Id<"schools"> | undefined;
  const canManage = hasEffectiveCapability(workspaceAccess, "enrollment.intakes.manage");
  const canList = hasEffectiveCapability(workspaceAccess, "enrollment.applications.list");
  const offeringNow = useOfferingNow();
  const campaigns = useQuery(listCampaignsRef, schoolId && canManage ? { schoolId, now: offeringNow } : "skip");
  const [queueState, setQueueState] = useState<"submitted" | "under_review" | "changes_requested" | "waitlisted" | "accepted" | "rejected">("submitted");
  const [cursor, setCursor] = useState<string | null>(null);
  const queue = useQuery(listQueuePageRef, schoolId && canList ? { schoolId, state: queueState, paginationOpts: { numItems: 20, cursor } } : "skip");
  const createCampaign = useMutation(createCampaignDraftRef), editCampaign = useMutation(editCampaignDraftRef), replaceCampaign = useMutation(createReplacementDraftRef), publishCampaign = useMutation(publishCampaignRef), closeCampaign = useMutation(closeCampaignRef);
  const [values, setValues] = useState<CampaignEditorValues>(EMPTY_CAMPAIGN);
  const [openDraftId, setOpenDraftId] = useState<string | "new" | null>(null);
  const [expectedDraftRevision, setExpectedDraftRevision] = useState<string | null>(null);
  const [replacement, setReplacement] = useState(false);
  const selected = openDraftId && openDraftId !== "new" ? campaigns?.find((campaign) => String(campaign.formVersionId) === openDraftId) ?? null : null;
  const [feedback, setFeedback] = useState("No unsaved campaign changes.");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ action: "publish" | "close"; campaign: CampaignBundle } | null>(null);
  const errors = validateCampaign(values);

  function update(key: keyof CampaignEditorValues, value: string) { setValues((current) => ({ ...current, [key]: value })); setFeedback("Campaign changes are not saved."); }
  function begin(bundle?: CampaignBundle, asReplacement = false) { setOpenDraftId(bundle ? String(bundle.formVersionId) : "new"); setExpectedDraftRevision(bundle?.draftRevision ?? null); setReplacement(asReplacement); setValues(bundle ? editorFrom(bundle) : EMPTY_CAMPAIGN); setFeedback(asReplacement ? "Editing a replacement version. Published values remain live until this version is published." : bundle ? "Editing draft." : "Creating a paid campaign draft."); }
  function reloadOpenDraft() { if (!selected) return; setValues(editorFrom(selected)); setExpectedDraftRevision(selected.draftRevision); setFeedback("Reloaded every editable value from the latest server draft."); }
  function buildInput(): CampaignInput {
    if (!schoolId) throw new Error("School context is unavailable.");
    const definitions = parseDefinitions(values);
    const priceApprovalEvidenceId = approvalEvidenceId(values.priceApprovalEvidenceId);
    return { schoolId, programmeSlug: values.programmeSlug, programmeName: values.programmeName, ...(values.programmeDescription ? { programmeDescription: values.programmeDescription } : {}), intakeSlug: values.intakeSlug, intakeName: values.intakeName, cycleLabel: values.cycleLabel, opensAt: Date.parse(values.opensAt), closesAt: Date.parse(values.closesAt), schemaVersion: values.schemaVersion, ...definitions, declarationTitle: values.declarationTitle, declarationBody: values.declarationBody, declarationPurpose: values.declarationPurpose, productSlug: values.productSlug, productName: values.productName, amountMinor: Math.round(Number(values.amount) * 100), currency: values.currency, refundPolicyKey: values.refundPolicyKey, feeDisclosure: values.feeDisclosure, ...(priceApprovalEvidenceId ? { priceApprovalEvidenceId } : {}), effectiveFrom: Date.now() };
  }
  async function save() {
    if (!schoolId || errors.length || (openDraftId !== "new" && !selected)) return;
    setBusy(true); setFeedback("Saving campaign draft…");
    try {
      const input = buildInput();
      if (replacement && selected) {
        const result = await replaceCampaign({ schoolId, programmeId: selected.programmeId, intakeId: selected.intakeId, productId: selected.productId, schemaVersion: input.schemaVersion, fields: input.fields, requirements: input.requirements, declarationTitle: input.declarationTitle, declarationBody: input.declarationBody, declarationPurpose: input.declarationPurpose, amountMinor: input.amountMinor, currency: input.currency, refundPolicyKey: input.refundPolicyKey, feeDisclosure: input.feeDisclosure, ...(input.priceApprovalEvidenceId ? { priceApprovalEvidenceId: input.priceApprovalEvidenceId } : {}), effectiveFrom: input.effectiveFrom });
        setOpenDraftId(String(result.formVersionId)); setExpectedDraftRevision(result.draftRevision); setReplacement(false);
      } else if (selected?.lifecycle === "draft") {
        if (!expectedDraftRevision) throw new Error("Reload the campaign draft before saving.");
        const result = await editCampaign({ ...input, programmeId: selected.programmeId, intakeId: selected.intakeId, formVersionId: selected.formVersionId, declarationVersionId: selected.declarationVersionId, productId: selected.productId, priceId: selected.priceId, expectedDraftRevision });
        setExpectedDraftRevision(result.draftRevision);
      } else {
        const result = await createCampaign(input);
        setOpenDraftId(String(result.formVersionId)); setExpectedDraftRevision(result.draftRevision);
      }
      setFeedback("Campaign draft saved and remains open for editing."); appToast.success("Campaign draft saved");
    } catch (error) { const text = errorText(error); const conflict = /CAMPAIGN_DRAFT_CONFLICT/i.test(text); setFeedback(conflict ? "This campaign changed on the server. Reload all server values before retrying." : text); appToast.error("Campaign could not be saved", { description: text }); } finally { setBusy(false); }
  }
  async function confirmedAction() {
    if (!confirm || !schoolId) return;
    const item = confirm.campaign; setBusy(true);
    try {
      if (confirm.action === "publish") { await publishCampaign({ programmeId: item.programmeId, intakeId: item.intakeId, formVersionId: item.formVersionId, declarationVersionId: item.declarationVersionId, productId: item.productId, priceId: item.priceId, draftRevision: item.draftRevision }); setFeedback("Campaign version published. Public pages now use this version."); appToast.success("Campaign published"); }
      else { await closeCampaign({ schoolId, intakeId: item.intakeId }); setFeedback("Campaign closed. New purchases are unavailable."); appToast.success("Campaign closed"); }
    } catch (error) { const message = errorText(error); setFeedback(message); appToast.error("Campaign action failed", { description: message }); } finally { setBusy(false); setConfirm(null); }
  }

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <AdminHeader label="Enrollment" title="Admissions" description="Manage published application campaigns and review the redacted application queue." actions={<Link className={secondaryButtonClass} href="/admin/admissions/retention">Retention</Link>} />
    <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
      {feedback}
    </div>
    {canManage ? <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Campaigns and forms</h2>
          <p className="text-xs sm:text-sm text-slate-500">Draft changes never alter the version already bound to an application.</p>
        </div>
        <button className={buttonClass} onClick={() => begin()}>New campaign</button>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {campaigns?.map((item) => (
          <article key={`${item.formVersionId}:${item.lifecycle}`} className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-900">{item.programmeName} — {item.intakeName}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Form v{item.formVersion} · {item.cycleLabel} · {item.currency} {(item.amountMinor / 100).toLocaleString()}
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${campaignBadge(item.lifecycle)}`}>
                {item.lifecycle}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {item.lifecycle === "draft" ? (
                <>
                  <button className={buttonClass} onClick={() => begin(item)}>Edit</button>
                  <button className={secondaryButtonClass} onClick={() => setConfirm({ action: "publish", campaign: item })}>Publish</button>
                </>
              ) : (
                <>
                  <button className={buttonClass} onClick={() => begin(item, true)}>New version</button>
                  <button className={secondaryButtonClass} onClick={() => void navigator.clipboard.writeText(item.applicationLink.href).then(() => setFeedback("Apply link copied."), () => setFeedback("The Apply link could not be copied. Open it and copy from the address bar."))}>Copy Apply link</button>
                  <a className={secondaryButtonClass} href={item.applicationLink.href} target="_blank" rel="noreferrer">Open Apply link</a>
                  <button className={dangerButtonClass} onClick={() => setConfirm({ action: "close", campaign: item })}>Close</button>
                </>
              )}
            </div>
          </article>
        ))}
        {campaigns?.length === 0 ? <p className="text-sm text-slate-500 py-4">No campaigns yet.</p> : null}
      </div>
      {openDraftId ? <CampaignForm values={values} update={update} errors={errors} busy={busy || (openDraftId !== "new" && !selected)} replacement={replacement} conflict={feedback.startsWith("This campaign changed")} onReload={reloadOpenDraft} onSave={() => void save()} onCancel={() => { setOpenDraftId(null); setExpectedDraftRevision(null); setReplacement(false); setValues(EMPTY_CAMPAIGN); setFeedback("Campaign edit cancelled."); }} /> : null}
    </AdminSurface> : null}
    {canList ? <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Application queue</h2>
          <p className="text-xs sm:text-sm text-slate-500">This list is redacted. Open a record for submitted snapshot detail.</p>
        </div>
        <label className="text-xs sm:text-sm font-semibold text-slate-700">
          State
          <select className={`${fieldClass} mt-1`} value={queueState} onChange={(event) => { setQueueState(event.target.value as typeof queueState); setCursor(null); }}>
            {[
              ["submitted", "Submitted"],
              ["under_review", "Under Review"],
              ["changes_requested", "Changes Requested"],
              ["waitlisted", "Waitlisted"],
              ["accepted", "Accepted"],
              ["rejected", "Rejected"],
            ].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Reference</th>
              <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">State</th>
              <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Revision</th>
              <th className="px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {queue?.page.map((item) => (
              <tr key={item.applicationId} className="transition hover:bg-slate-50/60">
                <td className="px-3.5 py-2.5 font-medium">
                  <Link className="font-semibold text-sky-700 hover:text-sky-900 hover:underline" href={`/admin/admissions/${encodeURIComponent(item.publicId)}`}>
                    {item.publicId}
                  </Link>
                </td>
                <td className="px-3.5 py-2.5">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${queueBadge(item.state)}`}>
                    {statusLabel(item.state)}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-slate-600">r{item.currentRevision}</td>
                <td className="px-3.5 py-2.5 text-slate-500">{new Date(item.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {queue && queue.page.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3.5 py-8 text-center text-sm text-slate-500">
                  No applications found in this state.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {queue && !queue.isDone ? <button className={secondaryButtonClass} onClick={() => setCursor(queue.continueCursor)}>Next page</button> : null}
    </AdminSurface> : null}
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.action === "publish" ? "Publish campaign version?" : "Close campaign?"} description={confirm?.action === "publish" ? "The public application route will begin using this immutable version when it is currently effective." : "New purchases will stop. Existing owned applications remain available."} confirmLabel={confirm?.action === "publish" ? "Publish" : "Close"} onConfirm={() => void confirmedAction()} onCancel={() => setConfirm(null)} />
  </main>;
}

function CampaignForm({ values, update, errors, busy, replacement, conflict, onReload, onSave, onCancel }: { values: CampaignEditorValues; update: (key: keyof CampaignEditorValues, value: string) => void; errors: string[]; busy: boolean; replacement: boolean; conflict: boolean; onReload: () => void; onSave: () => void; onCancel: () => void }) {
  const generalFields: Array<[keyof CampaignEditorValues, string, string]> = [
    ["programmeSlug", "Programme slug", "text"],
    ["programmeName", "Programme name", "text"],
    ["intakeSlug", "Intake slug", "text"],
    ["intakeName", "Intake name", "text"],
    ["cycleLabel", "Cycle label", "text"],
  ];
  const scheduleAndPricingFields: Array<[keyof CampaignEditorValues, string, string]> = [
    ["opensAt", "Opens", "datetime-local"],
    ["closesAt", "Closes", "datetime-local"],
    ["productSlug", "Product slug", "text"],
    ["productName", "Fee product name", "text"],
    ["amount", "Fee amount", "number"],
    ["currency", "Currency", "text"],
    ["refundPolicyKey", "Refund policy key", "text"],
  ];
  const replacementImmutable = new Set<keyof CampaignEditorValues>([
    "programmeSlug", "programmeName", "intakeSlug", "intakeName", "cycleLabel", "opensAt", "closesAt", "productSlug", "productName",
  ]);

  return (
    <form className="space-y-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-6 shadow-sm" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="border-b border-slate-200 pb-3">
        <h3 className="font-display text-base font-bold text-slate-900">{replacement ? "Replacement version" : "Campaign draft"}</h3>
        {replacement ? (
          <p className="mt-1 text-xs text-slate-500">
            Campaign identity, intake dates, and product identity are immutable in a replacement version. Create a new campaign to change them.
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-500">
            Configure programme offerings, pricing, application forms, and legal declarations.
          </p>
        )}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">Programme & Intake Identity</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {generalFields.map(([key, label, type]) => (
            <label key={key} className="text-xs font-semibold text-slate-700">
              {label}
              <input
                required
                disabled={replacement && replacementImmutable.has(key)}
                className={`${fieldClass} mt-1`}
                type={type}
                value={values[key]}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          Programme description <span className="font-normal text-slate-500">(optional)</span>
          <textarea disabled={replacement} className={`${fieldClass} mt-1 min-h-20`} value={values.programmeDescription} onChange={(event) => update("programmeDescription", event.target.value)} />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">Schedule & Pricing</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scheduleAndPricingFields.map(([key, label, type]) => (
            <label key={key} className="text-xs font-semibold text-slate-700">
              {label}
              <input
                required
                disabled={replacement && replacementImmutable.has(key)}
                className={`${fieldClass} mt-1`}
                type={type}
                min={type === "number" ? "0.01" : undefined}
                step={type === "number" ? "0.01" : undefined}
                value={values[key]}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">
            Finance approval evidence ID
            <input className={`${fieldClass} mt-1`} value={values.priceApprovalEvidenceId} onChange={(event) => update("priceApprovalEvidenceId", event.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-700">
            Required finance approval subject
            <input readOnly className={`${fieldClass} mt-1 font-mono text-xs`} value={values.priceApprovalSubjectKey} placeholder="Save the draft to generate this subject" />
          </label>
        </div>
        <p className="text-xs text-slate-500">Publishing requires current finance approval evidence bound to these exact fee and refund terms.</p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">Declarations & Disclosures</legend>
        <div className="space-y-3">
          {[
            ["declarationTitle", "Declaration title"],
            ["declarationBody", "Declaration body"],
            ["declarationPurpose", "Declaration purpose"],
            ["feeDisclosure", "Fee disclosure"],
          ].map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-slate-700">
              {label}
              <textarea
                required
                className={`${fieldClass} mt-1 min-h-20`}
                value={values[key as keyof CampaignEditorValues]}
                onChange={(event) => update(key as keyof CampaignEditorValues, event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-wider text-slate-500">Form & Document Schema</legend>
        <label className="block max-w-xs text-xs font-semibold text-slate-700">
          Schema version
          <input required className={`${fieldClass} mt-1`} value={values.schemaVersion} onChange={(event) => update("schemaVersion", event.target.value)} />
        </label>
        <div className="space-y-3">
          {[
            ["fieldsJson", "Form fields (JSON array)"],
            ["requirementsJson", "Document requirements (JSON array)"],
          ].map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-slate-700">
              {label}
              <textarea
                required
                className={`${fieldClass} mt-1 min-h-28 font-mono text-xs`}
                value={values[key as keyof CampaignEditorValues]}
                onChange={(event) => update(key as keyof CampaignEditorValues, event.target.value)}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {errors.length ? (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
          <p className="font-bold">Resolve these validation issues:</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
        {conflict ? (
          <button type="button" className="inline-flex items-center justify-center rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100" onClick={onReload}>
            Reload all server values
          </button>
        ) : null}
        <button className={buttonClass} disabled={busy || conflict || errors.length > 0}>Save draft</button>
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
