import type { ExamInputMode, GradingBand } from "@school/shared";
import {
  examScaledScore as computeExamScaled,
  total as computeTotal,
  deriveGradeAndRemark,
} from "@school/shared";
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
 * Get grade color class based on grade letter
 */
export function getGradeColorClass(gradeLetter: string | null): string {
  switch (gradeLetter) {
    case "A":
      return "text-emerald-600";
    case "B":
      return "text-blue-600";
    case "C":
      return "text-amber-600";
    case "D":
      return "text-orange-600";
    case "F":
      return "text-red-600";
    default:
      return "text-slate-300";
  }
}

/**
 * Get grade badge background color class
 */
export function getGradeBadgeColorClass(gradeLetter: string): string {
  switch (gradeLetter) {
    case "A":
      return "bg-emerald-100 text-emerald-800";
    case "B":
      return "bg-blue-100 text-blue-800";
    case "C":
      return "bg-amber-100 text-amber-800";
    case "D":
      return "bg-slate-100 text-slate-800";
    case "F":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
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
    });
    return errors;
  }

  // Check for null values
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (band.minScore === null || band.maxScore === null) {
      errors.push({
        type: "ordering",
        message: `Grade ${band.gradeLetter || "?"}: Both min and max scores are required.`,
        bandIndices: [i],
      });
      return errors;
    }
  }

  // Check ordering and range for each band
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (band.minScore !== null && band.maxScore !== null) {
      if (band.minScore > band.maxScore) {
        errors.push({
          type: "ordering",
          message: `Min score must be less than or equal to max score for Grade ${band.gradeLetter || "?"}.`,
          bandIndices: [i],
        });
      }
      if (band.minScore < 0 || band.maxScore > 100) {
        errors.push({
          type: "out_of_range",
          message: `Score values must be between 0 and 100 for Grade ${band.gradeLetter || "?"}.`,
          bandIndices: [i],
        });
      }
    }
  }

  if (errors.length > 0) return errors;

  // Sort bands by minScore for overlap and gap checks
  const sortedBands = [...bands]
    .map((b, originalIndex) => ({ ...b, originalIndex }))
    .sort((a, b) => (a.minScore ?? 0) - (b.minScore ?? 0));

  // Check for overlaps
  for (let i = 0; i < sortedBands.length - 1; i++) {
    const current = sortedBands[i];
    const next = sortedBands[i + 1];

    if (
      current.maxScore !== null &&
      next.minScore !== null &&
      current.maxScore >= next.minScore
    ) {
      errors.push({
        type: "overlap",
        message: `Bands overlap for Grade ${current.gradeLetter || "?"} and ${next.gradeLetter || "?"}. Resolve thresholds to unblock results.`,
        bandIndices: [current.originalIndex, next.originalIndex],
      });
    }
  }

  // Check coverage: must start at 0
  if (sortedBands[0].minScore !== 0) {
    errors.push({
      type: "gap",
      message: "Grading bands must start at 0. All scores from 0 to 100 must be covered.",
      bandIndices: [sortedBands[0].originalIndex],
    });
  }

  // Check coverage: must end at 100
  if (sortedBands[sortedBands.length - 1].maxScore !== 100) {
    errors.push({
      type: "gap",
      message: "Grading bands must end at 100. All scores from 0 to 100 must be covered.",
      bandIndices: [sortedBands[sortedBands.length - 1].originalIndex],
    });
  }

  // Check for gaps between bands
  for (let i = 0; i < sortedBands.length - 1; i++) {
    const current = sortedBands[i];
    const next = sortedBands[i + 1];

    if (
      current.maxScore !== null &&
      next.minScore !== null &&
      current.maxScore + 1 !== next.minScore
    ) {
      errors.push({
        type: "gap",
        message: `Gap detected between Grade ${current.gradeLetter || "?"} and ${next.gradeLetter || "?"}. All scores from 0 to 100 must be covered.`,
        bandIndices: [current.originalIndex, next.originalIndex],
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
