import type { ReportCardSheetData } from "../components/ReportCardSheet";

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, ordered(item)]),
    );
  }
  return value;
}

/** Compare reviewed content, excluding volatile generation time and signed media URLs. Not an authorization token. */
export function reportCardReviewKey(report: ReportCardSheetData): string {
  const {
    generatedAt: _generatedAt,
    schoolLogoUrl: _schoolLogoUrl,
    student,
    ...content
  } = report;
  const { photoUrl: _photoUrl, ...studentContent } = student;
  return JSON.stringify(ordered({ ...content, student: studentContent }));
}
