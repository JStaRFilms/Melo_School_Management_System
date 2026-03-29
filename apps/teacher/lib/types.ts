import type { ExamInputMode, GradingBand } from "@school/shared";

// Id type matching Convex generated type
export type Id<TableName extends string> = string & {
  readonly __tableName?: TableName;
};

// Selection state for the 4 dropdowns
export interface SelectionState {
  sessionId: Id<"academicSessions"> | null;
  termId: Id<"academicTerms"> | null;
  classId: Id<"classes"> | null;
  subjectId: Id<"subjects"> | null;
}

// Score fields that can be edited
export type ScoreField = "ca1" | "ca2" | "ca3" | "examRawScore";

// Draft scores per student (partial - allows incomplete rows)
export type DraftScores = Map<Id<"students">, Partial<Record<ScoreField, number | null>>>;

// Validation errors per student per field
export type ValidationErrors = Map<Id<"students">, Partial<Record<ScoreField, string>>>;

// Student roster entry from the query response
export interface StudentRosterEntry {
  studentId: Id<"students">;
  studentName: string;
  assessmentRecord: AssessmentRecordResponse | null;
}

// Assessment record as returned by Convex (with _id and _creationTime)
export interface AssessmentRecordResponse {
  _id: Id<"assessmentRecords">;
  _creationTime: number;
  schoolId: Id<"schools">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  classId: Id<"classes">;
  subjectId: Id<"subjects">;
  studentId: Id<"students">;
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
  enteredBy: Id<"users">;
  updatedBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
}

// School assessment settings from the query response
export interface SchoolSettingsResponse {
  _id: Id<"schoolAssessmentSettings">;
  _creationTime: number;
  schoolId: Id<"schools">;
  examInputMode: ExamInputMode;
  ca1Max: number;
  ca2Max: number;
  ca3Max: number;
  examContributionMax: number;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: Id<"users">;
}

export interface AssessmentEditingPolicyResponse {
  _id: Id<"assessmentEditingPolicies">;
  _creationTime: number;
  schoolId: Id<"schools">;
  sessionId: Id<"academicSessions">;
  termId: Id<"academicTerms">;
  editingWindowEnabled: boolean;
  editingWindowStartsAt: number | null;
  editingWindowEndsAt: number | null;
  finalizationEnabled: boolean;
  finalizeAt: number | null;
  createdAt: number;
  updatedAt: number;
  updatedBy: Id<"users">;
}

export interface AssessmentEditingStateResponse {
  hasPolicy: boolean;
  canEdit: boolean;
  lockReason: "window_not_started" | "window_closed" | "finalized" | null;
  message: string;
  isWithinEditingWindow: boolean;
  isFinalized: boolean;
  evaluatedAt: number;
}

// Grading band from the query response
export interface GradingBandResponse {
  _id: Id<"gradingBands">;
  _creationTime: number;
  schoolId: Id<"schools">;
  minScore: number;
  maxScore: number;
  gradeLetter: string;
  remark: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  updatedBy: Id<"users">;
}

// Full exam entry sheet response
export interface ExamEntrySheetResponse {
  roster: StudentRosterEntry[];
  settings: SchoolSettingsResponse | null;
  gradingBands: GradingBandResponse[];
  editingState: AssessmentEditingStateResponse;
}

// Upsert mutation response
export interface UpsertResponse {
  updated: number;
  created: number;
  errors: Array<{
    studentId: Id<"students">;
    field: ScoreField | "record";
    message: string;
  }>;
}

// Convert GradingBandResponse to shared GradingBand type
export function toGradingBand(band: GradingBandResponse): GradingBand {
  return {
    schoolId: band.schoolId,
    minScore: band.minScore,
    maxScore: band.maxScore,
    gradeLetter: band.gradeLetter,
    remark: band.remark,
    isActive: band.isActive,
    createdAt: band.createdAt,
    updatedAt: band.updatedAt,
    updatedBy: band.updatedBy,
  };
}

// Selector option types
export interface SelectorOption {
  id: string;
  name: string;
}
