"use client";

import { FileText, Clock, User, CheckCircle2, MoreVertical } from "lucide-react";
import { TeacherLibraryMaterial } from "../types";
import { badgeTone, formatTimestamp } from "../constants";
import { cn } from "@/lib/utils";

interface MaterialCardProps {
  material: TeacherLibraryMaterial;
  isSelected: boolean;
  isSelectedAsSource: boolean;
  onSelect: () => void;
  onInspect: () => void;
  className?: string;
}

export function MaterialCard({
  material,
  isSelected,
  isSelectedAsSource,
  onSelect,
  onInspect,
  className,
}: MaterialCardProps) {
  return (
    <article
      id={`material-${material._id}`}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-3.5 transition-all cursor-pointer",
        isSelectedAsSource
          ? "border-emerald-300 bg-emerald-50/30 shadow-md ring-2 ring-emerald-500/10"
          : isSelected
            ? "border-slate-950 bg-white shadow-md ring-2 ring-slate-950/5"
            : "border-slate-200/60 bg-white/50 hover:border-slate-300 hover:bg-white hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
            isSelectedAsSource
              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm"
              : isSelected
                ? "bg-slate-950 border-slate-950 text-white shadow-sm"
                : "bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-white"
          )}>
            {isSelectedAsSource ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 space-y-0">
            <h4 className="truncate font-display text-sm font-bold tracking-tight text-slate-950">
              {material.title}
            </h4>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <span>{material.subjectCode || material.subjectName}</span>
              <span>•</span>
              <span>{material.level}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect();
          }}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 active:bg-slate-200"
          aria-label={`Inspect ${material.title}`}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={cn(
          "inline-flex h-5 items-center px-1.5 rounded-md border text-[9px] font-bold uppercase tracking-widest",
          badgeTone("visibility", material.visibility)
        )}>
          {material.visibility.replace("_", " ")}
        </span>
        <span className={cn(
          "inline-flex h-5 items-center px-1.5 rounded-md border text-[9px] font-bold uppercase tracking-widest",
          badgeTone("processing", material.processingStatus)
        )}>
          {material.processingStatus}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-slate-50 pt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
          <Clock className="h-3 w-3 opacity-60" />
          {formatTimestamp(material.createdAt)}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
          <User className="h-3 w-3 opacity-60" />
          {material.ownerName.split(" ")[0]}
        </div>
      </div>
    </article>
  );
}
