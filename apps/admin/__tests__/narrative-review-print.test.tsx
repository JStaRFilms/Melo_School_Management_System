import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NarrativeReview } from "../app/assessments/report-cards/components/NarrativeReview";
import { deriveSchoolTheme } from "@school/shared/theme";

const state = vi.hoisted(() => ({ issued: false }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useQuery: () => ({
  status: state.issued ? "issued" : "draft", issuedAt: state.issued ? 1750000000000 : null,
  reviewedKey: state.issued ? null : "review", snapshot: {
    schoolName: "School", primaryColor: "#fefefe", accentColor: "#17324d", studentName: "Ada", admissionNumber: "A-01",
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
    const paper = view.container.querySelector<HTMLElement>(".narrative-review-paper")!;
    const theme = deriveSchoolTheme("#fefefe", "#17324d");
    expect(paper.style.getPropertyValue("--school-primary")).toBe(theme["--school-primary"]);
    expect(paper.style.getPropertyValue("--school-primary-contrast")).toBe(theme["--school-primary-contrast"]);
    expect(paper.style.getPropertyValue("--school-accent")).toBe(theme["--school-accent"]);
    expect(screen.getByText("Progress report").getAttribute("style")).toContain("var(--school-primary-contrast)");
    expect(screen.getByText("Art").getAttribute("style")).toContain("var(--school-accent)");
    const css = view.container.querySelector("style")?.textContent;
    expect(css).toContain("size: A4");
    expect(css).toContain("main * { color: #111827 !important; background: white !important; }");
    expect(css).toContain("border-color: #111827 !important");
    state.issued = true;
    view.rerender(<NarrativeReview studentId="child" classId="class" sessionId="session" termId="term" />);
    expect(screen.getByText("Print issued report")).toBeTruthy();
    expect(screen.queryByText(/Draft, not published/)).toBeNull();
  });
});
