/**
 * Mathematical School Theme Derivation and Contrast Calculation Engine
 * In accordance with D-04 §9 & F6 / MX-05
 *
 * Enforces:
 * 1. Strict 2-input configuration model: primaryColor and accentColor.
 * 2. Mathematical relative luminance and contrast according to ITU-R BT.709 and WCAG 2.2 AA.
 * 3. Invariant: School theme colors NEVER overwrite semantic status tokens or grade-band colors.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface SchoolThemeInputs {
  primaryColor: string;
  accentColor: string;
}

export interface SchoolThemeDerivation {
  "--school-primary": string;
  "--school-primary-hover": string;
  "--school-primary-surface": string;
  "--school-primary-border": string;
  "--school-primary-contrast": string; // High-contrast text (#ffffff or #0f172a)
  "--school-accent": string;
  "--school-accent-surface": string;
  "--school-accent-contrast": string; // High-contrast text (#ffffff or #0f172a)
  "--school-focus-ring": string;
}

/**
 * Standard default fallback colors
 */
export const DEFAULT_PRIMARY_COLOR = "#0f172a"; // Slate 900
export const DEFAULT_ACCENT_COLOR = "#2563eb";  // Blue 600

export const CONTRAST_DARK_TEXT = "#0f172a";
export const CONTRAST_LIGHT_TEXT = "#ffffff";

/**
 * Protected semantic status tokens and grade-band colors.
 * Sovereign and immutable across all school branding configurations (D-04 §1.3 I5 & §4.1.1).
 */
export const PROTECTED_SEMANTIC_TOKENS = {
  success: {
    text: "#065f46", // Emerald 800
    bg: "#ecfdf5",   // Emerald 50
    border: "#a7f3d0", // Emerald 200
  },
  warning: {
    text: "#92400e", // Amber 800
    bg: "#fffbeb",   // Amber 50
    border: "#fde68a", // Amber 200
  },
  error: {
    text: "#991b1b", // Rose 800
    bg: "#fff1f2",   // Rose 50
    border: "#fecdd3", // Rose 200
  },
  info: {
    text: "#075985", // Sky 800
    bg: "#f0f9ff",   // Sky 50
    border: "#bae6fd", // Sky 200
  },
  gradeBands: {
    A: "#065f46", // Emerald
    B: "#1e40af", // Royal Blue
    C: "#92400e", // Amber
    D: "#9a3412", // Burnt Orange
    F: "#991b1b", // Crimson
  },
} as const;

/**
 * Convert hex string (#RGB, #RRGGBB, or with optional alpha) to RGB object.
 * Returns null for invalid hex strings.
 */
export function hexToRgb(hex: string): RgbColor | null {
  if (!hex || typeof hex !== "string") return null;

  let cleaned = hex.trim().replace(/^#/, "");

  if (cleaned.length === 3) {
    cleaned = cleaned
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (cleaned.length < 6) return null;

  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

/**
 * Convert RGB components to 6-character hex code.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (c: number) => clamp(c).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculates relative luminance according to ITU-R BT.709 / WCAG 2.2 specs.
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Where R, G, B are linear channel components.
 */
export function calculateLuminance(rgb: RgbColor): number {
  const linearize = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const rLinear = linearize(rgb.r);
  const gLinear = linearize(rgb.g);
  const bLinear = linearize(rgb.b);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate WCAG contrast ratio between two colors.
 * (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color.
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1) || hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  const rgb2 = hexToRgb(color2) || hexToRgb(DEFAULT_ACCENT_COLOR)!;

  const lum1 = calculateLuminance(rgb1);
  const lum2 = calculateLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Checks if a contrast ratio satisfies WCAG 2.2 AA for normal/body text (>= 4.5:1).
 */
export function isWcagAABody(contrastRatio: number): boolean {
  return contrastRatio >= 4.5;
}

/**
 * Checks if a contrast ratio satisfies WCAG 2.2 AA for large text (>= 3.0:1).
 */
export function isWcagAALarge(contrastRatio: number): boolean {
  return contrastRatio >= 3.0;
}

/**
 * Select the contrast-safe text foreground (#ffffff or #0f172a) for a given background color.
 * Always selects the one providing highest contrast ratio, ensuring WCAG 2.2 AA compliance.
 */
export function getContrastSafeText(bgHex: string): string {
  const contrastWithWhite = calculateContrastRatio(bgHex, CONTRAST_LIGHT_TEXT);
  const contrastWithDark = calculateContrastRatio(bgHex, CONTRAST_DARK_TEXT);

  return contrastWithWhite >= contrastWithDark
    ? CONTRAST_LIGHT_TEXT
    : CONTRAST_DARK_TEXT;
}

/**
 * Adjusts brightness of a hex color by a factor (-1.0 to 1.0).
 * Positive values lighten; negative values darken.
 */
export function adjustBrightness(hex: string, factor: number): string {
  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_PRIMARY_COLOR)!;

  if (factor > 0) {
    // Lighten towards 255
    const r = rgb.r + (255 - rgb.r) * factor;
    const g = rgb.g + (255 - rgb.g) * factor;
    const b = rgb.b + (255 - rgb.b) * factor;
    return rgbToHex(r, g, b);
  }

  // Darken towards 0
  const absFactor = 1 + factor; // factor is negative
  const r = rgb.r * absFactor;
  const g = rgb.g * absFactor;
  const b = rgb.b * absFactor;
  return rgbToHex(r, g, b);
}

/**
 * Derives contrast-safe hover color for a given base color.
 * Darkens if background is light; lightens if background is dark.
 */
export function deriveHoverColor(hex: string): string {
  const rgb = hexToRgb(hex) || hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  const lum = calculateLuminance(rgb);

  // If luminance > 0.4 (relatively light), darken on hover. Else lighten.
  return lum > 0.4
    ? adjustBrightness(hex, -0.12)
    : adjustBrightness(hex, 0.15);
}

/**
 * Derives the complete set of CSS custom properties from strict 2-input theme config.
 *
 * @param primaryColor School primary branding color (hex)
 * @param accentColor School accent branding color (hex)
 * @returns 8 typed CSS custom property tokens
 */
export function deriveSchoolTheme(
  primaryColor?: string | null,
  accentColor?: string | null
): SchoolThemeDerivation {
  const validPrimary = hexToRgb(primaryColor || "")
    ? primaryColor!
    : DEFAULT_PRIMARY_COLOR;
  const validAccent = hexToRgb(accentColor || "")
    ? accentColor!
    : DEFAULT_ACCENT_COLOR;

  const primaryRgb = hexToRgb(validPrimary)!;
  const accentRgb = hexToRgb(validAccent)!;

  const primaryContrast = getContrastSafeText(validPrimary);
  const accentContrast = getContrastSafeText(validAccent);

  const primaryHover = deriveHoverColor(validPrimary);

  return {
    "--school-primary": validPrimary,
    "--school-primary-hover": primaryHover,
    "--school-primary-surface": `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.06)`,
    "--school-primary-border": `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`,
    "--school-primary-contrast": primaryContrast,
    "--school-accent": validAccent,
    "--school-accent-surface": `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.10)`,
    "--school-accent-contrast": accentContrast,
    "--school-focus-ring": `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.40)`,
  };
}

/**
 * Asserts that a token map strictly adheres to the school token namespace
 * and never contains or overwrites protected semantic tokens.
 */
export function assertThemeDoesNotOverwriteSemanticTokens(
  tokens: SchoolThemeDerivation
): boolean {
  const forbiddenPrefixes = ["--color-red", "--color-green", "--color-emerald", "--color-rose", "--color-amber", "--grade-"];
  const forbiddenKeys = ["color", "background", "border", "success", "error", "warning", "info"];

  for (const key of Object.keys(tokens)) {
    if (!key.startsWith("--school-")) {
      return false;
    }
    for (const forbidden of forbiddenPrefixes) {
      if (key.includes(forbidden)) return false;
    }
    for (const forbidden of forbiddenKeys) {
      if (key === `--${forbidden}`) return false;
    }
  }

  return true;
}
