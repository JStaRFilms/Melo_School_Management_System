"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import { useAuth } from "@/AuthProvider";
import { ClassReleasePanel } from "./ClassReleasePanel";
import { ReleasePauseControl } from "./ReleasePauseControl";

function ReleasePageContent() {
  const params = useSearchParams();
  const { workspaceAccess } = useAuth();
  const context = useQuery(api.functions.academic.resultPublication.getReleaseContext);
  const [session, setSession] = useState(params.get("sessionId") ?? "");
  const [term, setTerm] = useState(params.get("termId") ?? "");
  const [klass, setKlass] = useState(params.get("classId") ?? "");
  const [pauseTransition, setPauseTransition] = useState<boolean | null>(null);
  useEffect(() => {
    if (pauseTransition !== null && context?.releasesPaused === pauseTransition) setPauseTransition(null);
  }, [pauseTransition, context?.releasesPaused]);
  if (!context || workspaceAccess?.state !== "ready" || context.schoolId !== workspaceAccess.branch.schoolId) return <main className="p-6" role="status">Loading release options...</main>;
  const terms = context.terms.filter(t => t.sessionId === session);
  const validSession = context.sessions.some(s => s.id === session);
  const validTerm = validSession && terms.some(t => t.id === term);
  const validClass = context.classes.some(c => c.id === klass);
  const selection = validTerm && validClass ? { sessionId: session, termId: term, classId: klass } : null;
  const transitioning = pauseTransition !== null && pauseTransition !== context.releasesPaused;
  const releasesPaused = context.releasesPaused || (transitioning && pauseTransition === true);
  return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16 text-slate-900 sm:p-8">
    <header><h1 className="text-2xl font-bold">Class result release</h1>
      <p className="mt-2 text-base">Certify each student&apos;s report, then release the reviewed class results to families.</p></header>
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
      <div><span className="block font-semibold">School</span><span>{context.schoolName}</span></div>
      <label className="font-semibold">Session<select className="mt-2 block min-h-11 w-full rounded border p-2" value={validSession ? session : ""} onChange={e => { setSession(e.target.value); setTerm(""); }}><option value="">Select session</option>{context.sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="font-semibold">Term<select className="mt-2 block min-h-11 w-full rounded border p-2" value={validTerm ? term : ""} disabled={!validSession} onChange={e => setTerm(e.target.value)}><option value="">Select term</option>{terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="font-semibold">Class<select className="mt-2 block min-h-11 w-full rounded border p-2" value={validClass ? klass : ""} onChange={e => setKlass(e.target.value)}><option value="">Select class</option>{context.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>
    <ReleasePauseControl school={context.schoolName} paused={context.releasesPaused} reason={context.releasePauseReason} updatedAt={context.releasePauseUpdatedAt} canManage={context.canExclude} transition={transitioning} onTransition={setPauseTransition} />
    {selection ? <ClassReleasePanel key={`${context.schoolId}:${session}:${term}:${klass}`} selection={selection} context={{ school: context.schoolName, session: context.sessions.find(s => s.id === session)!.name, term: terms.find(t => t.id === term)!.name, klass: context.classes.find(c => c.id === klass)!.name, canRelease: context.canRelease && !releasesPaused && !transitioning, canExclude: context.canExclude, releasesPaused }} /> : <p role="status">Select a session, term and class to review the roster.</p>}
  </main>;
}

export default function ClassReleasePage() {
  return <Suspense fallback={<p role="status" className="p-6">Loading release options...</p>}><ReleasePageContent /></Suspense>;
}
