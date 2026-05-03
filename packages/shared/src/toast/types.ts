export type AppToastVariant = "success" | "error" | "warning" | "info";

export type AppToastAction = {
  label: string;
  onClick: () => void;
};

export type AppToastOptions = {
  description?: string;
  duration?: number;
  id?: string | number;
  action?: AppToastAction;
};

export type AppToastApi = {
  success: (message: string, options?: AppToastOptions) => string | number;
  error: (message: string, options?: AppToastOptions) => string | number;
  warning: (message: string, options?: AppToastOptions) => string | number;
  info: (message: string, options?: AppToastOptions) => string | number;
  dismiss: (id?: string | number) => void;
};
