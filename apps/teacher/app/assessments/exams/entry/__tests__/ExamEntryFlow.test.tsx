import {
buildErrorSummaries,
computeDerivedValues,
countErrors,
hasAnyErrors,
validateAllDrafts,
validateField,
} from "@/lib/exam-helpers";
import type {
DraftScores,
GradingBandResponse,
Id
} from "@/lib/types";
import { describe,expect,it } from "vitest";

const standardBands: GradingBandResponse[] = [
  {
    _id: "band1" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 0,
    maxScore: 39,
    gradeLetter: "F",
    remark: "Fail",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band2" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 40,
    maxScore: 49,
    gradeLetter: "D",
    remark: "Pass",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band3" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 50,
    maxScore: 59,
    gradeLetter: "C",
    remark: "Good",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band4" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 60,
    maxScore: 69,
    gradeLetter: "B",
    remark: "Very Good",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
  {
    _id: "band5" as Id<"gradingBands">,
    _creationTime: 0,
    schoolId: "school1" as Id<"schools">,
    minScore: 70,
    maxScore: 100,
    gradeLetter: "A",
    remark: "Excellent",
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: "user1" as Id<"users">,
  },
];

describe("validateField", () => {
  describe("raw40 mode", () => {
    it("valid ca1 returns null", () => {
      expect(validateField("ca1", 18, "raw40")).toBeNull();
    });

    it("ca1 below range returns error", () => {
      expect(validateField("ca1", -1, "raw40")).toBe(
        "CA1 must be between 0 and 20"
      );
    });

    it("ca1 above range returns error", () => {
      expect(validateField("ca1", 21, "raw40")).toBe(
        "CA1 must be between 0 and 20"
      );
    });

    it("valid exam raw40 returns null", () => {
      expect(validateField("examRawScore", 34, "raw40")).toBeNull();
    });

    it("exam raw40 above range returns error", () => {
      expect(validateField("examRawScore", 41, "raw40")).toBe(
        "Exam score must be between 0 and 40"
      );
    });

    it("null value (incomplete) returns null", () => {
      expect(validateField("ca1", null, "raw40")).toBeNull();
    });
  });

  describe("raw60 mode", () => {
    it("valid exam raw60 returns null", () => {
      expect(validateField("examRawScore", 54, "raw60_scaled_to_40")).toBeNull();
    });

    it("exam raw60 above range returns error", () => {
      expect(validateField("examRawScore", 61, "raw60_scaled_to_40")).toBe(
        "Exam score must be between 0 and 60"
      );
    });
  });
});

describe("validateAllDrafts", () => {
  it("returns empty map for valid drafts", () => {
    const drafts: DraftScores = new Map([
      ["s1" as Id<"students">, { ca1: 18, ca2: 15, ca3: 19, examRawScore: 34 }],
    ]);

    const errors = validateAllDrafts(drafts, "raw40");
    expect(errors.size).toBe(0);
  });

  it("returns errors for invalid drafts", () => {
    const drafts: DraftScores = new Map([
      ["s1" as Id<"students">, { ca1: 25, ca2: 15, ca3: 19, examRawScore: 34 }],
    ]);

    const errors = validateAllDrafts(drafts, "raw40");
    expect(errors.size).toBe(1);
    expect(errors.get("s1" as Id<"students">)?.ca1).toBe(
      "CA1 must be between 0 and 20"
    );
  });
});

describe("computeDerivedValues", () => {
  it("returns null values when inputs incomplete", () => {
    const result = computeDerivedValues(18, 15, null, 34, "raw40", standardBands);
    expect(result.examScaledScore).toBeNull();
    expect(result.total).toBeNull();
    expect(result.gradeLetter).toBeNull();
    expect(result.remark).toBeNull();
  });

  it("computes correct values for raw40 mode", () => {
    const result = computeDerivedValues(18, 15, 19, 34, "raw40", standardBands);
    expect(result.examScaledScore).toBe(34);
    expect(result.total).toBe(86);
    expect(result.gradeLetter).toBe("A");
    expect(result.remark).toBe("Excellent");
  });

  it("computes correct values for raw60 mode", () => {
    const result = computeDerivedValues(
      18,
      15,
      19,
      54,
      "raw60_scaled_to_40",
      standardBands
    );
    // (54/60)*40 = 36
    expect(result.examScaledScore).toBe(36);
    // 18+15+19+36 = 88
    expect(result.total).toBe(88);
    expect(result.gradeLetter).toBe("A");
    expect(result.remark).toBe("Excellent");
  });

  it("handles rounding for raw60 mode", () => {
    const result = computeDerivedValues(
      10,
      10,
      10,
      37,
      "raw60_scaled_to_40",
      standardBands
    );
    // (37/60)*40 = 24.67
    expect(result.examScaledScore).toBe(24.67);
    // 10+10+10+24.67 = 54.67
    expect(result.total).toBe(54.67);
    expect(result.gradeLetter).toBe("C");
    expect(result.remark).toBe("Good");
  });
});

describe("hasAnyErrors", () => {
  it("returns false for empty errors map", () => {
    expect(hasAnyErrors(new Map())).toBe(false);
  });

  it("returns true for non-empty errors map", () => {
    const errors = new Map([
      ["s1" as Id<"students">, { ca1: "Error" }],
    ]);
    expect(hasAnyErrors(errors)).toBe(true);
  });
});

describe("countErrors", () => {
  it("counts all errors across students", () => {
    const errors = new Map([
      ["s1" as Id<"students">, { ca1: "Error 1", ca2: "Error 2" }],
      ["s2" as Id<"students">, { examRawScore: "Error 3" }],
    ]);
    expect(countErrors(errors)).toBe(3);
  });
});

describe("buildErrorSummaries", () => {
  it("builds summaries with student names", () => {
    const errors = new Map([
      ["s1" as Id<"students">, { ca1: "CA1 must be between 0 and 20" }],
    ]);
    const roster = [
      {
        studentId: "s1" as Id<"students">,
        studentName: "Adebayo Ogunlesi",
        assessmentRecord: null,
      },
    ];

    const summaries = buildErrorSummaries(errors, roster);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].studentName).toBe("Adebayo Ogunlesi");
    expect(summaries[0].message).toBe("CA1 must be between 0 and 20");
  });
});
