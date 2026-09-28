// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NarrativeClassPrint } from "../app/assessments/report-cards/components/NarrativeClassPrint";

vi.mock("convex/react", () => ({ useQuery: () => ({ skipped: 1, reports: [{ issuedAt: 1750000000000, snapshot: {
  schoolName: "School", studentName: "Ada", admissionNumber: "A-1", className: "Former class",
  sessionName: "2025", termName: "First", subjects: [{ subjectId: "art", name: "Art", order: 0,
    comment: "A long comment.\n".repeat(120) }],
} }] }) }));
afterEach(cleanup);
it("prints only issued snapshots with skipped count and page-safe long comments", () => {
  const { container } = render(<NarrativeClassPrint classId="class" sessionId="session" termId="term" onExit={() => {}} />);
  expect(screen.getByText(/1 issued reports ready. 1 students skipped/)).toBeTruthy();
  expect(screen.getByText(/Former class · 2025/)).toBeTruthy();
  expect(container.querySelectorAll(".batch-sheet")).toHaveLength(1);
  expect(container.querySelector(".batch-sheet section p")?.textContent).toContain("A long comment.\nA long comment.");
  const css = container.querySelector("style")!.textContent!;
  expect(css).toContain("size: A4");
  expect(css).toContain(".batch-sheet * { color: #111827 !important; background: white !important; }");
  expect(css).toContain("section { break-inside: auto; }");
  expect(css).toContain("orphans: 3; widows: 3");
  expect(css).toContain("page-break-after: always");
  expect(container.textContent).not.toMatch(/draft|grade|score|rank/i);
});
