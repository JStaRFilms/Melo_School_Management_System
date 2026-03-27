export const AUTH_ERROR_MESSAGES = {
  invalidCredentials: "Email or password is incorrect.",
  invalidEmail: "Enter a valid email address.",
  missingCredentials: "Please enter your email and password.",
  retry: "We couldn't sign you in right now. Please try again.",
  signInDisabled: "Email and password sign-in is not enabled.",
  unauthorizedArea: "You don't have permission to access this area.",
} as const;

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  error?: unknown;
};

function collectErrorText(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object") {
    const parts = error as AuthErrorLike;
    return [parts.code, parts.status, parts.message, parts.error]
      .filter((part): part is string => typeof part === "string")
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
      "invalid credentials",
      "invalid password",
      "wrong password",
      "user not found",
      "credential account not found",
      "password not found",
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
    ])
  ) {
    return AUTH_ERROR_MESSAGES.retry;
  }

  return AUTH_ERROR_MESSAGES.retry;
}
