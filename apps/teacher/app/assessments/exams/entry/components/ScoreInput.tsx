"use client";

import { useId } from "react";
import type { ScoreField } from "@/lib/types";

interface ScoreInputProps {
  field: ScoreField;
  studentName?: string;
  showMaxLabel?: boolean;
  value: number | null;
  max: number;
  onChange: (value: number | null) => void;
  isExamField?: boolean;
  validationError?: string | null;
  disabled?: boolean;
}

export function ScoreInput({
  field,
  studentName,
  showMaxLabel = false,
  value,
  max,
  onChange,
  isExamField = false,
  validationError = null,
  disabled = false,
}: ScoreInputProps) {
  const errorId = useId();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(null);
      return;
    }
    const num = Number(raw);
    if (isNaN(num)) {
      onChange(null);
    } else {
      onChange(num);
    }
  };

  const hasError = validationError != null;
  const errorDescriptionId = hasError ? errorId : undefined;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Desktop: exact mockup score-input */}
      <input
        type="number"
        value={value ?? ""}
        min={0}
        max={max}
        step="0.01"
        onChange={handleChange}
        disabled={disabled}
        placeholder="--"
        aria-label={`${studentName ? `${studentName} ` : ""}${field === "examRawScore" ? "exam" : field.toUpperCase()} score out of ${max}`}
        aria-invalid={hasError}
        aria-describedby={errorDescriptionId}
        title={validationError ?? undefined}
        className={`hidden md:block score-input ${hasError ? "error" : ""} ${
          isExamField ? "bg-amber-50/20 border-amber-200" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />
      {/* Mobile: exact mockup score-input-mobile */}
      <input
        type="number"
        value={value ?? ""}
        min={0}
        max={max}
        step="0.01"
        onChange={handleChange}
        disabled={disabled}
        placeholder="--"
        aria-label={`${studentName ? `${studentName} ` : ""}${field === "examRawScore" ? "exam" : field.toUpperCase()} score out of ${max}`}
        aria-invalid={hasError}
        aria-describedby={errorDescriptionId}
        title={validationError ?? undefined}
        className={`md:hidden score-input-mobile ${hasError ? "error" : ""} ${
          isExamField ? "bg-amber-50/20 border-amber-200" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />
      {showMaxLabel && <span className="hidden md:block text-[10px] text-obsidian-500">/{max}</span>}
      {hasError && (
        <p id={errorId} role="alert" className="max-w-28 text-center text-[10px] font-semibold leading-tight text-rose-600">
          {validationError}
        </p>
      )}
    </div>
  );
}
