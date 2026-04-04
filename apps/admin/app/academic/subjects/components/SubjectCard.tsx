"use client";

import { BookOpenText, Archive } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { SubjectRecord } from "@/types";

interface SubjectCardProps {
  subject: SubjectRecord;
  isSelected?: boolean;
  onSelect: () => void;
  onArchive: () => void;
}

export function SubjectCard({
  subject,
  isSelected,
  onSelect,
  onArchive,
}: SubjectCardProps) {
  const initials = subject.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <AdminSurface
      id={`subject-${subject._id}`}
      as="article"
      intensity={isSelected ? "high" : "medium"}
      rounded="lg"
      className={`relative p-3.5 transition-all duration-300 cursor-pointer group ${
        isSelected ? "ring-2 ring-slate-950 shadow-md" : "hover:border-slate-300 hover:shadow-md"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
            isSelected ? "bg-slate-950 text-white shadow-sm" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
          }`}>
            {initials}
          </div>
          <div className="min-w-0 space-y-0 text-left">
            <h4 className="font-display text-sm font-bold tracking-tight text-slate-950 truncate">
              {subject.name}
            </h4>
            <div className="flex flex-col">
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest truncate">
                {subject.code}
              </p>
            </div>
          </div>
        </div>
        
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Added on
          </p>
          <p className="font-display text-[11px] font-bold text-slate-500">
            {new Date(subject.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3 border-t border-slate-50 pt-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Status
          </p>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {/* Archived subjects are filtered out upstream by listSubjects(), so this view only renders active records. */}
            <span className="inline-flex h-5 items-center px-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-[9px] font-bold uppercase tracking-widest text-emerald-600">
              Active
            </span>
          </div>
        </div>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-100 bg-white px-2 text-[10px] font-bold uppercase tracking-widest text-rose-500 transition-all hover:bg-rose-50"
        >
          <Archive className="h-3 w-3 opacity-60" />
          Archive
        </button>
      </div>
    </AdminSurface>
  );
}
