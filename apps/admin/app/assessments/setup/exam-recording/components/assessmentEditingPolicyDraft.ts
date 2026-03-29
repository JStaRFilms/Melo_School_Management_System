import type { AssessmentEditingPolicyResponse, Id } from "@/types";

export interface AssessmentEditingPolicyDraft {
  sessionId: Id<"academicSessions"> | null;
  termId: Id<"academicTerms"> | null;
  restrictionsEnabled: boolean;
  editingStartsAt: string;
  editingEndsAt: string;
}

export function toDateTimeInputValue(timestamp: number | null | undefined) {
  if (timestamp == null) {
    return "";
  }

  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function fromDateTimeInputValue(value: string) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function createAssessmentEditingPolicyDraft(
  sessionId: Id<"academicSessions"> | null,
  termId: Id<"academicTerms"> | null,
  policy?: AssessmentEditingPolicyResponse | null
): AssessmentEditingPolicyDraft {
  return {
    sessionId,
    termId,
    restrictionsEnabled:
      policy?.editingWindowEnabled || policy?.finalizationEnabled || false,
    editingStartsAt: toDateTimeInputValue(policy?.editingWindowStartsAt),
    editingEndsAt: toDateTimeInputValue(
      policy?.editingWindowEndsAt ?? policy?.finalizeAt
    ),
  };
}

export function buildAssessmentEditingPolicyMutationInput(
  draft: AssessmentEditingPolicyDraft
) {
  if (!draft.sessionId || !draft.termId) {
    throw new Error("Choose a session and term before saving exam access rules.");
  }

  return {
    sessionId: draft.sessionId,
    termId: draft.termId,
    editingWindowEnabled: draft.restrictionsEnabled,
    editingWindowStartsAt: draft.restrictionsEnabled
      ? fromDateTimeInputValue(draft.editingStartsAt)
      : null,
    editingWindowEndsAt: draft.restrictionsEnabled
      ? fromDateTimeInputValue(draft.editingEndsAt)
      : null,
    finalizationEnabled: false,
    finalizeAt: null,
  };
}

export function isAssessmentEditingPolicyDraftEqual(
  left: AssessmentEditingPolicyDraft,
  right: AssessmentEditingPolicyDraft
) {
  return (
      left.sessionId === right.sessionId &&
      left.termId === right.termId &&
      left.restrictionsEnabled === right.restrictionsEnabled &&
      left.editingStartsAt === right.editingStartsAt &&
      left.editingEndsAt === right.editingEndsAt
  );
}
