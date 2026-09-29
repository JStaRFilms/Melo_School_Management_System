import type { ExamInputMode } from "./types";
import type { SessionScoringPolicy } from "./session-policy";

export interface ScoreRowPolicyRecord {
  examRawMaxSnapshot: number;
  assessmentPolicySnapshot?: Partial<SessionScoringPolicy> | null;
  sessionScoringPolicyVersion?: number;
}

/** Legacy saved rows keep their own maxima; new and versioned rows use the sheet policy. */
export function scoreRowPolicy(
  mode: ExamInputMode,
  policy?: SessionScoringPolicy,
  record?: ScoreRowPolicyRecord | null,
): SessionScoringPolicy {
  if (policy && (!record || (record.sessionScoringPolicyVersion ?? 0) > 0)) return policy;
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
  roster: readonly { assessmentRecord?: ScoreRowPolicyRecord | null }[],
): boolean {
  const sheetWeights = scoreRowPolicy(mode, policy);
  return sheetWeights.examRawMax !== sheetWeights.examContributionMax || roster.some(row => {
    const weights = scoreRowPolicy(mode, policy, row.assessmentRecord);
    return weights.examRawMax !== weights.examContributionMax;
  });
}
