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
}) {
  const annualAverage = calculateAnnualAverage(args.totals);
  const missingTerms = getMissingCumulativeTerms(args.totals);

  if (annualAverage === null) {
    return {
      annualAverage: null,
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
    gradeLetter,
    remark,
    isComplete: true,
    missingTerms,
  };
}
