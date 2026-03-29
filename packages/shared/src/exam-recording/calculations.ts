import type { ExamInputMode, GradingBand, DerivedAssessmentFields } from "./types";

/**
 * Round a number to a specified number of decimal places
 */
export function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate the total CA score
 */
export function caTotal(ca1: number, ca2: number, ca3: number): number {
  return ca1 + ca2 + ca3;
}

/**
 * Calculate the exam scaled score based on input mode
 * 
 * raw40: examScaledScore = examRawScore
 * raw60_scaled_to_40: examScaledScore = round((examRawScore / 60) * 40, 2)
 */
export function examScaledScore(
  examRawScore: number,
  examInputMode: ExamInputMode
): number {
  if (examInputMode === "raw40") {
    return examRawScore;
  }
  // raw60_scaled_to_40
  return round((examRawScore / 60) * 40, 2);
}

/**
 * Calculate the total score
 * total = round(ca1 + ca2 + ca3 + examScaledScore, 2)
 */
export function total(
  ca1: number,
  ca2: number,
  ca3: number,
  examScaledScoreValue: number
): number {
  return round(ca1 + ca2 + ca3 + examScaledScoreValue, 2);
}

/**
 * Derive grade letter and remark from total score using active grading bands
 * 
 * @throws Error if no band matches (should never happen if bands cover 0-100)
 */
export function deriveGradeAndRemark(
  totalScore: number,
  activeBands: GradingBand[]
): { gradeLetter: string; remark: string } {
  if (activeBands.length === 0) {
    return { gradeLetter: "-", remark: "N/A" };
  }

  // Handle rounding edge cases and out-of-bounds scores by clamping to 0-100
  const score = Math.max(0, Math.min(100, totalScore));
  // Grading bands are configured as whole-number intervals, so decimal totals
  // from scaled exams or aggregated subjects grade against their integer floor.
  const bandLookupScore = Math.floor(score);

  const band = activeBands.find(
    (b) => bandLookupScore >= b.minScore && bandLookupScore <= b.maxScore
  );

  if (!band) {
    // If no band exactly matches (gaps in config), find the closest one
    const sorted = [...activeBands].sort((a, b) => a.minScore - b.minScore);
    if (score <= sorted[0].minScore) {
      return { gradeLetter: sorted[0].gradeLetter, remark: sorted[0].remark };
    }
    if (score >= sorted[sorted.length - 1].maxScore) {
      return {
        gradeLetter: sorted[sorted.length - 1].gradeLetter,
        remark: sorted[sorted.length - 1].remark,
      };
    }

    // This case should be very rare if bands are sensible
    return { gradeLetter: "?", remark: "Invalid Range" };
  }

  return {
    gradeLetter: band.gradeLetter,
    remark: band.remark,
  };
}

/**
 * Derive all assessment fields from raw inputs
 * 
 * This is the main calculation function that combines all derivation steps
 */
export function deriveAssessmentFields(
  ca1: number,
  ca2: number,
  ca3: number,
  examRawScore: number,
  examInputMode: ExamInputMode,
  activeBands: GradingBand[]
): DerivedAssessmentFields {
  const caTotalValue = caTotal(ca1, ca2, ca3);
  const examScaledScoreValue = examScaledScore(examRawScore, examInputMode);
  const totalValue = total(ca1, ca2, ca3, examScaledScoreValue);
  const { gradeLetter, remark } = deriveGradeAndRemark(totalValue, activeBands);

  return {
    caTotal: caTotalValue,
    examScaledScore: examScaledScoreValue,
    total: totalValue,
    gradeLetter,
    remark,
  };
}
