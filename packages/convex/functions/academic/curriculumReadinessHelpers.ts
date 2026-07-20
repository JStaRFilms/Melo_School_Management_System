export type ReadinessEvidence = {
  source: boolean;
  lessonPlan: boolean;
  studentNote: boolean;
  assignment: boolean;
  assessment: boolean;
  studentPublication: boolean;
};

export function describeCurriculumReadiness(evidence: ReadinessEvidence) {
  return {
    sourceStatus: evidence.source ? "approved_curriculum_unit" as const : "no_approved_curriculum_unit" as const,
    lessonPlanStatus: evidence.lessonPlan ? "lesson_plan_prepared" as const : "no_lesson_plan_prepared" as const,
    studentNoteStatus: evidence.studentNote ? "student_note_prepared" as const : "no_student_note_prepared" as const,
    assignmentStatus: evidence.assignment ? "assignment_prepared" as const : "no_assignment_prepared" as const,
    assessmentStatus: evidence.assessment ? "assessment_drafted" as const : "no_assessment_drafted" as const,
    studentPublicationStatus: evidence.studentPublication ? "student_resource_published" as const : "no_student_resource_published" as const,
  };
}

export function countCurriculumReadiness(rows: ReadinessEvidence[]) {
  return rows.reduce(
    (counts, row) => ({
      topicCount: counts.topicCount + 1,
      sourceApprovedCount: counts.sourceApprovedCount + Number(row.source),
      lessonPlanPreparedCount: counts.lessonPlanPreparedCount + Number(row.lessonPlan),
      studentNotePreparedCount: counts.studentNotePreparedCount + Number(row.studentNote),
      assignmentPreparedCount: counts.assignmentPreparedCount + Number(row.assignment),
      assessmentDraftedCount: counts.assessmentDraftedCount + Number(row.assessment),
      studentResourcePublishedCount: counts.studentResourcePublishedCount + Number(row.studentPublication),
    }),
    { topicCount: 0, sourceApprovedCount: 0, lessonPlanPreparedCount: 0, studentNotePreparedCount: 0, assignmentPreparedCount: 0, assessmentDraftedCount: 0, studentResourcePublishedCount: 0 },
  );
}
