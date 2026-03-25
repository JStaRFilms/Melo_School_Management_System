import { describe, it, expect } from "vitest";
import { validateScoreRanges, validateGradingBands } from "../validation";
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

describe("validateScoreRanges", () => {
  describe("raw40 mode", () => {
    it("should pass for valid scores", () => {
      const errors = validateScoreRanges(15, 18, 12, 35, "raw40");
      expect(errors).toHaveLength(0);
    });

    it("should pass for boundary scores", () => {
      const errors = validateScoreRanges(0, 20, 20, 40, "raw40");
      expect(errors).toHaveLength(0);
    });

    it("should fail for CA1 out of range", () => {
      const errors = validateScoreRanges(25, 10, 10, 30, "raw40");
      expect(errors).toContainEqual({
        field: "ca1",
        message: "CA1 must be between 0 and 20",
      });
    });

    it("should fail for CA2 out of range", () => {
      const errors = validateScoreRanges(10, -5, 10, 30, "raw40");
      expect(errors).toContainEqual({
        field: "ca2",
        message: "CA2 must be between 0 and 20",
      });
    });

    it("should fail for CA3 out of range", () => {
      const errors = validateScoreRanges(10, 10, 21, 30, "raw40");
      expect(errors).toContainEqual({
        field: "ca3",
        message: "CA3 must be between 0 and 20",
      });
    });

    it("should fail for exam score out of range in raw40 mode", () => {
      const errors = validateScoreRanges(10, 10, 10, 45, "raw40");
      expect(errors).toContainEqual({
        field: "examRawScore",
        message: "Exam score must be between 0 and 40",
      });
    });

    it("should collect multiple errors", () => {
      const errors = validateScoreRanges(25, -5, 21, 45, "raw40");
      expect(errors).toHaveLength(4);
    });
  });

  describe("raw60_scaled_to_40 mode", () => {
    it("should pass for valid scores", () => {
      const errors = validateScoreRanges(20, 20, 20, 60, "raw60_scaled_to_40");
      expect(errors).toHaveLength(0);
    });

    it("should fail for exam score out of range in raw60 mode", () => {
      const errors = validateScoreRanges(10, 10, 10, 65, "raw60_scaled_to_40");
      expect(errors).toContainEqual({
        field: "examRawScore",
        message: "Exam score must be between 0 and 60",
      });
    });
  });
});

describe("validateGradingBands", () => {
  it("should pass for valid full-coverage bands", () => {
    const bands = [
      createBand(0, 39, "F", "Fail"),
      createBand(40, 49, "D", "Pass"),
      createBand(50, 59, "C", "Good"),
      createBand(60, 69, "B", "Very Good"),
      createBand(70, 100, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors).toHaveLength(0);
  });

  it("should fail for empty bands", () => {
    const errors = validateGradingBands([]);
    expect(errors).toContainEqual({
      field: "record",
      message: "At least one grading band must be provided",
    });
  });

  it("should fail when a band is missing a grade letter", () => {
    const bands = [
      createBand(0, 39, "", "Fail"),
      createBand(40, 100, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors.some((e) => e.message.includes("grade letter"))).toBe(true);
  });

  it("should fail when minScore > maxScore", () => {
    const bands = [
      createBand(0, 39, "F", "Fail"),
      createBand(50, 40, "D", "Pass"), // min > max
      createBand(41, 100, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors.some((e) => e.message.includes("minScore"))).toBe(true);
  });

  it("should fail for overlapping bands", () => {
    const bands = [
      createBand(0, 50, "C", "Average"),
      createBand(45, 100, "A", "Excellent"), // Overlaps with previous
    ];
    const errors = validateGradingBands(bands);
    expect(errors.some((e) => e.message.includes("overlap"))).toBe(true);
  });

  it("should fail when bands don't start at 0", () => {
    const bands = [
      createBand(10, 100, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors).toContainEqual({
      field: "record",
      message: "Grading bands must start at 0",
    });
  });

  it("should fail when bands don't end at 100", () => {
    const bands = [
      createBand(0, 90, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors).toContainEqual({
      field: "record",
      message: "Grading bands must end at 100",
    });
  });

  it("should fail for gaps in coverage", () => {
    const bands = [
      createBand(0, 39, "F", "Fail"),
      createBand(50, 100, "A", "Excellent"), // Gap from 40-49
    ];
    const errors = validateGradingBands(bands);
    expect(errors.some((e) => e.message.includes("Gap"))).toBe(true);
  });

  it("should fail for minScore < 0", () => {
    const bands = [
      createBand(-10, 100, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors.some((e) => e.message.includes("minScore must be >= 0"))).toBe(
      true
    );
  });

  it("should fail for maxScore > 100", () => {
    const bands = [
      createBand(0, 110, "A", "Excellent"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors.some((e) => e.message.includes("maxScore must be <= 100"))).toBe(
      true
    );
  });

  it("should handle unsorted bands correctly", () => {
    // Bands provided out of order
    const bands = [
      createBand(70, 100, "A", "Excellent"),
      createBand(0, 39, "F", "Fail"),
      createBand(40, 69, "C", "Good"),
    ];
    const errors = validateGradingBands(bands);
    expect(errors).toHaveLength(0);
  });
});
