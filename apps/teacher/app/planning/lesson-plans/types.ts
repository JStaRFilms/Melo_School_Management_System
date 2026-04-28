export type LessonPlanWorkspaceOutputType = "lesson_plan" | "student_note" | "assignment";

export interface LessonPlanWorkspaceSource {
  _id: string;
  title: string;
  description: string | null;
  sourceType: "file_upload" | "text_entry" | "youtube_link" | "generated_draft" | "student_upload" | "imported_curriculum";
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

export interface LessonPlanWorkspaceSourceContext {
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
  topicLabel: string | null;
}

export interface LessonPlanWorkspaceTemplateSection {
  id: string;
  label: string;
  order: number;
  required: boolean;
  minimumWordCount: number | null;
}

export interface LessonPlanWorkspaceTemplate {
  _id: string;
  outputType: LessonPlanWorkspaceOutputType;
  title: string;
  description: string | null;
  templateScope: "subject_and_level" | "subject_only" | "level_only" | "school_default";
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  level: string | null;
  isSchoolDefault: boolean;
  requiredSectionIds: string[];
  sectionDefinitions: LessonPlanWorkspaceTemplateSection[];
  objectiveMinimums: {
    minimumObjectives: number;
    minimumSourceMaterials: number;
    minimumSections: number;
  };
  resolutionPath: string;
  applicabilityLabel: string;
  templateKey: string;
  resolutionRank: number;
}

export interface LessonPlanWorkspaceRevision {
  _id: string;
  revisionNumber: number;
  revisionKind: string;
  createdAt: number;
  title: string;
  snippet: string;
}

export interface LessonPlanWorkspaceDraft {
  artifactId: string | null;
  documentId: string | null;
  revisionId: string | null;
  revisionNumber: number;
  title: string;
  documentState: string;
  plainText: string;
  outputType: LessonPlanWorkspaceOutputType;
  templateId: string | null;
  templateResolutionPath: string | null;
  sourceSelectionSnapshot: string | null;
  lastSavedAt: number | null;
}

export interface LessonPlanPlanningContext {
  kind: "topic";
  classId: string;
  className: string;
  termId: string;
  termName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  level: string;
  topicId: string;
  topicTitle: string;
  planningContextKey: string;
  compatibilityMode: boolean;
}

export interface LessonPlanWorkspaceData {
  schoolName: string | null;
  outputType: LessonPlanWorkspaceOutputType;
  outputTypeLabel: string;
  sourceIds: string[];
  selectedSourceCount: number;
  accessibleSourceCount: number;
  missingSourceIds: string[];
  inaccessibleSourceIds: string[];
  warnings: string[];
  sourceContext: LessonPlanWorkspaceSourceContext;
  planningContext: LessonPlanPlanningContext | null;
  template: LessonPlanWorkspaceTemplate | null;
  draft: LessonPlanWorkspaceDraft;
  revisions: LessonPlanWorkspaceRevision[];
  canGenerate: boolean;
  canAutosave: boolean;
  selectedSources: LessonPlanWorkspaceSource[];
}

export interface LessonPlanGenerationMeta {
  attempts: number;
  repaired: boolean;
  validationIssues: string[];
  sourceExcerptWarnings?: string[];
}

export interface LessonPlanSaveResult {
  artifactId: string;
  documentId: string;
  revisionId: string;
  revisionNumber: number;
  title: string;
  documentState: string;
  plainText: string;
  outputType: LessonPlanWorkspaceOutputType;
  sourceIds: string[];
  sourceSelectionSnapshot: string;
  templateId: string | null;
  templateResolutionPath: string | null;
  savedAt: number;
  generationMeta?: LessonPlanGenerationMeta;
}
