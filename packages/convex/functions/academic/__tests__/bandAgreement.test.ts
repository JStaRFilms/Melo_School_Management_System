import { describe, expect, it } from "vitest";
import { validateGradingBands } from "@school/shared/exam-recording";
import { validateContiguousScoreRanges } from "../gradingBands";

type Band = { minScore: number; maxScore: number; gradeLetter: string };

const VALID: Band[] = [
  { minScore: 0, maxScore: 39, gradeLetter: "F" },
  { minScore: 40, maxScore: 49, gradeLetter: "D" },
  { minScore: 50, maxScore: 59, gradeLetter: "C" },
  { minScore: 60, maxScore: 69, gradeLetter: "B" },
  { minScore: 70, maxScore: 100, gradeLetter: "A" },
];

function throwsWith(bands: Band[]): boolean {
  try {
    validateContiguousScoreRanges(bands);
    return false;
  } catch {
    return true;
  }
}

describe("band agreement: shared returner vs server thrower (consolidation P3)", () => {
  const cases: Array<[string, Band[]]> = [
    ["valid", VALID],
    ["gap", [{ ...VALID[0] }, { minScore: 50, maxScore: 100, gradeLetter: "A" }]],
    ["overlap", [{ ...VALID[0], maxScore: 50 }, { minScore: 45, maxScore: 100, gradeLetter: "A" }]],
    ["duplicate label", [{ ...VALID[0] }, { minScore: 40, maxScore: 100, gradeLetter: "F" }]],
    ["non-integer", [{ ...VALID[0], maxScore: 39.5 }, { minScore: 40, maxScore: 100, gradeLetter: "A" }]],
    ["empty", []],
    ["bad span start", [{ minScore: 10, maxScore: 100, gradeLetter: "A" }]],
    ["bad span end", [{ minScore: 0, maxScore: 90, gradeLetter: "A" }]],
    ["over 100", Array.from({ length: 101 }, (_, i) => ({ minScore: i, maxScore: i, gradeLetter: `G${i}` }))],
    ["inverted", [{ minScore: 50, maxScore: 40, gradeLetter: "F" }, { minScore: 0, maxScore: 39, gradeLetter: "E" }, { minScore: 41, maxScore: 100, gradeLetter: "A" }]],
    ["out of range", [{ minScore: -5, maxScore: 100, gradeLetter: "A" }]],
    ["duplicate range", [{ minScore: 0, maxScore: 70, gradeLetter: "D" }, { minScore: 0, maxScore: 70, gradeLetter: "C" }, { minScore: 71, maxScore: 100, gradeLetter: "A" }]],
  ];

  for (const [name, bands] of cases) {
    it(`agrees on ${name}`, () => {
      const returnerValid = validateGradingBands(
        bands.map((b) => ({
          ...b,
          schoolId: "school1",
          remark: b.gradeLetter,
          isActive: true,
          createdAt: 0,
          updatedAt: 0,
          updatedBy: "user1",
        })),
      ).length === 0;
      expect(throwsWith(bands)).toBe(!returnerValid);
    });
  }
});
