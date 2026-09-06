import { resolveGradeColor } from "@school/shared/exam-recording";
import { FACTORY_DEFAULT_GRADING_BANDS, isGradeHex } from "@school/shared/exam-recording";
import type { ExamInputMode, GradingBand } from "../../../packages/shared/src/exam-recording";
import {
  examScaledScore as computeExamScaled,
  total as computeTotal,
  deriveGradeAndRemark,
} from "../../../packages/shared/src/exam-recording";
import type {
  DraftScores,
  GradingBandDraft,
  GradingBandResponse,
  ScoreField,
  StudentRosterEntry,
  ValidationErrors,
  BandValidationError,
  Id,
} from "@/types";

/**
 * Get the effective value for a score field (draft or original)
 */
export function getEffectiveValue(
  studentId: Id<"students">,
  field: ScoreField,
  draftScores: DraftScores,
  roster: StudentRosterEntry[]
): number | null {
  const draft = draftScores.get(studentId);
  if (draft && draft[field] !== undefined) {
    return draft[field] ?? null;
  }

  const entry = roster.find((s) => s.studentId === studentId);
  if (!entry?.assessmentRecord) return null;

  return entry.assessmentRecord[field] ?? null;
}

/**
 * Compute derived values for a student row
 */
export function computeDerivedValues(
  ca1: number | null,
  ca2: number | null,
  ca3: number | null,
  examRaw: number | null,
  examInputMode: ExamInputMode,
  gradingBands: GradingBandResponse[]
): {
  examScaledScore: number | null;
  total: number | null;
  gradeLetter: string | null;
  gradeColor?: string;
  remark: string | null;
} {
  if (ca1 === null || ca2 === null || ca3 === null || examRaw === null) {
    return {
      examScaledScore: null,
      total: null,
      gradeLetter: null,
      remark: null,
    };
  }

  const scaled = computeExamScaled(examRaw, examInputMode);
  const totalValue = computeTotal(ca1, ca2, ca3, scaled);

  let gradeLetter: string | null = null;
  let remark: string | null = null;

  if (gradingBands.length > 0) {
    try {
      const bands: GradingBand[] = gradingBands.map((b) => ({
        schoolId: b.schoolId,
        minScore: b.minScore,
        maxScore: b.maxScore,
        gradeLetter: b.gradeLetter,
    colorHex: b.colorHex ?? b.color,
        remark: b.remark,
        isActive: b.isActive,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        updatedBy: b.updatedBy,
      }));
      const result = deriveGradeAndRemark(totalValue, bands);
      gradeLetter = result.gradeLetter;
      remark = result.remark;
    } catch {
      gradeLetter = null;
      remark = null;
    }
  }

  return {
    examScaledScore: scaled,
    total: totalValue,
    gradeLetter,
    gradeColor: resolveGradeColor(gradeLetter, gradingBands),
    remark,
  };
}

/**
 * Validate a single field value
 */
export function validateField(
  field: ScoreField,
  value: number | null,
  examInputMode: ExamInputMode
): string | null {
  if (value === null) return null;

  if (field === "ca1" || field === "ca2" || field === "ca3") {
    if (value < 0 || value > 20) {
      return `${field.toUpperCase()} must be between 0 and 20`;
    }
  }

  if (field === "examRawScore") {
    if (examInputMode === "raw40") {
      if (value < 0 || value > 40) {
        return "Exam score must be between 0 and 40";
      }
    } else {
      if (value < 0 || value > 60) {
        return "Exam score must be between 0 and 60";
      }
    }
  }

  return null;
}

/**
 * Check if there are any validation errors
 */
export function hasAnyErrors(errors: ValidationErrors): boolean {
  return errors.size > 0;
}

/**
 * Count total validation errors
 */
export function countErrors(errors: ValidationErrors): number {
  let count = 0;
  for (const studentErrors of errors.values()) {
    count += Object.keys(studentErrors).length;
  }
  return count;
}

/**
 * Build error summaries for display
 */
export function buildErrorSummaries(
  errors: ValidationErrors,
  roster: StudentRosterEntry[]
): Array<{ studentName: string; message: string }> {
  const summaries: Array<{ studentName: string; message: string }> = [];

  for (const [studentId, fieldErrors] of errors.entries()) {
    const student = roster.find((s) => s.studentId === studentId);
    const studentName = student?.studentName ?? "Unknown student";

    for (const message of Object.values(fieldErrors)) {
      if (message) {
        summaries.push({ studentName, message });
      }
    }
  }

  return summaries;
}

/**
 * Validate grading bands (client-side)
 */
export function validateBandsClient(
  bands: GradingBandDraft[]
): BandValidationError[] {
  const errors: BandValidationError[] = [];

  if (bands.length === 0) {
    errors.push({
      type: "empty",
      message: "At least one grading band is required.",
      field: "all",
    });
    return errors;
  }

  // Check for missing values, out-of-range, and ordering violations on individual rows
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (band.colorHex !== undefined && !isGradeHex(band.colorHex)) errors.push({type: "ordering", message: `Tier #${i + 1}: use a six-digit hex color.`, bandIndices: [i], field: "all"});
    if (band.gradeLetter.trim().length === 0) {
      errors.push({
        type: "ordering",
        message: `Tier #${i + 1} is missing a grade label. Each grading band needs a grade letter or label.`,
        bandIndices: [i],
        field: "gradeLetter",
      });
    }
    if (band.minScore === null || band.maxScore === null) {
      errors.push({
        type: "ordering",
        message: `Grade "${band.gradeLetter || `Tier #${i + 1}`}": Both minimum and maximum scores are required.`,
        bandIndices: [i],
        field: "scoreRange",
      });
    } else {
      if (band.minScore > band.maxScore) {
        errors.push({
          type: "ordering",
          message: `Minimum score (${band.minScore}) cannot exceed maximum score (${band.maxScore}) for Grade "${band.gradeLetter || `Tier #${i + 1}`}".`,
          bandIndices: [i],
          field: "scoreRange",
        });
      }
      if (band.minScore < 0 || band.maxScore > 100) {
        errors.push({
          type: "out_of_range",
          message: `Score values must be between 0 and 100 for Grade "${band.gradeLetter || `Tier #${i + 1}`}".`,
          bandIndices: [i],
          field: "scoreRange",
        });
      }
    }
  }

  // Check for duplicate grade letters/labels
  const gradeLabelMap = new Map<string, { raw: string; indices: number[] }>();
  for (let i = 0; i < bands.length; i++) {
    const raw = bands[i].gradeLetter.trim();
    const normalized = raw.toUpperCase();
    if (normalized.length > 0) {
      const existing = gradeLabelMap.get(normalized);
      if (existing) {
        existing.indices.push(i);
      } else {
        gradeLabelMap.set(normalized, { raw, indices: [i] });
      }
    }
  }

  for (const [, { raw, indices }] of gradeLabelMap.entries()) {
    if (indices.length > 1) {
      errors.push({
        type: "duplicate_name",
        message: `Duplicate grade label "${raw}" found across ${indices.length} tiers. Each grade tier must have a unique label.`,
        bandIndices: indices,
        field: "gradeLetter",
      });
    }
  }

  // If any individual band has nulls or invalid bounds, return collected errors before global coverage checks
  const hasIncompleteRow = bands.some(
    (b) =>
      b.minScore === null ||
      b.maxScore === null ||
      b.minScore < 0 ||
      b.maxScore > 100 ||
      b.minScore > b.maxScore
  );

  if (hasIncompleteRow) {
    return errors;
  }

  // Sort bands by minScore for overlap and gap checks
  const sortedBands = [...bands]
    .map((b, originalIndex) => ({
      ...b,
      minScore: b.minScore as number,
      maxScore: b.maxScore as number,
      originalIndex,
    }))
    .sort((a, b) => a.minScore - b.minScore);

  // Check for duplicate score ranges and overlaps
  for (let i = 0; i < sortedBands.length - 1; i++) {
    const current = sortedBands[i];
    const next = sortedBands[i + 1];

    if (current.maxScore >= next.minScore) {
      if (current.minScore === next.minScore && current.maxScore === next.maxScore) {
        errors.push({
          type: "duplicate_range",
          message: `Duplicate score range ${current.minScore}–${current.maxScore} assigned to both Grade "${current.gradeLetter || "?"}" and "${next.gradeLetter || "?"}".`,
          bandIndices: [current.originalIndex, next.originalIndex],
          field: "scoreRange",
        });
      } else {
        const overlapStart = next.minScore;
        const overlapEnd = Math.min(current.maxScore, next.maxScore);
        errors.push({
          type: "overlap",
          message: `Bands overlap between Grade "${current.gradeLetter || "?"}" (${current.minScore}–${current.maxScore}) and "${next.gradeLetter || "?"}" (${next.minScore}–${next.maxScore}). Overlap: ${overlapStart}–${overlapEnd}.`,
          bandIndices: [current.originalIndex, next.originalIndex],
          field: "scoreRange",
        });
      }
    }
  }

  // Check coverage: must start at 0
  if (sortedBands[0].minScore !== 0) {
    errors.push({
      type: "gap",
      message: `Grading policy must start at 0 (currently starts at ${sortedBands[0].minScore}). All scores from 0 to 100 must be covered.`,
      bandIndices: [sortedBands[0].originalIndex],
      field: "scoreRange",
    });
  }

  // Check coverage: must end at 100
  if (sortedBands[sortedBands.length - 1].maxScore !== 100) {
    errors.push({
      type: "gap",
      message: `Grading policy must end at 100 (currently ends at ${sortedBands[sortedBands.length - 1].maxScore}). All scores from 0 to 100 must be covered.`,
      bandIndices: [sortedBands[sortedBands.length - 1].originalIndex],
      field: "scoreRange",
    });
  }

  // Check for gaps between adjacent bands
  for (let i = 0; i < sortedBands.length - 1; i++) {
    const current = sortedBands[i];
    const next = sortedBands[i + 1];

    if (current.maxScore + 1 < next.minScore) {
      errors.push({
        type: "gap",
        message: `Uncovered score gap ${current.maxScore + 1}–${next.minScore - 1} between Grade "${current.gradeLetter || "?"}" and "${next.gradeLetter || "?"}". All scores from 0 to 100 must be covered.`,
        bandIndices: [current.originalIndex, next.originalIndex],
        field: "scoreRange",
      });
    }
  }

  return errors;
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Standard default grading bands scale covering 0-100
 */
export const STANDARD_DEFAULT_GRADING_BANDS: GradingBandDraft[] = FACTORY_DEFAULT_GRADING_BANDS.map(band => ({ ...band }));
