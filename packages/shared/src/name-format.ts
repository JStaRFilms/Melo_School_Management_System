/**
 * Normalize a human-facing name into a consistent "title case" format.
 *
 * Rules:
 * - Trim and collapse whitespace.
 * - Title-case each token (capitalize the first letter after any non-letter boundary).
 * - Preserve short acronym-like tokens that are already uppercase (e.g., "JSS", "ICT", "1A").
 * - Do not attempt to be linguistically perfect (e.g., "McDonald" stays "Mcdonald").
 */

const ACRONYM_LIKE_MAX_LEN = 5;

export function humanNameTyping(input: string): string {
  return formatHumanName(input, false);
}

export function humanNameFinal(input: string): string {
  return formatHumanName(input, true);
}

export function normalizeHumanName(input: string): string {
  return humanNameFinal(input);
}

function formatHumanName(input: string, collapseWhitespace: boolean): string {
  const source = collapseWhitespace
    ? input.trim().replace(/\s+/g, " ")
    : input;

  if (!source) return "";

  return source.replace(/\S+/g, (token) => normalizeToken(token));
}

function normalizeToken(token: string): string {
  if (!token) return token;

  if (isRomanNumeral(token)) {
    return token.toUpperCase();
  }

  if (isAcronymLike(token)) {
    return token.toUpperCase();
  }

  return titleCaseToken(token);
}

function isRomanNumeral(token: string): boolean {
  // Keep very short roman numerals uppercase (e.g., "II", "IV", "X").
  if (token.length < 1 || token.length > 5) return false;
  return /^[IVXLCDM]+$/i.test(token);
}

function isAcronymLike(token: string): boolean {
  // Preserve tokens that are already uppercase letters/digits and short.
  // Examples: "JSS", "ICT", "SS1", "1A"
  if (token.length < 2 || token.length > ACRONYM_LIKE_MAX_LEN) return false;
  if (!/^[A-Za-z0-9]+$/.test(token)) return false;
  if (/[a-z]/.test(token)) return false;
  return /[A-Z]/.test(token);
}

function titleCaseToken(token: string): string {
  let out = "";
  let upperNext = true;

  for (const char of token) {
    if (isAsciiLetter(char)) {
      out += upperNext ? char.toUpperCase() : char.toLowerCase();
      upperNext = false;
      continue;
    }

    out += char;
    upperNext = true;
  }

  return out;
}

function isAsciiLetter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}
