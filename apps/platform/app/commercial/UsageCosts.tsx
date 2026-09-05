"use client";
import { useQuery } from "convex/react";
import { api } from "../../../../packages/convex/_generated/api";
import type { Id } from "../../../../packages/convex/_generated/dataModel";

export function UsageCosts({ schoolId }: { schoolId: Id<"schools"> }) {
  const data = useQuery(api.functions.academic.metering.getPlatformUsageCosts, { schoolId });
  if (!data) return <p role="status">Loading provider cost evidence…</p>;
  return <section className="space-y-3 border-b pb-4">
    <h2 className="text-lg font-semibold">Internal provider usage economics</h2>
    <p>Selected school only. Latest 100 evidence records, not cycle, group or all-time totals. Currency minor units are shown without FX conversion. These costs are not customer charges.</p>
    <p>Provider telemetry ingestion and paid execution unavailable. A recorded failed or unknown operation may still incur provider cost; customer allowance is separate.</p>
    {data.truncated && <p role="status">More records exist; this view is truncated.</p>}
    {!data.rows.length && <p>No provider cost evidence recorded. Spend is unknown, not zero.</p>}
    <ul className="space-y-3">{data.rows.map(r => <li className="break-words" key={r._id}>
      <p>{r.provider} / {r.model} · {r.outcome} · {r.currency} {r.costMinor.toLocaleString()} minor units</p>
      <p>Input tokens: {r.inputTokens?.toLocaleString() ?? "unknown"}; output tokens: {r.outputTokens?.toLocaleString() ?? "unknown"}; pages: {r.pages?.toLocaleString() ?? "unknown"}; bytes: {r.bytes?.toLocaleString() ?? "unknown"}</p>
      <p>Operation {r.operationId} · measured {new Date(r.measuredAt).toISOString()}</p>
    </li>)}</ul>
  </section>;
}
