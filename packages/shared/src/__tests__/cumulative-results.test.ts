import { describe, expect, it } from "vitest";

import {
  calculateAnnualAverage,
  deriveCumulativeAnnualResult,
  getMissingCumulativeTerms,
  isCumulativeAnnualMode,
  type CumulativeTermTotals,
  type ReportCardCalculationMode,
} from "../cumulative-results";
import type { GradingBand } from "../exam-recording";

const gradingBands: GradingBand[] = [
  {
    schoolId: "school-1",
    minScore: 0,
    maxScore: 39,
    gradeLetter: "F",
    remark: "Fail",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user-1",
  },
  {
    schoolId: "school-1",
    minScore: 40,
    maxScore: 59,
    gradeLetter: "C",
    remark: "Credit",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user-1",
  },
  {
    schoolId: "school-1",
    minScore: 60,
    maxScore: 69,
    gradeLetter: "B",
    remark: "Very Good",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user-1",
  },
  {
    schoolId: "school-1",
    minScore: 70,
    maxScore: 100,
    gradeLetter: "A",
    remark: "Excellent",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user-1",
  },
];

describe("cumulative results helpers", () => {
  it("detects cumulative annual mode only for the third term slot", () => {
    expect(
      isCumulativeAnnualMode({
        calculationMode: "cumulative_annual" satisfies ReportCardCalculationMode,
        currentTermIndex: 2,
      })
    ).toBe(true);
    expect(
      isCumulativeAnnualMode({
        calculationMode: "cumulative_annual",
        currentTermIndex: 1,
      })
    ).toBe(false);
    expect(
      isCumulativeAnnualMode({
        calculationMode: "standalone",
        currentTermIndex: 2,
      })
    ).toBe(false);
  });

  it("calculates the annual average from first, second, and current totals", () => {
    const totals: CumulativeTermTotals = {
      first: 72,
      second: 66,
      current: 81,
    };

    expect(calculateAnnualAverage(totals)).toBe(73);
  });

  it("reports missing terms when cumulative data is incomplete", () => {
    const totals: CumulativeTermTotals = {
      first: null,
      second: 63,
      current: null,
    };

    expect(getMissingCumulativeTerms(totals)).toEqual(["first", "current"]);
  });

  it("derives annual grade and remark from the annual average", () => {
    const result = deriveCumulativeAnnualResult({
      totals: {
        first: 72,
        second: 66,
        current: 81,
      },
      gradingBands,
    });

    expect(result).toEqual({
      annualAverage: 73,
      gradeLetter: "A",
      remark: "Excellent",
      isComplete: true,
      missingTerms: [],
    });
  });

  it("returns an incomplete state when a prior term is missing", () => {
    const result = deriveCumulativeAnnualResult({
      totals: {
        first: null,
        second: 66,
        current: 81,
      },
      gradingBands,
    });

    expect(result).toEqual({
      annualAverage: null,
      gradeLetter: null,
      remark: null,
      isComplete: false,
      missingTerms: ["first"],
    });
  });
});
