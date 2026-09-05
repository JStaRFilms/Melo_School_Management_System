import type { SchoolThemeInputs } from "./theme/themeDerivation";

/** Branding-only effective contract. Other domains must publish their own typed adapters. */
export interface EffectiveGroupBranding {
  theme: SchoolThemeInputs;
  source: "factory" | "branch_legacy" | "group" | "branch_override";
  groupVersion: number;
  revision: number;
  mode: "legacy" | "inherit" | "override";
}
