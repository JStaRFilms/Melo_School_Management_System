import { describe, expect, it } from "vitest";

import { getDefaultTermId } from "@/app/assessments/report-card-workbench/selection-defaults";

describe("report-card workbench defaults", () => {
  const terms = [
    { id: "first-term" },
    { id: "second-term" },
    { id: "third-term" },
  ];

  it("selects the active term instead of the first term", () => {
    expect(getDefaultTermId(terms, [{ id: "third-term" }])).toBe(
      "third-term"
    );
  });

  it("falls back safely when no active term matches the session", () => {
    expect(getDefaultTermId(terms, [])).toBe("first-term");
    expect(getDefaultTermId([], [])).toBeNull();
  });
});
