"use client";

import type { ScoreField } from "@/lib/types";

interface ScoreInputProps {
  field: ScoreField;
  value: number | null;
  max: number;
  onChange: (value: number | null) => void;
  isExamField?: boolean;
  validationError?: string | null;
}

export function ScoreInput({
  field,
  value,
  max,
  onChange,
  isExamField = false,
  validationError = null,
}: ScoreInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(null);
      return;
    }
    const num = parseInt(raw, 10);
    if (isNaN(num)) {
      onChange(null);
    } else {
      onChange(num);
    }
  };

  const hasError = validationError != null;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Desktop: exact mockup score-input */}
      <input
        type="number"
        value={value ?? ""}
        min={0}
        max={max}
        step={1}
        onChange={handleChange}
        placeholder="--"
        aria-label={`${field} score`}
        aria-invalid={hasError}
        title={validationError ?? undefined}
        className={`hidden md:block score-input ${hasError ? "error" : ""} ${
          isExamField ? "bg-amber-50/20 border-amber-200" : ""
        }`}
      />
      {/* Mobile: exact mockup score-input-mobile */}
      <input
        type="number"
        value={value ?? ""}
        min={0}
        max={max}
        step={1}
        onChange={handleChange}
        placeholder="--"
        aria-label={`${field} score`}
        aria-invalid={hasError}
        title={validationError ?? undefined}
        className={`md:hidden score-input-mobile ${hasError ? "error" : ""} ${
          isExamField ? "bg-amber-50/20 border-amber-200" : ""
        }`}
      />
      {hasError && (
        <span className="text-[9px] font-bold text-red-500 max-w-[120px] text-center leading-tight">
          {validationError}
        </span>
      )}
    </div>
  );
}
