export type ReadinessStatus =
  | "approved_curriculum_unit"
  | "no_approved_curriculum_unit"
  | "lesson_plan_prepared"
  | "no_lesson_plan_prepared"
  | "student_note_prepared"
  | "no_student_note_prepared"
  | "assignment_prepared"
  | "no_assignment_prepared"
  | "assessment_drafted"
  | "no_assessment_drafted"
  | "student_resource_published"
  | "no_student_resource_published";

export interface ReadinessRow {
  topicId: string;
  title: string;
  subjectId: string;
  level: string;
  termId: string;
  sourceStatus: ReadinessStatus;
  lessonPlanStatus: ReadinessStatus;
  studentNoteStatus: ReadinessStatus;
  assignmentStatus: ReadinessStatus;
  assessmentStatus: ReadinessStatus;
  studentPublicationStatus: ReadinessStatus;
}

export interface ReadinessCounts {
  topicCount: number;
  sourceApprovedCount: number;
  lessonPlanPreparedCount: number;
  studentNotePreparedCount: number;
  assignmentPreparedCount: number;
  assessmentDraftedCount: number;
  studentResourcePublishedCount: number;
}

export interface CurriculumReadinessResponse {
  rows: ReadinessRow[];
  counts: ReadinessCounts;
  evidenceNotice: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
