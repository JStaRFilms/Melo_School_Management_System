import { expect, it } from "vitest";
import {
  gradeDisplayColor,
  isGradeHex,
  resolveGradeColor,
} from "../grade-policy";
import { calculateContrastRatio } from "../../theme/themeDerivation";
it("derives readable ink without rejecting light valid hues", () => {
  for (const hue of ["#ffffff", "#ffffaa", "#abcDEF", "#00ffff", "#065f46"]) {
    expect(isGradeHex(hue)).toBe(true);
    expect(
      calculateContrastRatio(gradeDisplayColor(hue), "#ffffff"),
    ).toBeGreaterThanOrEqual(7);
    expect(calculateContrastRatio(gradeDisplayColor(hue), "#f1f5f9")).toBeGreaterThanOrEqual(4.5);
  }
  for (const hue of ["#abc", "red", "#ggffff", "#ffffff00"])
    expect(isGradeHex(hue)).toBe(false);
});
it("resolves custom labels and never guesses a missing policy from a familiar letter", () => {
  expect(
    resolveGradeColor("OUT", [{ gradeLetter: "OUT", colorHex: "#aa00aa" }]),
  ).toBe(gradeDisplayColor("#aa00aa"));
  expect(resolveGradeColor("A")).toBe("#334155");
  expect(resolveGradeColor(null)).toBe("#334155");
});
