"use client";

import { memo } from "react";
import { Boxes, Plus, Search, ChevronRight } from "lucide-react";
import type { BundleRecord } from "../types";
import { countBundleFields } from "../utils";

interface BundleListProps {
  bundles: BundleRecord[];
  selectedId: string | "new";
  onSelect: (id: string | "new") => void;
}

export const BundleList = memo(function BundleList({ bundles, selectedId, onSelect }: BundleListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200/80 bg-white sticky top-0 z-10">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5 text-indigo-600" />
            Report Add-ons
          </h2>
          <p className="text-[11px] font-medium text-slate-500">
            {bundles.length} {bundles.length === 1 ? "Add-on" : "Add-ons"} configured
          </p>
        </div>
        <button
          aria-label="Create new bundle"
          className="h-8 px-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-1 text-xs font-bold shadow-xs"
          onClick={() => onSelect("new")}
          type="button"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {bundles.map((bundle) => {
          const isSelected = selectedId === bundle._id;
          return (
            <button
              key={bundle._id}
              onClick={() => onSelect(bundle._id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                isSelected
                  ? "bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/10"
                  : "bg-white/70 border-slate-200 hover:border-slate-300 hover:bg-white text-slate-700 shadow-2xs"
              }`}
              type="button"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold truncate ${
                      isSelected ? "text-indigo-950" : "text-slate-900"
                    }`}
                  >
                    {bundle.name || "Untitled Add-on"}
                  </span>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {bundle.sections.length} {bundle.sections.length === 1 ? "Section" : "Sections"} &bull; {countBundleFields(bundle)} {countBundleFields(bundle) === 1 ? "Field" : "Fields"}
                </div>
              </div>

              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isSelected ? "text-indigo-600 translate-x-0.5" : "text-slate-300"
                }`}
              />
            </button>
          );
        })}

        {bundles.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-xl ring-1 ring-slate-900/5">
              <Search className="h-8 w-8" />
            </div>
            <p className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">No Bundles Yet</p>
            <p className="mt-2 text-xs font-medium text-slate-400 max-w-[220px]">
              Create custom report card sections for affective traits, psychomotor skills, or attendance.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
