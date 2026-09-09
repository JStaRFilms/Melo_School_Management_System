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
    "mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium placeholder:text-slate-400";
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
      {scopeNote && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-xs flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 text-sm">
            ℹ️
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-800">{scopeNote}</p>
            <p className="text-[11px] text-slate-500">
              Audit records are immutable and append-only. Sensitive credentials and private emails are redacted.
            </p>
          </div>
        </div>
      )}
      {!scopeConfigured && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 font-medium">
          No audit module scope is configured. Contact the system administrator to assign explicit audit visibility.
        </p>
      )}
      <form
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
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
          <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">Filter audit history</legend>
          <label className="block min-w-0 text-xs font-bold text-slate-700 sm:col-span-2">
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
          <label className="block min-w-0 text-xs font-bold text-slate-700">
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
          <label className="block min-w-0 text-xs font-bold text-slate-700">
            Action contains
            <input
              className={control}
              maxLength={160}
              value={filters.action}
              onChange={(e) =>
                setFilters({ ...filters, action: e.target.value })
              }
              placeholder="e.g. create, update"
            />
          </label>
          <label className="block min-w-0 text-xs font-bold text-slate-700">
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
          <label className="block min-w-0 text-xs font-bold text-slate-700">
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
          <label className="block min-w-0 text-xs font-bold text-slate-700">
            Actor ID contains
            <input
              className={control}
              maxLength={160}
              value={filters.actor}
              onChange={(e) =>
                setFilters({ ...filters, actor: e.target.value })
              }
              placeholder="User or admin ID"
            />
          </label>
          <label className="block min-w-0 text-xs font-bold text-slate-700">
            Affected record contains
            <input
              className={control}
              maxLength={160}
              value={filters.target}
              onChange={(e) =>
                setFilters({ ...filters, target: e.target.value })
              }
              placeholder="Record ID or reference"
            />
          </label>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            disabled={exporting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            Apply filters
          </button>
          <button
            type="button"
            disabled={exporting}
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
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
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Matching events{" "}
          <span className="text-xs font-normal text-slate-400">
            ({rows.length} loaded)
          </span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {canCsv && (
            <button
              disabled={exporting || loading || !scopeConfigured}
              onClick={() => void exportFormat("csv")}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors shadow-xs disabled:opacity-50"
            >
              Export CSV
            </button>
          )}
          {canPdf && (
            <button
              disabled={exporting || loading || !scopeConfigured}
              onClick={() => void exportFormat("pdf")}
              className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors shadow-xs disabled:opacity-50"
            >
              Printable PDF
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Exports reflect all matching events (up to 5,000 rows) according to applied filters.
      </p>
      {exporting && (
        <p role="status" className="text-xs font-medium text-slate-600">
          Preparing audit log export…
        </p>
      )}
      {message && (
        <p role={failed ? "alert" : "status"} className={`break-words text-xs p-3 rounded-lg border font-medium ${failed ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
          {message}
        </p>
      )}
      {loading ? (
        <p role="status" className="py-8 text-center text-xs text-slate-400">Loading audit history…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <h3 className="text-sm font-bold text-slate-800">
            {canLoadMore ? "No matches in scanned pages" : "No matching events"}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {canLoadMore
              ? "Continue searching older events, or refine your search filters."
              : "No audit events match the selected criteria."}
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-xs">
          {rows.map((row) => (
            <li className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors" key={row.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                    {row.module}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      row.outcome === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {row.outcome}
                  </span>
                </div>
                <time
                  className="text-xs text-slate-400 font-mono"
                  dateTime={new Date(row.timestamp).toISOString()}
                >
                  {new Date(row.timestamp)
                    .toISOString()
                    .replace("T", " ")
                    .replace(".000Z", " UTC")}
                </time>
              </div>
              <h3 className="mt-2 text-sm font-bold text-slate-900 break-words">{row.action}</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">
                {row.summary}
              </p>
              <details className="mt-3 group">
                <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline">
                  Inspect context and before / after
                </summary>
                <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
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
                      <div key={label} className="bg-white p-2 rounded border border-slate-100">
                        <dt className="font-bold text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-700 font-mono text-[11px]">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      {(canLoadMore || loadingMore) && (
        <button
          disabled={loadingMore || exporting}
          onClick={onLoadMore}
          className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 shadow-xs disabled:opacity-50 transition-colors"
        >
          {loadingMore ? "Searching older pages…" : "Search next page"}
        </button>
      )}
    </section>
  );
}
