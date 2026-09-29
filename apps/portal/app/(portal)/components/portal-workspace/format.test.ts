import { describe, expect, it } from "vitest";
import { formatScore } from "./format";

describe("portal score formatting", () => {
  it("keeps whole scores without decimal places and rounds fractions to one place", () => {
    expect(formatScore(null)).toBe("—");
    expect(formatScore(0)).toBe("0");
    expect(formatScore(75)).toBe("75");
    expect(formatScore(75.25)).toBe("75.3");
  });
});
