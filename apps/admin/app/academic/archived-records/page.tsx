"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import {
  Archive,
  BookMarked,
  CalendarDays,
  FolderArchive,
  Users,
} from "lucide-react";

import { ArchivedRecordDrawer } from "./components/ArchivedRecordDrawer";
import {
  ArchivedRecordsFilters,
  type ArchiveFilterType,
} from "./components/ArchivedRecordsFilters";
import { ArchivedRecordsList } from "./components/ArchivedRecordsList";
import type {
  ArchivedRecordItem,
  ArchivedRecordsSummary,
} from "./components/types";

interface ArchivedRecordsQueryResult {
  summary: ArchivedRecordsSummary;
  records: ArchivedRecordItem[];
}

function LoadingShell() {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function ArchivedRecordsPage() {
  const archiveData = useQuery(
    "functions/academic/archiveRecords:listArchivedRecords" as never
  ) as ArchivedRecordsQueryResult | undefined;

  const [activeType, setActiveType] = useState<ArchiveFilterType>("all");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ArchivedRecordItem | null>(
    null
  );

  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filteredRecords = useMemo(
    () =>
      archiveData?.records.filter((record: ArchivedRecordItem) => {
        if (activeType !== "all" && record.type !== activeType) {
          return false;
        }

        if (hasInvalidDateRange) {
          return false;
        }

        const archivedDay = new Date(record.archivedAt)
          .toISOString()
          .slice(0, 10);
        if (dateFrom && archivedDay < dateFrom) {
          return false;
        }
        if (dateTo && archivedDay > dateTo) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystacks = [
          record.name,
          record.subtitle ?? "",
          record.typeLabel,
          record.archivedByName ?? "",
          record.statusNote,
          record.linkedHistory,
          ...record.detailFields.map(
            (field) => `${field.label} ${field.value}`
          ),
        ];

        return haystacks.some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );
      }) ?? [],
    [
      activeType,
      archiveData?.records,
      dateFrom,
      dateTo,
      hasInvalidDateRange,
      normalizedSearch,
    ]
  );

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    const stillVisible = filteredRecords.some((record) => record.id === selectedRecord.id);
    if (!stillVisible) {
      setSelectedRecord(null);
    }
  }, [filteredRecords, selectedRecord]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_42%),linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] px-6 py-7">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
            Archived Records
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Browse archived academic history without restoring delete behavior
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            Archived sessions, classes, teachers, and subjects stay available for
            audit, report history, and compliance review. This area is intentionally
            read-only.
          </p>
        </div>
      </section>

      {archiveData ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Total Archived"
            value={archiveData.summary.totalArchived}
            note="Across all academic record types"
            icon={<Archive className="h-5 w-5" />}
          />
          <SummaryCard
            label="Classes"
            value={archiveData.summary.archivedClasses}
            note="Hidden from active enrollment"
            icon={<FolderArchive className="h-5 w-5" />}
          />
          <SummaryCard
            label="Subjects"
            value={archiveData.summary.archivedSubjects}
            note="Preserved for historical results"
            icon={<BookMarked className="h-5 w-5" />}
          />
          <SummaryCard
            label="Teachers"
            value={archiveData.summary.archivedTeachers}
            note="Removed from active teaching access"
            icon={<Users className="h-5 w-5" />}
          />
          <SummaryCard
            label="Sessions"
            value={archiveData.summary.archivedSessions}
            note="Kept for historic assessment context"
            icon={<CalendarDays className="h-5 w-5" />}
          />
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <LoadingShell />
        </section>
      )}

      <ArchivedRecordsFilters
        activeType={activeType}
        searchValue={searchValue}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onTypeChange={setActiveType}
        onSearchChange={setSearchValue}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />

      {hasInvalidDateRange ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The archived-from date must be earlier than the archived-to date.
        </div>
      ) : null}

      {!archiveData ? (
        <LoadingShell />
      ) : (
        <ArchivedRecordsList
          records={filteredRecords}
          onSelectRecord={setSelectedRecord}
        />
      )}

      <ArchivedRecordDrawer
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-2 text-sm text-slate-500">{note}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          {icon}
        </span>
      </div>
    </article>
  );
}
