"use client";

import { ClassCard } from "./ClassCard";
import { Plus, LayoutGrid } from "lucide-react";

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

interface ClassSectionProps {
  title: string;
  level: string;
  accent: string;
  accentClass: string;
  classes: ClassSummary[];
  selectedClassId: string | null;
  onSelect: (id: string) => void;
  onArchive: (id: string) => void;
  onRequestCreate: (level: string) => void;
}

export function ClassSection({
  title,
  level,
  accent,
  accentClass,
  classes,
  selectedClassId,
  onSelect,
  onArchive,
  onRequestCreate,
}: ClassSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${accentClass}`}>
            {accent}
          </div>
          <h3 className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onRequestCreate(level)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold tracking-wider text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Plus className="h-3 w-3" />
          Quick Add
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {classes.map((classDoc) => (
          <div key={classDoc._id} id={`class-${classDoc._id}`}>
            <ClassCard
              classDoc={classDoc}
              isSelected={selectedClassId === classDoc._id}
              onSelect={() => onSelect(classDoc._id)}
              onArchive={() => onArchive(classDoc._id)}
            />
          </div>
        ))}

        {classes.length === 0 && (
          <div 
            onClick={() => onRequestCreate(level)}
            className="sm:col-span-2 group min-h-[90px] flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center cursor-pointer hover:border-brand-primary/50 hover:bg-slate-50 transition-colors"
          >
             <div className="rounded-xl bg-white p-2.5 text-slate-300 shadow-2xs ring-1 ring-slate-950/5 group-hover:text-brand-primary group-hover:scale-105 transition-all">
                <LayoutGrid className="h-5 w-5" />
            </div>
            <p className="mt-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] group-hover:text-slate-600">
               No {title} records &bull; Click to create
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

