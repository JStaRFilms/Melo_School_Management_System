import { describe, it, expect } from "vitest";
import { validateBandsClient } from "../lib/exam-helpers";
import type { GradingBandDraft } from "../lib/types";

describe("validateBandsClient", () => {
  it("returns empty error for valid bands covering 0-100", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 0, maxScore: 39, gradeLetter: "F", remark: "Fail" },
      { minScore: 40, maxScore: 49, gradeLetter: "D", remark: "Pass" },
      { minScore: 50, maxScore: 59, gradeLetter: "C", remark: "Good" },
      { minScore: 60, maxScore: 69, gradeLetter: "B", remark: "Very Good" },
      { minScore: 70, maxScore: 100, gradeLetter: "A", remark: "Excellent" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors).toHaveLength(0);
  });

  it("returns empty error when no bands provided", () => {
    const errors = validateBandsClient([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("empty");
  });

  it("detects ordering violation when min > max", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 50, maxScore: 30, gradeLetter: "A", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "ordering")).toBe(true);
  });

  it("detects out of range values", () => {
    const bands: GradingBandDraft[] = [
      { minScore: -10, maxScore: 50, gradeLetter: "A", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "out_of_range")).toBe(true);
  });

  it("detects overlapping bands", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 0, maxScore: 50, gradeLetter: "A", remark: "Test" },
      { minScore: 40, maxScore: 100, gradeLetter: "B", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "overlap")).toBe(true);
  });

  it("detects gap when bands do not start at 0", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 10, maxScore: 100, gradeLetter: "A", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "gap")).toBe(true);
  });

  it("detects gap when bands do not end at 100", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 0, maxScore: 80, gradeLetter: "A", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "gap")).toBe(true);
  });

  it("detects gap between bands", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 0, maxScore: 30, gradeLetter: "F", remark: "Fail" },
      { minScore: 50, maxScore: 100, gradeLetter: "A", remark: "Excellent" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "gap")).toBe(true);
  });

  it("handles null minScore values", () => {
    const bands: GradingBandDraft[] = [
      { minScore: null, maxScore: 50, gradeLetter: "A", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "ordering")).toBe(true);
  });

  it("handles null maxScore values", () => {
    const bands: GradingBandDraft[] = [
      { minScore: 0, maxScore: null, gradeLetter: "A", remark: "Test" },
    ];

    const errors = validateBandsClient(bands);
    expect(errors.some((e) => e.type === "ordering")).toBe(true);
  });
});
