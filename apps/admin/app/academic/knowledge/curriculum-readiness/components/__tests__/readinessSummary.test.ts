import { describe, expect, it } from "vitest";
import { buildReadinessSummary } from "../readinessSummary";

describe("buildReadinessSummary", () => {
  it("preserves every readiness aggregate from the server count contract", () => {
    const summary = buildReadinessSummary({
      topicCount: 17,
      sourceApprovedCount: 16,
      lessonPlanPreparedCount: 15,
      studentNotePreparedCount: 14,
      assignmentPreparedCount: 13,
      assessmentDraftedCount: 12,
      studentResourcePublishedCount: 11,
    });

    expect(summary).toEqual([
      expect.objectContaining({ label: "Topics", value: 17 }),
      expect.objectContaining({ label: "Approved sources", value: 16 }),
      expect.objectContaining({ label: "Lesson plans", value: 15 }),
      expect.objectContaining({ label: "Student notes", value: 14 }),
      expect.objectContaining({ label: "Assignments", value: 13 }),
      expect.objectContaining({ label: "Assessments", value: 12 }),
      expect.objectContaining({ label: "Published resources", value: 11 }),
    ]);
  });
});
