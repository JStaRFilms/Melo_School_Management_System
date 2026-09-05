"use client";
import { GradeColorControl } from "./GradeColorControl";
import { gradeDisplayColor } from "@school/shared/exam-recording";

import { useCallback, useMemo } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import type { GradingBandDraft, BandValidationError } from "@/types";
import { validateBandsClient } from "@/exam-helpers";
import { BandRow } from "./BandRow";
import { AddBandButton } from "./AddBandButton";

interface BandTableProps {
  bands: GradingBandDraft[];
  onBandsChange: (bands: GradingBandDraft[]) => void;
  validationErrors: BandValidationError[];
  onValidationChange: (errors: BandValidationError[]) => void;
}

interface BandMobileCardProps {
  band: GradingBandDraft;
  index: number;
  hasError: boolean;
  hasNameError?: boolean;
  hasRangeError?: boolean;
  onChange: (index: number, field: keyof GradingBandDraft, value: string | number) => void;
  onDelete: (index: number) => void;
}

function BandMobileCard({
  band,
  index,
  hasError,
  hasNameError,
  hasRangeError,
  onChange,
  onDelete,
}: BandMobileCardProps) {
  const badgeClass = "";

  const handleScrollToErrors = () => {
    const banner = document.getElementById("band-validation-banner");
    if (banner) {
      banner.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const scrollable = document.querySelector(".custom-scrollbar");
      if (scrollable) {
        scrollable.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  return (
    <div
      className={`p-4 space-y-3.5 transition-colors ${
        hasError ? "bg-rose-50/40" : "bg-white hover:bg-slate-50/50"
      }`}
    >
      {/* Tier Header: Number, Grade Badge Input, Error Action, Delete */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 text-xs font-black text-slate-700 tabular-nums flex items-center justify-center">
            {index + 1}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Grade:</span>
            <input
              type="text"
              aria-label={`Grade label for tier ${index + 1}`}
              style={{ color: gradeDisplayColor(band.colorHex) }}
              value={band.gradeLetter}
              onChange={(e) => {
                const nextValue = e.target.value.toUpperCase().replace(/\s+/g, "");
                onChange(index, "gradeLetter", nextValue);
              }}
              placeholder="A"
              maxLength={4}
              spellCheck={false}
              className={`w-14 h-9 px-0 text-center uppercase font-black tracking-widest text-sm rounded-lg border bg-white transition-all focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none ${badgeClass} ${
                hasNameError
                  ? "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500/20"
                  : "border-slate-200 text-slate-900"
              }`}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {hasError && (
            <button
              type="button"
              onClick={handleScrollToErrors}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-2xs"
              title="Scroll to error details"
            >
              <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
              <span>Show error</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onDelete(index)}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete tier"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Score Range (Min to Max) */}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Min Score (%)
          </span>
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
            className={`w-full h-10 px-3 text-center font-mono font-bold text-xs rounded-xl border bg-white transition-all focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none ${
              hasRangeError
                ? "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500/20"
                : "border-slate-200 text-slate-900"
            }`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
            Max Score (%)
          </span>
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
            className={`w-full h-10 px-3 text-center font-mono font-bold text-xs rounded-xl border bg-white transition-all focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 outline-none ${
              hasRangeError
                ? "border-rose-500 bg-rose-50 text-rose-800 ring-1 ring-rose-500/20"
                : "border-slate-200 text-slate-900"
            }`}
          />
        </label>
      </div>

      <GradeColorControl grade={band.gradeLetter} value={band.colorHex} onChange={value => onChange(index, "colorHex", value)} />
      {/* Transcript Remark */}
      <label className="space-y-1 block">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
          Transcript Remark
        </span>
        <input
          type="text"
          value={band.remark}
          onChange={(e) => onChange(index, "remark", e.target.value)}
          placeholder="e.g. Excellent, Credit, Pass, Fail"
          className="w-full h-10 px-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
        />
      </label>
    </div>
  );
}

export function BandTable({
  bands,
  onBandsChange,
  validationErrors,
  onValidationChange,
}: BandTableProps) {
  // Track detailed error types for specific field highlighting
  const errorDetails = useMemo(() => {
    const nameErrorIndices = new Set<number>();
    const rangeErrorIndices = new Set<number>();
    const allErrorIndices = new Set<number>();

    for (const error of validationErrors) {
      if (error.bandIndices) {
        for (const idx of error.bandIndices) {
          allErrorIndices.add(idx);
          if (
            error.type === "duplicate_name" ||
            error.field === "gradeLetter" ||
            error.message.toLowerCase().includes("grade label") ||
            error.message.toLowerCase().includes("grade letter")
          ) {
            nameErrorIndices.add(idx);
          }
          if (
            error.type === "duplicate_range" ||
            error.type === "overlap" ||
            error.type === "gap" ||
            error.type === "out_of_range" ||
            error.field === "scoreRange" ||
            (error.type === "ordering" &&
              !error.message.toLowerCase().includes("grade label") &&
              !error.message.toLowerCase().includes("grade letter"))
          ) {
            rangeErrorIndices.add(idx);
          }
        }
      }
    }
    return { nameErrorIndices, rangeErrorIndices, allErrorIndices };
  }, [validationErrors]);

  const handleChange = useCallback(
    (index: number, field: keyof GradingBandDraft, value: string | number) => {
      const next = [...bands];
      next[index] = { ...next[index], [field]: value };
      onBandsChange(next);

      // Run validation on change
      const errors = validateBandsClient(next);
      onValidationChange(errors);
    },
    [bands, onBandsChange, onValidationChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const next = bands.filter((_, i) => i !== index);
      onBandsChange(next);

      // Run validation after delete
      const errors = validateBandsClient(next);
      onValidationChange(errors);
    },
    [bands, onBandsChange, onValidationChange]
  );

  const handleAdd = useCallback(() => {
    const next = [
      ...bands,
      { minScore: null, maxScore: null, gradeLetter: "", remark: "" },
    ];
    onBandsChange(next);
  }, [bands, onBandsChange]);

  return (
    <div className="flex flex-col">
      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="table-th w-24 px-6 border-b">Grade</th>
              <th className="table-th w-40 border-b">Range</th>
              <th className="table-th border-b">Remark</th>
              <th className="table-th border-b">Color & preview</th>
              <th className="table-th w-16 border-b" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {bands.map((band, index) => (
              <BandRow
                key={index}
                band={band}
                index={index}
                hasError={errorDetails.allErrorIndices.has(index)}
                hasNameError={errorDetails.nameErrorIndices.has(index)}
                hasRangeError={errorDetails.rangeErrorIndices.has(index)}
                onChange={handleChange}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="md:hidden divide-y divide-slate-100">
        {bands.map((band, index) => (
          <BandMobileCard
            key={index}
            band={band}
            index={index}
            hasError={errorDetails.allErrorIndices.has(index)}
            hasNameError={errorDetails.nameErrorIndices.has(index)}
            hasRangeError={errorDetails.rangeErrorIndices.has(index)}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <AddBandButton onAdd={handleAdd} position="bottom" />
    </div>
  );
}
