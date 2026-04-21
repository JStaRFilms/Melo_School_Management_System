"use client";

import { Archive, Sparkles } from "lucide-react";

import type { KnowledgeLibraryMaterialListItem } from "./types";
import { KnowledgeMaterialCard } from "./KnowledgeMaterialCard";

interface KnowledgeMaterialListProps {
  materials: KnowledgeLibraryMaterialListItem[];
  selectedMaterialId: string | null;
  onSelectMaterial: (materialId: string) => void;
}

export function KnowledgeMaterialList({
  materials,
  selectedMaterialId,
  onSelectMaterial,
}: KnowledgeMaterialListProps) {
  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
        <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
          No materials match the current filters
        </p>
        <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500">
          Try a different visibility or review filter, or clear search to expand the result set.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-2">
      {materials.map((material) => (
        <KnowledgeMaterialCard
          key={material._id}
          material={material}
          isSelected={selectedMaterialId === material._id}
          onSelect={() => onSelectMaterial(material._id)}
        />
      ))}

      {materials.length >= 2 && (
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white/70 p-4 text-[12px] font-medium leading-relaxed text-slate-500 shadow-sm ring-1 ring-slate-950/5">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <Archive className="h-3.5 w-3.5" />
            Review lane
          </div>
          <p className="mt-2">
            Each card is the canonical view of a material record. Select one to inspect audit history and apply admin overrides.
          </p>
        </div>
      )}
    </div>
  );
}
