"use client";

import {
  FACTORY_DEFAULT_GRADING_BANDS,
  gradeDisplayColor,
  isGradeHex,
} from "@school/shared/exam-recording";

export function GradeColorControl({
  grade,
  value,
  onChange,
}: {
  grade: string;
  value?: string;
  onChange: (value: string) => void;
}) {
  const selected = value ?? "#334155";
  const valid = isGradeHex(selected);
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium">
          Color for {grade || "new tier"}
          <input
            aria-label={`Pick color for ${grade || "new tier"}`}
            type="color"
            value={valid ? selected : "#334155"}
            onChange={(e) => onChange(e.target.value)}
            className="block h-9 w-12 cursor-pointer"
          />
        </label>
        <label className="text-xs font-medium">
          Hex
          <input
            aria-label={`Hex color for ${grade || "new tier"}`}
            aria-invalid={!valid}
            value={selected}
            onChange={(e) => onChange(e.target.value)}
            maxLength={7}
            spellCheck={false}
            className="block w-24 rounded border border-slate-300 p-2 font-mono text-xs"
          />
        </label>
        <span
          className="rounded border border-slate-200 bg-white px-2 py-1 text-sm font-bold"
          style={{ color: gradeDisplayColor(selected) }}
          aria-label={`Safe preview: ${grade || "Grade"}`}
        >
          {grade || "Grade"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Suggested grade colors">
        {FACTORY_DEFAULT_GRADING_BANDS.map((band) => (
          <button
            key={band.colorHex}
            type="button"
            aria-label={`Use ${band.colorHex}`}
            aria-pressed={selected.toLowerCase() === band.colorHex}
            title={band.colorHex}
            onClick={() => onChange(band.colorHex)}
            className="h-7 w-7 rounded border-2 border-white ring-1 ring-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: band.colorHex }}
          />
        ))}
      </div>
      {!valid && (
        <p role="alert" className="text-xs text-red-700">
          Use # followed by six hex digits.
        </p>
      )}
    </div>
  );
}
