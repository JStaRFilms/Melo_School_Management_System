"use client";

import { FileText, Clock, User, Shield, Info, MoreVertical } from "lucide-react";
import { TeacherLibraryMaterial } from "../types";
import { badgeTone, formatTimestamp } from "../constants";
import { cn } from "@/lib/utils";

interface MaterialCardProps {
  material: TeacherLibraryMaterial;
  isSelected: boolean;
  onToggleSelection: () => void;
  onViewDetails: () => void;
  className?: string;
}

export function MaterialCard({
  material,
  isSelected,
  onToggleSelection,
  onViewDetails,
  className,
}: MaterialCardProps) {
  const isReady = material.processingStatus === "ready";
  const hasFailed = material.processingStatus === "failed" || material.processingStatus === "ocr_needed";

  return (
    <article
      onClick={onToggleSelection}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-3 transition-all cursor-pointer",
        isSelected
          ? "border-slate-950 bg-white shadow-md ring-1 ring-slate-950/5"
          : "border-slate-200/60 bg-white/50 hover:border-slate-300 hover:bg-white hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors",
            isSelected ? "bg-slate-950 border-slate-950 text-white" : "bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-white"
          )}>
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
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
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails();
          }}
          className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-50 hover:text-slate-600 transition-colors"
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
        {material.reviewStatus !== "approved" && (
           <span className={cn(
            "inline-flex h-5 items-center px-1.5 rounded-md border text-[9px] font-bold uppercase tracking-widest",
            badgeTone("review", material.reviewStatus)
          )}>
            {material.reviewStatus}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-slate-50 pt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <Clock className="h-3 w-3" />
          {formatTimestamp(material.createdAt)}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <User className="h-3 w-3" />
          {material.ownerName.split(" ")[0]}
        </div>
      </div>

      {isSelected && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm ring-2 ring-white">
          <CheckIcon className="h-3 w-3" />
        </div>
      )}
    </article>
  );
}

function CheckIcon(props: any) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
