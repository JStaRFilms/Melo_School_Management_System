import type { ExamInputMode, GradingBand, ValidationError } from "./types";

/** Server-strict cap: the thrower and returner agree on 1–100 bands. */
export const MAX_GRADING_BANDS = 100;

export type BandSetIssueCode =
  | "empty"
  | "too_many"
  | "blank_label"
  | "duplicate_label"
  | "non_integer"
  | "out_of_range"
  | "inverted_range"
  | "bad_span"
  | "overlap"
  | "gap";

export interface BandSetIssue {
  code: BandSetIssueCode;
  /** Input index of the offending band (second occurrence for duplicates). */
  index?: number;
  /** Adjacent-band code (overlap/gap): input index of the next band in sorted order. */
  nextIndex?: number;
  /** trimmed grade label (label codes). */
  label?: string;
  /** offending bound for non_integer/out_of_range. */
  bound?: "minScore" | "maxScore";
  /** offending value for out_of_range. */
  value?: number;
  /** span end for bad_span. */
  spanEnd?: "start" | "end";
  /** gap range (inclusive). */
  gapFrom?: number;
  gapTo?: number;
}

export type BandSetInput = Pick<GradingBand, "gradeLetter" | "minScore" | "maxScore">;

/**
 * Single band-set predicate shared by the server thrower, the shared
 * returner, and the zod schemas (consolidation P3). Server-strict superset:
 * integers and the 100-band cap are checked here so the client can never
 * call a set valid that the server rejects.
 *
 * Canonical order mirrors the server thrower: length, then per-band
 * (label before bounds, duplicates at second occurrence), then span,
 * overlap, gap. Structural checks assume integer bounds; non-integer sets
 * are already rejected in stage 1.
 */
export function checkGradingBandSet(bands: BandSetInput[]): BandSetIssue[] {
  const issues: BandSetIssue[] = [];
  if (bands.length === 0) {
    return [{ code: "empty" }];
  }
  if (bands.length > MAX_GRADING_BANDS) {
    issues.push({ code: "too_many" });
  }
  const seenLabels = new Map<string, number>();
  bands.forEach((band, index) => {
    const label = band.gradeLetter.trim().toUpperCase();
    if (label.length === 0) {
      issues.push({ code: "blank_label", index });
    } else if (seenLabels.has(label)) {
      issues.push({ code: "duplicate_label", index, label: band.gradeLetter.trim() });
    } else {
      seenLabels.set(label, index);
    }
    for (const bound of ["minScore", "maxScore"] as const) {
      if (!Number.isInteger(band[bound])) {
        issues.push({ code: "non_integer", index, bound, value: band[bound] });
      }
    }
    if (band.minScore < 0) {
      issues.push({ code: "out_of_range", index, bound: "minScore", value: band.minScore });
    }
    if (band.maxScore > 100) {
      issues.push({ code: "out_of_range", index, bound: "maxScore", value: band.maxScore });
    }
    if (band.minScore > band.maxScore) {
      issues.push({ code: "inverted_range", index });
    }
  });
  if (issues.length > 0) {
    return issues;
  }
  const order = bands.map((band, index) => ({ ...band, index })).sort((a, b) => a.minScore - b.minScore);
  if (order[0].minScore !== 0) {
    issues.push({ code: "bad_span", spanEnd: "start" });
  }
  if (order[order.length - 1].maxScore !== 100) {
    issues.push({ code: "bad_span", spanEnd: "end" });
  }
  for (let i = 0; i < order.length - 1; i++) {
    const current = order[i];
    const next = order[i + 1];
    if (next.minScore <= current.maxScore) {
      issues.push({ code: "overlap", index: current.index, nextIndex: next.index });
    }
    if (next.minScore !== current.maxScore + 1) {
      issues.push({
        code: "gap",
        index: current.index,
        nextIndex: next.index,
        gapFrom: current.maxScore + 1,
        gapTo: next.minScore - 1,
      });
    }
  }
  return issues;
}

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
 * Rules (server-strict, via checkGradingBandSet):
 * 1. minScore <= maxScore for every band
 * 2. minScore >= 0 and maxScore <= 100, whole numbers only
 * 3. No overlap between bands
 * 4. Full coverage from 0 to 100
 * 5. At least one band must be provided, at most 100
 *
 * @returns Array of validation errors (empty if valid)
 */
export function validateGradingBands(bands: GradingBand[]): ValidationError[] {
  const issues = checkGradingBandSet(bands);
  if (issues.length === 0) {
    return [];
  }
  if (issues[0].code === "empty") {
    return [
      {
        field: "record",
        message: "At least one grading band must be provided",
      },
    ];
  }
  const errors: ValidationError[] = [];
  const structural: BandSetIssue[] = [];
  for (const issue of issues) {
    switch (issue.code) {
      case "too_many":
        errors.push({
          field: "record",
          message: `Use 1–${MAX_GRADING_BANDS} grading bands`,
        });
        break;
      case "duplicate_label":
        errors.push({
          field: "record",
          message: `Duplicate grade label "${issue.label}": each grading band must have a unique grade label.`,
        });
        break;
      case "blank_label":
        errors.push({
          field: "record",
          message: "Each grading band needs a grade letter or label.",
        });
        break;
      case "non_integer": {
        const band = bands[issue.index ?? 0];
        errors.push({
          field: "record",
          message: `Band "${band.gradeLetter}": ${issue.bound} (${issue.value}) must be a whole number`,
        });
        break;
      }
      case "out_of_range": {
        const band = bands[issue.index ?? 0];
        errors.push({
          field: "record",
          message:
            issue.bound === "minScore"
              ? `Band "${band.gradeLetter}": minScore must be >= 0`
              : `Band "${band.gradeLetter}": maxScore must be <= 100`,
        });
        break;
      }
      case "inverted_range": {
        const band = bands[issue.index ?? 0];
        errors.push({
          field: "record",
          message: `Band "${band.gradeLetter}": minScore (${band.minScore}) must be less than or equal to maxScore (${band.maxScore})`,
        });
        break;
      }
      default:
        structural.push(issue);
    }
  }

  // Individual band validation failed: skip overlap/coverage checks
  if (errors.length > 0) {
    return errors;
  }

  for (const issue of structural) {
    if (issue.code === "bad_span") {
      errors.push({
        field: "record",
        message:
          issue.spanEnd === "start"
            ? "Grading bands must start at 0"
            : "Grading bands must end at 100",
      });
      continue;
    }
    const current = bands[issue.index ?? 0];
    const next = bands[issue.nextIndex ?? 0];
    if (issue.code === "overlap") {
      if (current.minScore === next.minScore && current.maxScore === next.maxScore) {
        errors.push({
          field: "record",
          message: `Duplicate score range ${current.minScore}–${current.maxScore} found for Grade "${current.gradeLetter}" and "${next.gradeLetter}".`,
        });
      } else {
        const overlapEnd = Math.min(current.maxScore, next.maxScore);
        errors.push({
          field: "record",
          message: `Bands overlap: range ${next.minScore}–${overlapEnd} is covered by multiple bands (Grade "${current.gradeLetter}" and "${next.gradeLetter}").`,
        });
      }
      continue;
    }
    errors.push({
      field: "record",
      message: `Gap in grading bands: no band covers range ${issue.gapFrom} to ${issue.gapTo}`,
    });
  }

  return errors;
}
