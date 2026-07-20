import type { ReadinessCounts } from "./types";

export type ReadinessSummaryIcon = "topics" | "sources" | "plans" | "notes" | "assignments" | "assessments" | "published";

const summaryDefinitions: Array<{
  label: string;
  countKey: keyof ReadinessCounts;
  icon: ReadinessSummaryIcon;
}> = [
  { label: "Topics", countKey: "topicCount", icon: "topics" },
  { label: "Approved sources", countKey: "sourceApprovedCount", icon: "sources" },
  { label: "Lesson plans", countKey: "lessonPlanPreparedCount", icon: "plans" },
  { label: "Student notes", countKey: "studentNotePreparedCount", icon: "notes" },
  { label: "Assignments", countKey: "assignmentPreparedCount", icon: "assignments" },
  { label: "Assessments", countKey: "assessmentDraftedCount", icon: "assessments" },
  { label: "Published resources", countKey: "studentResourcePublishedCount", icon: "published" },
];

export function buildReadinessSummary(counts: ReadinessCounts) {
  return summaryDefinitions.map((definition) => ({
    ...definition,
    value: counts[definition.countKey],
  }));
}
