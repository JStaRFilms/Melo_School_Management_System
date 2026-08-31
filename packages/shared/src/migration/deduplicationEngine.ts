/**
 * Deduplication and Fuzzy Clash Intelligence Engine.
 * Uses Jaro-Winkler distance and multi-attribute weighted scoring to detect
 * duplicate students, sibling links, and name clashes across staged and live records.
 */

import { normalizePhoneNumber } from "./phoneNormalizer";

export interface CandidateRecord {
  firstName: string;
  lastName: string;
  middleName?: string;
  gender?: string;
  className?: string;
  guardianPhone?: string | null;
  admissionNumber?: string;
}

export interface ClashEvaluation {
  isClash: boolean;
  isWarning: boolean;
  confidence: number; // 0 to 100
  reason: string;
}

/**
 * Computes the standard Jaro Distance between two strings (0.0 to 1.0).
 */
export function jaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (!a.length || !b.length) return 0.0;

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);

    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }

  const m = matches;
  return (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3.0;
}

/**
 * Computes the Jaro-Winkler Distance with standard prefix scaling (p = 0.1, max 4 chars).
 */
export function jaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = jaroDistance(s1, s2);
  if (jaro < 0.7) return jaro;

  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(a.length, b.length));

  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return Math.min(1.0, jaro + prefix * prefixScale * (1.0 - jaro));
}

/**
 * Computes composite name similarity between two person names, accounting for
 * token reordering (e.g. "Tunde Adeyemi" vs "Babatunde Adeyemi").
 */
export function computeNameSimilarity(
  a: { firstName: string; lastName: string; middleName?: string },
  b: { firstName: string; lastName: string; middleName?: string }
): number {
  const fullA = [a.firstName, a.middleName, a.lastName].filter(Boolean).join(" ");
  const fullB = [b.firstName, b.middleName, b.lastName].filter(Boolean).join(" ");

  const directScore = jaroWinkler(fullA, fullB);

  // Inverted full name comparison ("Adeyemi Babatunde" vs "Babatunde Adeyemi")
  const fullAInv = [a.lastName, a.firstName, a.middleName].filter(Boolean).join(" ");
  const invScore = jaroWinkler(fullAInv, fullB);

  // Pairwise first & last score
  const firstScore = jaroWinkler(a.firstName, b.firstName);
  const lastScore = jaroWinkler(a.lastName, b.lastName);
  const crossFirstScore = jaroWinkler(a.firstName, b.lastName);
  const crossLastScore = jaroWinkler(a.lastName, b.firstName);

  const directPair = (firstScore + lastScore) / 2;
  const crossPair = (crossFirstScore + crossLastScore) / 2;

  return Math.max(directScore, invScore, directPair, crossPair);
}

/**
 * Evaluates duplicate/clash confidence between two candidate records.
 *
 * Scoring Weights:
 * - Name similarity: weight 0.40 (max 40 pts)
 * - Guardian phone match: weight +0.45 (+45 pts)
 * - Class name match: weight +0.35 (+35 pts)
 * - Gender match: weight +0.10 (+10 pts)
 *
 * Thresholds:
 * - >= 85%: High-confidence clash / duplicate candidate
 * - 50% - 84%: Ambiguous match -> warning requiring review
 * - < 50%: Distinct individual
 */
export function evaluateClash(
  recordA: CandidateRecord,
  recordB: CandidateRecord
): ClashEvaluation {
  let score = 0;
  const reasons: string[] = [];

  // Exact Admission Number match is an immediate 100% collision
  if (
    recordA.admissionNumber &&
    recordB.admissionNumber &&
    recordA.admissionNumber.trim().toLowerCase() ===
      recordB.admissionNumber.trim().toLowerCase()
  ) {
    return {
      isClash: true,
      isWarning: true,
      confidence: 100,
      reason: `Exact admission number collision: "${recordA.admissionNumber}"`,
    };
  }

  // 1. Name Similarity (Weight: 40)
  const nameSim = computeNameSimilarity(recordA, recordB);
  const namePoints = nameSim * 40;
  score += namePoints;

  if (nameSim >= 0.85) {
    reasons.push(`High name similarity (${Math.round(nameSim * 100)}%)`);
  } else if (nameSim >= 0.65) {
    reasons.push(`Moderate name similarity (${Math.round(nameSim * 100)}%)`);
  }

  // 2. Guardian Phone Match (Weight: 45)
  const phoneA = normalizePhoneNumber(recordA.guardianPhone);
  const phoneB = normalizePhoneNumber(recordB.guardianPhone);

  const hasPhoneMatch = Boolean(phoneA && phoneB && phoneA === phoneB);
  if (hasPhoneMatch) {
    score += 45;
    reasons.push("Identical guardian phone");
  }

  // 3. Class Name Match (Weight: 35)
  const classA = recordA.className?.trim().toLowerCase();
  const classB = recordB.className?.trim().toLowerCase();
  const hasClassMatch = Boolean(classA && classB && classA === classB);

  if (hasClassMatch) {
    score += 35;
    reasons.push(`Same class: "${recordA.className}"`);
  } else if (classA && classB && jaroWinkler(classA, classB) >= 0.8) {
    score += 15;
    reasons.push(`Similar class: "${recordA.className}" ~ "${recordB.className}"`);
  }

  // 4. Gender Match (Weight: 10)
  const genderA = recordA.gender?.trim().toLowerCase();
  const genderB = recordB.gender?.trim().toLowerCase();
  const hasValidGender =
    genderA &&
    genderB &&
    genderA !== "unspecified" &&
    genderB !== "unspecified";

  if (hasValidGender && genderA === genderB) {
    score += 10;
  }

  const confidence = Math.min(100, Math.round(score));
  const isHighConfidenceClash = confidence >= 85;
  const isWarning = confidence >= 50;

  return {
    isClash: isHighConfidenceClash,
    isWarning,
    confidence,
    reason: reasons.length > 0 ? reasons.join(", ") : "Low similarity",
  };
}

/**
 * Generates a deterministic family cluster key based on normalized guardian phone.
 */
export function generateFamilyClusterKey(
  guardianPhone: unknown
): string | undefined {
  const normalized = normalizePhoneNumber(guardianPhone);
  if (!normalized) return undefined;
  return `fam_${normalized.replace(/[^0-9]/g, "")}`;
}
