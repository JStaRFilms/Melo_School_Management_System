"use client";

import { useCallback, useMemo } from "react";
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

export function BandTable({
  bands,
  onBandsChange,
  validationErrors,
  onValidationChange,
}: BandTableProps) {
  // Track which bands have errors
  const errorBandIndices = useMemo(() => {
    const indices = new Set<number>();
    for (const error of validationErrors) {
      if (error.bandIndices) {
        for (const idx of error.bandIndices) {
          indices.add(idx);
        }
      }
    }
    return indices;
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
      {/* Table - exact match from mockup */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="table-th w-24 px-6 border-b">Grade</th>
              <th className="table-th w-40 border-b">Range</th>
              <th className="table-th border-b">Remark</th>
              <th className="table-th w-16 border-b" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/60">
            {bands.map((band, index) => (
              <BandRow
                key={index}
                band={band}
                index={index}
                hasError={errorBandIndices.has(index)}
                onChange={handleChange}
                onDelete={handleDelete}
              />
            ))}
          </tbody>
        </table>

        <AddBandButton onAdd={handleAdd} position="bottom" />
      </div>
    </div>
  );
}
