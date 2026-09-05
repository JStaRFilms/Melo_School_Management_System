"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";

type DisplayMetric = {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  state: string;
  reason: string;
  basis: string;
  details: { label: string; value: number; unit: string }[];
};

function MetricView({ metric }: { metric: DisplayMetric }) {
  const percentage = metric.key === "attendance" || metric.key === "academics";
  return (
    <div className="min-w-0 rounded border border-slate-200 bg-white p-3">
      <dt className="font-medium">
        {metric.label}: {metric.state.replaceAll("_", " ")}
      </dt>
      <dd className="mt-1 space-y-1">
        {metric.value !== null && (
          <strong className="block text-lg">
            {metric.value.toLocaleString()}
            {percentage ? "%" : ""}
            {!percentage && (
              <span className="ml-1 text-xs font-normal">{metric.unit}</span>
            )}
          </strong>
        )}
        <p>{metric.reason}</p>
        <p className="text-xs text-slate-600">Basis: {metric.basis}</p>
        {metric.details.length > 0 && (
          <ul className="text-xs text-slate-700">
            {metric.details.map((detail) => (
              <li key={`${detail.label}:${detail.unit}`}>
                {detail.label}: {detail.value.toLocaleString()} {detail.unit}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}

export default function OperationalOverview({
  groupId,
  branches,
  onOpenBranchAudit,
}: {
  groupId: Id<"schoolGroups">;
  branches: { schoolId: Id<"schools">; name: string }[];
  onOpenBranchAudit?: (schoolId: Id<"schools">) => Promise<void>;
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
  const [drilldownPending, setDrilldownPending] = useState<Id<"schools">>();
  const [drilldownError, setDrilldownError] = useState("");
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
      {drilldownError && <p role="alert">{drilldownError}</p>}
      {!overview ? (
        <p role="status">Checking operational scope…</p>
      ) : (
        <>
          <p className="text-sm">{overview.note}</p>
          <p className="text-xs text-slate-600">
            Per request: at most {overview.limits.branchesPerAggregate}{" "}
            branches, {overview.limits.sourceRowsPerTable.toLocaleString()} rows
            per source table and {overview.limits.termsPerBranch} terms per
            branch. A breached bound is unavailable, never a partial total.
          </p>
          <section
            aria-labelledby="group-totals"
            className="rounded-lg bg-slate-50 p-3"
          >
            <h3 id="group-totals" className="font-semibold">
              Complete selected-group totals
            </h3>
            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {overview.totals.map((total) => (
                <MetricView key={total.key} metric={total} />
              ))}
            </dl>
          </section>
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
                      <MetricView key={metric.key} metric={metric} />
                    ))}
                  </dl>
                )}
                {branch.drilldown && onOpenBranchAudit ? (
                  <button
                    type="button"
                    className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                    disabled={Boolean(drilldownPending)}
                    onClick={() => {
                      setDrilldownPending(branch.schoolId);
                      setDrilldownError("");
                      void onOpenBranchAudit(branch.schoolId)
                        .catch(() =>
                          setDrilldownError(
                            "Could not open the selected branch. Your current workspace remains active; retry after reviewing access.",
                          ),
                        )
                        .finally(() => setDrilldownPending(undefined));
                    }}
                  >
                    {drilldownPending === branch.schoolId
                      ? "Opening scoped audit…"
                      : "Open this branch’s scoped audit"}
                  </button>
                ) : (
                  <p className="text-sm text-slate-600">
                    No authorized selected-branch drilldown is available for
                    this row.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
