"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { api } from "@school/convex/_generated/api";
import { formatScore } from "./format";
import type { Id } from "@school/convex/_generated/dataModel";

export function PublishedResults({ studentId, initialSessionId }: { studentId: Id<"students">; initialSessionId: Id<"academicSessions"> | null }) {
  const sessions = usePaginatedQuery(api.functions.portal.listResultSessions, { studentId }, { initialNumItems: 20 });
  const [chosenSession, setChosenSession] = useState(initialSessionId);
  const sessionId = chosenSession ?? sessions.results[0]?.sessionId ?? null;
  return <section className="space-y-4" aria-label="Published academic history">
    <h2 className="text-lg font-bold text-slate-900">Academic history</h2>
    <label className="block text-sm text-slate-700">Session / year
      <select className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 sm:max-w-sm" value={sessionId ?? ""} onChange={event => setChosenSession(event.target.value as Id<"academicSessions">)}>
        {!sessionId && <option value="">Choose a session</option>}
        {sessionId && !sessions.results.some(row => row.sessionId === sessionId) && <option value={sessionId}>Selected session</option>}
        {sessions.results.map(row => <option key={row.sessionId} value={row.sessionId}>{row.name}</option>)}
      </select>
    </label>
    {sessions.status === "LoadingFirstPage" && <p role="status">Loading sessions...</p>}
    {sessions.status === "CanLoadMore" && <button type="button" className="text-sm underline" onClick={() => sessions.loadMore(20)}>Load older sessions</button>}
    {sessions.status === "LoadingMore" && <p role="status">Loading older sessions...</p>}
    {sessionId && <SessionResults key={`${studentId}:${sessionId}`} studentId={studentId} sessionId={sessionId} />}
  </section>;
}

function SessionResults({ studentId, sessionId }: { studentId: Id<"students">; sessionId: Id<"academicSessions"> }) {
  const history = usePaginatedQuery(api.functions.portal.listSessionResults, { studentId, sessionId, resultKind: "end_of_term" }, { initialNumItems: 6 });
  return <div className="space-y-3">
    <p className="text-sm text-slate-500">Published end-of-term reports only. Earlier reports retain their issued class and details.</p>
    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {history.results.map(item => <li key={`${item.resultKind}:${item.termId}`}>
        <Link href={item.href} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-50">
          <span className="font-semibold text-slate-900">{item.termName} · {item.sessionName}</span>
          {item.mode !== "needs_review" && <span className="text-slate-600">{item.className} · {item.mode === "narrative" ? "Progress report" : `Report card · Average ${formatScore(item.averageScore)}`}</span>}
        </Link>
      </li>)}
    </ul>
    {history.status === "LoadingFirstPage" || history.status === "LoadingMore" ? <p role="status">Loading published reports...</p> : null}
    {history.status === "CanLoadMore" && <button type="button" className="text-sm underline" onClick={() => history.loadMore(6)}>Load more terms</button>}
    {history.status === "Exhausted" && history.results.length === 0 && <p className="text-sm text-slate-600">No published reports for this session.</p>}
  </div>;
}
