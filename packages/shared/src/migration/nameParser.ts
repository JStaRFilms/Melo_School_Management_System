/**
 * Pure deterministic name parser for student and guardian names.
 * Supports Nigerian, Anglo, and international formats:
 * - "ADEYEMI, Babatunde Tunde" -> lastName: "Adeyemi", firstName: "Babatunde", middleName: "Tunde"
 * - "Chukwuemeka Okonkwo" -> firstName: "Chukwuemeka", lastName: "Okonkwo"
 * - "Babatunde Tunde Adeyemi" -> firstName: "Babatunde", middleName: "Tunde", lastName: "Adeyemi"
 * - Compound prefixes (Abdullahi, Ibrahim, van der, etc.) and hyphenated names.
 */

export interface ParsedName {
  firstName: string;
  lastName: string;
  middleName?: string;
  fullName: string;
}

const KNOWN_SURNAME_PREFIXES = new Set([
  "van der",
  "van de",
  "van den",
  "van",
  "von",
  "de la",
  "de",
  "da",
  "del",
  "della",
  "di",
  "du",
  "le",
  "la",
  "al-",
  "el-",
  "bin",
  "ibn",
  "san",
  "st.",
  "st",
]);

export function cleanTitleCase(input: string): string {
  if (!input) return "";
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  return trimmed
    .split(" ")
    .map((word) => {
      // Handle hyphenated words (e.g., Okafor-Smith)
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => titleCaseWord(part))
          .join("-");
      }
      return titleCaseWord(word);
    })
    .join(" ");
}

function titleCaseWord(word: string): string {
  if (!word) return "";
  const lower = word.toLowerCase();
  if (lower.startsWith("al-") && lower.length > 3) {
    return "Al-" + titleCaseWord(lower.slice(3));
  }
  if (lower.startsWith("el-") && lower.length > 3) {
    return "El-" + titleCaseWord(lower.slice(3));
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Parses a raw name string into structured first, middle, and last name components.
 */
export function parseHumanName(rawName: string): ParsedName {
  if (!rawName || typeof rawName !== "string") {
    return { firstName: "", lastName: "", fullName: "" };
  }

  const trimmed = rawName.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { firstName: "", lastName: "", fullName: "" };
  }

  // Check for "SURNAME, First Middle" format
  if (trimmed.includes(",")) {
    const [lastPart, ...restParts] = trimmed.split(",");
    const lastName = cleanTitleCase(lastPart.trim());
    const rest = cleanTitleCase(restParts.join(" ").trim());
    const tokens = rest.split(" ").filter(Boolean);

    if (tokens.length === 0) {
      return {
        firstName: lastName,
        lastName: "",
        fullName: lastName,
      };
    }

    const firstName = tokens[0];
    const middleName = tokens.slice(1).join(" ") || undefined;
    const fullName = middleName
      ? `${firstName} ${middleName} ${lastName}`
      : `${firstName} ${lastName}`;

    return {
      firstName,
      lastName,
      middleName,
      fullName: cleanTitleCase(fullName),
    };
  }

  // No comma: tokenize
  const tokens = trimmed.split(" ").filter(Boolean);
  if (tokens.length === 1) {
    const single = cleanTitleCase(tokens[0]);
    return {
      firstName: single,
      lastName: "",
      fullName: single,
    };
  }

  if (tokens.length === 2) {
    const firstName = cleanTitleCase(tokens[0]);
    const lastName = cleanTitleCase(tokens[1]);
    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
    };
  }

  // 3 or more tokens: Check for multi-word surname prefix (e.g. "van der", "de la")
  for (let i = 0; i < tokens.length - 1; i++) {
    const prefixCandidate = tokens.slice(i, i + 2).join(" ").toLowerCase();
    if (KNOWN_SURNAME_PREFIXES.has(prefixCandidate)) {
      const firstName = cleanTitleCase(tokens.slice(0, i).join(" "));
      const lastName = cleanTitleCase(tokens.slice(i).join(" "));
      return {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
      };
    }
  }

  // Default 3+ tokens: "First Middle... Last"
  const firstName = cleanTitleCase(tokens[0]);
  const middleName = cleanTitleCase(tokens.slice(1, -1).join(" "));
  const lastName = cleanTitleCase(tokens[tokens.length - 1]);
  const fullName = `${firstName} ${middleName} ${lastName}`;

  return {
    firstName,
    lastName,
    middleName: middleName || undefined,
    fullName: cleanTitleCase(fullName),
  };
}
