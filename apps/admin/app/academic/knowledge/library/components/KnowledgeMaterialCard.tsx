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
    <AdminSurface
      as="article"
      id={`knowledge-material-${material._id}`}
      intensity={isSelected ? "high" : "medium"}
      rounded="xl"
      className={`group relative cursor-pointer overflow-hidden border transition-all duration-300 ${
        isSelected ? "ring-2 ring-slate-950 shadow-lg" : "hover:border-slate-300 hover:shadow-md"
      }`}
      onClick={onSelect}
    >
      <div className="space-y-4 p-4 md:p-4.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white">
                <FileText className="h-3 w-3" />
                {material.sourceType.replace(/_/g, " ")}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${badgeTone(material.reviewStatus)}`}>
                {material.reviewStatus.replace(/_/g, " ")}
              </span>
            </div>
            <h3 className="truncate font-display text-lg font-black tracking-tight text-slate-950">
              {material.title}
            </h3>
            <p className="line-clamp-2 text-[13px] font-medium leading-relaxed text-slate-500">
              {material.description ?? material.topicLabel}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              {visibilityIcon(material.visibility)}
              {material.visibility.replace(/_/g, " ")}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${badgeTone(material.processingStatus)}`}>
              <Clock3 className="h-3 w-3" />
              {material.processingStatus.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            <BadgeCheck className="h-3 w-3 text-slate-400" />
            {material.ownerRole}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            <ShieldAlert className="h-3 w-3 text-slate-400" />
            {material.ownerName}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            <Search className="h-3 w-3 text-slate-400" />
            {material.subjectName} • {material.level}
          </span>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {material.labelSuggestions.slice(0, 3).map((label) => (
              <span
                key={label}
                className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"
              >
                {label}
              </span>
            ))}
            {material.labelSuggestions.length === 0 && (
              <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                No labels
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            <Archive className="h-3.5 w-3.5 text-slate-300" />
            Updated {updatedLabel}
          </div>
        </div>
      </div>
    </AdminSurface>
  );
}
