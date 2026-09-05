"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";

export default function OperationalOverview({
  groupId,
  branches,
}: {
  groupId: Id<"schoolGroups">;
  branches: { schoolId: Id<"schools">; name: string }[];
}) {
  const [start, setStart] = useState(() =>
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState<Id<"schools">>();
  const [period, setPeriod] = useState(() => ({
    startDate: Date.parse(start),
    endDate: Date.parse(end),
    branchId: undefined as Id<"schools"> | undefined,
  }));
  const [error, setError] = useState("");
  const overview = useQuery(
    api.functions.academic.groups.getOperationalOverview,
    { groupId, ...period },
  );
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Operations overview</h2>
      <form
        className="flex flex-wrap items-end gap-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const startDate = Date.parse(start),
            endDate = Date.parse(end);
          if (
            !Number.isFinite(startDate) ||
            !Number.isFinite(endDate) ||
            endDate <= startDate ||
            endDate - startDate > 366 * 86400000
          ) {
            setError("Choose an end after the start, within 366 days.");
            return;
          }
          setError("");
          setPeriod({ startDate, endDate, branchId });
        }}
      >
        <label className="min-w-0">
          Start (UTC)
          <input
            required
            type="date"
            className="mt-1 block max-w-full rounded border p-2"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="min-w-0">
          End (UTC, exclusive)
          <input
            required
            type="date"
            className="mt-1 block max-w-full rounded border p-2"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="min-w-0">
          Branch
          <select
            className="mt-1 block max-w-full rounded border p-2"
            value={branchId ?? ""}
            onChange={(e) =>
              setBranchId(
                branches.find((branch) => branch.schoolId === e.target.value)
                  ?.schoolId,
              )
            }
          >
            <option value="">All linked branches</option>
            {branches.map((branch) => (
              <option key={branch.schoolId} value={branch.schoolId}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded border px-3 py-2">Apply period</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {!overview ? (
        <p role="status">Checking operational scope…</p>
      ) : (
        <>
          <p className="text-sm">{overview.note}</p>
          <p className="text-sm">
            Applied period:{" "}
            {new Date(overview.period.startDate).toISOString().slice(0, 10)} –{" "}
            {new Date(overview.period.endDate).toISOString().slice(0, 10)}{" "}
            (exclusive), UTC.
          </p>
          {overview.branches.length === 0 && (
            <p>
              No linked branches in this selection. This is not a zero
              operational total.
            </p>
          )}
          <ul className="divide-y">
            {overview.branches.map((branch) => (
              <li key={branch.schoolId} className="space-y-2 py-3">
                <h3 className="font-semibold">
                  {branch.name} · {branch.status}
                </h3>
                {branch.access !== "scoped" ? (
                  <p className="text-sm">
                    {branch.access === "inactive"
                      ? "Suspended or unavailable branch — no operational reads."
                      : "Operational access denied or revoked — explicit active branch membership required."}
                  </p>
                ) : (
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {branch.metrics.map((metric) => (
                      <div key={metric.key}>
                        <dt className="font-medium">
                          {metric.label}: {metric.state.replaceAll("_", " ")}
                        </dt>
                        <dd>
                          {metric.reason} Units: {metric.unit}.
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-sm text-slate-600">
                  Drilldown unavailable until selected-branch routes and
                  unsaved-change guards are approved.
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
