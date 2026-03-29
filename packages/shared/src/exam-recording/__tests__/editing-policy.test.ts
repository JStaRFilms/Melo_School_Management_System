import { describe, expect, it } from "vitest";
import {
  resolveAssessmentEditingState,
  type AssessmentEditingPolicy,
} from "..";

const basePolicy: AssessmentEditingPolicy = {
  schoolId: "school_1",
  sessionId: "session_1",
  termId: "term_1",
  editingWindowEnabled: true,
  editingWindowStartsAt: 1_000,
  editingWindowEndsAt: 2_000,
  finalizationEnabled: true,
  finalizeAt: 2_500,
  createdAt: 500,
  updatedAt: 500,
  updatedBy: "user_1",
};

describe("resolveAssessmentEditingState", () => {
  it("allows editing when no policy exists", () => {
    const state = resolveAssessmentEditingState(null, 1_500);

    expect(state.canEdit).toBe(true);
    expect(state.lockReason).toBeNull();
  });

  it("blocks editing before the window starts", () => {
    const state = resolveAssessmentEditingState(basePolicy, 900);

    expect(state.canEdit).toBe(false);
    expect(state.lockReason).toBe("window_not_started");
  });

  it("allows editing while the window is open", () => {
    const state = resolveAssessmentEditingState(basePolicy, 1_500);

    expect(state.canEdit).toBe(true);
    expect(state.lockReason).toBeNull();
    expect(state.isWithinEditingWindow).toBe(true);
  });

  it("blocks editing after the window closes", () => {
    const state = resolveAssessmentEditingState(basePolicy, 2_100);

    expect(state.canEdit).toBe(false);
    expect(state.lockReason).toBe("window_closed");
  });

  it("prioritizes finalization over window status", () => {
    const state = resolveAssessmentEditingState(basePolicy, 2_700);

    expect(state.canEdit).toBe(false);
    expect(state.lockReason).toBe("finalized");
    expect(state.isFinalized).toBe(true);
  });
});
