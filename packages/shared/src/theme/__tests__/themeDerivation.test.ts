import { describe, expect, it } from "vitest";
import {
  calculateContrastRatio,
  calculateLuminance,
  deriveSchoolTheme,
  getContrastSafeText,
  hexToRgb,
  isWcagAABody,
  isWcagAALarge,
  assertThemeDoesNotOverwriteSemanticTokens,
  PROTECTED_SEMANTIC_TOKENS,
  CONTRAST_DARK_TEXT,
  CONTRAST_LIGHT_TEXT,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_ACCENT_COLOR,
} from "../themeDerivation";

describe("Theme Derivation and WCAG 2.2 AA Contrast Engine", () => {
  describe("Hex to RGB and Luminance Calculation", () => {
    it("converts 6-digit and 3-digit hex strings correctly", () => {
      expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb("invalid")).toBeNull();
    });

    it("calculates relative luminance according to ITU-R BT.709", () => {
      const whiteLum = calculateLuminance({ r: 255, g: 255, b: 255 });
      const blackLum = calculateLuminance({ r: 0, g: 0, b: 0 });

      expect(whiteLum).toBeCloseTo(1.0, 4);
      expect(blackLum).toBeCloseTo(0.0, 4);
    });

    it("calculates contrast ratio correctly", () => {
      const maxContrast = calculateContrastRatio("#ffffff", "#000000");
      expect(maxContrast).toBeCloseTo(21.0, 1);

      const identityContrast = calculateContrastRatio("#2563eb", "#2563eb");
      expect(identityContrast).toBeCloseTo(1.0, 2);
    });
  });

  describe("WCAG 2.2 AA Thresholds and Contrast Selection", () => {
    it("selects white text for dark backgrounds to ensure AA compliance", () => {
      const darkBg = "#0f172a"; // Slate 900
      const contrastText = getContrastSafeText(darkBg);
      expect(contrastText).toBe(CONTRAST_LIGHT_TEXT);

      const ratio = calculateContrastRatio(darkBg, contrastText);
      expect(isWcagAABody(ratio)).toBe(true);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("selects dark text for light backgrounds to ensure AA compliance", () => {
      const lightBg = "#f8fafc"; // Slate 50
      const contrastText = getContrastSafeText(lightBg);
      expect(contrastText).toBe(CONTRAST_DARK_TEXT);

      const ratio = calculateContrastRatio(lightBg, contrastText);
      expect(isWcagAABody(ratio)).toBe(true);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("evaluates borderline brand colors correctly", () => {
      // Golden yellow / Amber (#f59e0b)
      const amberBg = "#f59e0b";
      const contrastText = getContrastSafeText(amberBg);
      expect(contrastText).toBe(CONTRAST_DARK_TEXT);

      const ratio = calculateContrastRatio(amberBg, contrastText);
      expect(isWcagAABody(ratio)).toBe(true);
    });
  });

  describe("School Theme Derivation Algorithm", () => {
    it("derives all 8 required CSS custom properties with fallbacks", () => {
      const tokens = deriveSchoolTheme();

      expect(tokens["--school-primary"]).toBe(DEFAULT_PRIMARY_COLOR);
      expect(tokens["--school-primary-hover"]).toBeDefined();
      expect(tokens["--school-primary-surface"]).toContain("rgba(");
      expect(tokens["--school-primary-border"]).toContain("rgba(");
      expect(tokens["--school-primary-contrast"]).toBe(CONTRAST_LIGHT_TEXT);
      expect(tokens["--school-accent"]).toBe(DEFAULT_ACCENT_COLOR);
      expect(tokens["--school-accent-surface"]).toContain("rgba(");
      expect(tokens["--school-accent-contrast"]).toBe(CONTRAST_LIGHT_TEXT);
      expect(tokens["--school-focus-ring"]).toContain("rgba(");
    });

    it("correctly derives hover colors by darkening light colors and lightening dark colors", () => {
      const darkTheme = deriveSchoolTheme("#1e293b", "#3b82f6");
      const lightTheme = deriveSchoolTheme("#f1f5f9", "#38bdf8");

      expect(darkTheme["--school-primary-hover"]).not.toBe("#1e293b");
      expect(lightTheme["--school-primary-hover"]).not.toBe("#f1f5f9");
    });
  });

  describe("Sovereignty Safeguard for Semantic Status and Grade Tokens", () => {
    it("guarantees derived tokens only occupy the --school-* namespace", () => {
      const tokens = deriveSchoolTheme("#7c3aed", "#06b6d4");
      const isCompliant = assertThemeDoesNotOverwriteSemanticTokens(tokens);
      expect(isCompliant).toBe(true);
    });

    it("verifies protected semantic tokens are preserved and distinct from theme tokens", () => {
      expect(PROTECTED_SEMANTIC_TOKENS.success.text).toBe("#065f46");
      expect(PROTECTED_SEMANTIC_TOKENS.warning.text).toBe("#92400e");
      expect(PROTECTED_SEMANTIC_TOKENS.error.text).toBe("#991b1b");
      expect(PROTECTED_SEMANTIC_TOKENS.info.text).toBe("#075985");
      expect(PROTECTED_SEMANTIC_TOKENS.gradeBands.A).toBe("#065f46");
      expect(PROTECTED_SEMANTIC_TOKENS.gradeBands.F).toBe("#991b1b");
    });
  });
});
