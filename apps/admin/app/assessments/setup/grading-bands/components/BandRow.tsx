"use client";

import { MoreVertical } from "lucide-react";
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
      className={`hover:bg-slate-50 transition-colors ${hasError ? "bg-red-50/10" : ""}`}
    >
      <td className="p-4 sm:p-6">
        <input
          type="text"
          value={band.gradeLetter}
          onChange={(e) => {
            const nextValue = e.target.value.toUpperCase().replace(/\s+/g, "");
            onChange(index, "gradeLetter", nextValue);
          }}
          placeholder="?"
          maxLength={4}
          aria-label={`Grade letter for band ${index + 1}`}
          spellCheck={false}
          className={`band-input w-10 px-0 uppercase tracking-[0.12em] ${badgeClass} ${hasError ? "error-border" : ""}`}
        />
      </td>
      <td className="p-4 sm:p-6">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={band.minScore ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
              onChange(index, "minScore", v as number);
            }}
            min={0}
            max={100}
            step={1}
            placeholder="--"
            className={`band-input ${hasError ? "error-border" : ""}`}
          />
          <span className="text-slate-300">-</span>
          <input
            type="number"
            value={band.maxScore ?? ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
              onChange(index, "maxScore", v as number);
            }}
            min={0}
            max={100}
            step={1}
            placeholder="--"
            className={`band-input ${hasError ? "error-border" : ""}`}
          />
        </div>
      </td>
      <td className="p-4 sm:p-6">
        <input
          type="text"
          value={band.remark}
          onChange={(e) => onChange(index, "remark", e.target.value)}
          placeholder="Enter remark"
          className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 focus:bg-white focus:border-blue-600 outline-none transition-all"
        />
      </td>
      <td className="p-4 sm:p-6 text-right">
        <button
          onClick={() => onDelete(index)}
          className="text-slate-300 hover:text-red-500 p-2 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}
