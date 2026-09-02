"use client";

import { Plus } from "lucide-react";

interface AddBandButtonProps {
  onAdd: () => void;
  position: "top" | "bottom";
}

export function AddBandButton({ onAdd, position }: AddBandButtonProps) {
  if (position === "top") {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="h-9 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3.5 h-3.5 text-white/80" />
        Add Tier
      </button>
    );
  }

  return (
    <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex justify-center">
      <button
        type="button"
        onClick={onAdd}
        className="w-full py-2.5 rounded-xl border border-dashed border-slate-200 hover:border-slate-300 hover:bg-white text-xs font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-2 shadow-none active:scale-[0.99]"
      >
        <Plus className="w-3.5 h-3.5 text-slate-400" />
        Add New Tier
      </button>
    </div>
  );
}
