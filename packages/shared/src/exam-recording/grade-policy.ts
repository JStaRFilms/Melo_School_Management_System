import {
  calculateContrastRatio,
  hexToRgb,
  rgbToHex,
} from "../theme/themeDerivation";

export interface GradingBandItem {
  _id?: string;
  gradeLetter: string;
  minScore: number;
  maxScore: number;
  gradePoints: number;
  remark: string;
  colorHex: string;
  luminanceContrast: number;
  isDefaultPreset?: boolean;
}

/**
 * Immutable Factory Preset Standard Defaults (H1 / MX-06)
 * A: 75-100, B: 65-74, C: 50-64, D: 45-49, E: 40-44, F: 0-39
 */
export const FACTORY_DEFAULT_GRADING_BANDS: readonly GradingBandItem[] = [
  {
    gradeLetter: "A",
    minScore: 75,
    maxScore: 100,
    gradePoints: 4.0,
    remark: "Excellent",
    colorHex: "#065f46", // Emerald
    luminanceContrast: 7.2,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "B",
    minScore: 65,
    maxScore: 74,
    gradePoints: 3.0,
    remark: "Very Good",
    colorHex: "#1e40af", // Royal Blue
    luminanceContrast: 8.1,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "C",
    minScore: 50,
    maxScore: 64,
    gradePoints: 2.0,
    remark: "Good",
    colorHex: "#92400e", // Amber
    luminanceContrast: 5.4,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "D",
    minScore: 45,
    maxScore: 49,
    gradePoints: 1.0,
    remark: "Fair Pass",
    colorHex: "#9a3412", // Burnt Orange
    luminanceContrast: 4.9,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "E",
    minScore: 40,
    maxScore: 44,
    gradePoints: 0.5,
    remark: "Pass",
    colorHex: "#7c2d12", // Deep Bronze
    luminanceContrast: 6.2,
    isDefaultPreset: true,
  },
  {
    gradeLetter: "F",
    minScore: 0,
    maxScore: 39,
    gradePoints: 0.0,
    remark: "Fail",
    colorHex: "#991b1b", // Rose / Crimson
    luminanceContrast: 6.8,
    isDefaultPreset: true,
  },
] as const;

export function isGradeHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Preserve stored hue; 7:1 against white also leaves AA headroom on subtle table/hover surfaces. */
export function gradeDisplayColor(colorHex?: string | null): string {
  if (!colorHex || !isGradeHex(colorHex)) return "#334155";
  const rgb = hexToRgb(colorHex);
  if (!rgb) return "#334155";
  for (let factor = 1; factor >= 0; factor -= 0.01) {
    const ink = rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
    if (calculateContrastRatio(ink, "#ffffff") >= 7) return ink;
  }
  return "#000000";
}

export function resolveGradeColor(
  grade: string | null,
  bands: ReadonlyArray<{
    gradeLetter: string;
    colorHex?: string;
    color?: string;
  }> = [],
): string {
  const band = bands.find((b) => b.gradeLetter === grade);
  return gradeDisplayColor(band?.colorHex ?? band?.color);
}
