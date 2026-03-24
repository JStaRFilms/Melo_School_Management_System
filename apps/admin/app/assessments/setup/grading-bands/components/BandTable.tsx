"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    <div className="space-y-4">
      {/* Header - exact match from mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Grading Bands
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm italic">
            Define result derivation tiers for the session.
          </p>
        </div>
        <AddBandButton onAdd={handleAdd} position="top" />
      </div>

      {/* Table - exact match from mockup */}
      <div className="table-responsive">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="w-20">Grade</th>
              <th>Range</th>
              <th>Remark / Derivation Label</th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
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
