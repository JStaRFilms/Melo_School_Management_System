"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  markReadyForDecisionRef,
  recordDecisionRef,
  recordEvaluationRef,
  reopenDecisionRef,
  resumeWaitlistedRef,
  startReviewRef,
  type DecisionWorkflow,
} from "@school/convex/functions/admissions/refs";
import { appToast } from "@school/shared/toast";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { admissionsAdminErrorMessage } from "../admissions-errors";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass = "inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

type EvaluationType = "entrance_assessment" | "interview";
type EvaluationState = "scheduled" | "completed" | "cancelled";
type DecisionState = "waitlisted" | "accepted" | "rejected";

function label(value: string) { return value.replaceAll("_", " "); }
function evaluationStateFromValue(value: string): EvaluationState { return value === "completed" || value === "cancelled" ? value : "scheduled"; }
function decisionStateFromValue(value: string): DecisionState { return value === "accepted" || value === "rejected" ? value : "waitlisted"; }

export function readinessBlockerMessage(blocker: string) {
  if (blocker === "CURRENT_SNAPSHOT_UNAVAILABLE") return "The current submitted snapshot is unavailable.";
  if (blocker === "READINESS_EVIDENCE_UNAVAILABLE") return "The evidence needed for a readiness check is unavailable.";
  if (blocker === "FINANCIAL_HOLD") return "A financial hold must be resolved before a decision.";
  if (blocker.startsWith("DOCUMENT_REVIEW_PENDING:")) return "A required document is awaiting a completed review.";
  if (blocker === "EVALUATION_PENDING") return "A scheduled evaluation must be completed or cancelled.";
  return "A workflow requirement still needs attention.";
}

export function getDecisionControlVisibility(input: {
  applicationState: string;
  decisionState: NonNullable<DecisionWorkflow["decision"]>["state"] | null;
  readinessReady: boolean;
  canReviewDocuments: boolean;
  canDecide: boolean;
  canReopenFinalDecision: boolean;
}) {
  const inEvaluation = input.applicationState === "under_review" && input.decisionState === "in_evaluation";
  return {
    startReview: input.canReviewDocuments && (input.applicationState === "submitted" || (input.applicationState === "under_review" && input.decisionState === null)),
    evaluation: input.canReviewDocuments && inEvaluation,
    markReady: input.canReviewDocuments && inEvaluation && input.readinessReady,
    decision: input.canDecide && input.readinessReady && (input.decisionState === "ready_for_decision" || input.decisionState === "waitlisted"),
    resumeWaitlist: input.canDecide && input.decisionState === "waitlisted",
    reopen: input.canReopenFinalDecision && (input.decisionState === "accepted" || input.decisionState === "rejected"),
  };
}

export function DecisionWorkflowSection({ schoolId, applicationId, applicationState, workflow, canReviewDocuments, canDecide, canReopenFinalDecision, onFeedback }: {
  schoolId: Id<"schools">;
  applicationId: Id<"admissionsApplications">;
  applicationState: string;
  workflow: DecisionWorkflow;
  canReviewDocuments: boolean;
  canDecide: boolean;
  canReopenFinalDecision: boolean;
  onFeedback: (message: string) => void;
}) {
  const startReview = useMutation(startReviewRef);
  const recordEvaluation = useMutation(recordEvaluationRef);
  const markReady = useMutation(markReadyForDecisionRef);
  const recordDecision = useMutation(recordDecisionRef);
  const resumeWaitlisted = useMutation(resumeWaitlistedRef);
  const reopenDecision = useMutation(reopenDecisionRef);
  const [busy, setBusy] = useState(false);
  const [evaluationType, setEvaluationType] = useState<EvaluationType>("entrance_assessment");
  const [evaluationState, setEvaluationState] = useState<EvaluationState>("scheduled");
  const [scheduledAt, setScheduledAt] = useState("");
  const [resultCode, setResultCode] = useState("");
  const [score, setScore] = useState("");
  const [decisionState, setDecisionState] = useState<DecisionState>("waitlisted");
  const [decisionReason, setDecisionReason] = useState("");
  const [guardianMessage, setGuardianMessage] = useState("");
  const [resumeReason, setResumeReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [confirmDecision, setConfirmDecision] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);

  const currentState = workflow.decision?.state ?? null;
  const visibility = getDecisionControlVisibility({ applicationState, decisionState: currentState, readinessReady: workflow.readiness.ready, canReviewDocuments, canDecide, canReopenFinalDecision });
  const latestEvaluation = workflow.evaluations.find((item) => item.type === evaluationType);
  const allowedEvaluationStates: EvaluationState[] = latestEvaluation?.state === "scheduled" ? ["scheduled", "completed", "cancelled"] : ["scheduled"];
  const effectiveEvaluationState = allowedEvaluationStates.includes(evaluationState) ? evaluationState : allowedEvaluationStates[0];
  const legalDecisionStates: DecisionState[] = currentState === "waitlisted"
    ? [...(workflow.readiness.acceptanceReady ? ["accepted" as const] : []), "rejected"]
    : ["waitlisted", ...(workflow.readiness.acceptanceReady ? ["accepted" as const] : []), "rejected"];
  const effectiveDecisionState = legalDecisionStates.includes(decisionState) ? decisionState : legalDecisionStates[0];

  async function run(actionLabel: string, operation: () => Promise<unknown>) {
    setBusy(true);
    onFeedback(`${actionLabel}…`);
    try {
      await operation();
      onFeedback(`${actionLabel} completed.`);
      appToast.success(`${actionLabel} completed`);
    } catch (error) {
      const safeMessage = admissionsAdminErrorMessage(error);
      onFeedback(safeMessage);
      appToast.error(`${actionLabel} failed`, { description: safeMessage });
    } finally {
      setBusy(false);
    }
  }

  function submitEvaluation() {
    const parsedScore = score.trim() ? Number(score) : undefined;
    const parsedSchedule = effectiveEvaluationState === "scheduled" ? Date.parse(scheduledAt) : undefined;
    void run("Evaluation record", () => recordEvaluation({
      schoolId,
      applicationId,
      type: evaluationType,
      state: effectiveEvaluationState,
      ...(parsedSchedule !== undefined ? { scheduledAt: parsedSchedule } : {}),
      ...(effectiveEvaluationState === "completed" ? { resultCode: resultCode.trim() } : {}),
      ...(effectiveEvaluationState === "completed" && parsedScore !== undefined ? { score: parsedScore } : {}),
    }));
  }

  function submitDecision() {
    setConfirmDecision(false);
    void run("Decision record", () => recordDecision({ schoolId, applicationId, state: effectiveDecisionState, reasonCode: decisionReason.trim(), guardianMessage: guardianMessage.trim() }));
  }

  const blockers = [...new Set(workflow.readiness.blockers.map(readinessBlockerMessage))];
  return <>
    <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="font-display text-lg font-bold text-slate-900">Decision workflow</h2>
        <p className="text-xs sm:text-sm text-slate-500">Evaluation and decisions are versioned against the current immutable submission. Conversion remains a separate workflow.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm"><strong>Current state:</strong> {workflow.decision ? label(workflow.decision.state) : "review not started"}{workflow.decision ? ` · version ${workflow.decision.version}` : ""}</div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-sm"><strong>Readiness:</strong> {workflow.readiness.ready ? "ready for a decision" : "not ready"}{workflow.readiness.ready && !workflow.readiness.acceptanceReady ? " · acceptance blocked" : ""}</div>
      </div>
      {blockers.length ? <div><h3 className="text-sm font-bold text-slate-900">Readiness blockers</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : <p className="text-sm text-slate-700">No current readiness blockers.</p>}
      <div><h3 className="text-sm font-bold text-slate-900">Latest evaluations</h3>{workflow.evaluations.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{workflow.evaluations.map((evaluation) => <div className="rounded-lg border border-slate-200 p-3 text-sm" key={`${evaluation.type}-${evaluation.version}`}><strong>{label(evaluation.type)}</strong> · {label(evaluation.state)} · version {evaluation.version}{evaluation.scheduledAt ? <p>Scheduled {new Date(evaluation.scheduledAt).toLocaleString()}</p> : null}{evaluation.completedAt ? <p>Completed {new Date(evaluation.completedAt).toLocaleString()}</p> : null}{evaluation.resultCode ? <p>Result: {evaluation.resultCode}</p> : null}{evaluation.score !== null ? <p>Score: {evaluation.score}/100</p> : null}</div>)}</div> : <p className="mt-1 text-sm text-slate-500">No evaluations recorded.</p>}</div>
      {visibility.startReview ? <button className={buttonClass} disabled={busy} onClick={() => void run("Review start", () => startReview({ schoolId, applicationId }))}>Start review</button> : null}
      {visibility.evaluation ? <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); submitEvaluation(); }}>
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Record evaluation</h3>
        <label className="text-xs font-semibold text-slate-700">Evaluation type<select className={`${inputClass} mt-1`} value={evaluationType} onChange={(event) => { setEvaluationType(event.target.value === "interview" ? "interview" : "entrance_assessment"); setEvaluationState("scheduled"); }}><option value="entrance_assessment">Entrance assessment</option><option value="interview">Interview</option></select></label>
        <label className="text-xs font-semibold text-slate-700">Record state<select className={`${inputClass} mt-1`} value={effectiveEvaluationState} onChange={(event) => setEvaluationState(evaluationStateFromValue(event.target.value))}>{allowedEvaluationStates.map((state) => <option key={state} value={state}>{label(state)}</option>)}</select></label>
        {effectiveEvaluationState === "scheduled" ? <label className="text-xs font-semibold text-slate-700">Scheduled date and time<input required type="datetime-local" className={`${inputClass} mt-1`} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label> : null}
        {effectiveEvaluationState === "completed" ? <><label className="text-xs font-semibold text-slate-700">Result code<input required maxLength={100} className={`${inputClass} mt-1`} value={resultCode} onChange={(event) => setResultCode(event.target.value)} /></label><label className="text-xs font-semibold text-slate-700">Score (optional)<input type="number" min="0" max="100" step="0.01" className={`${inputClass} mt-1`} value={score} onChange={(event) => setScore(event.target.value)} /></label></> : null}
        <button className={buttonClass} disabled={busy}>{effectiveEvaluationState === "scheduled" ? "Schedule evaluation" : `Record ${effectiveEvaluationState} evaluation`}</button>
      </form> : null}
      {visibility.markReady ? <button className={buttonClass} disabled={busy} onClick={() => void run("Ready for decision", () => markReady({ schoolId, applicationId }))}>Mark ready for decision</button> : null}
      {visibility.decision ? <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setConfirmDecision(true); }}>
        <h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Record immutable decision</h3>
        <label className="text-xs font-semibold text-slate-700">Outcome<select className={`${inputClass} mt-1`} value={effectiveDecisionState} onChange={(event) => setDecisionState(decisionStateFromValue(event.target.value))}>{legalDecisionStates.map((state) => <option key={state} value={state}>{label(state)}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">Reason code<input required maxLength={100} className={`${inputClass} mt-1`} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Guardian-safe message<textarea required maxLength={1000} className={`${inputClass} mt-1 min-h-20`} value={guardianMessage} onChange={(event) => setGuardianMessage(event.target.value)} /></label>
        <button className={buttonClass} disabled={busy}>Review and record decision</button>
      </form> : null}
      {visibility.resumeWaitlist ? <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void run("Waitlist evaluation resume", () => resumeWaitlisted({ schoolId, applicationId, reasonCode: resumeReason.trim() })); }}><h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Resume waitlisted evaluation</h3><label className="text-xs font-semibold text-slate-700">Reason code<input required maxLength={100} className={`${inputClass} mt-1`} value={resumeReason} onChange={(event) => setResumeReason(event.target.value)} /></label><button className={secondaryButtonClass} disabled={busy}>Resume evaluation</button></form> : null}
      {visibility.reopen ? <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setConfirmReopen(true); }}><h3 className="text-sm font-bold text-slate-900 sm:col-span-2">Manager reopen</h3><label className="text-xs font-semibold text-slate-700">Reason code<input required maxLength={100} className={`${inputClass} mt-1`} value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} /></label><button className={secondaryButtonClass} disabled={busy}>Review reopen request</button></form> : null}
    </AdminSurface>
    <ConfirmDialog open={confirmDecision} title={`Record ${label(effectiveDecisionState)} decision?`} description="This appends an immutable decision version against the current submitted snapshot. Waitlisting is not admission and does not reserve a place. Sign in again first if your session is no longer recent." confirmLabel="Record decision" onCancel={() => setConfirmDecision(false)} onConfirm={submitDecision} />
    <ConfirmDialog open={confirmReopen} title="Reopen this final decision?" description="This appends a new in-evaluation workflow version. It does not erase the final decision history, and it is unavailable after completed conversion." confirmLabel="Reopen decision" onCancel={() => setConfirmReopen(false)} onConfirm={() => { setConfirmReopen(false); void run("Decision reopen", () => reopenDecision({ schoolId, applicationId, reasonCode: reopenReason.trim() })); }} />
  </>;
}
