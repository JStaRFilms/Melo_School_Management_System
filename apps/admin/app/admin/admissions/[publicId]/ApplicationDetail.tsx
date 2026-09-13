"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";
import { hasEffectiveCapability } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAuth } from "@/AuthProvider";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  executeAcceptedConversionRef, getAdmissionNumberPolicyRef, getApplicationDetailRef, getApplicationWorkflowRef, getConversionWorkflowRef, getDocumentAccessRef, recordDecisionRef, recordDocumentReviewRef, requestChangesRef, resolveApplicationByPublicIdRef, revealSensitiveApplicationDetailRef, startReviewRef,
  type DocumentMetadata,
} from "@school/convex/functions/admissions/refs";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass = "inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass = "inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

function message(error: unknown) { return error instanceof Error ? error.message : "The operation failed."; }
function statusLabel(value: string) { return value.replaceAll("_", " "); }

function detailStateBadge(state: string) {
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

export function ApplicationDetail({ publicId }: { publicId: string }) {
  const { workspaceAccess } = useAuth();
  const ready = workspaceAccess?.state === "ready" ? workspaceAccess : null;
  const schoolId = ready?.branch.schoolId as Id<"schools"> | undefined;
  const canSensitive = hasEffectiveCapability(workspaceAccess, "enrollment.applications.view_sensitive");
  const canReviewDocuments = hasEffectiveCapability(workspaceAccess, "enrollment.documents.review");
  const canManage = hasEffectiveCapability(workspaceAccess, "enrollment.intakes.manage");
  const canDecide = hasEffectiveCapability(workspaceAccess, "enrollment.decisions.record");
  const canOverrideNumber = hasEffectiveCapability(workspaceAccess, "enrollment.admissions.override_number");
  const [classId, setClassId] = useState("");
  const resolved = useQuery(resolveApplicationByPublicIdRef, schoolId ? { schoolId, publicId } : "skip");
  const detail = useQuery(getApplicationDetailRef, schoolId && resolved ? { schoolId, applicationId: resolved.applicationId } : "skip");
  const workflow = useQuery(getApplicationWorkflowRef, schoolId && resolved ? { schoolId, applicationId: resolved.applicationId } : "skip");
  const canConvert = canManage && canDecide;
  const conversionWorkflow = useQuery(getConversionWorkflowRef, schoolId && resolved && canConvert ? { schoolId, applicationId: resolved.applicationId } : "skip");
  const selectedConversionClass = conversionWorkflow?.classes.find((item) => item.classId === classId);
  const admissionNumbering = useQuery(getAdmissionNumberPolicyRef, schoolId && selectedConversionClass ? { schoolId, level: selectedConversionClass.level } : "skip");
  const reveal = useMutation(revealSensitiveApplicationDetailRef), startReview = useMutation(startReviewRef), requestChanges = useMutation(requestChangesRef), decide = useMutation(recordDecisionRef), convert = useMutation(executeAcceptedConversionRef);
  const [sensitive, setSensitive] = useState<{ answers: Array<{ fieldKey: string; valueType: string; serializedValue: string; dataClass: string }>; documents: DocumentMetadata[] } | null>(null);
  const [feedback, setFeedback] = useState("Sensitive details are hidden by default.");
  const [busy, setBusy] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]), [selectedRequirements, setSelectedRequirements] = useState<Id<"admissionsDocumentRequirements">[]>([]);
  const [correctionReason, setCorrectionReason] = useState(""), [correctionMessage, setCorrectionMessage] = useState("");
  const [decisionState, setDecisionState] = useState<"accepted" | "rejected">("accepted"), [decisionReason, setDecisionReason] = useState(""), [decisionMessage, setDecisionMessage] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState(""), [familyKind, setFamilyKind] = useState<"create" | "existing">("create"), [familyName, setFamilyName] = useState(""), [familyId, setFamilyId] = useState("");
  const [overrideReason, setOverrideReason] = useState(""), [overrideConfirmed, setOverrideConfirmed] = useState(false), [keepCounterConfirmed, setKeepCounterConfirmed] = useState(false);
  const [confirmDecision, setConfirmDecision] = useState(false), [confirmConversion, setConfirmConversion] = useState(false);

  async function run(label: string, operation: () => Promise<unknown>) { setBusy(true); setFeedback(`${label}…`); try { await operation(); setFeedback(`${label} completed.`); appToast.success(`${label} completed`); } catch (error) { const text = message(error); setFeedback(text); appToast.error(`${label} failed`, { description: text }); } finally { setBusy(false); } }
  function runConversion() {
    setConfirmConversion(false);
    if (!conversionWorkflow || !schoolId || !resolved || !selectedConversionClass || !admissionNumbering) return;
    const idempotencyKey = conversionWorkflow.conversion?.idempotencyKey ?? crypto.randomUUID();
    const manualOverride = Boolean(admissionNumbering.policy && admissionNumber.trim());
    const numberingArgs = manualOverride
      ? { overrideReason: overrideReason.trim(), overrideConfirmed, overrideCounterDecision: "keep" as const }
      : admissionNumbering.policy
        ? { numberingVersion: admissionNumbering.version, numberingFormatVersion: admissionNumbering.formatVersion ?? undefined, numberingCounterKey: admissionNumbering.counter?.key, numberingCounterVersion: admissionNumbering.counter?.configVersion, numberingSessionId: admissionNumbering.activeSessionId ?? undefined, numberingResetPeriod: admissionNumbering.resetPeriod ?? undefined }
        : {};
    const selectedFamily = conversionWorkflow.families.find((item) => item.familyId === familyId);
    const familyResolution = familyKind === "existing"
      ? selectedFamily ? { kind: "existing" as const, familyId: selectedFamily.familyId } : null
      : { kind: "create" as const, ...(familyName ? { familyName } : {}) };
    if (!familyResolution) return;
    void run(conversionWorkflow.conversion?.state === "failed_retryable" ? "Conversion retry" : "Conversion start", () => convert({ schoolId, applicationId: resolved.applicationId, idempotencyKey, classId: selectedConversionClass.classId, admissionNumber: admissionNumber.trim(), familyResolution, ...numberingArgs }));
  }
  const numberingPolicyConfigured = Boolean(admissionNumbering?.policy);
  const manualNumberingReady = Boolean(admissionNumber.trim()) && (!numberingPolicyConfigured || (canOverrideNumber && overrideReason.trim().length >= 8 && overrideConfirmed && keepCounterConfirmed));
  const automaticNumberingReady = numberingPolicyConfigured && !admissionNumber.trim() && Boolean(admissionNumbering?.preview && admissionNumbering.formatVersion && admissionNumbering.counter && admissionNumbering.activeSessionId && admissionNumbering.resetPeriod);
  const conversionNumberingReady = admissionNumbering !== undefined && (manualNumberingReady || automaticNumberingReady);
  if (resolved === null) return <main className="p-6"><AdminHeader title="Application unavailable" description="The reference was not found or is outside this school." /><Link className={secondaryButtonClass} href="/admin/admissions">Return to admissions</Link></main>;
  if (!detail || !workflow || !resolved || !schoolId) return <main className="p-6"><p role="status">Loading application…</p></main>;
  const documents = [...detail.documents, ...(sensitive?.documents ?? [])];
  return <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
    <AdminHeader label="Admissions review" title={`Application ${detail.context.publicId}`} description={`Immutable submitted revision ${detail.context.currentRevision}`} actions={<Link className={secondaryButtonClass} href="/admin/admissions">Queue</Link>} />
    <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
      {feedback}
    </div>
    <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Submitted revision</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Submitted {new Date(detail.context.submittedAt).toLocaleString()} by {detail.context.signerName} ({detail.context.signerRelationship}). Declaration accepted {new Date(detail.context.declarationAcceptedAt).toLocaleString()}.
          </p>
        </div>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${detailStateBadge(detail.context.state)}`}>
          {statusLabel(detail.context.state)}
        </span>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Applicant" value={`${detail.profile.firstName} ${detail.profile.middleName ?? ""} ${detail.profile.lastName}`.replace(/\s+/g, " ")} />
        <Fact label="Date of birth" value={new Date(detail.profile.dateOfBirth).toLocaleDateString(undefined, { timeZone: "UTC" })} />
        <Fact label="Primary contact" value={`${detail.primaryContact.fullName} · ${detail.primaryContact.relationship}`} />
        <Fact label="Requested entry" value={detail.requestedEntryLabel ?? "Not supplied"} />
      </dl>
      <div className="border-t border-slate-100 pt-3">
        <AnswerList title="Application answers" answers={detail.answers} />
      </div>
      <div className="border-t border-slate-100 pt-3 flex flex-wrap items-center gap-3">
        {canSensitive ? (
          <button className={secondaryButtonClass} disabled={busy || Boolean(sensitive)} onClick={() => void run("Sensitive detail reveal", async () => { const result = await reveal({ schoolId, applicationId: resolved.applicationId, reason: "APPLICATION_REVIEW" }); setSensitive({ answers: result.answers, documents: result.documents }); })}>
            {sensitive ? "Sensitive details revealed" : "Reveal sensitive details"}
          </button>
        ) : (
          <p className="text-xs text-slate-500">Sensitive answers and documents require the sensitive-detail capability.</p>
        )}
      </div>
      {sensitive ? (
        <div className="border-t border-slate-100 pt-3">
          <AnswerList title="Sensitive answers" answers={sensitive.answers} />
        </div>
      ) : null}
    </AdminSurface>
    <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Documents</h2>
        <p className="text-xs sm:text-sm text-slate-500">Metadata is from the immutable submitted revision; current review state is shown separately. Retention controls are kept on the retention page.</p>
      </div>
      {documents.length ? (
        <div className="space-y-3">
          {documents.map((document) => (
            <DocumentRow key={document.documentKey} schoolId={schoolId} document={document} canReview={canReviewDocuments} onFeedback={setFeedback} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 py-2">No documents in this revision.</p>
      )}
    </AdminSurface>
    <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Review actions</h2>
      </div>
      {detail.context.state === "submitted" ? (
        <div className="pb-2">
          <button className={buttonClass} disabled={busy} onClick={() => void run("Review start", () => startReview({ schoolId, applicationId: resolved.applicationId }))}>
            Start review
          </button>
        </div>
      ) : null}
      {canReviewDocuments && ["submitted", "under_review"].includes(detail.context.state) ? (
        <form className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); void run("Correction request", () => requestChanges({ schoolId, applicationId: resolved.applicationId, fieldKeys: selectedFields, requirementIds: selectedRequirements, reasonCode: correctionReason, guardianMessage: correctionMessage })); }}>
          <h3 className="text-sm font-bold text-slate-900">Request corrections</h3>
          <p className="text-xs text-slate-500">Select fields or documents requiring correction, specify the reason, and provide an explanatory message.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {workflow.fieldKeys.map((key) => <Check key={key} label={`Field: ${key}`} checked={selectedFields.includes(key)} onChange={(checked) => setSelectedFields((current) => checked ? [...current, key] : current.filter((item) => item !== key))} />)}
            {workflow.requirements.map((item) => <Check key={item.requirementId} label={`Document: ${item.label}`} checked={selectedRequirements.includes(item.requirementId)} onChange={(checked) => setSelectedRequirements((current) => checked ? [...current, item.requirementId] : current.filter((id) => id !== item.requirementId))} />)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Reason code
              <input required className={`${inputClass} mt-1`} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Guardian-safe message
              <textarea required className={`${inputClass} mt-1 min-h-20`} value={correctionMessage} onChange={(event) => setCorrectionMessage(event.target.value)} />
            </label>
          </div>
          <button className={buttonClass} disabled={busy || (!selectedFields.length && !selectedRequirements.length)}>
            Request corrections
          </button>
        </form>
      ) : null}
      {canDecide && ["submitted", "under_review"].includes(detail.context.state) ? (
        <form className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); setConfirmDecision(true); }}>
          <h3 className="text-sm font-bold text-slate-900">Decision</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-700">
              Outcome
              <select className={`${inputClass} mt-1`} value={decisionState} onChange={(event) => setDecisionState(event.target.value === "rejected" ? "rejected" : "accepted")}>
                <option value="accepted">Accept</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Reason code
              <input required className={`${inputClass} mt-1`} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Guardian-safe message
            <textarea required className={`${inputClass} mt-1 min-h-20`} value={decisionMessage} onChange={(event) => setDecisionMessage(event.target.value)} />
          </label>
          <button className={buttonClass}>Record decision</button>
        </form>
      ) : null}
    </AdminSurface>
    {detail.context.state === "accepted" && canConvert ? (
      <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-display text-lg font-bold text-slate-900">Accepted conversion</h2>
          <p className="text-xs sm:text-sm text-slate-500">Conversion creates the canonical student and family link. Portal onboarding runs only after conversion succeeds.</p>
        </div>
        {conversionWorkflow === undefined ? (
          <p role="status">Loading conversion options...</p>
        ) : (
          <>
            {conversionWorkflow.conversion ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-sm space-y-1">
                <p><strong>Conversion:</strong> {statusLabel(conversionWorkflow.conversion.state)}</p>
                <p><strong>Admission number:</strong> {conversionWorkflow.conversion.admissionNumber ?? "Pending"}</p>
                <p><strong>Onboarding:</strong> {conversionWorkflow.conversion.onboardingState ? statusLabel(conversionWorkflow.conversion.onboardingState) : "Not queued"}</p>
                {conversionWorkflow.conversion.errorCode ? <p className="text-rose-700 font-medium">{conversionWorkflow.conversion.errorCode}</p> : null}
              </div>
            ) : null}
            {!conversionWorkflow.conversion || conversionWorkflow.conversion.state === "failed_retryable" ? (
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setConfirmConversion(true); }}>
                <label className="text-xs font-semibold text-slate-700">
                  Class
                  <select required className={`${inputClass} mt-1`} value={classId} onChange={(event) => { setClassId(event.target.value); setAdmissionNumber(""); setOverrideReason(""); setOverrideConfirmed(false); setKeepCounterConfirmed(false); }}>
                    <option value="">Select class</option>
                    {conversionWorkflow.classes.map((item) => <option key={item.classId} value={item.classId}>{item.name}</option>)}
                  </select>
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs sm:col-span-2 text-slate-700">
                  {!classId ? "Select a class to load governed admission numbering." : admissionNumbering === undefined ? "Loading governed admission numbering…" : admissionNumbering.policy ? admissionNumbering.preview ? `Automatic admission number preview: ${admissionNumbering.preview}. Leave the manual field blank to use it.` : `Automatic numbering is unavailable: ${admissionNumbering.unavailableReason ?? "review the school numbering setup"}.` : "No admission-numbering policy is configured. Enter a manual admission number."}
                </div>
                {!numberingPolicyConfigured || canOverrideNumber ? (
                  <label className="text-xs font-semibold text-slate-700">
                    Manual admission number
                    <input className={`${inputClass} mt-1`} value={admissionNumber} onChange={(event) => setAdmissionNumber(event.target.value)} placeholder={numberingPolicyConfigured ? "Leave blank for automatic numbering" : "Required without a numbering policy"} />
                  </label>
                ) : null}
                {numberingPolicyConfigured && admissionNumber.trim() ? (
                  <>
                    <label className="text-xs font-semibold text-slate-700 sm:col-span-2">
                      Override reason
                      <input required minLength={8} maxLength={240} className={`${inputClass} mt-1`} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
                    </label>
                    <Check label="I confirm this manual admission-number override" checked={overrideConfirmed} onChange={setOverrideConfirmed} />
                    <Check label="Keep the automatic counter unchanged" checked={keepCounterConfirmed} onChange={setKeepCounterConfirmed} />
                  </>
                ) : null}
                <label className="text-xs font-semibold text-slate-700">
                  Family resolution
                  <select className={`${inputClass} mt-1`} value={familyKind} onChange={(event) => setFamilyKind(event.target.value === "existing" ? "existing" : "create")}>
                    <option value="create">Create family</option>
                    <option value="existing">Existing family</option>
                  </select>
                </label>
                {familyKind === "create" ? (
                  <label className="text-xs font-semibold text-slate-700">
                    Family name
                    <input className={`${inputClass} mt-1`} value={familyName} onChange={(event) => setFamilyName(event.target.value)} />
                  </label>
                ) : (
                  <label className="text-xs font-semibold text-slate-700">
                    Existing family
                    <select required className={`${inputClass} mt-1`} value={familyId} onChange={(event) => setFamilyId(event.target.value)}>
                      <option value="">Select family</option>
                      {conversionWorkflow.families.map((item) => <option key={item.familyId} value={item.familyId}>{item.name}</option>)}
                    </select>
                  </label>
                )}
                <div className="sm:col-span-2 pt-2">
                  <button className={buttonClass} disabled={busy || !classId || !conversionNumberingReady || (familyKind === "existing" && !familyId)}>
                    {conversionWorkflow.conversion?.state === "failed_retryable" ? "Retry conversion" : "Start conversion"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="text-sm font-semibold text-slate-700">
                {conversionWorkflow.conversion.state === "requested" || conversionWorkflow.conversion.state === "running" ? "Conversion is in progress; another request is not allowed." : conversionWorkflow.conversion.state === "succeeded" ? "Conversion completed successfully." : "Conversion ended with a terminal failure. A new conversion request is not allowed."}
              </p>
            )}
          </>
        )}
      </AdminSurface>
    ) : null}
    <ConfirmDialog open={confirmDecision} title={`${decisionState === "accepted" ? "Accept" : "Reject"} this application?`} description="This records a decision against the immutable submitted revision and sends only the guardian-safe message to the guardian workflow." confirmLabel="Record decision" onCancel={() => setConfirmDecision(false)} onConfirm={() => { setConfirmDecision(false); void run("Decision", () => decide({ schoolId, applicationId: resolved.applicationId, state: decisionState, reasonCode: decisionReason, guardianMessage: decisionMessage })); }} />
    <ConfirmDialog open={confirmConversion} title="Start accepted-application conversion?" description="This creates or links the canonical family and student records. Confirm only after reviewing the selected class, admission number, and family resolution." confirmLabel={conversionWorkflow?.conversion?.state === "failed_retryable" ? "Retry conversion" : "Start conversion"} onCancel={() => setConfirmConversion(false)} onConfirm={runConversion} />
  </main>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900 break-words">{value}</dd>
    </div>
  );
}

function AnswerList({ title, answers }: { title: string; answers: Array<{ fieldKey: string; serializedValue: string }> }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      {answers.length ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {answers.map((answer) => <Fact key={answer.fieldKey} label={answer.fieldKey} value={answer.serializedValue} />)}
        </dl>
      ) : (
        <p className="text-xs text-slate-500">No answers in this category.</p>
      )}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${checked ? "border-sky-300 bg-sky-50/50 text-sky-950 font-medium" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function DocumentRow({ schoolId, document, canReview, onFeedback }: { schoolId: Id<"schools">; document: DocumentMetadata; canReview: boolean; onFeedback: (value: string) => void }) {
  const access = useMutation(getDocumentAccessRef), review = useMutation(recordDocumentReviewRef);
  const [reason, setReason] = useState("APPLICATION_REVIEW"), [guardianMessage, setGuardianMessage] = useState("");
  async function perform(operation: () => Promise<unknown>, success: string) { try { await operation(); onFeedback(success); appToast.success(success); } catch (error) { const text = message(error); onFeedback(text); appToast.error("Document action failed", { description: text }); } }
  return (
    <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{document.fileName}</h3>
          <p className="text-xs text-slate-500">{document.category} · {document.mimeType} · {document.byteSize.toLocaleString()} bytes · version {document.version}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>Submitted: <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700">{statusLabel(document.submittedState)}</span></span>
            <span>Current: <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium ${document.currentState === "accepted" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ["rejected", "needs_replacement"].includes(document.currentState) ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{statusLabel(document.currentState)}</span></span>
            <span className="font-mono text-slate-500 break-all">SHA-256: {document.sha256}</span>
          </div>
        </div>
      </div>
      {canReview ? (
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700">
            Access/review reason
            <input className={`${inputClass} mt-1`} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButtonClass} onClick={() => void perform(async () => { const result = await access({ schoolId, documentKey: document.documentKey, action: "view", reason }); if (result.status !== "available") throw new Error("Checked document access is unavailable."); window.open(result.url, "_blank", "noopener,noreferrer"); }, "Checked document access granted")}>
              View
            </button>
            <button className={buttonClass} onClick={() => void perform(() => review({ schoolId, documentKey: document.documentKey, result: "accepted" }), "Document accepted")}>
              Accept document
            </button>
            <button className={dangerButtonClass} disabled={!reason || !guardianMessage} onClick={() => void perform(() => review({ schoolId, documentKey: document.documentKey, result: "needs_replacement", reasonCode: reason, guardianMessage }), "Replacement requested")}>
              Request replacement
            </button>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Guardian-safe replacement message
            <textarea className={`${inputClass} mt-1 min-h-20`} value={guardianMessage} onChange={(event) => setGuardianMessage(event.target.value)} />
          </label>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Document access and review require the document-review capability.</p>
      )}
    </article>
  );
}
