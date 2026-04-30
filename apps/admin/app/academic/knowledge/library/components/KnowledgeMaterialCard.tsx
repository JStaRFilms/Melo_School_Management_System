"use client";

import {
  Archive,
  BadgeCheck,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Search,
  ShieldAlert,
} from "lucide-react";

import { AdminSurface } from "@/components/ui/AdminSurface";

import type { KnowledgeLibraryMaterialListItem } from "./types";

interface KnowledgeMaterialCardProps {
  material: KnowledgeLibraryMaterialListItem;
  isSelected?: boolean;
  onSelect: () => void;
}

function badgeTone(value: string) {
  switch (value) {
    case "approved":
    case "indexed":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "pending_review":
    case "indexing":
    case "queued":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "rejected":
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "archived":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
}

function visibilityIcon(visibility: KnowledgeLibraryMaterialListItem["visibility"]) {
  return visibility === "private_owner" ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />;
}

export function KnowledgeMaterialCard({ material, isSelected, onSelect }: KnowledgeMaterialCardProps) {
  const updatedLabel = new Date(material.updatedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      id={`knowledge-material-${material._id}`}
      className={`group relative flex cursor-pointer items-center gap-4 rounded-xl border p-3 transition-all duration-300 ${
        isSelected 
          ? "border-slate-950 bg-white shadow-xl shadow-slate-950/5 ring-1 ring-slate-950" 
          : "border-slate-200 bg-white/50 hover:border-slate-300 hover:bg-white hover:shadow-md"
      }`}
      onClick={onSelect}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition-colors group-hover:bg-slate-200 group-hover:text-slate-600">
        <FileText className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-sm font-black tracking-tight text-slate-950">
            {material.title}
          </h3>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${badgeTone(material.reviewStatus)}`}>
            {material.reviewStatus.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-3 overflow-hidden text-[11px] font-bold text-slate-400 uppercase tracking-tight">
          <span className="truncate">{material.subjectName} • {material.level}</span>
          <span className="hidden sm:inline-flex items-center gap-1 shrink-0">
            <BadgeCheck className="h-3 w-3" />
            {material.ownerName}
          </span>
        </div>
      </div>

      <div className="hidden md:flex shrink-0 flex-col items-end gap-1.5 text-right">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${badgeTone(material.processingStatus)}`}>
            {material.processingStatus.replace(/_/g, " ")}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
            {visibilityIcon(material.visibility)}
            {material.visibility.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
          {updatedLabel}
        </p>
      </div>
    </div>
  );
}
