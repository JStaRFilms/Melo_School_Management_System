import type {
  AssessmentEditingPolicy,
  AssessmentEditingState,
} from "./types";

function getEffectivePolicyRange(policy: AssessmentEditingPolicy) {
  const hasLegacyFinalization =
    policy.finalizationEnabled && typeof policy.finalizeAt === "number";
  const hasWindow =
    policy.editingWindowEnabled &&
    typeof policy.editingWindowEndsAt === "number";

  return {
    enabled: hasWindow || hasLegacyFinalization,
    startsAt: policy.editingWindowStartsAt,
    endsAt: policy.editingWindowEndsAt ?? policy.finalizeAt,
  };
}

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function resolveAssessmentEditingState(
  policy: AssessmentEditingPolicy | null,
  now: number
): AssessmentEditingState {
  if (!policy) {
    return {
      hasPolicy: false,
      canEdit: true,
      lockReason: null,
      message: "Editing is open because no exam access policy has been set.",
      isWithinEditingWindow: true,
      isFinalized: false,
      evaluatedAt: now,
    };
  }

  const effectiveRange = getEffectivePolicyRange(policy);
  const editingWindowStartsAt = effectiveRange.startsAt;
  const editingWindowEndsAt = effectiveRange.endsAt;

  if (
    effectiveRange.enabled &&
    typeof editingWindowStartsAt === "number" &&
    now < editingWindowStartsAt
  ) {
    return {
      hasPolicy: true,
      canEdit: false,
      lockReason: "window_not_started",
      message: `Editing opens on ${formatDateTime(editingWindowStartsAt)}.`,
      isWithinEditingWindow: false,
      isFinalized: false,
      evaluatedAt: now,
    };
  }

  if (
    effectiveRange.enabled &&
    typeof editingWindowEndsAt === "number" &&
    now > editingWindowEndsAt
  ) {
    return {
      hasPolicy: true,
      canEdit: false,
      lockReason: policy.finalizationEnabled ? "finalized" : "window_closed",
      message: `Editing closed on ${formatDateTime(editingWindowEndsAt)}.`,
      isWithinEditingWindow: false,
      isFinalized: Boolean(policy.finalizationEnabled),
      evaluatedAt: now,
    };
  }

  const windowMessage =
    effectiveRange.enabled &&
    typeof editingWindowEndsAt === "number"
      ? `Editing is open until ${formatDateTime(editingWindowEndsAt)}.`
      : "Editing is currently open.";

  return {
    hasPolicy: true,
    canEdit: true,
    lockReason: null,
    message: windowMessage,
    isWithinEditingWindow: true,
    isFinalized: false,
    evaluatedAt: now,
  };
}
