"use client";

import type { ArchiveFilterType } from "./types";
import { ChevronDown } from "lucide-react";

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
  { value: "teacher", label: "Staff & Teachers" },
  { value: "student", label: "Students" },
  { value: "session", label: "Academic Sessions" },
  { value: "event", label: "Calendar Events" },
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
  const handleDateFromChange = (value: string) => {
    if (value && dateTo && value > dateTo) {
      onDateFromChange(dateTo);
      return;
    }
    onDateFromChange(value);
  };

  const handleDateToChange = (value: string) => {
    if (value && dateFrom && value < dateFrom) {
      onDateToChange(dateFrom);
      return;
    }
    onDateToChange(value);
  };

  return (
    <div className="space-y-5">
      {/* Search Input */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
          Keywords
        </label>
        <div className="relative group">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Name, code, or context..."
            className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          />
        </div>
      </div>

      {/* Type Selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
          Record Type
        </label>
        <div className="relative">
          <select
            value={activeType}
            onChange={(e) => onTypeChange(e.target.value as ArchiveFilterType)}
            className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 appearance-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Date Range */}
      <div className="pt-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-2">
          Archived Window
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter px-1">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(event) => handleDateFromChange(event.target.value)}
              className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter px-1">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => handleDateToChange(event.target.value)}
              className="w-full h-10 px-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
