// Exam Recording Domain - Shared Module

// Types
export type {
  ExamInputMode,
  SchoolAssessmentSettings,
  AssessmentEditingPolicy,
  AssessmentEditLockReason,
  AssessmentEditingState,
  GradingBand,
  AssessmentRecord,
  ScoreInput,
  DerivedAssessmentFields,
  ValidationError,
  UpsertResult,
} from "./types";

// Calculation functions
export {
  round,
  caTotal,
  examScaledScore,
  total,
  deriveGradeAndRemark,
  deriveAssessmentFields,
} from "./calculations";

// Validation functions
export { validateScoreRanges, validateGradingBands } from "./validation";

// Editing policy helpers
export { resolveAssessmentEditingState } from "./editing-policy";

export { FACTORY_DEFAULT_GRADING_BANDS, isGradeHex, gradeDisplayColor, resolveGradeColor } from "./grade-policy";
export type { GradingBandItem } from "./grade-policy";
export { reportCardReviewKey } from "./report-review";
