"use client";

import { Boxes, Plus, Search, ChevronRight } from "lucide-react";
import type { BundleRecord } from "../types";
import { countBundleFields } from "../utils";

interface BundleListProps {
  bundles: BundleRecord[];
  selectedId: string | "new";
  onSelect: (id: string | "new") => void;
}

export function BundleList({ bundles, selectedId, onSelect }: BundleListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-4 p-4 lg:p-6 border-b border-white/10 bg-slate-900/5 backdrop-blur-md sticky top-0 z-10">
        <div className="space-y-1">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5" />
            Bundle Catalog
          </h2>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{bundles.length} Registrations</p>
        </div>
        <button
          onClick={() => onSelect("new")}
          className="p-2 bg-slate-900 text-white rounded-lg shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 group"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {bundles.map((bundle) => {
          const isSelected = selectedId === bundle._id;
          return (
            <button
              key={bundle._id}
              onClick={() => onSelect(bundle._id)}
              className={`w-full group relative flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ${isSelected
                ? "bg-slate-900 shadow-2xl shadow-slate-900/20 translate-x-1"
                : "hover:bg-white hover:shadow-lg hover:shadow-slate-200/50"
                }`}
            >
              <div className={`p-2 rounded-lg transition-colors ${isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white"
                }`}>
                <Boxes className="w-4 h-4" />
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className={`text-xs font-black uppercase tracking-widest truncate transition-colors ${isSelected ? "text-white" : "text-slate-700"
                  }`}>
                  {bundle.name}
                </div>
                <div className={`text-xs font-bold uppercase tracking-widest transition-colors ${isSelected ? "text-white/40" : "text-slate-400"
                  }`}>
                  {bundle.sections.length} Sectors • {countBundleFields(bundle)} Nodes
                </div>
              </div>

              <ChevronRight className={`w-4 h-4 transition-all ${isSelected ? "text-white translate-x-0" : "text-slate-200 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                }`} />
            </button>
          );
        })}

        {bundles.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center px-6">
            <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-xl ring-1 ring-slate-900/5">
              <Search className="h-8 w-8" />
            </div>
            <p className="mt-8 text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Void Catalog</p>
            <p className="mt-2 text-xs font-medium text-slate-300 max-w-[200px]">No bundles defined in local memory.</p>
          </div>
        )}
      </div>
    </div>
  );
}
