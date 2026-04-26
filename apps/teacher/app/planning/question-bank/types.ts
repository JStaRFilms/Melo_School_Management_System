export type AssessmentDraftMode = "practice_quiz" | "class_test" | "exam_draft";
export type AssessmentOutputType = "question_bank_draft" | "cbt_draft";
export type AssessmentQuestionType =
  | "multiple_choice"
  | "short_answer"
  | "essay"
  | "true_false"
  | "fill_in_the_blank";
export type AssessmentQuestionDifficulty = "easy" | "medium" | "hard";
export type AssessmentQuestionStyle = "balanced" | "open_ended_heavy" | "mixed_open_ended" | "objective_heavy";

export interface AssessmentQuestionMix {
  multiple_choice: number;
  short_answer: number;
  essay: number;
  true_false: number;
  fill_in_the_blank: number;
}

export interface AssessmentGenerationSettings {
  profileId?: string;
  profileName?: string;
  questionStyle: AssessmentQuestionStyle;
  totalQuestions: number;
  questionMix: AssessmentQuestionMix;
  allowTeacherOverrides: boolean;
  overrideReason?: string;
}

export interface AssessmentGenerationProfile extends AssessmentGenerationSettings {
  _id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: number;
}

export interface AssessmentSource {
  _id: string;
  title: string;
  description: string | null;
  sourceType:
    | "file_upload"
    | "text_entry"
    | "youtube_link"
    | "generated_draft"
    | "student_upload"
    | "imported_curriculum";
  visibility: "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  processingStatus: "awaiting_upload" | "queued" | "extracting" | "ocr_needed" | "ready" | "failed";
  searchStatus: "not_indexed" | "indexing" | "indexed" | "failed";
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  level: string;
  topicLabel: string;
  canUseAsLessonSource: boolean;
}

export interface AssessmentSourceContext {
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
  topicLabel: string | null;
}

export interface AssessmentDraftItem {
  id: string;
  itemOrder: number;
  questionType: AssessmentQuestionType;
  difficulty: AssessmentQuestionDifficulty;
  promptText: string;
  answerText: string;
  explanationText: string;
  marks: number | null;
  tags: string[];
}

export interface AssessmentDraftBank {
  bankId: string | null;
  title: string;
  description: string | null;
  draftMode: AssessmentDraftMode;
  outputType: AssessmentOutputType;
  bankStatus: "draft" | "active" | "archived" | "superseded";
  visibility: "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
  topicLabel: string | null;
  sourceSelectionSnapshot: string | null;
  effectiveGenerationSettings: AssessmentGenerationSettings | null;
  lastSavedAt: number | null;
  itemCount: number;
}

export interface AssessmentWorkspaceData {
  schoolName: string | null;
  draftMode: AssessmentDraftMode;
  draftModeLabel: string;
  outputType: AssessmentOutputType;
  outputTypeLabel: string;
  sourceIds: string[];
  selectedSourceCount: number;
  accessibleSourceCount: number;
  missingSourceIds: string[];
  inaccessibleSourceIds: string[];
  warnings: string[];
  sourceContext: AssessmentSourceContext;
  profiles: AssessmentGenerationProfile[];
  draft: AssessmentDraftBank;
  items: AssessmentDraftItem[];
  canGenerate: boolean;
  canAutosave: boolean;
  selectedSources: AssessmentSource[];
}

export interface AssessmentBankSaveResult {
  bankId: string;
  title: string;
  description: string | null;
  draftMode: AssessmentDraftMode;
  outputType: AssessmentOutputType;
  sourceSelectionSnapshot: string;
  itemCount: number;
  savedAt: number;
  effectiveGenerationSettings: AssessmentGenerationSettings;
}

export interface AssessmentBankGenerationResult extends AssessmentBankSaveResult {
  items: AssessmentDraftItem[];
}

export const assessmentDraftModeOptions: Array<{
  value: AssessmentDraftMode;
  label: string;
  description: string;
  outputType: AssessmentOutputType;
  defaultQuestionType: AssessmentQuestionType;
}> = [
  {
    value: "practice_quiz",
    label: "Practice quiz",
    description: "Quick recall-first draft for low-stakes practice.",
    outputType: "question_bank_draft",
    defaultQuestionType: "short_answer",
  },
  {
    value: "class_test",
    label: "Class test",
    description: "Balanced classroom assessment with structured revision value.",
    outputType: "question_bank_draft",
    defaultQuestionType: "short_answer",
  },
  {
    value: "exam_draft",
    label: "Exam draft",
    description: "Formal CBT-style draft for review and moderation.",
    outputType: "cbt_draft",
    defaultQuestionType: "multiple_choice",
  },
] as const;

export function normalizeAssessmentSourceIds(rawValue: string | string[] | null) {
  if (!rawValue) {
    return [];
  }

  const values = Array.isArray(rawValue) ? rawValue : rawValue.split(",");
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const sourceId of values) {
    const trimmed = sourceId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function getAssessmentDraftModeOption(mode: AssessmentDraftMode) {
  return assessmentDraftModeOptions.find((option) => option.value === mode) ?? assessmentDraftModeOptions[0];
}

export function getAssessmentOutputTypeLabel(outputType: AssessmentOutputType) {
  return outputType === "cbt_draft" ? "CBT draft" : "Question bank draft";
}

export function getDefaultAssessmentQuestionType(mode: AssessmentDraftMode) {
  return getAssessmentDraftModeOption(mode).defaultQuestionType;
}
