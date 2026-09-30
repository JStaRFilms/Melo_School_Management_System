import { describe, expect, it } from "vitest";
import { scoreRowPolicy, scoreRosterHasScaledColumn } from "../row-policy";
import { validateScoresForPolicy } from "../session-policy";

const sheetPolicy = { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 };
const customPolicy = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 50, examContributionMax: 50 };
const eightyPolicy = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50 };

const scores = (ca3: number, examRawScore: number) => ({ ca1: 20, ca2: 20, ca3, examRawScore });

describe("score row policy precedence", () => {
  it("validates each legacy saved row against its own snapshot even with a sheet policy", () => {
    const records = [
      { examRawMaxSnapshot: 40 },
      { examRawMaxSnapshot: 60, sessionScoringPolicyVersion: 0 },
      { examRawMaxSnapshot: 50, assessmentPolicySnapshot: { ca3Max: 10, examContributionMax: 50 } },
    ];
    const expected = [sheetPolicy, { ...sheetPolicy, examRawMax: 60 }, customPolicy];
    records.forEach((record, index) => {
      const rowPolicy = scoreRowPolicy("raw40", sheetPolicy, record);
      expect(rowPolicy).toEqual(expected[index]);
      // The server validates saved legacy rows against these recorded maxima.
      for (const values of [scores(11, 51), scores(10, 60)]) {
        expect(validateScoresForPolicy(values, rowPolicy)).toEqual(validateScoresForPolicy(values, expected[index]));
      }
    });
    expect(validateScoresForPolicy(scores(20, 51), scoreRowPolicy("raw40", sheetPolicy, records[0])).map(error => error.field)).toEqual(["examRawScore"]);
    expect(validateScoresForPolicy(scores(20, 51), scoreRowPolicy("raw40", sheetPolicy, records[1]))).toEqual([]);
    expect(validateScoresForPolicy(scores(11, 50), scoreRowPolicy("raw40", sheetPolicy, records[2])).map(error => error.field)).toEqual(["ca3"]);
    expect(scoreRosterHasScaledColumn("raw40", sheetPolicy, records.map(assessmentRecord => ({ assessmentRecord })))).toBe(true);
  });

  it("uses the supplied sheet policy for an unsaved /80 row even at version zero", () => {
    const weights = scoreRowPolicy("raw40", eightyPolicy, null);
    expect(weights).toEqual(eightyPolicy);
    expect(validateScoresForPolicy(scores(10, 80), weights)).toEqual([]);
    expect(validateScoresForPolicy(scores(11, 81), weights).map(error => error.field)).toEqual(["ca3", "examRawScore"]);
    expect(scoreRosterHasScaledColumn("raw40", eightyPolicy, [{ assessmentRecord: null }])).toBe(true);
    expect(scoreRosterHasScaledColumn("raw40", eightyPolicy, [{ assessmentRecord: { examRawMaxSnapshot: 40 } }])).toBe(true);
    expect(scoreRowPolicy("raw40", eightyPolicy, { examRawMaxSnapshot: 40 })).toEqual(sheetPolicy);
  });

  it("uses the current explicit policy instead of an old snapshot for a versioned row", () => {
    const record = { examRawMaxSnapshot: 40, sessionScoringPolicyVersion: 1, assessmentPolicySnapshot: sheetPolicy };
    const weights = scoreRowPolicy("raw40", eightyPolicy, record);
    expect(weights).toEqual(eightyPolicy);
    expect(validateScoresForPolicy(scores(10, 80), weights)).toEqual(validateScoresForPolicy(scores(10, 80), eightyPolicy));
    expect(validateScoresForPolicy(scores(11, 81), weights)).toEqual(validateScoresForPolicy(scores(11, 81), eightyPolicy));
  });
});
