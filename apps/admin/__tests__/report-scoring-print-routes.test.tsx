import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import ReportPage from "../app/assessments/report-cards/page";

const state = vi.hoisted(() => ({ batch: false, stale: false, student: "student1", classId: "class1", print: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/assessments/report-cards",
  useRouter: () => ({ push: vi.fn(), replace: state.replace }),
  useSearchParams: () => new URLSearchParams(`studentId=${state.student}&sessionId=session1&termId=term1&classId=${state.classId}${state.batch ? "&printClass=1" : ""}`),
}));
vi.mock("convex/react", () => ({
  useQuery: (name: string) => {
    const report = { student: { _id: state.student, name: "Student 1" }, classId: state.classId, className: "Class 1", sessionName: "Session 1", termName: "Term 1", results: [],
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
beforeEach(() => { state.batch = false; state.stale = false; state.student = "student1"; state.classId = "class1"; state.print = vi.fn(); state.replace = vi.fn(); window.print = state.print; });
afterEach(() => { vi.useRealTimers(); });

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

it("does not print a new class with a previously acknowledged batch warning", () => {
  vi.useFakeTimers();
  state.batch = true; state.stale = true;
  const view = render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  state.classId = "class2";
  view.rerender(<ReportPage />);
  act(() => vi.runAllTimers());
  expect(state.print).not.toHaveBeenCalled();
  expect(state.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  act(() => vi.advanceTimersByTime(250));
  expect(state.print).toHaveBeenCalledOnce();
  act(() => window.dispatchEvent(new Event("afterprint")));
  expect(state.replace).toHaveBeenCalledOnce();
  view.unmount();
});

it("drops a pending single print when the student changes", () => {
  state.stale = true;
  const view = render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Single print" }));
  state.student = "student2";
  view.rerender(<ReportPage />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(state.print).not.toHaveBeenCalled();
});
