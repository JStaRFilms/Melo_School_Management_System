"use client";

import { Users2, Layers, Pencil, Archive } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

type ClassSummary = {
  _id: string;
  name: string;
  level: string;
  gradeName?: string;
  classLabel?: string;
  formTeacherId?: string;
  formTeacherName?: string;
  subjectNames: string[];
  studentCount: number;
  createdAt: number;
};

interface ClassCardProps {
  classDoc: ClassSummary;
  isSelected?: boolean;
  onSelect: () => void;
  onArchive: () => void;
}

export function ClassCard({
  classDoc,
  isSelected,
  onSelect,
  onArchive,
}: ClassCardProps) {
  const source = classDoc.gradeName || classDoc.name;
  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || source.trim().charAt(0).toUpperCase() || "?";

  return (
    <AdminSurface
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
          <div className="min-w-0 space-y-0.5">
            <h4 className="font-display text-sm font-bold tracking-tight text-slate-950 truncate">
              {classDoc.gradeName || classDoc.name}
            </h4>
            {classDoc.classLabel && (
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 truncate">
                {classDoc.classLabel}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
               <p className={`text-[10px] font-bold uppercase tracking-wider ${
                classDoc.formTeacherName ? "text-emerald-600" : "text-slate-300 italic"
              }`}>
                {classDoc.formTeacherName || "No Form Teacher"}
              </p>
            </div>
          </div>
        </div>
        
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <Users2 className="h-3 w-3 text-slate-300" />
            <p className="text-[10px] font-bold text-slate-500">
              {classDoc.studentCount}
            </p>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300 mt-1">
            Students
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-2.5">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Layers className="h-3 w-3 text-slate-300 shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
            {classDoc.subjectNames.length} Subjects Offered
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-100 bg-white px-2 text-[10px] font-bold uppercase tracking-widest text-rose-500 transition-all hover:bg-rose-50"
          >
            <Archive className="h-3 w-3 opacity-60" />
            <span className="hidden sm:inline">Archive</span>
          </button>
          
          <div
            aria-hidden="true"
            title="Edit"
            className={`p-1.5 rounded-md transition-colors ${
            isSelected ? "text-slate-950 bg-slate-50" : "text-slate-300 group-hover:text-slate-500"
          }`}>
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </AdminSurface>
  );
}
