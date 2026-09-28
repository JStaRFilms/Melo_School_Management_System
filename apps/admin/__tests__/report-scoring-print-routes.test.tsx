import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportPage from "../app/assessments/report-cards/page";

const state = vi.hoisted(() => ({ batch: false, stale: false, print: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/assessments/report-cards",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`studentId=student1&sessionId=session1&termId=term1&classId=class1${state.batch ? "&printClass=1" : ""}`),
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string) => {
    const report = { student: { _id: "student1", name: "Student 1" }, classId: "class1", className: "Class 1", sessionName: "Session 1", termName: "Term 1", results: [],
      scoringPolicyWarning: state.stale ? "Issued report predates the completed regrade." : undefined };
    if (name.endsWith(":getStudentReportCard")) return report;
    if (name.endsWith(":getClassReportCards")) return [report];
    return [];
  },
}));
vi.mock("../app/assessments/report-cards/components/ReportCardAdminPanel", () => ({ ReportCardAdminPanel: () => null }));
vi.mock("@school/shared", async importOriginal => {
  const original = await importOriginal<typeof import("@school/shared")>();
  return { ...original, ReportCardBatchNavigator: () => null, ReportCardPreview: () => null,
    ReportCardToolbar: ({ onPrint }: { onPrint: () => void }) => <button onClick={onPrint}>Single print</button>,
    ReportCardBatchPrintStackV2: ({ onReady }: { onReady: () => void }) => <button onClick={onReady}>Batch ready</button> };
});
beforeEach(() => { state.batch = false; state.stale = false; state.print = vi.fn(); window.print = state.print; });

it("blocks single-print until the stale issued copy is acknowledged", () => {
  state.stale = true;
  render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Single print" }));
  expect(state.print).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  expect(state.print).toHaveBeenCalledOnce();
});

it("shows the batch warning before the auto-print trigger", () => {
  state.batch = true; state.stale = true;
  render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  expect(state.print).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});
