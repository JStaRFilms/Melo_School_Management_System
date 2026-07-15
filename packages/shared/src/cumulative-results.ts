import { deriveGradeAndRemark, round } from "./exam-recording/calculations";
import type { GradingBand } from "./exam-recording/types";

export type ReportCardCalculationMode = "standalone" | "cumulative_annual";
export type HistoricalTermTotalSource = "manual_backfill" | "migration_snapshot";

export type CumulativeTermKey = "first" | "second" | "current";

export type CumulativeTermTotals = {
  first: number | null;
  second: number | null;
  current: number | null;
};

export function isCumulativeAnnualMode(args: {
  calculationMode: ReportCardCalculationMode;
  currentTermIndex: number;
}) {
  return (
    args.calculationMode === "cumulative_annual" && args.currentTermIndex === 2
  );
}

export function calculateAnnualAverage(totals: CumulativeTermTotals) {
  if (
    totals.first === null ||
    totals.second === null ||
    totals.current === null
  ) {
    return null;
  }

  return round((totals.first + totals.second + totals.current) / 3, 2);
}

export function getMissingCumulativeTerms(totals: CumulativeTermTotals) {
  const missing: CumulativeTermKey[] = [];

  if (totals.first === null) missing.push("first");
  if (totals.second === null) missing.push("second");
  if (totals.current === null) missing.push("current");

  return missing;
}

export function deriveCumulativeAnnualResult(args: {
  totals: CumulativeTermTotals;
  gradingBands: GradingBand[];
  includedTerms?: CumulativeTermKey[];
  finalTotalOverride?: number | null;
}) {
  if (
    args.finalTotalOverride !== null &&
    args.finalTotalOverride !== undefined &&
    !Number.isFinite(args.finalTotalOverride)
  ) {
    throw new RangeError("Final total override must be finite");
  }

  const includedTerms = args.includedTerms ?? ["first", "second", "current"];
  const missingTerms = includedTerms.filter((key) => args.totals[key] === null);
  const includedValues = includedTerms
    .map((key) => args.totals[key])
    .filter((value): value is number => value !== null);
  const computedAverage =
    includedTerms.length > 0 && missingTerms.length === 0
      ? round(
          includedValues.reduce((sum, value) => sum + value, 0) /
            includedTerms.length,
          2
        )
      : null;
  const annualAverage = args.finalTotalOverride ?? computedAverage;

  if (annualAverage === null) {
    return {
      annualAverage: null,
      computedAverage,
      divisor: includedTerms.length,
      gradeLetter: null,
      remark: null,
      isComplete: false,
      missingTerms,
    };
  }

  const { gradeLetter, remark } = deriveGradeAndRemark(
    annualAverage,
    args.gradingBands
  );

  return {
    annualAverage,
    computedAverage,
    divisor: includedTerms.length,
    gradeLetter,
    remark,
    isComplete: true,
    missingTerms: [] as CumulativeTermKey[],
  };
}
