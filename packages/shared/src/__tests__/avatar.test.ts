import { describe, expect, it } from "vitest";
import { getInitials } from "../components/Avatar";

describe("getInitials (consolidation P22)", () => {
  it("takes first letters of the first two parts", () => {
    expect(getInitials("Ada Okafor")).toBe("AO");
    expect(getInitials("  ada   okafor  ")).toBe("AO");
    expect(getInitials("Madonna")).toBe("M");
    expect(getInitials("A B C")).toBe("AB");
  });

  it("falls back on empty input", () => {
    expect(getInitials("")).toBe("ST");
    expect(getInitials(null)).toBe("ST");
    expect(getInitials(undefined)).toBe("ST");
    expect(getInitials("   ")).toBe("ST");
    expect(getInitials("", "")).toBe("");
    expect(getInitials("Ada", "SC")).toBe("A");
    expect(getInitials(null, "SC")).toBe("SC");
  });
});
