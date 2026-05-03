import type { AppToastVariant } from "./types";

export const APP_TOAST_DEFAULT_DURATION_MS: Record<AppToastVariant, number> = {
  success: 5_000,
  info: 5_000,
  warning: 8_000,
  error: 10_000,
};

export const APP_TOAST_POSITION = "top-center" as const;
