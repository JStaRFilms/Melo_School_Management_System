// Exam Recording Domain - Shared Module

// Types
export { EXAM_INPUT_MODES } from "./types";
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
export {
  MAX_GRADING_BANDS,
  checkGradingBandSet,
  validateScoreRanges,
  validateGradingBands,
} from "./validation";
export type { BandSetInput, BandSetIssue, BandSetIssueCode } from "./validation";

export { SESSION_SCORING_PRESETS, sessionScoringSnapshotMode, validateSessionScoringPolicy, validateScoresForPolicy, deriveForSessionPolicy } from "./session-policy";
export type { SessionScoringPolicy } from "./session-policy";
export { scoreRowPolicy, scoreRosterHasScaledColumn } from "./row-policy";

// Editing policy helpers
export { resolveAssessmentEditingState } from "./editing-policy";

export { FACTORY_DEFAULT_GRADING_BANDS, isGradeHex, gradeDisplayColor, resolveGradeColor } from "./grade-policy";
export type { GradingBandItem } from "./grade-policy";
export { reportCardReviewKey } from "./report-review";
