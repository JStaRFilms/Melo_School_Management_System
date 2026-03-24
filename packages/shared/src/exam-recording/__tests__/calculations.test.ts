import { describe, it, expect } from "vitest";
import {
  round,
  caTotal,
  examScaledScore,
  total,
  deriveGradeAndRemark,
  deriveAssessmentFields,
} from "../calculations";
import type { GradingBand } from "../types";

// Helper to create a grading band
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

// Standard grading bands for tests
const standardBands: GradingBand[] = [
  createBand(0, 39, "F", "Fail"),
  createBand(40, 49, "D", "Pass"),
  createBand(50, 59, "C", "Good"),
  createBand(60, 69, "B", "Very Good"),
  createBand(70, 100, "A", "Excellent"),
];

describe("round", () => {
  it("should round to 2 decimal places", () => {
    expect(round(33.333, 2)).toBe(33.33);
    expect(round(33.335, 2)).toBe(33.34);
    expect(round(33.334, 2)).toBe(33.33);
  });

  it("should handle whole numbers", () => {
    expect(round(10, 2)).toBe(10);
    expect(round(10.0, 2)).toBe(10);
  });

  it("should handle zero", () => {
    expect(round(0, 2)).toBe(0);
  });
});

describe("caTotal", () => {
  it("should sum CA scores", () => {
    expect(caTotal(15, 18, 12)).toBe(45);
    expect(caTotal(20, 20, 20)).toBe(60);
    expect(caTotal(0, 0, 0)).toBe(0);
  });
});

describe("examScaledScore", () => {
  describe("raw40 mode", () => {
    it("should return raw score as-is", () => {
      expect(examScaledScore(35, "raw40")).toBe(35);
      expect(examScaledScore(40, "raw40")).toBe(40);
      expect(examScaledScore(0, "raw40")).toBe(0);
    });
  });

  describe("raw60_scaled_to_40 mode", () => {
    it("should scale 60-point score to 40-point", () => {
      expect(examScaledScore(30, "raw60_scaled_to_40")).toBe(20.0);
      expect(examScaledScore(45, "raw60_scaled_to_40")).toBe(30.0);
      expect(examScaledScore(60, "raw60_scaled_to_40")).toBe(40.0);
      expect(examScaledScore(0, "raw60_scaled_to_40")).toBe(0);
    });

    it("should round to 2 decimal places", () => {
      // (37/60)*40 = 24.666... -> 24.67
      expect(examScaledScore(37, "raw60_scaled_to_40")).toBe(24.67);
      // (33/60)*40 = 22.0
      expect(examScaledScore(33, "raw60_scaled_to_40")).toBe(22.0);
    });
  });
});

describe("total", () => {
  it("should compute total with rounding", () => {
    expect(total(15, 18, 12, 35)).toBe(80);
    expect(total(20, 20, 20, 40)).toBe(100);
    expect(total(10, 10, 10, 24.67)).toBe(54.67);
  });
});

describe("deriveGradeAndRemark", () => {
  it("should return correct grade for score in band", () => {
    expect(deriveGradeAndRemark(80, standardBands)).toEqual({
      gradeLetter: "A",
      remark: "Excellent",
    });
    expect(deriveGradeAndRemark(65, standardBands)).toEqual({
      gradeLetter: "B",
      remark: "Very Good",
    });
    expect(deriveGradeAndRemark(55, standardBands)).toEqual({
      gradeLetter: "C",
      remark: "Good",
    });
    expect(deriveGradeAndRemark(45, standardBands)).toEqual({
      gradeLetter: "D",
      remark: "Pass",
    });
    expect(deriveGradeAndRemark(30, standardBands)).toEqual({
      gradeLetter: "F",
      remark: "Fail",
    });
  });

  it("should handle boundary values", () => {
    // Exact boundary
    expect(deriveGradeAndRemark(40, standardBands)).toEqual({
      gradeLetter: "D",
      remark: "Pass",
    });
    expect(deriveGradeAndRemark(39, standardBands)).toEqual({
      gradeLetter: "F",
      remark: "Fail",
    });
    expect(deriveGradeAndRemark(70, standardBands)).toEqual({
      gradeLetter: "A",
      remark: "Excellent",
    });
  });

  it("should throw error if no band matches", () => {
    const incompleteBands = [createBand(50, 100, "A", "Excellent")];
    expect(() => deriveGradeAndRemark(30, incompleteBands)).toThrow(
      "No grading band found for score 30"
    );
  });
});

describe("deriveAssessmentFields", () => {
  it("should derive all fields for raw40 mode", () => {
    const result = deriveAssessmentFields(15, 18, 12, 35, "raw40", standardBands);

    expect(result.caTotal).toBe(45);
    expect(result.examScaledScore).toBe(35);
    expect(result.total).toBe(80);
    expect(result.gradeLetter).toBe("A");
    expect(result.remark).toBe("Excellent");
  });

  it("should derive all fields for raw60_scaled_to_40 mode", () => {
    const result = deriveAssessmentFields(
      20,
      20,
      20,
      60,
      "raw60_scaled_to_40",
      standardBands
    );

    expect(result.caTotal).toBe(60);
    expect(result.examScaledScore).toBe(40);
    expect(result.total).toBe(100);
    expect(result.gradeLetter).toBe("A");
    expect(result.remark).toBe("Excellent");
  });

  it("should handle rounding correctly", () => {
    // CA: 10+10+10 = 30, Exam: (37/60)*40 = 24.67, Total: 54.67
    const result = deriveAssessmentFields(
      10,
      10,
      10,
      37,
      "raw60_scaled_to_40",
      standardBands
    );

    expect(result.caTotal).toBe(30);
    expect(result.examScaledScore).toBe(24.67);
    expect(result.total).toBe(54.67);
    expect(result.gradeLetter).toBe("C");
    expect(result.remark).toBe("Good");
  });

  it("should handle zero scores", () => {
    const result = deriveAssessmentFields(0, 0, 0, 0, "raw40", standardBands);

    expect(result.caTotal).toBe(0);
    expect(result.examScaledScore).toBe(0);
    expect(result.total).toBe(0);
    expect(result.gradeLetter).toBe("F");
    expect(result.remark).toBe("Fail");
  });
});
