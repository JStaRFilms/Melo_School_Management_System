import { v } from "convex/values";

// The same two-input domain shape is used by school profiles and group defaults.
export const schoolThemeValidator = v.object({
  primaryColor: v.string(),
  accentColor: v.string(),
});
