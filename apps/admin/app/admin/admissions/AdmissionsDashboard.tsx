"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";
import { hasEffectiveCapability } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAuth } from "@/AuthProvider";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  approveCampaignPriceTermsRef, approveCampaignPublicationRequirementsRef, closeCampaignRef, createCampaignDraftRef, createReplacementDraftRef, editCampaignDraftRef, listCampaignsRef, listQueuePageRef, publishCampaignRef,
  type CampaignBundle, type CampaignFieldInput, type CampaignInput, type CampaignRequirementInput,
} from "@school/convex/functions/admissions/refs";
import { createCampaignEditorValues, fieldChoiceOptions, nextCampaignDefinitionKey, parseDefinitions, slugifyCampaignValue, validateCampaign, withCleanChoiceOptions, type CampaignEditorValues } from "./admissions-model";

const fieldClass = "w-full min-w-0 min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500 sm:rounded-lg sm:text-sm";
const buttonClass = "inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass = "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const iconButtonClass = "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white text-lg font-bold leading-none text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

function localDate(value: number) { const offset = new Date(value).getTimezoneOffset() * 60_000; return new Date(value - offset).toISOString().slice(0, 16); }
function editorFrom(bundle: CampaignBundle): CampaignEditorValues { return { programmeSlug: bundle.programmeSlug, programmeName: bundle.programmeName, programmeDescription: bundle.programmeDescription ?? "", intakeSlug: bundle.intakeSlug, intakeName: bundle.intakeName, cycleLabel: bundle.cycleLabel, opensAt: localDate(bundle.opensAt), closesAt: localDate(bundle.closesAt), schemaVersion: bundle.schemaVersion, declarationTitle: bundle.declarationTitle, declarationBody: bundle.declarationBody, declarationPurpose: bundle.declarationPurpose, productSlug: bundle.productSlug, productName: bundle.productName, amount: String(bundle.amountMinor / 100), currency: bundle.currency, refundPolicyKey: bundle.refundPolicyKey, feeDisclosure: bundle.feeDisclosure, priceApprovalEvidenceId: bundle.priceApprovalEvidenceId ? String(bundle.priceApprovalEvidenceId) : "", priceApprovalSubjectKey: bundle.priceApprovalSubjectKey, fieldsJson: JSON.stringify(bundle.fields, null, 2), requirementsJson: JSON.stringify(bundle.requirements, null, 2) }; }
function errorText(error: unknown) { return error instanceof Error ? error.message : "The operation could not be completed."; }
function approvalEvidenceId(value: string) { const normalized = value.trim(); return normalized ? normalized as Id<"schoolApprovalEvidence"> : undefined; }
function statusLabel(value: string) { return value.replaceAll("_", " "); }

/** Scroll an element into view using only the workspace scroll container — never
 * the document body, or the pinned app header gets pushed out on mobile. */
function scrollInnerIntoView(element: HTMLElement, center = false) {
  if (typeof window === "undefined") return;
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    const scrolls = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
    if (scrolls && node.scrollHeight > node.clientHeight + 1) {
      const delta = element.getBoundingClientRect().top - node.getBoundingClientRect().top;
      const offset = center ? Math.max(0, (node.clientHeight - element.getBoundingClientRect().height) / 2) : 8;
      node.scrollTo?.({ top: Math.max(0, node.scrollTop + delta - offset), behavior: "smooth" });
      return;
    }
    node = node.parentElement;
  }
}
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

function applicationLinkForAdmin(canonicalHref: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APPLY_ORIGIN?.trim();
  if (!configuredOrigin) return canonicalHref;
  try {
    const canonical = new URL(canonicalHref);
    return new URL(`${canonical.pathname}${canonical.search}${canonical.hash}`, configuredOrigin).toString();
  } catch {
    return canonicalHref;
  }
}

function publicationApprovalNeeds(campaign: CampaignBundle) {
  const sensitive = (value: string) => value === "highly_sensitive" || value === "financial_security";
  return {
    price: !campaign.priceApprovalEvidenceId,
    fields: campaign.fields.some((field) => sensitive(field.dataClass) && !field.approvalEvidenceId),
    documents: campaign.requirements.some((requirement) => (requirement.requiredMode !== "optional" || requirement.category === "identity" || requirement.category === "medical" || sensitive(requirement.sensitivity)) && !requirement.approvalEvidenceId),
  };
}

export function AdmissionsDashboard() {
  const { workspaceAccess } = useAuth();
  const ready = workspaceAccess?.state === "ready" ? workspaceAccess : null;
  const schoolId = ready?.branch.schoolId as Id<"schools"> | undefined;
  const canManage = hasEffectiveCapability(workspaceAccess, "enrollment.intakes.manage");
  const canList = hasEffectiveCapability(workspaceAccess, "enrollment.applications.list");
  const canApproveFinance = hasEffectiveCapability(workspaceAccess, "finance.fee_plans.manage");
  const canApproveDocuments = hasEffectiveCapability(workspaceAccess, "enrollment.documents.review");
  const canApproveSensitiveFields = hasEffectiveCapability(workspaceAccess, "enrollment.applications.view_sensitive");
  const offeringNow = useOfferingNow();
  const campaigns = useQuery(listCampaignsRef, schoolId && canManage ? { schoolId, now: offeringNow } : "skip");
  const [queueState, setQueueState] = useState<"submitted" | "under_review" | "changes_requested" | "waitlisted" | "accepted" | "rejected">("submitted");
  const [cursor, setCursor] = useState<string | null>(null);
  const queue = useQuery(listQueuePageRef, schoolId && canList ? { schoolId, state: queueState, paginationOpts: { numItems: 20, cursor } } : "skip");
  const createCampaign = useMutation(createCampaignDraftRef), editCampaign = useMutation(editCampaignDraftRef), replaceCampaign = useMutation(createReplacementDraftRef), approvePriceTerms = useMutation(approveCampaignPriceTermsRef), approvePublicationRequirements = useMutation(approveCampaignPublicationRequirementsRef), publishCampaign = useMutation(publishCampaignRef), closeCampaign = useMutation(closeCampaignRef);
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
  const formTopRef = useRef<HTMLDivElement>(null);

  // The editor replaces the list like an app screen. Snap to it when it OPENS only —
  // saving swaps the draft id too, and must not yank the scroll position.
  const wasEditorOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasEditorOpenRef.current;
    wasEditorOpenRef.current = Boolean(openDraftId);
    if (!openDraftId || wasOpen) return;
    const anchor = formTopRef.current;
    if (anchor) scrollInnerIntoView(anchor);
  }, [openDraftId]);

  function cancelEdit() {
    setOpenDraftId(null);
    setExpectedDraftRevision(null);
    setReplacement(false);
    setValues(createCampaignEditorValues());
    setFeedback("Campaign edit cancelled.");
    syncEditParam(null);
  }

  // Open the editor straight from a shared draft link (?edit=new or ?edit=<formVersionId>).
  const deepLinkConsumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (openDraftId || !campaigns) return;
    const target = searchParams.get("edit");
    if (!target || deepLinkConsumedRef.current === target) return;
    deepLinkConsumedRef.current = target;
    if (target === "new") {
      begin();
      return;
    }
    const found = campaigns.find((campaign) => String(campaign.formVersionId) === target);
    if (found) begin(found, found.lifecycle !== "draft");
  });

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  function syncEditParam(value: string | null) {
    router.replace(value ? `${pathname}?edit=${encodeURIComponent(value)}` : pathname);
  }
  function begin(bundle?: CampaignBundle, asReplacement = false) {
    const draftId = bundle ? String(bundle.formVersionId) : "new";
    setOpenDraftId(draftId);
    setExpectedDraftRevision(bundle?.draftRevision ?? null);
    setReplacement(asReplacement);
    setCustomSlugs({ programme: Boolean(bundle), intake: Boolean(bundle), product: Boolean(bundle) });
    setValues(bundle ? editorFrom(bundle) : createCampaignEditorValues());
    setFeedback(asReplacement ? "Editing a replacement version. Published values remain live until this version is published." : bundle ? "Editing draft." : "Creating a paid campaign draft.");
    syncEditParam(draftId);
  }
  function reloadOpenDraft() { if (!selected) return; setValues(editorFrom(selected)); setExpectedDraftRevision(selected.draftRevision); setFeedback("Reloaded every editable value from the latest server draft."); }
  function buildInput(): CampaignInput {
    if (!schoolId) throw new Error("School context is unavailable.");
    const parsed = parseDefinitions(values);
    // Empty choice rows are an editing aid only — never persist them.
    const definitions = { fields: parsed.fields.map(withCleanChoiceOptions), requirements: parsed.requirements };
    const priceApprovalEvidenceId = approvalEvidenceId(values.priceApprovalEvidenceId);
    return { schoolId, programmeSlug: values.programmeSlug, programmeName: values.programmeName, ...(values.programmeDescription ? { programmeDescription: values.programmeDescription } : {}), intakeSlug: values.intakeSlug, intakeName: values.intakeName, cycleLabel: values.cycleLabel, opensAt: Date.parse(values.opensAt), closesAt: Date.parse(values.closesAt), schemaVersion: values.schemaVersion, ...definitions, declarationTitle: values.declarationTitle, declarationBody: values.declarationBody, declarationPurpose: values.declarationPurpose, productSlug: values.productSlug, productName: values.productName, amountMinor: Math.round(Number(values.amount) * 100), currency: values.currency, refundPolicyKey: values.refundPolicyKey, feeDisclosure: values.feeDisclosure, ...(priceApprovalEvidenceId ? { priceApprovalEvidenceId } : {}), effectiveFrom: selected?.lifecycle === "draft" ? selected.effectiveFrom : Date.now() };
  }
  async function save() {
    if (!schoolId || errors.length || (openDraftId !== "new" && !selected)) return;
    setBusy(true); setFeedback("Saving campaign draft…");
    try {
      const input = buildInput();
      if (replacement && selected) {
        const result = await replaceCampaign({ schoolId, programmeId: selected.programmeId, intakeId: selected.intakeId, productId: selected.productId, schemaVersion: input.schemaVersion, fields: input.fields, requirements: input.requirements, declarationTitle: input.declarationTitle, declarationBody: input.declarationBody, declarationPurpose: input.declarationPurpose, amountMinor: input.amountMinor, currency: input.currency, refundPolicyKey: input.refundPolicyKey, feeDisclosure: input.feeDisclosure, ...(input.priceApprovalEvidenceId ? { priceApprovalEvidenceId: input.priceApprovalEvidenceId } : {}), effectiveFrom: input.effectiveFrom });
        setOpenDraftId(String(result.formVersionId)); setExpectedDraftRevision(result.draftRevision); setReplacement(false); syncEditParam(String(result.formVersionId));
      } else if (selected?.lifecycle === "draft") {
        if (!expectedDraftRevision) throw new Error("Reload the campaign draft before saving.");
        const result = await editCampaign({ ...input, programmeId: selected.programmeId, intakeId: selected.intakeId, formVersionId: selected.formVersionId, declarationVersionId: selected.declarationVersionId, productId: selected.productId, priceId: selected.priceId, expectedDraftRevision });
        setExpectedDraftRevision(result.draftRevision);
      } else {
        const result = await createCampaign(input);
        setOpenDraftId(String(result.formVersionId)); setExpectedDraftRevision(result.draftRevision); syncEditParam(String(result.formVersionId));
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
  function requiresPublicationApproval(item: CampaignBundle) {
    return Object.values(publicationApprovalNeeds(item)).some(Boolean);
  }
  function canApproveForPublication(item: CampaignBundle) {
    const needs = publicationApprovalNeeds(item);
    return (!needs.price || canApproveFinance) && (!needs.documents || canApproveDocuments) && (!needs.fields || canApproveSensitiveFields);
  }
  async function confirmedAction() {
    if (!confirm || !schoolId) return;
    const item = confirm.campaign; setBusy(true);
    try {
      if (confirm.action === "publish") {
        const approvalNeeds = publicationApprovalNeeds(item);
        if (approvalNeeds.price || approvalNeeds.documents || approvalNeeds.fields) {
          if ((approvalNeeds.price && !canApproveFinance) || (approvalNeeds.documents && !canApproveDocuments) || (approvalNeeds.fields && !canApproveSensitiveFields)) {
            throw new Error("You do not have all permissions required to approve this campaign for publication.");
          }
        }
        await approvePublicationRequirements({ programmeId: item.programmeId, intakeId: item.intakeId, formVersionId: item.formVersionId, declarationVersionId: item.declarationVersionId, productId: item.productId, priceId: item.priceId, draftRevision: item.draftRevision });
        await publishCampaign({ programmeId: item.programmeId, intakeId: item.intakeId, formVersionId: item.formVersionId, declarationVersionId: item.declarationVersionId, productId: item.productId, priceId: item.priceId, draftRevision: item.draftRevision });
        setFeedback("Campaign version published. Public pages now use this version.");
        appToast.success("Campaign published");
      }
      else { await closeCampaign({ schoolId, intakeId: item.intakeId }); setFeedback("Campaign closed. New purchases are unavailable."); appToast.success("Campaign closed"); }
    } catch (error) { const message = errorText(error); setFeedback(message); appToast.error("Campaign action failed", { description: message }); } finally { setBusy(false); setConfirm(null); }
  }

  return <main className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
    <AdminHeader label="Enrollment" title="Admissions" description="Manage published application campaigns and review the redacted application queue." actions={<Link className={`${secondaryButtonClass} w-full sm:w-auto`} href="/admin/admissions/retention">Retention</Link>} />
    <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
      {feedback}
    </div>
    {canManage ? <AdminSurface as="section" intensity="none" className="space-y-4">
      {openDraftId ? <div ref={formTopRef} className="scroll-mt-2">
        <button type="button" aria-label="Back to campaigns" onClick={cancelEdit} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]">
          <span aria-hidden="true">←</span> Campaigns
        </button>
      </div> : null}
      {openDraftId ? null : <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-slate-900">Campaigns and forms</h2>
          <p className="text-xs sm:text-sm text-slate-500">Draft changes never alter the version already bound to an application.</p>
        </div>
        <button className={`${buttonClass} w-full sm:w-auto`} onClick={() => begin()}>New campaign</button>
      </div>}
      {openDraftId ? null : <div className="grid gap-3 lg:grid-cols-2">
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
            <div className="mt-4 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:flex sm:flex-wrap">
              {item.lifecycle === "draft" ? (
                <>
                  <button className={`${buttonClass} w-full sm:w-auto`} onClick={() => begin(item)}>Edit</button>
                  <button className={`${secondaryButtonClass} w-full sm:w-auto`} disabled={!canApproveForPublication(item)} title={!canApproveForPublication(item) ? "Additional approval permissions are required" : undefined} onClick={() => setConfirm({ action: "publish", campaign: item })}>{requiresPublicationApproval(item) ? canApproveForPublication(item) ? "Approve requirements & publish" : "Approval permissions required" : "Publish"}</button>
                </>
              ) : (
                <>
                  <button className={`${buttonClass} w-full sm:w-auto`} onClick={() => begin(item, true)}>New version</button>
                  <button className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={() => void navigator.clipboard.writeText(applicationLinkForAdmin(item.applicationLink.href)).then(() => setFeedback("Apply link copied."), () => setFeedback("The Apply link could not be copied. Open it and copy from the address bar."))}>Copy Apply link</button>
                  <a className={`${secondaryButtonClass} w-full sm:w-auto`} href={applicationLinkForAdmin(item.applicationLink.href)} target="_blank" rel="noreferrer">Open Apply link</a>
                  <button className={`${dangerButtonClass} w-full sm:w-auto`} onClick={() => setConfirm({ action: "close", campaign: item })}>Close</button>
                </>
              )}
            </div>
          </article>
        ))}
        {campaigns?.length === 0 ? <p className="text-sm text-slate-500 py-4">No campaigns yet.</p> : null}
      </div>}
      {openDraftId ? <CampaignForm values={values} update={update} errors={errors} busy={busy || (openDraftId !== "new" && !selected)} replacement={replacement} isNew={openDraftId === "new"} campaign={selected?.lifecycle === "draft" ? selected : null} canApproveFinance={canApproveFinance} customSlugs={customSlugs} onCustomizeSlug={(key) => setCustomSlugs((current) => ({ ...current, [key]: true }))} conflict={feedback.startsWith("This campaign changed")} onApprovePrice={() => void approveCurrentPrice()} onReload={reloadOpenDraft} onSave={() => void save()} onCancel={cancelEdit} /> : null}
    </AdminSurface> : null}
    {canList && !openDraftId ? <AdminSurface as="section" intensity="none" className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-slate-900">Application queue</h2>
          <p className="text-xs sm:text-sm text-slate-500">This list is redacted. Open a record for submitted snapshot detail.</p>
        </div>
        <label className="block text-xs font-semibold text-slate-700 sm:text-sm">
          State
          <select className={`${fieldClass} mt-1 sm:w-56`} value={queueState} onChange={(event) => { setQueueState(event.target.value as typeof queueState); setCursor(null); }}>
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
      {/* Mobile: card list (app feel, no sideways scroll, reference wraps safely) */}
      <div className="grid gap-2 md:hidden">
        {queue?.page.map((item) => (
          <Link key={item.applicationId} href={`/admin/admissions/${encodeURIComponent(item.publicId)}`} className="block rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition active:scale-[0.99]">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-all font-mono text-xs font-semibold leading-relaxed text-sky-700">{item.publicId}</p>
              <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${queueBadge(item.state)}`}>
                {statusLabel(item.state)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
              <span>r{item.currentRevision}</span>
              <span className="truncate">{new Date(item.updatedAt).toLocaleString()}</span>
            </div>
          </Link>
        ))}
        {queue && queue.page.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-3.5 py-8 text-center text-sm text-slate-500">
            No applications found in this state.
          </p>
        ) : null}
      </div>
      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
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
      {queue && !queue.isDone ? <button className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={() => setCursor(queue.continueCursor)}>Next page</button> : null}
    </AdminSurface> : null}
    <ConfirmDialog open={Boolean(confirm)} title={confirm?.action === "publish" ? requiresPublicationApproval(confirm.campaign) ? "Approve requirements and publish?" : "Publish campaign version?" : "Close campaign?"} description={confirm?.action === "publish" ? requiresPublicationApproval(confirm.campaign) ? "This records your approval for the saved fee terms and controlled application requirements, then publishes the campaign." : "The public application route will begin using this immutable version when it is currently effective." : "New purchases will stop. Existing owned applications remain available."} confirmLabel={confirm?.action === "publish" ? requiresPublicationApproval(confirm.campaign) ? "Approve & publish" : "Publish" : "Close"} onConfirm={() => void confirmedAction()} onCancel={() => setConfirm(null)} />
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

function ChoiceEditor({ field, onChange, onFocusOption, registerRef }: {
  field: CampaignFieldInput;
  onChange: (options: string[]) => void;
  onFocusOption: (key: string) => void;
  registerRef: (key: string, element: HTMLInputElement | null) => void;
}) {
  // One input per option: spaces work, Enter adds the next option, and empty
  // rows are an editing aid — empties are stripped before anything is saved.
  const stored = fieldChoiceOptions(field);
  const rows = stored.length ? stored : [""];
  const setRow = (rowIndex: number, value: string) => {
    const next = [...rows];
    next[rowIndex] = value;
    onChange(next);
  };
  return (
    <div className="space-y-2 sm:col-span-2 lg:col-span-4">
      <span className="text-sm font-semibold text-slate-800">Choices</span>
      {rows.map((option, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-2">
          <input
            aria-label={`Option ${rowIndex + 1}`}
            ref={(element) => registerRef(`${field.fieldKey}:${rowIndex}`, element)}
            className={`${fieldClass} flex-1`}
            value={option}
            onChange={(event) => setRow(rowIndex, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const next = [...rows];
                next.splice(rowIndex + 1, 0, "");
                onChange(next);
                onFocusOption(`${field.fieldKey}:${rowIndex + 1}`);
              } else if (event.key === "Backspace" && option === "" && rows.length > 1) {
                event.preventDefault();
                onChange(rows.filter((_, itemIndex) => itemIndex !== rowIndex));
                onFocusOption(`${field.fieldKey}:${Math.max(0, rowIndex - 1)}`);
              }
            }}
            placeholder={`Option ${rowIndex + 1}`}
          />
          <button type="button" aria-label={`Remove option ${rowIndex + 1}`} className={iconButtonClass} onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== rowIndex))}>×</button>
        </div>
      ))}
      <button type="button" className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={() => { onChange([...rows, ""]); onFocusOption(`${field.fieldKey}:${rows.length}`); }}>Add option</button>
    </div>
  );
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

  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const optionRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusCardKey, setFocusCardKey] = useState<string | null>(null);
  const [focusOptionKey, setFocusOptionKey] = useState<string | null>(null);

  // After adding a card, bring it into view and land the cursor in its first input.
  useEffect(() => {
    if (!focusCardKey) return;
    const card = cardRefs.current.get(focusCardKey);
    setFocusCardKey(null);
    if (!card) return;
    scrollInnerIntoView(card);
    card.querySelector("input")?.focus({ preventScroll: true });
  }, [focusCardKey, fields.length, requirements.length]);

  useEffect(() => {
    if (!focusOptionKey) return;
    const input = optionRefs.current.get(focusOptionKey);
    setFocusOptionKey(null);
    input?.focus({ preventScroll: true });
  }, [focusOptionKey, fields.length, values.fieldsJson]);

  const saveDefinitions = (nextFields: CampaignFieldInput[], nextRequirements: CampaignRequirementInput[]) => {
    update("fieldsJson", JSON.stringify(nextFields.map((field, index) => ({ ...field, order: index + 1 })), null, 2));
    update("requirementsJson", JSON.stringify(nextRequirements.map((requirement, index) => ({ ...requirement, order: index + 1 })), null, 2));
  };
  const moveItem = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };
  const [movedCardKey, setMovedCardKey] = useState<string | null>(null);

  // After a move, keep the card centered on screen with a brief highlight so the
  // reorder is felt instead of just happening somewhere off-screen.
  useEffect(() => {
    if (!movedCardKey) return;
    const card = cardRefs.current.get(movedCardKey);
    if (card) scrollInnerIntoView(card, true);
    const timer = window.setTimeout(() => setMovedCardKey((current) => current === movedCardKey ? null : current), 1200);
    return () => window.clearTimeout(timer);
  }, [movedCardKey, values.fieldsJson, values.requirementsJson]);

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const field = fields[index];
    if (!field) return;
    saveDefinitions(moveItem(fields, index, direction), requirements);
    setMovedCardKey(field.fieldKey);
  };
  const moveRequirement = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= requirements.length) return;
    const requirement = requirements[index];
    if (!requirement) return;
    saveDefinitions(fields, moveItem(requirements, index, direction));
    setMovedCardKey(requirement.requirementKey);
  };
  const duplicateField = (index: number) => {
    const current = fields[index];
    if (!current) return;
    const key = nextCampaignDefinitionKey("question", fields.map((field) => field.fieldKey));
    const next = [...fields];
    next.splice(index + 1, 0, { ...current, fieldKey: key });
    saveDefinitions(next, requirements);
    setFocusCardKey(key);
  };
  const duplicateRequirement = (index: number) => {
    const current = requirements[index];
    if (!current) return;
    const key = nextCampaignDefinitionKey("document", requirements.map((requirement) => requirement.requirementKey));
    const next = [...requirements];
    next.splice(index + 1, 0, { ...current, requirementKey: key });
    saveDefinitions(fields, next);
    setFocusCardKey(key);
  };
  const [activeCardKey, setActiveCardKey] = useState<string | null>(null);
  const cardFocusProps = (key: string) => ({
    onFocus: () => setActiveCardKey(key),
    onBlur: (event: FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActiveCardKey(null);
    },
  });
  const cardHighlight = (key: string) => movedCardKey === key || activeCardKey === key
    ? " border-sky-400 ring-2 ring-sky-200"
    : "";
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
  const addQuestion = () => {
    const key = nextCampaignDefinitionKey("question", fields.map((field) => field.fieldKey));
    saveDefinitions([...fields, {
      fieldKey: key,
      sectionKey: "additional-information",
      kind: "text",
      label: "",
      requiredMode: "optional",
      dataClass: "personal",
      purpose: "Review the applicant's information.",
      validationJson: "{}",
      order: fields.length + 1,
    }], requirements);
    setFocusCardKey(key);
  };
  const addRequirement = () => {
    const key = nextCampaignDefinitionKey("document", requirements.map((requirement) => requirement.requirementKey));
    saveDefinitions(fields, [...requirements, {
      requirementKey: key,
      category: "identity",
      label: "",
      requiredMode: "optional",
      acceptedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 5 * 1024 * 1024,
      maxFiles: 1,
      sensitivity: "highly_sensitive",
      purpose: "Verify information supplied with the application.",
      order: requirements.length + 1,
    }]);
    setFocusCardKey(key);
  };
  const setFieldOptions = (index: number, options: string[]) => {
    changeField(index, { validationJson: JSON.stringify({ options }) });
  };
  const priceApproved = Boolean(values.priceApprovalEvidenceId);

  return (
    <form className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:space-y-7 sm:rounded-xl sm:p-6 [&_*:not(button)]:min-w-0" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <div className="border-b border-slate-200 pb-4">
        <h3 className="font-display text-lg font-bold text-slate-900">{replacement ? "New campaign version" : "Set up an admissions campaign"}</h3>
        <p className="mt-1 text-sm text-slate-600">Start with the essentials. Technical settings stay out of the way unless you need them.</p>
        {replacement ? <p className="mt-2 text-xs font-medium text-slate-600">The programme, intake window, and product identity are locked because existing applications may already refer to them.</p> : null}
      </div>

      <fieldset className="min-w-0 space-y-4">
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

      <fieldset className="min-w-0 space-y-4 border-t border-slate-200 pt-6">
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
          {priceApproved ? <p className="mt-1 text-sm text-emerald-800">The current fee and refund terms are approved and ready to publish.</p> : campaign ? <div className="mt-1 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-amber-900">Review and approve the saved fee terms before publishing.</p>{canApproveFinance ? <button type="button" className={`${buttonClass} w-full sm:w-auto`} disabled={busy} onClick={onApprovePrice}>Approve fee terms</button> : <p className="text-xs font-medium text-amber-900">A staff member with fee-plan authority must approve these terms.</p>}</div> : <p className="mt-1 text-sm text-amber-900">Save the draft first. The approval action will appear here afterward.</p>}
        </div>
      </fieldset>

      <fieldset className="min-w-0 space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div><legend className="font-display text-base font-bold text-slate-900">3. Extra questions</legend><p className="mt-1 text-sm text-slate-600">The child profile and primary contact are already included. Add only what the school still needs.</p><details className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-1 text-sm"><summary className="flex min-h-[44px] cursor-pointer items-center font-semibold text-slate-700">See the details parents already fill in</summary><div className="grid gap-3 pb-3 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Child</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600"><li>First name, last name, date of birth <span className="text-slate-400">(always required)</span></li><li>Middle name, gender, preferred name</li><li>Nationality, country of birth, home address</li></ul></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Primary contact</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600"><li>Full name, relationship to the child <span className="text-slate-400">(always required)</span></li><li>Email, phone number, home address</li></ul></div></div></details></div>
          <button type="button" className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={addQuestion}>Add question</button>
        </div>
        {fields.length ? <div className="space-y-3">{fields.map((field, index) => <div key={`${field.fieldKey}:${index}`} data-card-key={field.fieldKey} ref={(element) => { if (element) cardRefs.current.set(field.fieldKey, element); else cardRefs.current.delete(field.fieldKey); }} {...cardFocusProps(field.fieldKey)} className={`grid gap-3 rounded-2xl border border-slate-200 p-3 transition sm:rounded-lg sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_12rem_auto_auto]${cardHighlight(field.fieldKey)}`}><label className="text-sm font-semibold text-slate-800">Question<input className={`${fieldClass} mt-1`} value={field.label} onChange={(event) => changeField(index, { label: event.target.value })} placeholder="For example, Previous school attended" /></label><label className="text-sm font-semibold text-slate-800">Answer type<select className={`${fieldClass} mt-1`} value={field.kind} onChange={(event) => { const kind = event.target.value; changeField(index, { kind, validationJson: kind === "select" || kind === "multi_select" ? JSON.stringify({ options: ["", ""] }) : "{}" }); }}>{QUESTION_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={field.requiredMode === "required"} onChange={(event) => changeField(index, { requiredMode: event.target.checked ? "required" : "optional" })} />Required</label><div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button type="button" className={iconButtonClass} onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Move question up">↑</button><button type="button" className={iconButtonClass} onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Move question down">↓</button><button type="button" className={`${secondaryButtonClass} flex-1`} onClick={() => duplicateField(index)} aria-label="Duplicate question">Duplicate</button><button type="button" className={`${secondaryButtonClass} flex-1`} onClick={() => saveDefinitions(fields.filter((_, itemIndex) => itemIndex !== index), requirements)}>Remove</button></div>{field.kind === "select" || field.kind === "multi_select" ? <ChoiceEditor field={field} onChange={(options) => setFieldOptions(index, options)} onFocusOption={(key) => setFocusOptionKey(key)} registerRef={(key, element) => { if (element) optionRefs.current.set(key, element); else optionRefs.current.delete(key); }} /> : null}</div>)}</div> : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No extra questions. Parents will still complete the standard child and contact details.</p>}{fields.length ? <button type="button" className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={addQuestion}>Add another question</button> : null}
      </fieldset>

      <fieldset className="min-w-0 space-y-4 border-t border-slate-200 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div><legend className="font-display text-base font-bold text-slate-900">4. Documents</legend><p className="mt-1 text-sm text-slate-600">Ask parents to upload documents, like a birth certificate. Leave this empty if nothing needs uploading.</p></div>
          <button type="button" className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={addRequirement}>Add document</button>
        </div>
        {requirements.length ? <div className="space-y-3">{requirements.map((requirement, index) => <div key={`${requirement.requirementKey}:${index}`} data-card-key={requirement.requirementKey} ref={(element) => { if (element) cardRefs.current.set(requirement.requirementKey, element); else cardRefs.current.delete(requirement.requirementKey); }} {...cardFocusProps(requirement.requirementKey)} className={`grid gap-3 rounded-2xl border border-slate-200 p-3 transition sm:rounded-lg sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_10rem_9rem_auto_auto]${cardHighlight(requirement.requirementKey)}`}><label className="text-sm font-semibold text-slate-800">Document name<input className={`${fieldClass} mt-1`} value={requirement.label} onChange={(event) => changeRequirement(index, { label: event.target.value })} placeholder="For example, Birth certificate" /></label><label className="text-sm font-semibold text-slate-800">Category<select className={`${fieldClass} mt-1`} value={requirement.category} onChange={(event) => { const category = event.target.value; changeRequirement(index, { category, ...(category === "identity" || category === "medical" ? { sensitivity: "highly_sensitive" } : {}) }); }}><option value="identity">Identity</option><option value="academic">Academic</option><option value="medical">Medical</option><option value="legal">Legal</option></select></label><label className="text-sm font-semibold text-slate-800">Maximum size<select className={`${fieldClass} mt-1`} value={String(requirement.maxBytes)} onChange={(event) => changeRequirement(index, { maxBytes: Number(event.target.value) })}><option value={2 * 1024 * 1024}>2 MB</option><option value={5 * 1024 * 1024}>5 MB</option><option value={10 * 1024 * 1024}>10 MB</option></select></label><label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={requirement.requiredMode === "required"} onChange={(event) => changeRequirement(index, { requiredMode: event.target.checked ? "required" : "optional" })} />Required</label><div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5"><button type="button" className={iconButtonClass} onClick={() => moveRequirement(index, -1)} disabled={index === 0} aria-label="Move document up">↑</button><button type="button" className={iconButtonClass} onClick={() => moveRequirement(index, 1)} disabled={index === requirements.length - 1} aria-label="Move document down">↓</button><button type="button" className={`${secondaryButtonClass} flex-1`} onClick={() => duplicateRequirement(index)} aria-label="Duplicate document">Duplicate</button><button type="button" className={`${secondaryButtonClass} flex-1`} onClick={() => saveDefinitions(fields, requirements.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div></div>)}</div> : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No documents required for this campaign.</p>}{requirements.length ? <button type="button" className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={addRequirement}>Add another document</button> : null}
      </fieldset>

      <fieldset className="min-w-0 space-y-4 border-t border-slate-200 pt-6">
        <legend className="font-display text-base font-bold text-slate-900">5. Guardian declaration</legend>
        <label className="block text-sm font-semibold text-slate-800">Title<input required className={`${fieldClass} mt-1`} value={values.declarationTitle} onChange={(event) => update("declarationTitle", event.target.value)} /></label>
        <label className="block text-sm font-semibold text-slate-800">Declaration shown before submission<textarea required className={`${fieldClass} mt-1 min-h-28`} value={values.declarationBody} onChange={(event) => update("declarationBody", event.target.value)} /></label>
      </fieldset>

      {errors.length ? <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900"><p className="font-bold">Check these details:</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}

      <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] grid grid-cols-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur min-[400px]:grid-cols-2 sm:flex sm:flex-wrap sm:rounded-xl">
        {conflict ? <button type="button" className="col-span-2 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900" onClick={onReload}>Reload all server values</button> : null}
        <button className={`${buttonClass} w-full sm:w-auto`} disabled={busy || conflict || errors.length > 0}>{busy ? "Saving…" : "Save draft"}</button>
        <button type="button" className={`${secondaryButtonClass} w-full sm:w-auto`} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function SlugControl({ label, value, editable, canCustomize, onCustomize, onChange }: { label: string; value: string; editable: boolean; canCustomize: boolean; onCustomize: () => void; onChange: (value: string) => void }) {
  return <div className="min-w-0 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0"><strong>{label}:</strong> <span className="font-mono break-all">{value || "generated from the name"}</span></span>{canCustomize ? <button type="button" className="font-semibold text-sky-700 hover:underline" onClick={onCustomize}>Customize</button> : null}</div>{editable ? <label className="mt-2 block font-semibold text-slate-700">Custom slug<input required className={`${fieldClass} mt-1`} value={value} onChange={(event) => onChange(slugifyCampaignValue(event.target.value))} /></label> : null}</div>;
}
