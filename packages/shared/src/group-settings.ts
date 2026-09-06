import type { SchoolThemeInputs } from "./theme/themeDerivation";

export type GroupSettingOrigin =
  | "factory"
  | "branch_legacy"
  | "group"
  | "branch_override";
export type GroupSettingMode = "legacy" | "inherit" | "override";

/** Shared effective metadata used by typed domain adapters. */
export interface EffectiveGroupSetting<T> {
  value: T;
  source: GroupSettingOrigin;
  groupVersion: number;
  revision: number;
  mode: GroupSettingMode;
}

export interface EffectiveGroupBranding
  extends Omit<EffectiveGroupSetting<SchoolThemeInputs>, "value"> {
  theme: SchoolThemeInputs;
}
