import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecisionWorkflow } from "@school/convex/functions/admissions/refs";
import { admissionsAdminErrorMessage } from "../app/admin/admissions/admissions-errors";
import { DecisionWorkflowSection, getDecisionControlVisibility, readinessBlockerMessage } from "../app/admin/admissions/[publicId]/DecisionWorkflowSection";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.mutate }));
vi.mock("@school/shared/toast", () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));

const inEvaluation: DecisionWorkflow = {
  decision: { decisionId: "decision-internal" as never, snapshotId: "snapshot-internal" as never, version: 3, state: "in_evaluation", reasonCode: null, guardianMessage: null, decidedAt: 1 },
  evaluations: [],
  readiness: { ready: false, acceptanceReady: false, blockers: ["DOCUMENT_REVIEW_PENDING:birth-certificate", "EVALUATION_PENDING"] },
};

function renderWorkflow(workflow: DecisionWorkflow, props: Partial<Parameters<typeof DecisionWorkflowSection>[0]> = {}) {
  return render(createElement(DecisionWorkflowSection, {
    schoolId: "school-internal" as never,
    applicationId: "application-internal" as never,
    applicationState: "under_review",
    workflow,
    canReviewDocuments: true,
    canDecide: true,
    canReopenFinalDecision: false,
    onFeedback: vi.fn(),
    ...props,
  }));
}

describe("admissions decision workflow", () => {
  beforeEach(() => mocks.mutate.mockReset().mockResolvedValue({ version: 4 }));

  it("maps freshness failures and readiness blockers to safe actionable copy", () => {
    expect(admissionsAdminErrorMessage(new Error('[CONVEX M(...)] ConvexError: {"code":"FRESH_AUTH_REQUIRED"} internal-id Called by client'))).toMatch(/Sign out, sign in again/i);
    expect(admissionsAdminErrorMessage(new Error("unexpected internal-id raw provider body"))).not.toMatch(/internal-id|provider body/i);
    expect(readinessBlockerMessage("DOCUMENT_REVIEW_PENDING:private-requirement-key")).toBe("A required document is awaiting a completed review.");
  });

  it("derives legal controls from workflow state and effective permissions", () => {
    expect(getDecisionControlVisibility({ applicationState: "submitted", decisionState: null, readinessReady: false, canReviewDocuments: false, canDecide: false, canReopenFinalDecision: false })).toEqual({ startReview: false, evaluation: false, markReady: false, decision: false, resumeWaitlist: false, reopen: false });
    expect(getDecisionControlVisibility({ applicationState: "submitted", decisionState: null, readinessReady: false, canReviewDocuments: true, canDecide: false, canReopenFinalDecision: false })).toMatchObject({ startReview: true });
    expect(getDecisionControlVisibility({ applicationState: "under_review", decisionState: null, readinessReady: false, canReviewDocuments: true, canDecide: false, canReopenFinalDecision: false })).toMatchObject({ startReview: true });
    expect(getDecisionControlVisibility({ applicationState: "under_review", decisionState: "in_evaluation", readinessReady: true, canReviewDocuments: true, canDecide: false, canReopenFinalDecision: false })).toMatchObject({ evaluation: true, markReady: true, decision: false });
    expect(getDecisionControlVisibility({ applicationState: "waitlisted", decisionState: "waitlisted", readinessReady: false, canReviewDocuments: false, canDecide: true, canReopenFinalDecision: false })).toMatchObject({ decision: false, resumeWaitlist: true });
    expect(getDecisionControlVisibility({ applicationState: "waitlisted", decisionState: "waitlisted", readinessReady: true, canReviewDocuments: false, canDecide: true, canReopenFinalDecision: false })).toMatchObject({ decision: true, resumeWaitlist: true, reopen: false });
    expect(getDecisionControlVisibility({ applicationState: "accepted", decisionState: "accepted", readinessReady: true, canReviewDocuments: false, canDecide: true, canReopenFinalDecision: true })).toMatchObject({ decision: false, reopen: true });
  });

  it("shows state, version, evaluations, and safe blockers without exposing IDs", () => {
    const view = renderWorkflow({ ...inEvaluation, evaluations: [{ evaluationId: "evaluation-internal" as never, type: "interview", state: "scheduled", scheduledAt: Date.parse("2027-01-02T10:00:00Z"), completedAt: null, resultCode: null, score: null, version: 2 }] });
    expect(screen.getByText(/Current state:/).closest("div")).toHaveTextContent(/in evaluation · version 3/i);
    expect(screen.getByText("A required document is awaiting a completed review.")).toBeInTheDocument();
    expect(screen.getByText("interview").closest("div")).toHaveTextContent(/interview.*scheduled.*version 2/i);
    expect(view.container).not.toHaveTextContent(/decision-internal|snapshot-internal|evaluation-internal|birth-certificate/);
  });

  it("wires bounded scheduled evaluation input and disables controls while busy", async () => {
    let finish: (() => void) | undefined;
    mocks.mutate.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderWorkflow(inEvaluation);
    fireEvent.change(screen.getByLabelText("Scheduled date and time"), { target: { value: "2027-02-03T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule evaluation" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school-internal", applicationId: "application-internal", type: "entrance_assessment", state: "scheduled", scheduledAt: expect.any(Number) })));
    expect(screen.getByRole("button", { name: "Schedule evaluation" })).toBeDisabled();
    finish?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "Schedule evaluation" })).not.toBeDisabled());
  });

  it("shows only legal outcomes and confirms before recording an immutable decision", async () => {
    renderWorkflow({ ...inEvaluation, decision: { ...inEvaluation.decision!, state: "ready_for_decision" }, readiness: { ready: true, acceptanceReady: false, blockers: [] } });
    const outcome = screen.getByLabelText("Outcome");
    expect(outcome).toHaveTextContent(/waitlisted/i);
    expect(outcome).toHaveTextContent(/rejected/i);
    expect(outcome).not.toHaveTextContent(/accepted/i);
    fireEvent.change(screen.getByLabelText("Reason code"), { target: { value: "CAPACITY" } });
    fireEvent.change(screen.getByLabelText("Guardian-safe message"), { target: { value: "The application is on the waitlist. This is not an offer." } });
    fireEvent.click(screen.getByRole("button", { name: "Review and record decision" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/immutable decision version/i);
    expect(screen.getByRole("dialog")).toHaveTextContent(/does not reserve a place/i);
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ state: "waitlisted", reasonCode: "CAPACITY", guardianMessage: expect.stringContaining("not an offer") })));
  });

  it("requires acceptance readiness for waitlist acceptance", () => {
    renderWorkflow({ ...inEvaluation, decision: { ...inEvaluation.decision!, state: "waitlisted" }, readiness: { ready: true, acceptanceReady: false, blockers: [] } }, { applicationState: "waitlisted" });
    const outcome = screen.getByLabelText("Outcome");
    expect(outcome).toHaveTextContent(/rejected/i);
    expect(outcome).not.toHaveTextContent(/accepted/i);
  });

  it("renders waitlist resume and manager reopen only in their legal states", () => {
    const waitlist = renderWorkflow({ ...inEvaluation, decision: { ...inEvaluation.decision!, state: "waitlisted" }, readiness: { ready: true, acceptanceReady: true, blockers: [] } }, { applicationState: "waitlisted", canReopenFinalDecision: false });
    expect(screen.getByRole("heading", { name: "Resume waitlisted evaluation" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Manager reopen" })).not.toBeInTheDocument();
    waitlist.unmount();
    renderWorkflow({ ...inEvaluation, decision: { ...inEvaluation.decision!, state: "rejected" } }, { applicationState: "rejected", canReopenFinalDecision: true });
    expect(screen.getByRole("heading", { name: "Manager reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resume waitlisted evaluation" })).not.toBeInTheDocument();
  });
});
