// Exam Recording Domain Types
export type ExamInputMode = "raw40" | "raw60_scaled_to_40";

export interface SchoolAssessmentSettings {
  schoolId: string;
  examInputMode: ExamInputMode;
  ca1Max: number;
  ca2Max: number;
  ca3Max: number;
  examContributionMax: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

export interface AssessmentEditingPolicy {
  schoolId: string;
  sessionId: string;
  termId: string;
  editingWindowEnabled: boolean;
  editingWindowStartsAt: number | null;
  editingWindowEndsAt: number | null;
  finalizationEnabled: boolean;
  finalizeAt: number | null;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

export type AssessmentEditLockReason =
  | "window_not_started"
  | "window_closed"
  | "finalized";

export interface AssessmentEditingState {
  hasPolicy: boolean;
  canEdit: boolean;
  lockReason: AssessmentEditLockReason | null;
  message: string;
  isWithinEditingWindow: boolean;
  isFinalized: boolean;
  evaluatedAt: number;
}

export interface GradingBand {
  schoolId: string;
  minScore: number;
  maxScore: number;
  gradeLetter: string;
  remark: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
}

export interface AssessmentRecord {
  schoolId: string;
  sessionId: string;
  termId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  ca1: number;
  ca2: number;
  ca3: number;
  examRawScore: number;
  examScaledScore: number;
  total: number;
  gradeLetter: string;
  remark: string;
  examInputModeSnapshot: string;
  examRawMaxSnapshot: number;
  status: "draft";
  enteredBy: string;
  updatedBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface ScoreInput {
  ca1: number;
  ca2: number;
  ca3: number;
  examRawScore: number;
}

export interface DerivedAssessmentFields {
  caTotal: number;
  examScaledScore: number;
  total: number;
  gradeLetter: string;
  remark: string;
}

export interface ValidationError {
  field: "ca1" | "ca2" | "ca3" | "examRawScore" | "record";
  message: string;
}

export interface UpsertResult {
  updated: number;
  created: number;
  errors: Array<{
    studentId: string;
    field: "ca1" | "ca2" | "ca3" | "examRawScore" | "record";
    message: string;
  }>;
}
