import { useCallback } from "react";
import {
  validateScoreRanges,
  examScaledScore as computeExamScaledScore,
  total as computeTotal,
  deriveGradeAndRemark,
} from "@school/shared";
import type { ExamInputMode, GradingBand } from "@school/shared";
import type {
  ScoreField,
  DraftScores,
  ValidationErrors,
  StudentRosterEntry,
  Id,
  toGradingBand,
} from "./types";
import type { GradingBandResponse } from "./types";

/**
 * Validates a single field value and returns an error message or null.
 */
export function validateField(
  field: ScoreField,
  value: number | null,
  examInputMode: ExamInputMode
): string | null {
  if (value === null) return null; // incomplete rows are not invalid

  const errors = validateScoreRanges(
    field === "ca1" ? value : 0,
    field === "ca2" ? value : 0,
    field === "ca3" ? value : 0,
    field === "examRawScore" ? value : 0,
    examInputMode
  );

  const fieldError = errors.find((e) => e.field === field);
  return fieldError ? fieldError.message : null;
}

/**
 * Validates all draft scores and returns a new ValidationErrors map.
 */
export function validateAllDrafts(
  draftScores: DraftScores,
  examInputMode: ExamInputMode
): ValidationErrors {
  const errors: ValidationErrors = new Map();

  for (const [studentId, scores] of draftScores.entries()) {
    const studentErrors: Partial<Record<ScoreField, string>> = {};
    let hasErrors = false;

    for (const field of ["ca1", "ca2", "ca3", "examRawScore"] as ScoreField[]) {
      const value = scores[field] ?? null;
      const error = validateField(field, value, examInputMode);
      if (error) {
        studentErrors[field] = error;
        hasErrors = true;
      }
    }

    if (hasErrors) {
      errors.set(studentId, studentErrors);
    }
  }

  return errors;
}

/**
 * Computes derived values for a row given raw scores.
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

  const scaled = computeExamScaledScore(examRaw, examInputMode);
  const totalVal = computeTotal(ca1, ca2, ca3, scaled);

  const bands = gradingBands.map((b) => ({
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

  try {
    const gradeInfo = deriveGradeAndRemark(totalVal, bands);
    return {
      examScaledScore: scaled,
      total: totalVal,
      gradeLetter: gradeInfo.gradeLetter,
      remark: gradeInfo.remark,
    };
  } catch {
    return {
      examScaledScore: scaled,
      total: totalVal,
      gradeLetter: null,
      remark: null,
    };
  }
}

/**
 * Gets the effective value for a field (draft overrides original).
 */
export function getEffectiveValue(
  studentId: Id<"students">,
  field: ScoreField,
  draftScores: DraftScores,
  roster: StudentRosterEntry[]
): number | null {
  const draftEntry = draftScores.get(studentId);
  if (draftEntry && field in draftEntry) {
    return draftEntry[field] ?? null;
  }

  const student = roster.find((s) => s.studentId === studentId);
  if (student?.assessmentRecord) {
    return student.assessmentRecord[field];
  }

  return null;
}

/**
 * Checks if there are any validation errors.
 */
export function hasAnyErrors(errors: ValidationErrors): boolean {
  return errors.size > 0;
}

/**
 * Counts the total number of validation errors across all students.
 */
export function countErrors(errors: ValidationErrors): number {
  let count = 0;
  for (const studentErrors of errors.values()) {
    count += Object.keys(studentErrors).length;
  }
  return count;
}

/**
 * Builds the list of error summaries for the ValidationErrorBanner.
 */
export function buildErrorSummaries(
  errors: ValidationErrors,
  roster: StudentRosterEntry[]
): Array<{ studentName: string; message: string }> {
  const summaries: Array<{ studentName: string; message: string }> = [];

  for (const [studentId, fieldErrors] of errors.entries()) {
    const student = roster.find((s) => s.studentId === studentId);
    const studentName = student?.studentName ?? "Unknown";

    for (const [, message] of Object.entries(fieldErrors)) {
      if (message) {
        summaries.push({ studentName, message });
      }
    }
  }

  return summaries;
}

/**
 * Hook-like utility for exam entry validation and computation.
 */
export function useExamEntryHelpers() {
  return {
    validateField,
    validateAllDrafts,
    computeDerivedValues,
    getEffectiveValue,
    hasAnyErrors,
    countErrors,
    buildErrorSummaries,
  };
}
