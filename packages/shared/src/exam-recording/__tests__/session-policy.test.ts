import { describe, expect, it } from "vitest";
import { deriveForSessionPolicy, SESSION_SCORING_PRESETS, validateScoresForPolicy, validateSessionScoringPolicy } from "../index";

const bands = [
  { schoolId: "s", minScore: 0, maxScore: 100, gradeLetter: "A", remark: "Pass", isActive: true,
    createdAt: 1, updatedAt: 1, updatedBy: "u" },
];
describe("session scoring policies", () => {
  it("accepts the three editable starters and scales /80 into 50", () => {
    for (const starter of SESSION_SCORING_PRESETS) expect(validateSessionScoringPolicy(starter)).toEqual([]);
    const policy = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50 };
    expect(validateSessionScoringPolicy(policy)).toEqual([]);
    expect(validateSessionScoringPolicy({ ca1Max: 0, ca2Max: 50, ca3Max: 0,
      examRawMax: 75, examContributionMax: 50 })).toEqual([]);
    expect(deriveForSessionPolicy({ ca1: 15, ca2: 10, ca3: 8, examRawScore: 61 }, policy, bands))
      .toMatchObject({ caTotal: 33, examScaledScore: 38.13, total: 71.13 });
  });
  it("rejects invalid settings and nonfinite or over-limit scores", () => {
    const policy = SESSION_SCORING_PRESETS[2];
    expect(validateSessionScoringPolicy({ ...policy, examRawMax: 0 })).not.toEqual([]);
    expect(validateSessionScoringPolicy({ ...policy, ca3Max: 11 })).not.toEqual([]);
    expect(validateScoresForPolicy({ ca1: 0, ca2: NaN, ca3: 11, examRawScore: 51 }, policy)
      .map(e => e.field)).toEqual(["ca2", "ca3", "examRawScore"]);
  });
});
