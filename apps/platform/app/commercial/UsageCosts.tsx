"use client";
import { useQuery } from "convex/react";
import { api } from "../../../../packages/convex/_generated/api";
import type { Id } from "../../../../packages/convex/_generated/dataModel";

export function UsageCosts({ schoolId }: { schoolId: Id<"schools"> }) {
  const data = useQuery(api.functions.academic.metering.getPlatformUsageCosts, { schoolId });
  if (!data)
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <p role="status" className="text-sm text-slate-500">Loading provider cost evidence…</p>
      </div>
    );
  return <section className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-3 min-w-0">
    <h2 className="text-base font-bold text-slate-900">Internal provider usage economics</h2>
    <p className="text-sm text-slate-600 break-words">This school only. The latest 100 usage records — not termly, group or all-time totals. Amounts are shown as-is with no currency conversion. These are our costs, not customer charges.</p>
    <p className="text-xs text-slate-500 break-words">Automatic usage tracking is off. A failed or unknown task may still have cost us money; the school&apos;s allowance is tracked separately.</p>
    {data.truncated && <p role="status" className="text-xs font-semibold text-amber-700 break-words">More records exist; this view is cut off at 100.</p>}
    {!data.rows.length && <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 break-words">No usage cost recorded yet. Spend is unknown, not zero.</p>}
    <ul className="space-y-2 min-w-0">{data.rows.map(r => <li className="break-words min-w-0 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-slate-700" key={r._id}>
      <p className="font-bold text-slate-900 break-words">{r.provider} / {r.model} · {r.outcome} · {r.currency} {r.costMinor.toLocaleString()} minor units</p>
      <p className="mt-0.5 text-slate-500 break-words">Input tokens: {r.inputTokens?.toLocaleString() ?? "unknown"}; output tokens: {r.outputTokens?.toLocaleString() ?? "unknown"}; pages: {r.pages?.toLocaleString() ?? "unknown"}; bytes: {r.bytes?.toLocaleString() ?? "unknown"}</p>
      <p className="mt-0.5 font-mono text-[11px] text-slate-400 break-all">Operation {r.operationId} · measured {new Date(r.measuredAt).toISOString()}</p>
    </li>)}</ul>
  </section>;
}
