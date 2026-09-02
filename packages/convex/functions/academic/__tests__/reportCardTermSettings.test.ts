import { describe, expect, it } from "vitest";
import { assertNextTermBeginsFitsAdjacentTerm } from "../reportCardTermSettings";

describe("report-card next-term date validation", () => {
  it("rejects a resumption date at or after the adjacent term end", () => {
    expect(() =>
      assertNextTermBeginsFitsAdjacentTerm(200, { endDate: 200 })
    ).toThrow("Next term start date must be before the adjacent term ends");
    expect(() =>
      assertNextTermBeginsFitsAdjacentTerm(201, { endDate: 200 })
    ).toThrow("Next term start date must be before the adjacent term ends");
  });

  it("allows a resumption date before the adjacent term ends", () => {
    expect(() =>
      assertNextTermBeginsFitsAdjacentTerm(199, { endDate: 200 })
    ).not.toThrow();
  });
});
