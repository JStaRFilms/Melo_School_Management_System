import { describe, expect, it } from "vitest";
import {
  CONTRAST_DARK_TEXT,
  CONTRAST_LIGHT_TEXT,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  PROTECTED_SEMANTIC_TOKENS,
  assertThemeDoesNotOverwriteSemanticTokens,
  calculateContrastRatio,
  calculateLuminance,
  deriveSchoolTheme,
  getContrastSafeText,
  hexToRgb,
  isWcagAABody,
  normalizeThemeColor,
} from "../themeDerivation";

const opaquePairs = [
  ["--school-primary", "--school-primary-contrast"],
  ["--school-primary-hover", "--school-primary-hover-contrast"],
  ["--school-primary-pressed", "--school-primary-pressed-contrast"],
  ["--school-accent", "--school-accent-contrast"],
  ["--school-accent-hover", "--school-accent-hover-contrast"],
  ["--school-accent-pressed", "--school-accent-pressed-contrast"],
  ["--school-selection", "--school-selection-contrast"],
  ["--school-progress", "--school-progress-contrast"],
] as const;

describe("two-base school theme derivation", () => {
  it("strictly parses and normalizes opaque hex inputs", () => {
    expect(normalizeThemeColor(" #AbC ")).toBe("#aabbcc");
    expect(normalizeThemeColor("#2563EB")).toBe("#2563eb");
    expect(normalizeThemeColor("#2563eb99")).toBeNull();
    expect(normalizeThemeColor("#2563ebjunk")).toBeNull();
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("invalid")).toBeNull();
  });

  it("uses WCAG luminance and contrast calculations", () => {
    expect(calculateLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 4);
    expect(calculateContrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(getContrastSafeText("#f59e0b")).toBe(CONTRAST_DARK_TEXT);
    expect(getContrastSafeText("#0f172a")).toBe(CONTRAST_LIGHT_TEXT);
  });

  it.each([
    ["default", undefined, undefined],
    ["light", "#f8fafc", "#fde68a"],
    ["dark", "#172554", "#164e63"],
    ["custom", "#7c3aed", "#db2777"],
  ])("derives AA opaque foreground pairs for %s bases", (_name, primary, accent) => {
    const tokens = deriveSchoolTheme(primary, accent);
    for (const [background, foreground] of opaquePairs) {
      expect(calculateContrastRatio(tokens[background], tokens[foreground])).toSatisfy(isWcagAABody);
    }
    expect(tokens["--school-primary-surface"]).toContain("rgba(");
    expect(tokens["--school-accent-surface"]).toContain("rgba(");
    expect(tokens["--school-primary-surface-contrast"]).toBe(CONTRAST_DARK_TEXT);
    expect(tokens["--school-accent-surface-contrast"]).toBe(CONTRAST_DARK_TEXT);
  });

  it("falls back safely for an input with no safe hex representation", () => {
    const tokens = deriveSchoolTheme("not-a-colour", "#bad-value");
    expect(tokens["--school-primary"]).toBe(DEFAULT_PRIMARY_COLOR);
    expect(tokens["--school-accent"]).toBe(DEFAULT_ACCENT_COLOR);
  });

  it("does not derive status or grade domain semantics", () => {
    expect(assertThemeDoesNotOverwriteSemanticTokens(deriveSchoolTheme("#7c3aed", "#06b6d4"))).toBe(true);
    expect(PROTECTED_SEMANTIC_TOKENS.success.text).toBe("#065f46");
    expect(PROTECTED_SEMANTIC_TOKENS.gradeBands.F).toBe("#991b1b");
  });
});
