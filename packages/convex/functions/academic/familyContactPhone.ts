import { ConvexError } from "convex/values";

export function normalizeOptionalPhone(value: string | null | undefined) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("@") || /[a-zA-Z]/.test(trimmed)) {
    throw new ConvexError(
      "Contact phone number cannot contain letters or email addresses.",
    );
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new ConvexError(
      "Contact phone number must contain between 7 and 15 digits.",
    );
  }

  return trimmed;
}
