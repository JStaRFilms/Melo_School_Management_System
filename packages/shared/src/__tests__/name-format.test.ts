import { describe, expect, it } from "vitest";
import { normalizeHumanName } from "../name-format";

describe("normalizeHumanName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeHumanName("  john   doe  ")).toBe("John Doe");
  });

  it("handles hyphens and apostrophes", () => {
    expect(normalizeHumanName("jean-luc o'neill")).toBe("Jean-Luc O'Neill");
  });

  it("preserves short uppercase acronyms and alnum tokens", () => {
    expect(normalizeHumanName("JSS 1A")).toBe("JSS 1A");
    expect(normalizeHumanName("ICT")).toBe("ICT");
    expect(normalizeHumanName("SS1")).toBe("SS1");
  });

  it("uppercases the first letter after a digit boundary", () => {
    expect(normalizeHumanName("class 1a")).toBe("Class 1A");
  });

  it("keeps very short roman numerals uppercase", () => {
    expect(normalizeHumanName("john paul ii")).toBe("John Paul II");
    expect(normalizeHumanName("henry iv")).toBe("Henry IV");
  });
});

