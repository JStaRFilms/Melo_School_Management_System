import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NarrativeReview } from "../app/assessments/report-cards/components/NarrativeReview";

const state = vi.hoisted(() => ({ issued: false }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useQuery: () => ({
  status: state.issued ? "issued" : "draft", issuedAt: state.issued ? 1750000000000 : null,
  reviewedKey: state.issued ? null : "review", snapshot: {
    schoolName: "School", studentName: "Ada", admissionNumber: "A-01",
    className: "Nursery", sessionName: "2025", termName: "Term 1",
    subjects: [{ subjectId: "art", name: "Art", comment: "Paints carefully." }],
  },
}) }));
afterEach(cleanup);
describe("staff narrative print", () => {
  it("marks draft paper unpublished and separates issued print", () => {
    state.issued = false;
    const view = render(<NarrativeReview studentId="child" classId="class" sessionId="session" termId="term" />);
    expect(screen.getByText(/Draft, not published - not visible to families/)).toBeTruthy();
    expect(screen.queryByText("Print issued report")).toBeNull();
    expect(view.container.querySelector("style")?.textContent).toContain("size: A4");
    state.issued = true;
    view.rerender(<NarrativeReview studentId="child" classId="class" sessionId="session" termId="term" />);
    expect(screen.getByText("Print issued report")).toBeTruthy();
    expect(screen.queryByText(/Draft, not published/)).toBeNull();
  });
});
