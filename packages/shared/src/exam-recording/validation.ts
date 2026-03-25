import type { ExamInputMode, GradingBand, ValidationError } from "./types";

/**
 * Validate score ranges for assessment records
 * 
 * @returns Array of validation errors (empty if valid)
 */
export function validateScoreRanges(
  ca1: number,
  ca2: number,
  ca3: number,
  examRawScore: number,
  examInputMode: ExamInputMode
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate CA1
  if (ca1 < 0 || ca1 > 20) {
    errors.push({
      field: "ca1",
      message: "CA1 must be between 0 and 20",
    });
  }

  // Validate CA2
  if (ca2 < 0 || ca2 > 20) {
    errors.push({
      field: "ca2",
      message: "CA2 must be between 0 and 20",
    });
  }

  // Validate CA3
  if (ca3 < 0 || ca3 > 20) {
    errors.push({
      field: "ca3",
      message: "CA3 must be between 0 and 20",
    });
  }

  // Validate exam raw score based on mode
  if (examInputMode === "raw40") {
    if (examRawScore < 0 || examRawScore > 40) {
      errors.push({
        field: "examRawScore",
        message: "Exam score must be between 0 and 40",
      });
    }
  } else if (examInputMode === "raw60_scaled_to_40") {
    if (examRawScore < 0 || examRawScore > 60) {
      errors.push({
        field: "examRawScore",
        message: "Exam score must be between 0 and 60",
      });
    }
  }

  return errors;
}

/**
 * Validate grading bands for overlap and coverage
 * 
 * Rules:
 * 1. minScore <= maxScore for every band
 * 2. minScore >= 0 and maxScore <= 100
 * 3. No overlap between bands
 * 4. Full coverage from 0 to 100
 * 5. At least one band must be provided
 * 
 * @returns Array of validation errors (empty if valid)
 */
export function validateGradingBands(bands: GradingBand[]): ValidationError[] {
  const errors: ValidationError[] = [];

  // Rule 5: At least one band
  if (bands.length === 0) {
    errors.push({
      field: "record",
      message: "At least one grading band must be provided",
    });
    return errors;
  }

  // Rule 1 & 2: Validate individual bands
  for (const band of bands) {
    if (band.gradeLetter.trim().length === 0) {
      errors.push({
        field: "record",
        message: "Each grading band needs a grade letter or label.",
      });
    }
    if (band.minScore > band.maxScore) {
      errors.push({
        field: "record",
        message: `Band "${band.gradeLetter}": minScore (${band.minScore}) must be less than or equal to maxScore (${band.maxScore})`,
      });
    }
    if (band.minScore < 0) {
      errors.push({
        field: "record",
        message: `Band "${band.gradeLetter}": minScore must be >= 0`,
      });
    }
    if (band.maxScore > 100) {
      errors.push({
        field: "record",
        message: `Band "${band.gradeLetter}": maxScore must be <= 100`,
      });
    }
  }

  // If individual band validation failed, skip overlap/coverage checks
  if (errors.length > 0) {
    return errors;
  }

  // Sort bands by minScore for overlap and coverage checks
  const sortedBands = [...bands].sort((a, b) => a.minScore - b.minScore);

  // Rule 3: Check for overlaps
  for (let i = 0; i < sortedBands.length - 1; i++) {
    const current = sortedBands[i];
    const next = sortedBands[i + 1];

    if (current.maxScore >= next.minScore) {
      const overlapStart = next.minScore;
      const overlapEnd = Math.min(current.maxScore, next.maxScore);
      errors.push({
        field: "record",
        message: `Bands overlap: range ${overlapStart}-${overlapEnd} is covered by multiple bands`,
      });
    }
  }

  // Rule 4: Check for full coverage
  if (sortedBands[0].minScore !== 0) {
    errors.push({
      field: "record",
      message: "Grading bands must start at 0",
    });
  }

  if (sortedBands[sortedBands.length - 1].maxScore !== 100) {
    errors.push({
      field: "record",
      message: "Grading bands must end at 100",
    });
  }

  // Check for gaps between bands
  for (let i = 0; i < sortedBands.length - 1; i++) {
    const current = sortedBands[i];
    const next = sortedBands[i + 1];

    if (current.maxScore + 1 !== next.minScore) {
      errors.push({
        field: "record",
        message: `Gap in grading bands: no band covers range ${current.maxScore + 1} to ${next.minScore - 1}`,
      });
    }
  }

  return errors;
}
