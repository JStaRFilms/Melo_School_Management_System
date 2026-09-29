"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";

const confirmation = "I reviewed this roster and understand that releasing it makes these reports visible to families.";
type Selection = { sessionId: string; termId: string; classId: string };
type Context = { school: string; session: string; term: string; klass: string; canRelease: boolean; canExclude: boolean; releasesPaused?: boolean };
type Release = { releasedAt: number; releasedByName?: string; eligibleCount: number; certifiedCount: number; excludedCount: number };
const button = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50";

export function ReviewDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab" || !ref.current) return;
      const elements = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]')];
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current.querySelector("h2") || !ref.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !ref.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previousFocus.current?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="presentation"><div ref={ref} role="dialog" aria-modal="true" aria-labelledby="release-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4"><h2 id="release-dialog-title" tabIndex={-1} className="text-xl font-bold">{title}</h2>{children}</div></div>;
}

export function ClassReleasePanel({ schoolId, selection, context }: { schoolId: Id<"schools">; selection: Selection; context: Context }) {
  const args = { schoolId, sessionId: selection.sessionId as Id<"academicSessions">, termId: selection.termId as Id<"academicTerms">, classId: selection.classId as Id<"classes"> };
  const readiness = useQuery(api.functions.academic.resultPublication.getClassReadiness, args);
  const release = useMutation(api.functions.academic.resultPublication.releaseClassResults);
  const exclude = useMutation(api.functions.academic.resultPublication.excludeStudent);
  const [dialog, setDialog] = useState<"release" | "exclude" | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [staleKey, setStaleKey] = useState<string | null>(null);
  const [savedRelease, setSavedRelease] = useState<Release | null>(null);
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const releasedHeading = useRef<HTMLHeadingElement>(null);
  const close = () => { if (!pending) { setDialog(null); setChecked(false); setError(""); setReason(""); } };
  const rosterChanged = dialog === "release" && !!readiness && openedKey !== readiness.reviewKey;
  const staleReview = rosterChanged || (!!readiness && !!staleKey && readiness.reviewKey === staleKey);
  const current = readiness && !staleReview;
  useEffect(() => {
    if (dialog === "release" && readiness && openedKey !== readiness.reviewKey) setChecked(false);
  }, [dialog, openedKey, readiness]);
  const released = readiness?.released ?? savedRelease;
  const blocked = readiness ? readiness.rows.filter(r => r.status === "blocked").length : 0;
  const selected = readiness?.rows.find(r => r.studentId === studentId);
  const contextLabel = `${context.school} / ${context.klass} / ${context.session} / ${context.term}`;
  const reviewHref = (id: string) => `/assessments/report-cards?${new URLSearchParams({ ...selection, studentId: id, schoolId })}`;
  const needsAdmin = (code: string | null) => code !== null && code !== "not_certified" && code !== "enrollment_status";
  return <section className="space-y-5" aria-label="Class release readiness">
    <p className="text-base font-semibold">{contextLabel}</p>
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div role="status" aria-live="polite"><h2 ref={releasedHeading} tabIndex={released ? -1 : undefined} className="text-xl font-bold">{released ? "Released to families" : readiness?.ready && current ? "Ready to release" : "Not published"}</h2>
        <p>{released ? `Original release: ${new Date(released.releasedAt).toLocaleString()} by ${released.releasedByName || "Staff member"}. The released roster is frozen.` : "Families cannot see these results until this class is released."}</p></div>
      {readiness ? <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Eligible", released?.eligibleCount ?? readiness.eligibleCount], ["Certified", released?.certifiedCount ?? readiness.certifiedCount], ["Missing certification", released ? 0 : readiness.eligibleCount - readiness.certifiedCount], ["Excluded", released?.excludedCount ?? readiness.excludedCount]].map(([label, count]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><dt>{label}</dt><dd className="text-2xl font-bold">{count}</dd></div>)}</dl> : <p role="status">Loading readiness...</p>}
    </div>
    {readiness && <div className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-xl font-bold">Reviewed roster</h2>
      {readiness.rows.length === 0 ? <p>Roster needs review. No eligible students found.</p> : <><div aria-hidden="true" className="mb-2 hidden grid-cols-[2fr_1fr_2fr_1fr] gap-2 px-4 font-semibold sm:grid"><span>Student</span><span>Status</span><span>Reason</span><span>Action</span></div><ul className="space-y-3">{readiness.rows.map(row => <li key={row.studentId} className="grid gap-2 rounded-lg border p-4 sm:grid-cols-[2fr_1fr_2fr_1fr] sm:items-center">
        <div><span className="sm:hidden">Student: </span><strong>{row.name}</strong><span className="block text-sm text-slate-600">{row.admissionNumber}</span></div>
        <div><span className="sm:hidden">Status: </span>{row.status === "certified" ? "Certified" : row.status === "excluded" ? "Excluded" : "Needs attention"}</div>
        <div><span className="sm:hidden">Reason: </span>{row.reason ?? "None"}{row.status === "excluded" && <span className="block text-sm">Approved by {row.approvedByName || "Staff member"}</span>}</div>
        <div className="space-y-2">{row.status === "blocked" && (needsAdmin(row.reasonCode) ? <span>Contact your school administrator for review</span> : <Link className="inline-flex min-h-11 items-center underline focus-visible:outline-2" href={reviewHref(row.studentId)}>Review report card</Link>)}
          {context.canExclude && !released && row.canExclude && <button type="button" className={button} onClick={() => { setStudentId(row.studentId); setReason(""); setError(""); setDialog("exclude"); }}>Exclude student</button>}</div>
      </li>)}</ul></>}
      {released && <p className="mt-4">Not included in this release. A reviewed amendment is required for later additions or corrections.</p>}
    </div>}
    <footer className="space-y-2">{(context.canRelease || context.releasesPaused) && !released && <><button type="button" className={button} disabled={!!context.releasesPaused || !context.canRelease || !readiness?.ready || !readiness.reviewKey || !current || pending} onClick={() => { setOpenedKey(readiness?.reviewKey ?? null); setChecked(false); setError(""); setDialog("release"); }}>Review release</button>
      {(context.releasesPaused || !readiness?.ready || !current) && <p role="status">{context.releasesPaused ? "New class releases are paused for this school." : !readiness ? "Loading readiness..." : !current ? "The roster changed. Review the updated list before releasing." : blocked ? `${blocked} students need attention.` : "Roster needs review."}</p>}</>}</footer>
    <p role="status" aria-live="polite">{notice}</p>
    {dialog === "exclude" && selected && <ReviewDialog title="Exclude student?" onClose={close}><p>{selected.name} ({selected.admissionNumber}) from {contextLabel}</p><p>This student will not receive this class release, even if a report is certified. The decision is recorded for review.</p>
      <label className="block font-semibold">Reason<textarea className="mt-2 block w-full rounded border p-2" value={reason} onChange={e => setReason(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "exclusion-error" : undefined} rows={4} /></label>
      {error && <p id="exclusion-error" role="alert" className="text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={close} disabled={pending}>Cancel</button><button type="button" className={button} disabled={pending || reason.trim().length < 10 || reason.trim().length > 500} onClick={async () => { setPending(true); setError(""); try { await exclude({ ...args, studentId: selected.studentId as Id<"students">, reason: reason.trim() }); setDialog(null); setReason(""); setNotice("Exclusion recorded. Review the updated roster."); } catch (e) { setError(e instanceof Error ? e.message : "Exclusion failed."); } finally { setPending(false); } }}>Confirm exclusion</button></div></ReviewDialog>}
    {dialog === "release" && readiness && <ReviewDialog title="Release class results?" onClose={close}><p>{contextLabel}</p><p>{readiness.eligibleCount} eligible, {readiness.certifiedCount} certified, {readiness.excludedCount} excluded.</p><p>Families of the eligible students will be able to see their certified reports. Excluded students will not receive this release. The released roster is frozen. Later admissions or corrections need a separate reviewed process.</p>
      <label className="flex gap-3"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{confirmation}</label>
      {staleReview && <p role="alert" className="text-rose-700">The roster changed. Close this window and review the updated list before releasing.</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={pending} onClick={close}>Cancel</button><button type="button" className={button} disabled={!!context.releasesPaused || !context.canRelease || !checked || !current || !readiness.ready || !readiness.reviewKey || pending} onClick={async () => { if (!readiness.reviewKey) return; setPending(true); setError(""); try { const result = await release({ ...args, reviewedKey: readiness.reviewKey, confirmation }); setSavedRelease(result); setDialog(null); setNotice("Released to families. The original release details are shown above."); window.setTimeout(() => releasedHeading.current?.focus(), 0); } catch (e) { const message = e instanceof Error ? e.message : "Release failed."; if (/roster changed|not ready|different review/i.test(message)) { setStaleKey(readiness.reviewKey); setChecked(false); setNotice("Review the updated roster before releasing."); } else setError(message); } finally { setPending(false); } }}>{pending ? "Releasing results..." : "Release class results"}</button></div></ReviewDialog>}
  </section>;
}
