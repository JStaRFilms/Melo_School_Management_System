import { describe, expect, it } from "vitest";
import { validateField } from "../lib/exam-helpers";
import type { ScoreField } from "../lib/types";

describe("validateField adapter (consolidation P20)", () => {
  it("accepts null and in-range values", () => {
    expect(validateField("ca1", null, "raw40")).toBeNull();
    expect(validateField("ca1", 0, "raw40")).toBeNull();
    expect(validateField("ca2", 20, "raw60_scaled_to_40")).toBeNull();
    expect(validateField("examRawScore", 40, "raw40")).toBeNull();
    expect(validateField("examRawScore", 60, "raw60_scaled_to_40")).toBeNull();
  });

  it("rejects out-of-range CA values with the shared message", () => {
    for (const field of ["ca1", "ca2", "ca3"] as ScoreField[]) {
      expect(validateField(field, -1, "raw40")).toBe(`${field.toUpperCase()} must be between 0 and 20`);
      expect(validateField(field, 21, "raw40")).toBe(`${field.toUpperCase()} must be between 0 and 20`);
    }
  });

  it("rejects out-of-range exam scores per mode", () => {
    expect(validateField("examRawScore", 41, "raw40")).toBe("Exam score must be between 0 and 40");
    expect(validateField("examRawScore", -1, "raw40")).toBe("Exam score must be between 0 and 40");
    expect(validateField("examRawScore", 61, "raw60_scaled_to_40")).toBe("Exam score must be between 0 and 60");
    // Mode boundary is respected, not blurred.
    expect(validateField("examRawScore", 41, "raw60_scaled_to_40")).toBeNull();
  });
});
