"use client";

import { Toaster } from "sonner";
import { APP_TOAST_POSITION } from "./defaults";

export function AppToaster() {
  return (
    <Toaster
      position={APP_TOAST_POSITION}
      closeButton
      richColors
      expand={false}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast: "app-toast z-[10000]",
          title: "app-toast-title",
          description: "app-toast-description",
          actionButton: "app-toast-action",
          cancelButton: "app-toast-cancel",
          closeButton: "app-toast-close",
        },
      }}
    />
  );
}
