"use client";

import type { ArchiveRecordType } from "./types";

export type ArchiveFilterType = "all" | ArchiveRecordType;

interface ArchivedRecordsFiltersProps {
  activeType: ArchiveFilterType;
  searchValue: string;
  dateFrom: string;
  dateTo: string;
  onTypeChange: (value: ArchiveFilterType) => void;
  onSearchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}

const FILTER_OPTIONS: Array<{
  value: ArchiveFilterType;
  label: string;
}> = [
  { value: "all", label: "All Records" },
  { value: "class", label: "Classes" },
  { value: "subject", label: "Subjects" },
  { value: "teacher", label: "Teachers" },
  { value: "session", label: "Sessions" },
];

export function ArchivedRecordsFilters({
  activeType,
  searchValue,
  dateFrom,
  dateTo,
  onTypeChange,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
}: ArchivedRecordsFiltersProps) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-2 rounded-2xl bg-slate-100 p-1">
            {FILTER_OPTIONS.map((option) => {
              const isActive = option.value === activeType;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onTypeChange(option.value)}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                    isActive
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Search Records
            </span>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name, code, email, archived by..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Archived From
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => onDateFromChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Archived To
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => onDateToChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </label>
        </div>
      </div>
    </section>
  );
}
