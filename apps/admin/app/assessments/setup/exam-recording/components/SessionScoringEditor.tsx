"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useDirtyForm } from "@school/shared/drafts";
import { SESSION_SCORING_PRESETS, validateSessionScoringPolicy, type SessionScoringPolicy } from "@school/shared/exam-recording";
import type { Id } from "@/types";

const fields = [
  ["ca1Max", "CA 1 contribution"], ["ca2Max", "CA 2 contribution"],
  ["ca3Max", "CA 3 contribution"], ["examRawMax", "Exam raw maximum"],
  ["examContributionMax", "Exam contribution"],
] as const;

type Current = { policy: SessionScoringPolicy; version: number; source: "legacy" | "session" };
type Phase = "scanning" | "failed_scanning" | "invalid" | "ready" | "regrading" | "failed_regrading" | "complete";
type Job = {
  phase: Phase; policy: SessionScoringPolicy; expectedVersion: number;
  scanned: number; invalidCount: number; updated: number; failureReason?: string;
  invalidExamples: Array<{ studentId: string; termId: string; classId: string; subjectId: string; recordId: string; field: string; message: string }>;
};
type Preview = { phase: Phase | "not_started"; count: number; invalidCount: number; invalidCountIsPartial: boolean; canApply: boolean; warning: string };
const same = (a: SessionScoringPolicy, b: SessionScoringPolicy) => fields.every(([key]) => a[key] === b[key]);

export function SessionScoringEditor({ sessionId }: { sessionId: Id<"academicSessions"> }) {
  const current = useQuery("functions/academic/sessionScoring:getSessionScoringPolicy" as never, { sessionId } as never) as Current | undefined;
  const job = useQuery("functions/academic/sessionScoring:getSessionScoringJob" as never, { sessionId } as never) as Job | null | undefined;
  const [draft, setDraft] = useState<SessionScoringPolicy | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [rawValue, setRawValue] = useState("");
  const [baseline, setBaseline] = useState<Current | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pinLegacy, setPinLegacy] = useState(false);
  const start = useMutation("functions/academic/sessionScoring:startSessionScoringScan" as never);
  const apply = useMutation("functions/academic/sessionScoring:applySessionScoringChange" as never);
  const cancel = useMutation("functions/academic/sessionScoring:cancelSessionScoringScan" as never);
  const resume = useMutation("functions/academic/sessionScoring:resumeSessionScoringJob" as never);
  const incompleteInput = editingField !== null && !/^(?:\d+)(?:\.\d{1,2})?$/.test(rawValue);
  const validation = draft ? validateSessionScoringPolicy(draft) : [];
  if (incompleteInput) validation.push("Finish entering a valid weight before scanning.");
  const dirty = !!draft && !!baseline && (!same(draft, baseline.policy) || (baseline.source === "legacy" && pinLegacy));
  const stale = !!current && !!baseline && current.version !== baseline.version;
  const matching = !!job && !!draft && !!baseline && same(job.policy, draft) && job.expectedVersion === baseline.version;
  const preview = useQuery("functions/academic/sessionScoring:previewSessionScoringChange" as never,
    draft && validation.length === 0 && !stale ? { sessionId, policy: draft } as never : "skip" as never) as Preview | undefined;

  useEffect(() => {
    if (current && !baseline) {
      setBaseline(current);
      setDraft({ ...current.policy });
    } else if (current && baseline && current.version !== baseline.version && !dirty) {
      setBaseline(current);
      setDraft({ ...current.policy });
      setPinLegacy(false);
      setConfirmed(false);
    }
  }, [current, baseline, dirty]);
  // The job is the durable copy of a scanned draft. Hydrate only while the local
  // draft is pristine, so a late query cannot replace an intentional edit.
  useEffect(() => {
    if (!current || !baseline || !draft || !job || job.phase === "complete" || current.version !== job.expectedVersion || baseline.version !== job.expectedVersion || dirty) return;
    if (!same(draft, job.policy)) setDraft({ ...job.policy });
    else if (baseline.source === "legacy" && !pinLegacy) setPinLegacy(true);
  }, [current, baseline, draft, job, dirty, pinLegacy]);
  useEffect(() => { setConfirmed(false); }, [draft]);
  useDirtyForm({ name: "Session scoring policy", isDirty: dirty,
    discard: () => { setDraft(current ? { ...current.policy } : null); setBaseline(current ?? null); setPinLegacy(false); setConfirmed(false); } });

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed. Try again."); }
    finally { setBusy(false); }
  }

  if (!current || !draft || !baseline || job === undefined) return <p role="status">Loading session scoring policy…</p>;
  const locked = !!job && job.phase !== "complete";
  const ready = !stale && matching && job?.phase === "ready" && preview?.phase === "ready" && preview.canApply;
  const total = draft.ca1Max + draft.ca2Max + draft.ca3Max + draft.examContributionMax;
  return (
    <section aria-label="Session scoring policy" className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Session scoring policy</h2>
        <p className="text-sm text-slate-600">This policy applies only to the selected session. Existing sessions are not updated automatically. {current.source === "legacy" ? "Using legacy weights until a session policy is applied." : `Session policy version ${current.version}.`}</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Preset starters">
        {SESSION_SCORING_PRESETS.map((preset, index) => (
          <button key={index} type="button" disabled={locked || busy} onClick={() => setDraft({ ...preset })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50">
            {index === 0 ? "20/20/20 + exam /40 worth 40" : index === 1 ? "20/20/20 + exam /60 worth 40" : "20/20/10 + exam /50 worth 50"}
          </button>
        ))}
      </div>
      {baseline.source === "legacy" && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={pinLegacy} disabled={locked || busy || stale} onChange={event => setPinLegacy(event.target.checked)} /> Save these legacy weights as an explicit session policy</label>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {fields.map(([field, label]) => <label key={field} className="text-sm font-semibold text-slate-700">{label}
          <input type="text" inputMode="decimal" value={editingField === field ? rawValue : Number.isNaN(draft[field]) ? "" : draft[field]}
            disabled={locked || busy} onFocus={() => { setEditingField(field); setRawValue(Number.isNaN(draft[field]) ? "" : String(draft[field])); }}
            onBlur={() => { if (rawValue === "") setDraft(previous => previous ? { ...previous, [field]: NaN } : previous); setEditingField(null); }}
            onChange={event => { const raw = event.target.value; setRawValue(raw); if (/^\d+(?:\.\d{1,2})?$/.test(raw)) setDraft(previous => previous ? { ...previous, [field]: Number(raw) } : previous); }}
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:opacity-50" />
        </label>)}
      </div>
      <p className="text-sm text-slate-700">CA and exam contributions total {Number.isFinite(total) ? total : "—"}/100. Exam contribution = round(raw ÷ {draft.examRawMax} × {draft.examContributionMax}, 2).</p>
      {validation.length > 0 && <ul role="alert" className="text-sm text-rose-800">{validation.map(message => <li key={message}>{message}</li>)}</ul>}
      {stale && <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p>Session policy changed to version {current.version} while you were editing. Your draft is intact. Review it against the new policy before starting a new scan.</p><button type="button" disabled={busy || locked} onClick={() => { setBaseline(current); setConfirmed(false); setError(null); }} className="rounded-lg border border-amber-400 px-3 py-2 font-semibold disabled:opacity-50">Rebase draft on version {current.version}</button> <button type="button" disabled={busy || locked} onClick={() => { setBaseline(current); setDraft({ ...current.policy }); setPinLegacy(false); setConfirmed(false); setError(null); }} className="rounded-lg border border-amber-400 px-3 py-2 font-semibold disabled:opacity-50">Discard draft and load current policy</button></div>}
      {error && <p role="alert" className="text-sm text-rose-800">{error}</p>}
      {job && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p>Job: {job.phase.replaceAll("_", " ")}. {job.phase === "scanning" || job.phase === "failed_scanning" ? "Partial counts: " : ""}{job.scanned} records scanned, {job.invalidCount} invalid records, {job.updated} regraded.</p>
        {job.failureReason && <p>Failure: {job.failureReason}. Scores and reports remain locked. Resume the job.</p>}
        {job.phase === "invalid" && <p>Cancel the scan to unlock score entry, correct these scores, then scan again.</p>}
        {job.phase === "complete" && <p>Regrade complete. Issued reports remain unchanged; review them. Replacement certification is currently unavailable.</p>}
        {job.invalidExamples.length > 0 && <ul className="mt-2 list-disc pl-5">{job.invalidExamples.map((example, i) => <li key={`${example.recordId}-${example.field}-${i}`}>Student {example.studentId}, term {example.termId}, record {example.recordId}: {example.field} {example.message}. <a className="font-semibold underline" href={`/assessments/results/entry?${new URLSearchParams({ sessionId, termId: example.termId, classId: example.classId, subjectId: example.subjectId, studentId: example.studentId })}`}>Open the student score sheet</a> after cancelling the scan. The student row will scroll into view when the sheet loads.</li>)}</ul>}
      </div>}
      {preview && matching && <p role="status" className="text-sm text-slate-700">{preview.warning} {preview.invalidCountIsPartial ? "Counts are partial." : `Final scan: ${preview.count} affected records, ${preview.invalidCount} invalid.`}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={!dirty || stale || validation.length > 0 || locked || busy} onClick={() => run(() => start({ sessionId, policy: draft, expectedVersion: baseline.version, expectedPolicy: baseline.policy } as never))} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Scan all session scores</button>
        {job && ["scanning", "failed_scanning", "ready", "invalid"].includes(job.phase) && <button type="button" disabled={busy} onClick={() => run(() => cancel({ sessionId } as never))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel scan and unlock</button>}
        {job && ["failed_scanning", "failed_regrading"].includes(job.phase) && <button type="button" disabled={busy} onClick={() => run(() => resume({ sessionId } as never))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Resume job</button>}
      </div>
      {ready && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 space-y-3">
        <p>Confirm regrading {preview.count} scores in this session. Other sessions will not change. Issued reports remain unchanged; review them after completion. Replacement certification is currently unavailable.</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I reviewed the complete scan and want to start the regrade.</label>
        <button type="button" disabled={!confirmed || busy} onClick={() => run(() => apply({ sessionId, policy: draft, expectedVersion: baseline.version, expectedPolicy: baseline.policy, confirmRegrade: true } as never))} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Start regrade</button>
      </div>}
    </section>
  );
}
