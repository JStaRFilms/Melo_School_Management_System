/**
 * The only tenant-controlled theme inputs are primary and accent. Every other
 * school token is derived here; status and grade colours are intentionally not.
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
  "--school-primary-hover-contrast": string;
  "--school-primary-pressed": string;
  "--school-primary-pressed-contrast": string;
  "--school-primary-contrast": string;
  "--school-primary-surface": string;
  "--school-primary-surface-contrast": string;
  "--school-primary-border": string;
  "--school-accent": string;
  "--school-accent-hover": string;
  "--school-accent-hover-contrast": string;
  "--school-accent-pressed": string;
  "--school-accent-pressed-contrast": string;
  "--school-accent-contrast": string;
  "--school-accent-surface": string;
  "--school-accent-surface-contrast": string;
  "--school-accent-border": string;
  "--school-focus-ring": string;
  "--school-selection": string;
  "--school-selection-contrast": string;
  "--school-progress": string;
  "--school-progress-contrast": string;
}

export const DEFAULT_PRIMARY_COLOR = "#0f172a";
export const DEFAULT_ACCENT_COLOR = "#2563eb";
export const CONTRAST_DARK_TEXT = "#0f172a";
export const CONTRAST_LIGHT_TEXT = "#ffffff";
const CONTRAST_FALLBACK_TEXT = "#000000";

/** Protected domain semantics: school branding must never derive these. */
export const PROTECTED_SEMANTIC_TOKENS = {
  success: { text: "#065f46", bg: "#ecfdf5", border: "#a7f3d0" },
  warning: { text: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  error: { text: "#991b1b", bg: "#fff1f2", border: "#fecdd3" },
  info: { text: "#075985", bg: "#f0f9ff", border: "#bae6fd" },
  gradeBands: { A: "#065f46", B: "#1e40af", C: "#92400e", D: "#9a3412", F: "#991b1b" },
} as const;

export function hexToRgb(hex: string): RgbColor | null {
  const normalized = normalizeThemeColor(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

/** Normalizes #RGB or #RRGGBB to a safe opaque six-digit CSS colour. */
export function normalizeThemeColor(color: string | null | undefined): string | null {
  if (typeof color !== "string") return null;
  const value = color.trim();
  const shortMatch = /^#([\da-f]{3})$/i.exec(value);
  if (shortMatch) {
    return `#${shortMatch[1].split("").map((channel) => channel + channel).join("").toLowerCase()}`;
  }
  const longMatch = /^#([\da-f]{6})$/i.exec(value);
  return longMatch ? `#${longMatch[1].toLowerCase()}` : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function calculateLuminance(rgb: RgbColor): number {
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

export function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1) ?? hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  const rgb2 = hexToRgb(color2) ?? hexToRgb(DEFAULT_ACCENT_COLOR)!;
  const luminance1 = calculateLuminance(rgb1);
  const luminance2 = calculateLuminance(rgb2);
  return (Math.max(luminance1, luminance2) + 0.05) / (Math.min(luminance1, luminance2) + 0.05);
}

export const isWcagAABody = (contrastRatio: number) => contrastRatio >= 4.5;
export const isWcagAALarge = (contrastRatio: number) => contrastRatio >= 3;

export function getContrastSafeText(background: string): string {
  const whiteContrast = calculateContrastRatio(background, CONTRAST_LIGHT_TEXT);
  const darkContrast = calculateContrastRatio(background, CONTRAST_DARK_TEXT);
  if (Math.max(whiteContrast, darkContrast) >= 4.5) {
    return whiteContrast >= darkContrast ? CONTRAST_LIGHT_TEXT : CONTRAST_DARK_TEXT;
  }
  // Mid-tone branding can be too low-contrast for both prescribed neutrals.
  return CONTRAST_FALLBACK_TEXT;
}

export function adjustBrightness(hex: string, factor: number): string {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  const adjust = (channel: number) => factor >= 0 ? channel + (255 - channel) * factor : channel * (1 + factor);
  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

/** Hover/pressed retain the base hue direction while remaining distinct states. */
export function deriveHoverColor(hex: string): string {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  return calculateLuminance(rgb) > 0.4 ? adjustBrightness(hex, -0.12) : adjustBrightness(hex, 0.15);
}

function derivePressedColor(hex: string): string {
  const rgb = hexToRgb(hex) ?? hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  return calculateLuminance(rgb) > 0.4 ? adjustBrightness(hex, -0.22) : adjustBrightness(hex, 0.26);
}

function rgba(color: string, alpha: number): string {
  const rgb = hexToRgb(color) ?? hexToRgb(DEFAULT_PRIMARY_COLOR)!;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function resolvedBase(color: string | null | undefined, fallback: string): string {
  return normalizeThemeColor(color) ?? fallback;
}

export function deriveSchoolTheme(primaryColor?: string | null, accentColor?: string | null): SchoolThemeDerivation {
  const primary = resolvedBase(primaryColor, DEFAULT_PRIMARY_COLOR);
  const accent = resolvedBase(accentColor, DEFAULT_ACCENT_COLOR);
  const primaryHover = deriveHoverColor(primary);
  const accentHover = deriveHoverColor(accent);
  const primaryPressed = derivePressedColor(primary);
  const accentPressed = derivePressedColor(accent);

  return {
    "--school-primary": primary,
    "--school-primary-hover": primaryHover,
    "--school-primary-hover-contrast": getContrastSafeText(primaryHover),
    "--school-primary-pressed": primaryPressed,
    "--school-primary-pressed-contrast": getContrastSafeText(primaryPressed),
    "--school-primary-contrast": getContrastSafeText(primary),
    "--school-primary-surface": rgba(primary, 0.06),
    "--school-primary-surface-contrast": CONTRAST_DARK_TEXT,
    "--school-primary-border": rgba(primary, 0.18),
    "--school-accent": accent,
    "--school-accent-hover": accentHover,
    "--school-accent-hover-contrast": getContrastSafeText(accentHover),
    "--school-accent-pressed": accentPressed,
    "--school-accent-pressed-contrast": getContrastSafeText(accentPressed),
    "--school-accent-contrast": getContrastSafeText(accent),
    "--school-accent-surface": rgba(accent, 0.1),
    "--school-accent-surface-contrast": CONTRAST_DARK_TEXT,
    "--school-accent-border": rgba(accent, 0.2),
    "--school-focus-ring": rgba(accent, 0.45),
    "--school-selection": primary,
    "--school-selection-contrast": getContrastSafeText(primary),
    "--school-progress": accent,
    "--school-progress-contrast": getContrastSafeText(accent),
  };
}

export function assertThemeDoesNotOverwriteSemanticTokens(tokens: SchoolThemeDerivation): boolean {
  return Object.keys(tokens).every((key) => key.startsWith("--school-") && !key.includes("grade") && !/(success|warning|error|info)/.test(key));
}
