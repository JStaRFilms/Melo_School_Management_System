"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { ClassReleasePanel } from "./ClassReleasePanel";
import { ReleasePauseControl } from "./ReleasePauseControl";

type Selection = { sessionId: string; termId: string; classId: string };
const pageSize = 24;
const moreButton = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50";

function ReleasePageContent({ schoolId, useDeepLink }: { schoolId: Id<"schools">; useDeepLink: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const context = useQuery(api.functions.academic.resultPublication.getReleaseContext, { schoolId });
  const authorized = !!context && context.schoolId === schoolId;
  const [resetRequired, setResetRequired] = useState(!useDeepLink);
  const [pendingNavigation, setPendingNavigation] = useState<{ from: string; to: string } | null>(null);
  const url = params.toString();
  useEffect(() => {
    if (!resetRequired) return;
    const clean = new URLSearchParams(url);
    clean.delete("sessionId"); clean.delete("termId"); clean.delete("classId");
    if (clean.toString() !== url) router.replace(`/assessments/report-cards/release${clean.size ? `?${clean}` : ""}`);
    else setResetRequired(false);
  }, [resetRequired, router, url]);
  useEffect(() => {
    if (pendingNavigation && url !== pendingNavigation.from) setPendingNavigation(null);
  }, [pendingNavigation, url]);
  const navigating = resetRequired || (!!pendingNavigation && url === pendingNavigation.from && pendingNavigation.to !== url);
  const selection: Selection = {
    sessionId: navigating ? "" : params.get("sessionId") ?? "",
    termId: navigating ? "" : params.get("termId") ?? "",
    classId: navigating ? "" : params.get("classId") ?? "",
  };
  const navigate = (next: Selection) => {
    const search = new URLSearchParams(url);
    for (const key of ["sessionId", "termId", "classId"] as const) {
      if (next[key]) search.set(key, next[key]);
      else search.delete(key);
    }
    setPendingNavigation({ from: url, to: search.toString() });
    router.push(`/assessments/report-cards/release${search.size ? `?${search}` : ""}`);
  };
  const [pauseTransition, setPauseTransition] = useState<boolean | null>(null);
  const sessions = usePaginatedQuery(api.functions.academic.resultPublication.listReleaseSessions, authorized ? { schoolId } : "skip", { initialNumItems: pageSize });
  const terms = usePaginatedQuery(api.functions.academic.resultPublication.listReleaseTerms, authorized && selection.sessionId ? { schoolId, sessionId: selection.sessionId as Id<"academicSessions"> } : "skip", { initialNumItems: pageSize });
  const classes = usePaginatedQuery(api.functions.academic.resultPublication.listReleaseClasses, authorized ? { schoolId } : "skip", { initialNumItems: pageSize });
  const releases = usePaginatedQuery(api.functions.academic.resultPublication.listReleasedClasses, authorized ? { schoolId } : "skip", { initialNumItems: pageSize });
  const hasTuple = !!(selection.sessionId && selection.termId && selection.classId);
  const selected = useQuery(api.functions.academic.resultPublication.getReleaseSelection, authorized && hasTuple ? {
    schoolId, sessionId: selection.sessionId as Id<"academicSessions">,
    termId: selection.termId as Id<"academicTerms">,
    classId: selection.classId as Id<"classes">,
  } : "skip");
  useEffect(() => {
    if (pauseTransition !== null && context?.releasesPaused === pauseTransition) setPauseTransition(null);
  }, [pauseTransition, context?.releasesPaused]);
  if (!authorized || !context) return <main className="p-6" role="status">Loading release options...</main>;
  const transitioning = pauseTransition !== null && pauseTransition !== context.releasesPaused;
  const releasesPaused = context.releasesPaused || (transitioning && pauseTransition === true);
  const sessionOptions = selected ? [selected.session, ...sessions.results.filter(s => s.id !== selected.session.id)] : sessions.results;
  const termOptions = selected ? [selected.term, ...terms.results.filter(t => t.id !== selected.term.id)] : terms.results;
  const classOptions = selected ? [selected.klass, ...classes.results.filter(c => c.id !== selected.klass.id)] : classes.results;
  const currentSession = sessionOptions.find(s => s.id === selection.sessionId);
  const currentTerm = termOptions.find(t => t.id === selection.termId && t.sessionId === selection.sessionId);
  const currentClass = classOptions.find(c => c.id === selection.classId);
  const isCurrentTuple = !!selected && !!currentSession && !!currentTerm && !!currentClass;
  const canInspect = isCurrentTuple && selected.released;
  const eligiblePeriod = isCurrentTuple && !currentSession.isArchived && currentSession.isActive &&
    !currentTerm.isArchived && currentTerm.isActive && !currentClass.isArchived;
  const loadMore = (list: { status: string; loadMore: (numItems: number) => void }, label: string) => list.status === "CanLoadMore" &&
    <button type="button" className={moreButton} onClick={() => list.loadMore(pageSize)}>Load more {label}</button>;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 pb-16 text-slate-900 sm:p-8">
    <header><h1 className="text-2xl font-bold">Class result release</h1>
      <p className="mt-2 text-base">Certify each student&apos;s report, then release the reviewed class results to families.</p></header>
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
      <div><span className="block font-semibold">School</span><span>{context.schoolName}</span></div>
      <div><label className="font-semibold" htmlFor="release-session">Session</label><select id="release-session" className="mt-2 block min-h-11 w-full rounded border p-2" value={currentSession ? selection.sessionId : ""} onChange={e => navigate({ sessionId: e.target.value, termId: "", classId: "" })}><option value="">Select session</option>{sessionOptions.map(s => <option key={s.id} value={s.id}>{s.name}{s.isArchived ? " (archived)" : !s.isActive ? " (inactive)" : ""}</option>)}</select>{loadMore(sessions, "sessions")}</div>
      <div><label className="font-semibold" htmlFor="release-term">Term</label><select id="release-term" className="mt-2 block min-h-11 w-full rounded border p-2" value={currentTerm ? selection.termId : ""} disabled={!currentSession} onChange={e => navigate({ ...selection, termId: e.target.value })}><option value="">Select term</option>{termOptions.map(t => <option key={t.id} value={t.id}>{t.name}{t.isArchived ? " (archived)" : !t.isActive ? " (inactive)" : ""}</option>)}</select>{currentSession && loadMore(terms, "terms")}</div>
      <div><label className="font-semibold" htmlFor="release-class">Class</label><select id="release-class" className="mt-2 block min-h-11 w-full rounded border p-2" value={currentClass ? selection.classId : ""} onChange={e => navigate({ ...selection, classId: e.target.value })}><option value="">Select class</option>{classOptions.map(c => <option key={c.id} value={c.id}>{c.name}{c.isArchived ? " (archived)" : ""}</option>)}</select>{loadMore(classes, "classes")}</div>
    </div>
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5" aria-label="Published classes">
      <h2 className="text-xl font-bold">Find a published class</h2>
      <p>Older published classes remain available to inspect, including archived sessions and classes.</p>
      <ul className="space-y-2">{releases.results.map(r => <li key={r.id}><button type="button" className={moreButton} onClick={() => navigate({ sessionId: r.sessionId, termId: r.termId, classId: r.classId })}>{r.label} / {new Date(r.releasedAt).toLocaleDateString()}</button></li>)}</ul>
      {releases.status === "LoadingFirstPage" && <p role="status">Loading published classes...</p>}
      {loadMore(releases, "published classes")}
    </section>
    <ReleasePauseControl schoolId={schoolId} school={context.schoolName} paused={context.releasesPaused} reason={context.releasePauseReason} updatedAt={context.releasePauseUpdatedAt} canManage={context.canExclude} transition={transitioning} onTransition={setPauseTransition} />
    {!navigating && (canInspect || eligiblePeriod) ? <ClassReleasePanel key={`${context.schoolId}:${selection.sessionId}:${selection.termId}:${selection.classId}`} schoolId={schoolId} selection={selection} context={{ school: context.schoolName, session: currentSession!.name, term: currentTerm!.name, klass: currentClass!.name, canRelease: context.canRelease && !releasesPaused && !transitioning && eligiblePeriod, canExclude: context.canExclude && eligiblePeriod, releasesPaused }} />
      : <p role="status">{navigating || hasTuple && selected === undefined ? "Loading release options..." : hasTuple && selected === null ? "This class, session or term is unavailable for this school." : hasTuple && !eligiblePeriod ? "This period needs historical roster reconciliation before a new release. Existing published classes can still be inspected." : "Select a session, term and class to review the roster."}</p>}
  </main>;
}

function SelectedBranchReleasePage({ schoolId }: { schoolId: Id<"schools"> | null }) {
  const [branch, setBranch] = useState<{ schoolId: Id<"schools"> | null; switched: boolean }>({ schoolId: null, switched: false });
  // Keep the last branch across a brief workspace loading state. Change state
  // during render so no old URL tuple reaches the new branch, even for one frame.
  if (schoolId && branch.schoolId !== schoolId)
    setBranch({ schoolId, switched: branch.schoolId !== null || branch.switched });
  return schoolId ? <ReleasePageContent key={schoolId} schoolId={schoolId}
    useDeepLink={!branch.switched && (branch.schoolId === null || branch.schoolId === schoolId)} />
    : <main className="p-6" role="status">Loading release options...</main>;
}

export default function ClassReleasePage() {
  const { workspaceAccess } = useAuth();
  const schoolId = workspaceAccess?.state === "ready" ? workspaceAccess.branch.schoolId as Id<"schools"> : null;
  return <Suspense fallback={<p role="status" className="p-6">Loading release options...</p>}>
    <SelectedBranchReleasePage schoolId={schoolId} />
  </Suspense>;
}
