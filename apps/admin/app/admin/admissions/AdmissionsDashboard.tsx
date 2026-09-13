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
  approveCampaignPriceTermsRef, closeCampaignRef, createCampaignDraftRef, createReplacementDraftRef, editCampaignDraftRef, listCampaignsRef, listQueuePageRef, publishCampaignRef,
  type CampaignBundle, type CampaignFieldInput, type CampaignInput, type CampaignRequirementInput,
} from "@school/convex/functions/admissions/refs";
import { createCampaignEditorValues, parseDefinitions, slugifyCampaignValue, validateCampaign, type CampaignEditorValues } from "./admissions-model";

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
  const canApproveFinance = hasEffectiveCapability(workspaceAccess, "finance.fee_plans.manage");
  const offeringNow = useOfferingNow();
  const campaigns = useQuery(listCampaignsRef, schoolId && canManage ? { schoolId, now: offeringNow } : "skip");
  const [queueState, setQueueState] = useState<"submitted" | "under_review" | "changes_requested" | "waitlisted" | "accepted" | "rejected">("submitted");
  const [cursor, setCursor] = useState<string | null>(null);
  const queue = useQuery(listQueuePageRef, schoolId && canList ? { schoolId, state: queueState, paginationOpts: { numItems: 20, cursor } } : "skip");
  const createCampaign = useMutation(createCampaignDraftRef), editCampaign = useMutation(editCampaignDraftRef), replaceCampaign = useMutation(createReplacementDraftRef), approvePriceTerms = useMutation(approveCampaignPriceTermsRef), publishCampaign = useMutation(publishCampaignRef), closeCampaign = useMutation(closeCampaignRef);
  const [values, setValues] = useState<CampaignEditorValues>(() => createCampaignEditorValues());
  const [customSlugs, setCustomSlugs] = useState({ programme: false, intake: false, product: false });
  const [openDraftId, setOpenDraftId] = useState<string | "new" | null>(null);
  const [expectedDraftRevision, setExpectedDraftRevision] = useState<string | null>(null);
  const [replacement, setReplacement] = useState(false);
  const selected = openDraftId && openDraftId !== "new" ? campaigns?.find((campaign) => String(campaign.formVersionId) === openDraftId) ?? null : null;
  const [feedback, setFeedback] = useState("No unsaved campaign changes.");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ action: "publish" | "close"; campaign: CampaignBundle } | null>(null);
  const errors = validateCampaign(values);

  useEffect(() => {
    if (!selected || selected.lifecycle !== "draft") return;
    setValues((current) => {
      const termsMatch = current.amount === String(selected.amountMinor / 100) && current.currency === selected.currency && current.refundPolicyKey === selected.refundPolicyKey && current.feeDisclosure === selected.feeDisclosure;
      if (!termsMatch || (current.priceApprovalEvidenceId === String(selected.priceApprovalEvidenceId ?? "") && current.priceApprovalSubjectKey === selected.priceApprovalSubjectKey)) return current;
      return { ...current, priceApprovalEvidenceId: String(selected.priceApprovalEvidenceId ?? ""), priceApprovalSubjectKey: selected.priceApprovalSubjectKey };
    });
  }, [selected]);

  function update(key: keyof CampaignEditorValues, value: string) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "programmeName" && !customSlugs.programme) next.programmeSlug = slugifyCampaignValue(value);
      if (key === "intakeName" && !customSlugs.intake) next.intakeSlug = slugifyCampaignValue(value);
      if (key === "productName" && !customSlugs.product) next.productSlug = slugifyCampaignValue(value);
      if (["amount", "currency", "refundPolicyKey", "feeDisclosure"].includes(key)) {
        next.priceApprovalEvidenceId = "";
        next.priceApprovalSubjectKey = "";
      }
      return next;
    });
    setFeedback("Campaign changes are not saved.");
  }
  function begin(bundle?: CampaignBundle, asReplacement = false) {
    setOpenDraftId(bundle ? String(bundle.formVersionId) : "new");
    setExpectedDraftRevision(bundle?.draftRevision ?? null);
    setReplacement(asReplacement);
    setCustomSlugs({ programme: Boolean(bundle), intake: Boolean(bundle), product: Boolean(bundle) });
    setValues(bundle ? editorFrom(bundle) : createCampaignEditorValues());
    setFeedback(asReplacement ? "Editing a replacement version. Published values remain live until this version is published." : bundle ? "Editing draft." : "Creating a paid campaign draft.");
  }
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
  async function approveCurrentPrice() {
    if (!schoolId || !selected || selected.lifecycle !== "draft" || !selected.priceApprovalSubjectKey) return;
    setBusy(true);
    setFeedback("Approving the saved fee and refund terms…");
    try {
      const result = await approvePriceTerms({ schoolId, priceId: selected.priceId, expectedSubjectKey: selected.priceApprovalSubjectKey });
      setValues((current) => ({ ...current, priceApprovalEvidenceId: String(result.approvalEvidenceId), priceApprovalSubjectKey: result.subjectKey }));
      setFeedback(result.replayed ? "These fee terms were already approved." : "Fee and refund terms approved for publication.");
      appToast.success("Fee terms approved");
    } catch (error) {
      const message = errorText(error);
      setFeedback(message);
      appToast.error("Fee terms could not be approved", { description: message });
    } finally {
      setBusy(false);
    }
  }
  async function confirmedAction() {
    if (!confirm || !schoolId) return;
    const item = confirm.campaign; setBusy(true);
    try {
      if (confirm.action === "publish") {
        if (!item.priceApprovalEvidenceId) {
          if (!canApproveFinance) throw new Error("A staff member with fee-plan authority must approve the fee terms before publishing.");
          await approvePriceTerms({ schoolId, priceId: item.priceId, expectedSubjectKey: item.priceApprovalSubjectKey });
        }
        await publishCampaign({ programmeId: item.programmeId, intakeId: item.intakeId, formVersionId: item.formVersionId, declarationVersionId: item.declarationVersionId, productId: item.productId, priceId: item.priceId, draftRevision: item.draftRevision });
        setFeedback("Campaign version published. Public pages now use this version.");
        appToast.success("Campaign published");
      }
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
                  <button className={secondaryButtonClass} disabled={!item.priceApprovalEvidenceId && !canApproveFinance} title={!item.priceApprovalEvidenceId && !canApproveFinance ? "Finance approval is required" : undefined} onClick={() => setConfirm({ action: "publish", campaign: item })}>{item.priceApprovalEvidenceId ? "Publish" : canApproveFinance ? "Approve & publish" : "Finance approval required"}</button>
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
      {openDraftId ? <CampaignForm values={values} update={update} errors={errors} busy={busy || (openDraftId !== "new" && !selected)} replacement={replacement} isNew={openDraftId === "new"} campaign={selected?.lifecycle === "draft" ? selected : null} canApproveFinance={canApproveFinance} customSlugs={customSlugs} onCustomizeSlug={(key) => setCustomSlugs((current) => ({ ...current, [key]: true }))} conflict={feedback.startsWith("This campaign changed")} onApprovePrice={() => void approveCurrentPrice()} onReload={reloadOpenDraft} onSave={() => void save()} onCancel={() => { setOpenDraftId(null); setExpectedDraftRevision(null); setReplacement(false); setValues(createCampaignEditorValues()); setFeedback("Campaign edit cancelled."); }} /> : null}
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
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.action === "publish" ? confirm.campaign.priceApprovalEvidenceId ? "Publish campaign version?" : "Approve fee terms and publish?" : "Close campaign?"} description={confirm?.action === "publish" ? confirm.campaign.priceApprovalEvidenceId ? "The public application route will begin using this immutable version when it is currently effective." : "This records your finance approval for the saved fee and refund terms, then publishes the campaign." : "New purchases will stop. Existing owned applications remain available."} confirmLabel={confirm?.action === "publish" ? confirm.campaign.priceApprovalEvidenceId ? "Publish" : "Approve & publish" : "Close"} onConfirm={() => void confirmedAction()} onCancel={() => setConfirm(null)} />
  </main>;
}

type SlugKey = "programme" | "intake" | "product";

const QUESTION_KINDS = [
  ["text", "Short answer"],
  ["textarea", "Long answer"],
  ["email", "Email address"],
  ["phone", "Phone number"],
  ["number", "Number"],
  ["date", "Date"],
  ["boolean", "Yes or no"],
  ["select", "Choose one"],
  ["multi_select", "Choose several"],
] as const;

function choiceOptions(validationJson: string) {
  try {
    const parsed: unknown = JSON.parse(validationJson);
    if (typeof parsed === "object" && parsed !== null && "options" in parsed && Array.isArray(parsed.options)) {
      return parsed.options.filter((option): option is string => typeof option === "string").join("\n");
    }
  } catch {
    return "";
  }
  return "";
}

function CampaignForm({ values, update, errors, busy, replacement, isNew, campaign, canApproveFinance, customSlugs, onCustomizeSlug, conflict, onApprovePrice, onReload, onSave, onCancel }: {
  values: CampaignEditorValues;
  update: (key: keyof CampaignEditorValues, value: string) => void;
  errors: string[];
  busy: boolean;
  replacement: boolean;
  isNew: boolean;
  campaign: CampaignBundle | null;
  canApproveFinance: boolean;
  customSlugs: Record<SlugKey, boolean>;
  onCustomizeSlug: (key: SlugKey) => void;
  conflict: boolean;
  onApprovePrice: () => void;
  onReload: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  let fields: CampaignFieldInput[] = [];
  let requirements: CampaignRequirementInput[] = [];
  try {
    ({ fields, requirements } = parseDefinitions(values));
  } catch {
    // The validation summary and advanced editor expose malformed saved JSON.
  }

  const saveDefinitions = (nextFields: CampaignFieldInput[], nextRequirements: CampaignRequirementInput[]) => {
    update("fieldsJson", JSON.stringify(nextFields.map((field, index) => ({ ...field, order: index + 1 })), null, 2));
    update("requirementsJson", JSON.stringify(nextRequirements.map((requirement, index) => ({ ...requirement, order: index + 1 })), null, 2));
  };
  const changeField = (index: number, patch: Partial<CampaignFieldInput>) => {
    const current = fields[index];
    if (!current) return;
    const next = { ...current, ...patch };
    if (typeof patch.label === "string" && (!current.fieldKey || current.fieldKey === slugifyCampaignValue(current.label))) {
      next.fieldKey = slugifyCampaignValue(patch.label);
    }
    saveDefinitions(fields.map((field, itemIndex) => itemIndex === index ? next : field), requirements);
  };
  const changeRequirement = (index: number, patch: Partial<CampaignRequirementInput>) => {
    const current = requirements[index];
    if (!current) return;
    const next = { ...current, ...patch };
    if (typeof patch.label === "string" && (!current.requirementKey || current.requirementKey === slugifyCampaignValue(current.label))) {
      next.requirementKey = slugifyCampaignValue(patch.label);
    }
    saveDefinitions(fields, requirements.map((requirement, itemIndex) => itemIndex === index ? next : requirement));
  };
  const addQuestion = () => saveDefinitions([...fields, {
    fieldKey: `question-${fields.length + 1}`,
    sectionKey: "additional-information",
    kind: "text",
    label: "",
    requiredMode: "optional",
    dataClass: "personal",
    purpose: "Review the applicant's information.",
    validationJson: "{}",
    order: fields.length + 1,
  }], requirements);
  const addRequirement = () => saveDefinitions(fields, [...requirements, {
    requirementKey: `document-${requirements.length + 1}`,
    category: "identity",
    label: "",
    requiredMode: "optional",
    acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxBytes: 5 * 1024 * 1024,
    maxFiles: 1,
    sensitivity: "personal",
    purpose: "Verify information supplied with the application.",
    order: requirements.length + 1,
  }]);
  const priceApproved = Boolean(values.priceApprovalEvidenceId);

  return (
    <form className="space-y-7 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="border-b border-slate-200 pb-4">
        <h3 className="font-display text-lg font-bold text-slate-900">{replacement ? "New campaign version" : "Set up an admissions campaign"}</h3>
        <p className="mt-1 text-sm text-slate-600">Start with the essentials. Technical settings stay out of the way unless you need them.</p>
        {replacement ? <p className="mt-2 text-xs font-medium text-slate-600">The programme, intake window, and product identity are locked because existing applications may already refer to them.</p> : null}
      </div>

      <fieldset className="space-y-4">
        <legend className="font-display text-base font-bold text-slate-900">1. Programme and intake</legend>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              Programme name
              <input required disabled={replacement} className={`${fieldClass} mt-1`} value={values.programmeName} onChange={(event) => update("programmeName", event.target.value)} placeholder="For example, Primary School" />
            </label>
            <SlugControl label="Programme URL" value={values.programmeSlug} editable={isNew && customSlugs.programme} canCustomize={isNew && !customSlugs.programme} onCustomize={() => onCustomizeSlug("programme")} onChange={(value) => update("programmeSlug", value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-800">
              Intake name
              <input required disabled={replacement} className={`${fieldClass} mt-1`} value={values.intakeName} onChange={(event) => update("intakeName", event.target.value)} placeholder="For example, 2026/2027 Main Intake" />
            </label>
            <SlugControl label="Application URL" value={values.intakeSlug} editable={isNew && customSlugs.intake} canCustomize={isNew && !customSlugs.intake} onCustomize={() => onCustomizeSlug("intake")} onChange={(value) => update("intakeSlug", value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-800 sm:col-span-1">
            Academic cycle
            <input required disabled={replacement} className={`${fieldClass} mt-1`} value={values.cycleLabel} onChange={(event) => update("cycleLabel", event.target.value)} placeholder="2026/2027" />
          </label>
          <label className="text-sm font-semibold text-slate-800 sm:col-span-2">
            Description <span className="font-normal text-slate-500">(optional)</span>
            <input disabled={replacement} className={`${fieldClass} mt-1`} value={values.programmeDescription} onChange={(event) => update("programmeDescription", event.target.value)} placeholder="A short description parents will understand" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-800">Applications open<input required disabled={replacement} className={`${fieldClass} mt-1`} type="datetime-local" value={values.opensAt} onChange={(event) => update("opensAt", event.target.value)} /></label>
          <label className="text-sm font-semibold text-slate-800">Applications close<input required disabled={replacement} className={`${fieldClass} mt-1`} type="datetime-local" value={values.closesAt} onChange={(event) => update("closesAt", event.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-6">
        <legend className="font-display text-base font-bold text-slate-900">2. Application fee</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <label className="block text-sm font-semibold text-slate-800">Fee name<input required disabled={replacement} className={`${fieldClass} mt-1`} value={values.productName} onChange={(event) => update("productName", event.target.value)} /></label>
            <SlugControl label="Fee reference" value={values.productSlug} editable={isNew && customSlugs.product} canCustomize={isNew && !customSlugs.product} onCustomize={() => onCustomizeSlug("product")} onChange={(value) => update("productSlug", value)} />
          </div>
          <label className="text-sm font-semibold text-slate-800">Amount<input required min="0.01" step="0.01" className={`${fieldClass} mt-1`} type="number" value={values.amount} onChange={(event) => update("amount", event.target.value)} placeholder="5000" /></label>
          <label className="text-sm font-semibold text-slate-800">Currency<select className={`${fieldClass} mt-1`} value={values.currency} onChange={(event) => update("currency", event.target.value)}><option value="NGN">NGN</option><option value="USD">USD</option><option value="GBP">GBP</option><option value="GHS">GHS</option></select></label>
        </div>
        <label className="block text-sm font-semibold text-slate-800">
          Refund policy
          <select className={`${fieldClass} mt-1`} value={values.refundPolicyKey} onChange={(event) => update("refundPolicyKey", event.target.value)}>
            <option value="non-refundable">Non-refundable after payment</option>
            <option value="full-before-close">Full refund before the application deadline</option>
            <option value="partial-admin-deduction">Partial refund before review</option>
            <option value="school-discretion">Refunds reviewed by the school</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-800">What parents see about this fee<textarea required className={`${fieldClass} mt-1 min-h-20`} value={values.feeDisclosure} onChange={(event) => update("feeDisclosure", event.target.value)} /></label>
        <div className={`rounded-lg border p-4 ${priceApproved ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="text-sm font-bold text-slate-900">Finance approval</p>
          {priceApproved ? <p className="mt-1 text-sm text-emerald-800">The current fee and refund terms are approved and ready to publish.</p> : campaign ? <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-amber-900">Review and approve the saved fee terms before publishing.</p>{canApproveFinance ? <button type="button" className={buttonClass} disabled={busy} onClick={onApprovePrice}>Approve fee terms</button> : <p className="text-xs font-medium text-amber-900">A staff member with fee-plan authority must approve these terms.</p>}</div> : <p className="mt-1 text-sm text-amber-900">Save the draft first. The approval action will appear here afterward.</p>}
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><legend className="font-display text-base font-bold text-slate-900">3. Extra questions</legend><p className="mt-1 text-sm text-slate-600">The child profile and primary contact are already included. Add only what the school still needs.</p></div>
          <button type="button" className={secondaryButtonClass} onClick={addQuestion}>Add question</button>
        </div>
        {fields.length ? <div className="space-y-3">{fields.map((field, index) => <div key={`${field.fieldKey}:${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_12rem_auto_auto] sm:items-end"><label className="text-sm font-semibold text-slate-800">Question<input className={`${fieldClass} mt-1`} value={field.label} onChange={(event) => changeField(index, { label: event.target.value })} placeholder="For example, Previous school attended" /></label><label className="text-sm font-semibold text-slate-800">Answer type<select className={`${fieldClass} mt-1`} value={field.kind} onChange={(event) => { const kind = event.target.value; changeField(index, { kind, validationJson: kind === "select" || kind === "multi_select" ? JSON.stringify({ options: ["Option 1", "Option 2"] }) : "{}" }); }}>{QUESTION_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={field.requiredMode === "required"} onChange={(event) => changeField(index, { requiredMode: event.target.checked ? "required" : "optional" })} />Required</label><button type="button" className={secondaryButtonClass} onClick={() => saveDefinitions(fields.filter((_, itemIndex) => itemIndex !== index), requirements)}>Remove</button>{field.kind === "select" || field.kind === "multi_select" ? <label className="text-sm font-semibold text-slate-800 sm:col-span-4">Choices <span className="font-normal text-slate-500">(one per line)</span><textarea className={`${fieldClass} mt-1 min-h-24`} value={choiceOptions(field.validationJson)} onChange={(event) => changeField(index, { validationJson: JSON.stringify({ options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) }) })} /></label> : null}</div>)}</div> : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No extra questions. Parents will still complete the standard child and contact details.</p>}
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><legend className="font-display text-base font-bold text-slate-900">4. Documents</legend><p className="mt-1 text-sm text-slate-600">Leave this empty for the first walkthrough. Existing Meridian storage must be reconciled before document uploads can work.</p></div>
          <button type="button" className={secondaryButtonClass} onClick={addRequirement}>Add document</button>
        </div>
        {requirements.length ? <div className="space-y-3">{requirements.map((requirement, index) => <div key={`${requirement.requirementKey}:${index}`} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_10rem_9rem_auto_auto] sm:items-end"><label className="text-sm font-semibold text-slate-800">Document name<input className={`${fieldClass} mt-1`} value={requirement.label} onChange={(event) => changeRequirement(index, { label: event.target.value })} placeholder="For example, Birth certificate" /></label><label className="text-sm font-semibold text-slate-800">Category<select className={`${fieldClass} mt-1`} value={requirement.category} onChange={(event) => changeRequirement(index, { category: event.target.value })}><option value="identity">Identity</option><option value="academic">Academic</option><option value="medical">Medical</option><option value="legal">Legal</option></select></label><label className="text-sm font-semibold text-slate-800">Maximum size<select className={`${fieldClass} mt-1`} value={String(requirement.maxBytes)} onChange={(event) => changeRequirement(index, { maxBytes: Number(event.target.value) })}><option value={2 * 1024 * 1024}>2 MB</option><option value={5 * 1024 * 1024}>5 MB</option><option value={10 * 1024 * 1024}>10 MB</option></select></label><label className="flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={requirement.requiredMode === "required"} onChange={(event) => changeRequirement(index, { requiredMode: event.target.checked ? "required" : "optional" })} />Required</label><button type="button" className={secondaryButtonClass} onClick={() => saveDefinitions(fields, requirements.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div> : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No documents required for this campaign.</p>}
      </fieldset>

      <fieldset className="space-y-4 border-t border-slate-200 pt-6">
        <legend className="font-display text-base font-bold text-slate-900">5. Guardian declaration</legend>
        <label className="block text-sm font-semibold text-slate-800">Title<input required className={`${fieldClass} mt-1`} value={values.declarationTitle} onChange={(event) => update("declarationTitle", event.target.value)} /></label>
        <label className="block text-sm font-semibold text-slate-800">Declaration shown before submission<textarea required className={`${fieldClass} mt-1 min-h-28`} value={values.declarationBody} onChange={(event) => update("declarationBody", event.target.value)} /></label>
      </fieldset>

      {errors.length ? <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900"><p className="font-bold">Check these details:</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}

      <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        {conflict ? <button type="button" className="inline-flex items-center justify-center rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900" onClick={onReload}>Reload all server values</button> : null}
        <button className={buttonClass} disabled={busy || conflict || errors.length > 0}>{busy ? "Saving…" : "Save draft"}</button>
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function SlugControl({ label, value, editable, canCustomize, onCustomize, onChange }: { label: string; value: string; editable: boolean; canCustomize: boolean; onCustomize: () => void; onChange: (value: string) => void }) {
  return <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{label}:</strong> <span className="font-mono">{value || "generated from the name"}</span></span>{canCustomize ? <button type="button" className="font-semibold text-sky-700 hover:underline" onClick={onCustomize}>Customize</button> : null}</div>{editable ? <label className="mt-2 block font-semibold text-slate-700">Custom slug<input required className={`${fieldClass} mt-1`} value={value} onChange={(event) => onChange(slugifyCampaignValue(event.target.value))} /></label> : null}</div>;
}
