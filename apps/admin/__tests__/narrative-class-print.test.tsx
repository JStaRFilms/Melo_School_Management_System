// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NarrativeClassPrint } from "../app/assessments/report-cards/components/NarrativeClassPrint";
import { deriveSchoolTheme } from "@school/shared/theme";

const state = vi.hoisted(() => ({ empty: false }));
vi.mock("convex/react", () => ({ useQuery: () => state.empty ? { skipped: 0, reports: [] } : { skipped: 1, reports: [{ issuedAt: 1750000000000, snapshot: {
  schoolName: "School", primaryColor: "#fefefe", accentColor: "#17324d", studentName: "Ada", admissionNumber: "A-1", className: "Former class",
  sessionName: "2025", termName: "First", subjects: [{ subjectId: "art", name: "Art", order: 0,
    comment: "A long comment.\n".repeat(120) }],
} }] } }));
afterEach(() => { cleanup(); state.empty = false; });
it("prints only issued snapshots with skipped count and page-safe long comments", () => {
  const { container } = render(<NarrativeClassPrint classId="class" sessionId="session" termId="term" onExit={() => {}} />);
  expect(screen.getByText(/1 issued reports ready. 1 students skipped/)).toBeTruthy();
  expect(screen.getByText(/Former class | 2025/)).toBeTruthy();
  expect(container.querySelectorAll(".batch-sheet")).toHaveLength(1);
  const paper = container.querySelector<HTMLElement>(".batch-sheet")!;
  const theme = deriveSchoolTheme("#fefefe", "#17324d");
  expect(paper.style.getPropertyValue("--school-primary")).toBe(theme["--school-primary"]);
  expect(paper.style.getPropertyValue("--school-primary-contrast")).toBe(theme["--school-primary-contrast"]);
  expect(paper.style.getPropertyValue("--school-accent")).toBe(theme["--school-accent"]);
  expect(screen.getByText("Progress report").getAttribute("style")).toContain("var(--school-primary-contrast)");
  expect(screen.getByText("Art").getAttribute("style")).toContain("var(--school-accent)");
  expect(container.querySelector(".batch-sheet section p")?.textContent).toContain("A long comment.\nA long comment.");
  const css = container.querySelector("style")!.textContent!;
  expect(css).toContain("size: A4");
  expect(css).toContain(".rc-no-print { display: none !important; }");
  expect(css).toContain(".batch-sheet * { color: #111827 !important; background: white !important; }");
  expect(css).toContain(".batch-sheet h2 { border-color: #111827 !important; }");
  expect(css).toContain("section { break-inside: auto; }");
  expect(css).toContain("orphans: 3; widows: 3");
  expect(css).toContain("page-break-after: always");
  expect(container.textContent).not.toMatch(/draft|grade|score|rank/i);
});
it("shows an empty issued batch safely without a paper or print action", () => {
  state.empty = true;
  const { container } = render(<NarrativeClassPrint classId="class" sessionId="session" termId="term" onExit={() => {}} />);
  expect(screen.getByRole("status").textContent).toContain("0 issued reports ready. 0 students skipped");
  expect(screen.queryByRole("button", { name: "Print issued class reports" })).toBeNull();
  expect(container.querySelector(".batch-sheet")).toBeNull();
});
