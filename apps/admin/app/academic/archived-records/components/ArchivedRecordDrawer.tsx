"use client";

import { X } from "lucide-react";

import type { ArchivedRecordItem } from "./types";

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

interface ArchivedRecordDrawerProps {
  record: ArchivedRecordItem | null;
  onClose: () => void;
}

export function ArchivedRecordDrawer({
  record,
  onClose,
}: ArchivedRecordDrawerProps) {
  if (!record) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close archived record details"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
              Record Audit
            </p>
            <h2 className="text-lg font-bold text-slate-950">{record.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-700">
              Audit Only
            </p>
            <p className="mt-1 text-sm text-blue-900">
              This record remains available for history, report cards, and admin
              audit. Restore behavior is intentionally not part of this view.
            </p>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <MetaCard label="Record Type" value={record.typeLabel} />
            <MetaCard
              label="Archived By"
              value={record.archivedByName ?? "Legacy record"}
            />
            <MetaCard
              label="Archived On"
              value={formatDateTime(record.archivedAt)}
            />
            <MetaCard
              label="Created On"
              value={formatDateTime(record.createdAt)}
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
              Status Note
            </p>
            <p className="mt-2 text-sm font-medium text-slate-800">
              {record.statusNote}
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
              Linked History
            </p>
            <p className="mt-2 text-sm text-slate-700">{record.linkedHistory}</p>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
              Metadata Snapshot
            </p>
            <dl className="space-y-3">
              {record.detailFields.map((field) => (
                <div
                  key={`${record.id}-${field.label}`}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400">
                    {field.label}
                  </dt>
                  <dd className="text-right text-sm font-medium text-slate-800">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
              Blocker Snapshot
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Archive blocker snapshots are not stored yet. This panel shows the
              surviving record metadata and linked historical usage instead.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
