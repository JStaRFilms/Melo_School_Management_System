import { describe, expect, it } from "vitest";
import type { GradingBand } from "../exam-recording";
import { deriveAggregatedSubjectResult } from "../subject-aggregation";

function createBand(
  minScore: number,
  maxScore: number,
  gradeLetter: string,
  remark: string
): GradingBand {
  return {
    schoolId: "school1",
    minScore,
    maxScore,
    gradeLetter,
    remark,
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1",
  };
}

const standardBands: GradingBand[] = [
  createBand(0, 39, "F", "Fail"),
  createBand(40, 49, "D", "Pass"),
  createBand(50, 59, "C", "Good"),
  createBand(60, 69, "B", "Very Good"),
  createBand(70, 100, "A", "Excellent"),
];

describe("deriveAggregatedSubjectResult", () => {
  it("derives fixed contribution totals for any number of components", () => {
    const result = deriveAggregatedSubjectResult({
      strategy: "fixed_contribution",
      gradingBands: standardBands,
      components: [
        {
          subjectId: "home-econ",
          ca1: 16,
          ca2: 16,
          ca3: 16,
          examScore: 32,
          total: 80,
          contributionMax: 20,
        },
        {
          subjectId: "agric",
          ca1: 13,
          ca2: 13,
          ca3: 13,
          examScore: 26,
          total: 65,
          contributionMax: 20,
        },
        {
          subjectId: "population-core",
          ca1: 15,
          ca2: 15,
          ca3: 15,
          examScore: 30,
          total: 75,
          contributionMax: 60,
        },
      ],
    });

    expect(result.isRecorded).toBe(true);
    expect(result.ca1).toBe(14.8);
    expect(result.ca2).toBe(14.8);
    expect(result.ca3).toBe(14.8);
    expect(result.examScore).toBe(29.6);
    expect(result.total).toBe(74);
    expect(result.gradeLetter).toBe("A");
    expect(result.remark).toBe("Excellent");
  });

  it("normalizes combined raw totals back to 100", () => {
    const result = deriveAggregatedSubjectResult({
      strategy: "raw_combined_normalized",
      gradingBands: standardBands,
      components: [
        { subjectId: "home-econ", ca1: 20, ca2: 20, ca3: 10, examScore: 30, total: 80 },
        { subjectId: "agric", ca1: 10, ca2: 10, ca3: 20, examScore: 20, total: 60 },
        { subjectId: "civic", ca1: 20, ca2: 20, ca3: 20, examScore: 40, total: 100 },
      ],
    });

    expect(result.isRecorded).toBe(true);
    expect(result.aggregatedRawTotal).toBe(240);
    expect(result.aggregatedRawMax).toBe(300);
    expect(result.ca1).toBe(16.67);
    expect(result.ca2).toBe(16.67);
    expect(result.ca3).toBe(16.67);
    expect(result.examScore).toBe(29.99);
    expect(result.total).toBe(80);
    expect(result.gradeLetter).toBe("A");
  });

  it("returns a pending aggregate when any component is missing", () => {
    const result = deriveAggregatedSubjectResult({
      strategy: "raw_combined_normalized",
      gradingBands: standardBands,
      components: [
        { subjectId: "home-econ", ca1: 20, ca2: 20, ca3: 10, examScore: 30, total: 80 },
        { subjectId: "agric", ca1: null, ca2: null, ca3: null, examScore: null, total: null },
      ],
    });

    expect(result.isRecorded).toBe(false);
    expect(result.ca1).toBe(0);
    expect(result.ca2).toBe(0);
    expect(result.ca3).toBe(0);
    expect(result.examScore).toBe(0);
    expect(result.total).toBe(0);
    expect(result.gradeLetter).toBe("-");
    expect(result.remark).toBe("Pending");
  });
});
