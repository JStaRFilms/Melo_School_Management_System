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
  const band = activeBands.find(
    (b) => totalScore >= b.minScore && totalScore <= b.maxScore
  );

  if (!band) {
    throw new Error(
      `No grading band found for score ${totalScore}. Bands must cover 0-100.`
    );
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
