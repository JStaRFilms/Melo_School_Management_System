"use client";

import { ArrowRight, FolderSearch } from "lucide-react";

import type { ArchivedRecordItem } from "./types";

interface ArchivedRecordsListProps {
  records: ArchivedRecordItem[];
  onSelectRecord: (record: ArchivedRecordItem) => void;
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function chipClasses(recordType: ArchivedRecordItem["type"]) {
  if (recordType === "class") return "bg-emerald-50 text-emerald-700";
  if (recordType === "subject") return "bg-amber-50 text-amber-700";
  if (recordType === "teacher") return "bg-fuchsia-50 text-fuchsia-700";
  return "bg-blue-50 text-blue-700";
}

export function ArchivedRecordsList({
  records,
  onSelectRecord,
}: ArchivedRecordsListProps) {
  if (records.length === 0) {
    return (
      <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <FolderSearch className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-950">
          No archived records found
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Try changing the filters or search terms. Archived academic records
          remain here for audit and reporting history only.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="hidden overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm lg:block">
        <div className="grid grid-cols-[minmax(0,1.4fr)_120px_180px_180px_minmax(0,1.1fr)_88px] gap-4 border-b border-slate-200 px-6 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          <span>Record</span>
          <span>Type</span>
          <span>Archived On</span>
          <span>Archived By</span>
          <span>History Snapshot</span>
          <span className="text-right">Open</span>
        </div>

        <div className="divide-y divide-slate-100">
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => onSelectRecord(record)}
              className="grid w-full grid-cols-[minmax(0,1.4fr)_120px_180px_180px_minmax(0,1.1fr)_88px] gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">
                  {record.name}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {record.subtitle ?? "No secondary label"}
                </p>
              </div>

              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${chipClasses(
                    record.type
                  )}`}
                >
                  {record.typeLabel}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-700">
                {formatDateTime(record.archivedAt)}
              </p>

              <p className="text-sm font-medium text-slate-700">
                {record.archivedByName ?? "Legacy record"}
              </p>

              <p className="line-clamp-2 text-sm text-slate-600">
                {record.linkedHistory}
              </p>

              <span className="inline-flex items-center justify-end gap-2 text-sm font-bold text-slate-700">
                Details
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:hidden">
        {records.map((record) => (
          <button
            key={record.id}
            type="button"
            onClick={() => onSelectRecord(record)}
            className="rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-950">
                  {record.name}
                </p>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {record.subtitle ?? "No secondary label"}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${chipClasses(
                  record.type
                )}`}
              >
                {record.typeLabel}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Archived On
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {formatDateTime(record.archivedAt)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Archived By
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {record.archivedByName ?? "Legacy record"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600">{record.linkedHistory}</p>

            <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
              Open details
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </section>
    </>
  );
}
