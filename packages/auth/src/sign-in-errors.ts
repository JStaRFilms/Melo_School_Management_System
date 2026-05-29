export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: "The email or password is incorrect. Check your password and try again.",
  invalidEmail: "Enter a valid email address.",
  missingCredentials: "Please enter your email and password.",
  retry: "The sign-in service is unavailable right now. Check your connection or try again shortly.",
  signInDisabled: "Email and password sign-in is not enabled.",
  unauthorizedArea: "You don't have permission to access this area.",
} as const;

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  statusText?: unknown;
  error?: unknown;
  cause?: unknown;
};

function collectErrorText(error: unknown, depth = 0): string {
  if (!error || depth > 3) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return [error.name, error.message, collectErrorText(error.cause, depth + 1)]
      .filter(Boolean)
      .join(" ");
  }

  if (typeof error === "object") {
    const parts = error as AuthErrorLike;
    return [
      parts.code,
      parts.status,
      parts.statusText,
      parts.message,
      collectErrorText(parts.error, depth + 1),
      collectErrorText(parts.cause, depth + 1),
    ]
      .map((part) => {
        if (typeof part === "number") return String(part);
        if (typeof part === "string") return part;
        return "";
      })
      .filter((part) => part.length > 0)
      .join(" ");
  }

  return "";
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(text: string, phrases: string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

export function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getSignInErrorMessage(error: unknown): string {
  const text = normalizeText(collectErrorText(error));

  if (!text) {
    return AUTH_ERROR_MESSAGES.retry;
  }

  if (
    containsAny(text, [
      "invalid_email_or_password",
      "invalid email or password",
      "email or password is incorrect",
      "incorrect email or password",
      "invalid credentials",
      "invalid credential",
      "invalid password",
      "wrong password",
      "user not found",
      "credential account not found",
      "password not found",
      "unauthorized",
      "internal server error",
      "401",
      "403",
      "500",
    ])
  ) {
    return AUTH_ERROR_MESSAGES.invalidCredentials;
  }

  if (containsAny(text, ["invalid email", "email is invalid"])) {
    return AUTH_ERROR_MESSAGES.invalidEmail;
  }

  if (containsAny(text, ["email and password is not enabled"])) {
    return AUTH_ERROR_MESSAGES.signInDisabled;
  }

  if (
    containsAny(text, [
      "failed to fetch",
      "network error",
      "networkerror",
      "fetch failed",
      "load failed",
      "service unavailable",
      "bad gateway",
      "gateway timeout",
      "timeout",
      "503",
      "502",
      "504",
    ])
  ) {
    return AUTH_ERROR_MESSAGES.retry;
  }

  return AUTH_ERROR_MESSAGES.retry;
}
