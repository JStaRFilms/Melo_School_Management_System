import type { GradingBand, ValidationError } from "./types";
import { deriveGradeAndRemark, round } from "./calculations";

export interface SessionScoringPolicy {
  ca1Max: number;
  ca2Max: number;
  ca3Max: number;
  examRawMax: number;
  examContributionMax: number;
}

export const SESSION_SCORING_PRESETS: readonly SessionScoringPolicy[] = [
  { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 },
  { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 60, examContributionMax: 40 },
  { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 50, examContributionMax: 50 },
];

export function sessionScoringSnapshotMode(policy: SessionScoringPolicy): "raw40" | "raw60_scaled_to_40" | "custom" {
  if (policy.examRawMax === 40 && policy.examContributionMax === 40) return "raw40";
  if (policy.examRawMax === 60 && policy.examContributionMax === 40) return "raw60_scaled_to_40";
  return "custom";
}

export function validateSessionScoringPolicy(policy: SessionScoringPolicy): string[] {
  const errors: string[] = [];
  for (const field of ["ca1Max", "ca2Max", "ca3Max", "examRawMax", "examContributionMax"] as const) {
    const value = policy[field];
    if (!Number.isFinite(value) || value < 0 || (field === "examRawMax" && value === 0) || value > 100 ||
      Math.abs(Math.round(value * 100) - value * 100) > 1e-8) {
      errors.push(`${field} must be between ${field === "examRawMax" ? "0 (exclusive)" : "0"} and 100 with at most two decimal places`);
    }
  }
  if (Math.abs(policy.ca1Max + policy.ca2Max + policy.ca3Max + policy.examContributionMax - 100) > 1e-8) {
    errors.push("CA and exam contributions must total 100");
  }
  return errors;
}

export function validateScoresForPolicy(
  scores: { ca1: number; ca2: number; ca3: number; examRawScore: number },
  policy: SessionScoringPolicy,
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const [field, max] of [
    ["ca1", policy.ca1Max], ["ca2", policy.ca2Max], ["ca3", policy.ca3Max], ["examRawScore", policy.examRawMax],
  ] as const) {
    const value = scores[field];
    if (!Number.isFinite(value) || value < 0 || value > max) {
      errors.push({ field, message: `${field} must be between 0 and ${max}` });
    }
  }
  return errors;
}

export function deriveForSessionPolicy(
  scores: { ca1: number; ca2: number; ca3: number; examRawScore: number },
  policy: SessionScoringPolicy,
  bands: GradingBand[],
) {
  const caTotal = round(scores.ca1 + scores.ca2 + scores.ca3, 2);
  const examScaledScore = round(scores.examRawScore / policy.examRawMax * policy.examContributionMax, 2);
  const total = round(caTotal + examScaledScore, 2);
  return { caTotal, examScaledScore, total, ...deriveGradeAndRemark(total, bands) };
}
