import { toast } from "sonner";
import { APP_TOAST_DEFAULT_DURATION_MS } from "./defaults";
import type { AppToastApi, AppToastOptions, AppToastVariant } from "./types";

type SonnerToastOptions = Parameters<typeof toast>[1];

function toSonnerOptions(
  variant: AppToastVariant,
  options: AppToastOptions = {},
): SonnerToastOptions {
  return {
    id: options.id,
    description: options.description,
    duration: options.duration ?? APP_TOAST_DEFAULT_DURATION_MS[variant],
    action: options.action,
  };
}

export const appToast: AppToastApi = {
  success(message, options) {
    return toast.success(message, toSonnerOptions("success", options));
  },
  error(message, options) {
    return toast.error(message, toSonnerOptions("error", options));
  },
  warning(message, options) {
    return toast.warning(message, toSonnerOptions("warning", options));
  },
  info(message, options) {
    return toast.info(message, toSonnerOptions("info", options));
  },
  dismiss(id) {
    toast.dismiss(id);
  },
};
