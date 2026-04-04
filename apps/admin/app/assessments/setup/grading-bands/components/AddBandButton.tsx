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
        onClick={onAdd}
        className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4 text-white/50" />
        Add Tier
      </button>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-slate-50 flex justify-center border-t border-slate-100">
      <button
        onClick={onAdd}
        className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2"
      >
        <Plus className="w-3 h-3 text-slate-300 transition-colors" />
        Add New Tier
      </button>
    </div>
  );
}
