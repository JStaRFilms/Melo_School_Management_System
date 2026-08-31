/**
 * Pure deterministic phone normalizer.
 * Normalizes Nigerian and international phone numbers into standard E.164 (+234...).
 * Returns null if the phone is invalid, empty, or junk without throwing.
 */

export function normalizePhoneNumber(rawPhone: unknown): string | null {
  if (typeof rawPhone !== "string" && typeof rawPhone !== "number") {
    return null;
  }

  const str = String(rawPhone).trim();
  if (!str) return null;

  // Filter out obvious placeholders
  const lower = str.toLowerCase();
  if (
    lower === "n/a" ||
    lower === "na" ||
    lower === "none" ||
    lower === "nil" ||
    lower === "null" ||
    lower === "unknown" ||
    lower === "-" ||
    lower === "--" ||
    lower === "0"
  ) {
    return null;
  }

  // Remove non-digit characters except leading '+'
  const hasPlus = str.startsWith("+");
  const digitsOnly = str.replace(/\D/g, "");

  if (!digitsOnly) return null;

  // Handle Nigerian phone numbers:
  // 1. 11 digits starting with 0 (e.g. 08031234567 -> +2348031234567)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return `+234${digitsOnly.slice(1)}`;
  }

  // 2. 13 digits starting with 234 (e.g. 2348031234567 -> +2348031234567)
  if (digitsOnly.length === 13 && digitsOnly.startsWith("234")) {
    return `+${digitsOnly}`;
  }

  // 3. 14 digits starting with 0234 (e.g. 02348031234567 -> +2348031234567)
  if (digitsOnly.length === 14 && digitsOnly.startsWith("0234")) {
    return `+${digitsOnly.slice(1)}`;
  }

  // 4. 10 digits starting with 7, 8, or 9 (e.g. 8031234567 -> +2348031234567)
  if (
    digitsOnly.length === 10 &&
    (digitsOnly.startsWith("7") ||
      digitsOnly.startsWith("8") ||
      digitsOnly.startsWith("9"))
  ) {
    return `+234${digitsOnly}`;
  }

  // Handle other valid international numbers (7 to 15 digits)
  if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    if (hasPlus) {
      return `+${digitsOnly}`;
    }
    // If it already starts with a common country code, e.g. 1 (US), 44 (UK), etc.
    if (digitsOnly.length >= 10) {
      return `+${digitsOnly}`;
    }
  }

  // Not a valid phone number
  return null;
}
