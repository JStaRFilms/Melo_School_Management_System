"use client";

import { ArrowRight, FolderSearch, Clock, User, Info } from "lucide-react";
import type { ArchivedRecordItem } from "./types";

interface ArchivedRecordsListProps {
  records: ArchivedRecordItem[];
  onSelectRecord: (record: ArchivedRecordItem) => void;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function chipClasses(recordType: ArchivedRecordItem["type"]) {
  const base = "inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ring-inset";
  const typeClasses: Record<ArchivedRecordItem["type"], string> = {
    class: `${base} bg-emerald-50 text-emerald-700 ring-emerald-600/10`,
    subject: `${base} bg-amber-50 text-amber-700 ring-amber-600/10`,
    teacher: `${base} bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/10`,
    student: `${base} bg-indigo-50 text-indigo-700 ring-indigo-600/10`,
    event: `${base} bg-cyan-50 text-cyan-700 ring-cyan-600/10`,
    session: `${base} bg-slate-50 text-slate-700 ring-slate-600/10`,
  };
  return typeClasses[recordType] || `${base} bg-slate-50 text-slate-700 ring-slate-600/10`;
}

export function ArchivedRecordsList({
  records,
  onSelectRecord,
}: ArchivedRecordsListProps) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 ring-1 ring-slate-200/50">
          <FolderSearch className="h-8 w-8 text-slate-300" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">No Archive Matches</h3>
        <p className="mt-1.5 text-xs text-slate-400 max-w-[240px] leading-relaxed">
          Adjust your filters or search terms to find historical academic records.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      {/* Desktop Header */}
      <div className="hidden lg:grid grid-cols-[1fr_120px_140px_140px_1fr_60px] gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50/30">
        {["Record", "Type", "Archived", "By", "History", ""].map((h, i) => (
          <span key={i} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {h}
          </span>
        ))}
      </div>

      {/* List Body */}
      <div className="divide-y divide-slate-50">
        {records.map((record) => (
          <button
            key={record.id}
            id={"record-" + record.id}
            onClick={() => onSelectRecord(record)}
            className="group w-full grid grid-cols-1 lg:grid-cols-[1fr_120px_140px_140px_1fr_60px] gap-2 lg:gap-4 px-4 lg:px-6 py-4 text-left transition-all hover:bg-indigo-50/30"
          >
            {/* Record Info */}
            <div className="min-w-0 flex flex-col justify-center">
              <span className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {record.name}
              </span>
              <span className="truncate text-[10px] text-slate-400 font-medium uppercase tracking-tighter mt-0.5">
                {record.subtitle || "Reference Record"}
              </span>
            </div>

            {/* Type */}
            <div className="flex lg:items-center">
              <span className={chipClasses(record.type)}>
                {record.typeLabel}
              </span>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
              <Clock size={12} className="text-slate-300 lg:hidden" />
              <span className="font-mono">{formatDate(record.archivedAt)}</span>
            </div>

            {/* Archived By */}
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
              <User size={12} className="text-slate-300 lg:hidden" />
              <span className="truncate">{record.archivedByName || "System"}</span>
            </div>

            {/* History Snapshot */}
            <div className="flex items-center gap-2 lg:block">
              <Info size={12} className="text-slate-300 lg:hidden shrink-0" />
              <p className="text-[11px] text-slate-500 font-medium line-clamp-1 italic">
                {record.linkedHistory}
              </p>
            </div>

            {/* Action Icon */}
            <div className="hidden lg:flex items-center justify-end">
              <div className="h-7 w-7 rounded-full bg-transparent group-hover:bg-white group-hover:shadow-sm flex items-center justify-center transition-all border border-transparent group-hover:border-indigo-100">
                <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
