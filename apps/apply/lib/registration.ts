export type GuardianRegistration = {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

export function validateGuardianRegistration(input: GuardianRegistration): string[] {
  const errors: string[] = [];
  if (input.name.trim().length < 2) errors.push("Enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.push("Enter a valid email address.");
  if (input.password.length < 8) errors.push("Use a password with at least 8 characters.");
  if (input.password !== input.passwordConfirmation) errors.push("The passwords do not match.");
  return errors;
}

function authErrorText(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error.toLowerCase();
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  if (typeof error === "object") {
    const value = error as { code?: unknown; message?: unknown; status?: unknown; statusText?: unknown };
    return [value.code, value.message, value.status, value.statusText]
      .filter((part): part is string | number => typeof part === "string" || typeof part === "number")
      .join(" ")
      .toLowerCase();
  }
  return "";
}

export function guardianRegistrationErrorMessage(error: unknown): string {
  const text = authErrorText(error);
  if (/user.*already|already.*exist|email.*taken/.test(text)) return "An account already exists for this email. Sign in instead.";
  if (/password.*short|too short/.test(text)) return "Use a password with at least 8 characters.";
  if (/invalid.*email|email.*invalid/.test(text)) return "Enter a valid email address.";
  if (/origin|forbidden|403/.test(text)) return "Account creation is not available from this address. Refresh the page and try again.";
  if (/fetch|network|timeout|502|503|504/.test(text)) return "The account service is temporarily unavailable. Check your connection and try again.";
  return "We could not create your account. If this email is already registered, sign in instead.";
}
