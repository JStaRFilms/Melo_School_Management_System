"use client";

import { Trash2 } from "lucide-react";
import type { GradingBandDraft } from "@/types";
import { getGradeBadgeColorClass } from "@/exam-helpers";

interface BandRowProps {
  band: GradingBandDraft;
  index: number;
  hasError: boolean;
  onChange: (
    index: number,
    field: keyof GradingBandDraft,
    value: string | number
  ) => void;
  onDelete: (index: number) => void;
}

export function BandRow({
  band,
  index,
  hasError,
  onChange,
  onDelete,
}: BandRowProps) {
  const badgeClass = getGradeBadgeColorClass(band.gradeLetter);

  return (
    <tr
      className={`group hover:bg-slate-50/50 transition-colors ${hasError ? "bg-rose-50/30" : ""}`}
    >
      <td className="p-2.5 px-6">
        <input
          type="text"
          value={band.gradeLetter}
          onChange={(e) => {
            const nextValue = e.target.value.toUpperCase().replace(/\s+/g, "");
            onChange(index, "gradeLetter", nextValue);
          }}
          placeholder="?"
          maxLength={4}
          spellCheck={false}
          className={`w-12 h-9 px-0 text-center uppercase font-bold tracking-widest rounded-lg border border-slate-200 bg-white transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none ${badgeClass} ${hasError ? "border-rose-500 bg-rose-50" : ""}`}
        />
      </td>
      <td className="p-2.5">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={band.minScore ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
              onChange(index, "minScore", v as number);
            }}
            min={0}
            max={100}
            placeholder="0"
            className={`w-14 h-9 text-center font-mono font-bold text-[11px] rounded-lg border border-slate-200 bg-white transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none ${hasError ? "border-rose-500" : ""}`}
          />
          <span className="text-slate-200 font-bold px-0.5">&ndash;</span>
          <input
            type="number"
            value={band.maxScore ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
              onChange(index, "maxScore", v as number);
            }}
            min={0}
            max={100}
            placeholder="100"
            className={`w-14 h-9 text-center font-mono font-bold text-[11px] rounded-lg border border-slate-200 bg-white transition-all focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none ${hasError ? "border-rose-500" : ""}`}
          />
        </div>
      </td>
      <td className="p-2.5">
        <input
          type="text"
          value={band.remark}
          onChange={(e) => onChange(index, "remark", e.target.value)}
          placeholder="Remark..."
          className="w-full h-9 px-4 bg-slate-50/50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 focus:bg-white focus:border-blue-500/50 outline-none transition-all"
        />
      </td>
      <td className="p-2.5 px-6 text-right">
        <button
          onClick={() => onDelete(index)}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-2 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
