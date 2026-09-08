"use client";

import { useState } from "react";
import type { AuditRow } from "../audit-export";

export interface AuditFilters {
  search: string;
  module: string;
  action: string;
  actor: string;
  target: string;
  startDate: string;
  endDate: string;
}
export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  search: "",
  module: "",
  action: "",
  actor: "",
  target: "",
  startDate: "",
  endDate: "",
};

export function AuditExplorerView({
  rows,
  loading,
  canLoadMore,
  loadingMore,
  onLoadMore,
  modules,
  onApply,
  onExport,
  canCsv,
  canPdf,
  scopeConfigured,
  scopeNote,
}: {
  rows: AuditRow[];
  loading: boolean;
  canLoadMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  modules: string[];
  onApply: (filters: AuditFilters) => void;
  onExport: (format: "csv" | "pdf") => Promise<number>;
  canCsv: boolean;
  canPdf: boolean;
  scopeConfigured: boolean;
  scopeNote: string;
}) {
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const control =
    "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500";
  const exportFormat = async (format: "csv" | "pdf") => {
    setExporting(true);
    setMessage("");
    setFailed(false);
    try {
      const count = await onExport(format);
      setMessage(
        `${count} events prepared. ${format === "pdf" ? "Review the printable window and choose Print / Save as PDF." : "CSV download requested."}`,
      );
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Export could not complete. Retry after checking access.",
      );
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="space-y-5">
      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
        <p>{scopeNote}</p>
        <p className="mt-1">
          Events are append-only. Before/after values are safe summaries, not
          full records. Actor identifiers are canonical IDs; private email
          snapshots are not displayed.
        </p>
      </div>
      {!scopeConfigured && (
        <p role="alert" className="rounded-lg border p-4 text-sm">
          No audit module scope is configured. Ask the proprietor to assign
          explicit visibility. An audit-view capability alone does not grant
          every department’s history.
        </p>
      )}
      <form
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            filters.startDate &&
            filters.endDate &&
            filters.startDate > filters.endDate
          ) {
            setFailed(true);
            setMessage("Start date must precede end date.");
            return;
          }
          setMessage("");
          onApply(filters);
        }}
      >
        <fieldset
          disabled={exporting}
          className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <legend className="mb-3 font-semibold">Filter audit history</legend>
          <label className="block min-w-0 text-sm font-medium sm:col-span-2">
            Search safe summaries
            <input
              className={control}
              maxLength={160}
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder="Summary, action or affected record"
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Module
            <select
              className={control}
              value={filters.module}
              onChange={(e) =>
                setFilters({ ...filters, module: e.target.value })
              }
            >
              <option value="">All authorized modules</option>
              {modules.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Action contains
            <input
              className={control}
              maxLength={160}
              value={filters.action}
              onChange={(e) =>
                setFilters({ ...filters, action: e.target.value })
              }
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            From (UTC)
            <input
              type="date"
              className={control}
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Through (UTC)
            <input
              type="date"
              className={control}
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Actor ID contains
            <input
              className={control}
              maxLength={160}
              value={filters.actor}
              onChange={(e) =>
                setFilters({ ...filters, actor: e.target.value })
              }
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            Affected record contains
            <input
              className={control}
              maxLength={160}
              value={filters.target}
              onChange={(e) =>
                setFilters({ ...filters, target: e.target.value })
              }
            />
          </label>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            disabled={exporting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Apply filters
          </button>
          <button
            type="button"
            disabled={exporting}
            className="rounded-lg border px-4 py-2 text-sm"
            onClick={() => {
              setFilters(EMPTY_AUDIT_FILTERS);
              onApply(EMPTY_AUDIT_FILTERS);
              setMessage("");
            }}
          >
            Clear filters
          </button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          Matching events{" "}
          <span className="text-sm font-normal text-slate-500">
            {rows.length} loaded
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {canCsv && (
            <button
              disabled={exporting || loading || !scopeConfigured}
              onClick={() => void exportFormat("csv")}
              className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              Export CSV
            </button>
          )}
          {canPdf && (
            <button
              disabled={exporting || loading || !scopeConfigured}
              onClick={() => void exportFormat("pdf")}
              className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              Printable PDF
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Exports use the applied filters, not only loaded rows. Maximum 5,000
        matching events / 200 source pages; larger searches fail explicitly
        without a partial file.
      </p>
      {exporting && (
        <p role="status" className="text-sm">
          Revalidating access and preparing all matching pages…
        </p>
      )}
      {message && (
        <p role={failed ? "alert" : "status"} className="break-words text-sm">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading audit history…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-white p-6">
          <h3 className="font-semibold">
            {canLoadMore ? "No matches in scanned pages" : "No matching events"}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {canLoadMore
              ? "Continue searching older pages. This is not a claim that the entire history is empty."
              : "Try different filters or check your delegated module scope."}
          </p>
        </div>
      ) : (
        <ol className="divide-y rounded-xl border border-slate-200 bg-white">
          {rows.map((row) => (
            <li className="p-4 sm:p-5" key={row.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {row.module} · {row.outcome}
                </span>
                <time
                  className="text-xs text-slate-500"
                  dateTime={new Date(row.timestamp).toISOString()}
                >
                  {new Date(row.timestamp)
                    .toISOString()
                    .replace("T", " ")
                    .replace(".000Z", " UTC")}
                </time>
              </div>
              <h3 className="mt-2 break-words font-semibold">{row.action}</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                {row.summary}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm underline">
                  Inspect context and before / after
                </summary>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  {[
                    ["Actor", row.actor],
                    ["Branch", row.schoolId],
                    ["Target", `${row.targetType} · ${row.targetId}`],
                    ["Correlation", row.correlationId],
                    ["Before", row.before ?? "Not recorded"],
                    ["After", row.after ?? "Not recorded"],
                    ["Group snapshot", row.groupId ?? "Not recorded"],
                    ["Retention", row.retentionClass],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="font-semibold text-slate-500">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          ))}
        </ol>
      )}
      {(canLoadMore || loadingMore) && (
        <button
          disabled={loadingMore || exporting}
          onClick={onLoadMore}
          className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {loadingMore ? "Searching older pages…" : "Search next page"}
        </button>
      )}
    </section>
  );
}
