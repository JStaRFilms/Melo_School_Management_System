import type { ExamInputMode } from "./types";
import type { SessionScoringPolicy } from "./session-policy";

/** A saved row keeps its own historical weights; unsaved rows use the sheet mode. */
export function scoreRowPolicy(
  mode: ExamInputMode,
  policy?: SessionScoringPolicy,
  record?: { examRawMaxSnapshot: number; assessmentPolicySnapshot?: Partial<SessionScoringPolicy> | null } | null,
): SessionScoringPolicy {
  if (policy) return policy;
  return {
    ca1Max: record?.assessmentPolicySnapshot?.ca1Max ?? 20,
    ca2Max: record?.assessmentPolicySnapshot?.ca2Max ?? 20,
    ca3Max: record?.assessmentPolicySnapshot?.ca3Max ?? 20,
    examRawMax: record?.examRawMaxSnapshot ?? (mode === "raw40" ? 40 : 60),
    examContributionMax: record?.assessmentPolicySnapshot?.examContributionMax ?? 40,
  };
}

export function scoreRosterHasScaledColumn(
  mode: ExamInputMode,
  policy: SessionScoringPolicy | undefined,
  roster: readonly { assessmentRecord?: { examRawMaxSnapshot: number; assessmentPolicySnapshot?: Partial<SessionScoringPolicy> | null } | null }[],
): boolean {
  return roster.length === 0
    ? scoreRowPolicy(mode, policy).examRawMax !== scoreRowPolicy(mode, policy).examContributionMax
    : roster.some(row => {
      const weights = scoreRowPolicy(mode, policy, row.assessmentRecord);
      return weights.examRawMax !== weights.examContributionMax;
    });
}
