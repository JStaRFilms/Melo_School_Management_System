"use client";

import Link from "next/link";
import type { Doc } from "@school/convex/_generated/dataModel";
import { lifecycleButton } from "./LifecycleContextFields";

type Event = Doc<"studentEnrollmentEvents"> | Doc<"staffServiceEvents">;
type Period = Doc<"studentEnrollmentPeriods"> | Doc<"staffServicePeriods">;

export function LifecycleLoadMore({ status, loadMore, label }: { status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"; loadMore: (n: number) => void; label: string }) {
  return status === "Exhausted" ? null : <button type="button" className={lifecycleButton} disabled={status !== "CanLoadMore"} onClick={() => loadMore(25)}>{status === "CanLoadMore" ? label : "Loading..."}</button>;
}

export function LifecyclePeriods({ periods, events, inactive }: { periods: Period[]; events: Event[]; inactive: boolean }) {
  const ordered = [...periods].sort((a, b) => a.recordedAt - b.recordedAt || a._creationTime - b._creationTime);
  return <section className="space-y-3 text-sm" aria-label="Participation periods">
    <h3 className="font-semibold">Periods and gaps</h3>
    {ordered.length === 0 && <p>No recorded periods. Legacy start dates are unknown.</p>}
    <ol className="space-y-3">
      {ordered.map((period, i) => {
        const next = ordered[i + 1];
        const closing = events.find(e => e._id === period.closedByEventId);
        return <li key={period._id} className="border-l-2 border-slate-200 pl-3">
          <p>{period.startDay ?? "Start date unknown"} to {period.endDay ?? "Present"}</p>
          <p className="text-xs text-slate-600">{period.sessionName ?? "Session not recorded"} • {period.termName ?? "Term not recorded"}{"roleAtStart" in period && period.roleAtStart ? ` • ${period.roleAtStart}` : ""}</p>
          {closing && <p>{closing.type.replaceAll("_", " ")} • {closing.reason}</p>}
          {period.endDay && (next?.startDay || (i === ordered.length - 1 && inactive)) && <p className="mt-2 font-medium">Gap: {period.endDay} to {next?.startDay ?? "today, continuing"}{period.endDay === next?.startDay ? " • same-day return" : ""}</p>}
        </li>;
      })}
    </ol>
    <p className="text-xs text-slate-500">The end day is the first inactive day. Entry context is not a full placement or assignment history. Older pages may contain more periods.</p>
  </section>;
}

export function LifecycleEvents({ events }: { events: Event[] }) {
  return <section className="space-y-3 text-sm" aria-label="Lifecycle history">
    <h3 className="font-semibold">Recorded history</h3>
    <p className="text-xs text-slate-600">Newest revisions first. Effective dates may differ from recording order.</p>
    {events.length === 0 && <p>No recorded events. No joining or admission date has been inferred.</p>}
    <ol className="space-y-3">{events.map(event => <li key={event._id} className="border-b border-slate-200 pb-3">
      <p className="font-medium">{event.type.replaceAll("_", " ")} • {event.afterStatus.replaceAll("_", " ")}</p>
      <p>{event.reason}</p>
      <p className="text-xs text-slate-600">Effective {event.effectiveDay ?? "day not recorded"} • Recorded {new Date(event.recordedAt).toLocaleString()} • Actor {event.actorUserId ?? "System or unknown"}</p>
      <p className="text-xs text-slate-600">{event.sessionName ?? "Session not recorded"} • {event.termName ?? "Term not recorded"}{"className" in event && event.className ? ` • ${event.className}` : ""}</p>
      {"studentId" in event && event.sessionId && event.termId && <Link className="inline-flex min-h-11 items-center underline" href={`/assessments/report-cards?${new URLSearchParams({ schoolId: event.schoolId, studentId: event.studentId, sessionId: event.sessionId, termId: event.termId, classId: event.classId })}`}>View report in recorded context</Link>}
      {"previousPermissions" in event && event.previousPermissions && <details><summary className="min-h-11 cursor-pointer py-2">Recorded access review</summary><p>Previous effective access: {event.previousPermissions.effective.join(", ") || "None"}</p><p>Proposed effective access: {event.proposedPermissions?.effective.join(", ") || "None"}</p></details>}
    </li>)}</ol>
  </section>;
}
