import { beforeEach, expect, it, vi } from "vitest";
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
vi.mock("@school/shared", async importOriginal => {
  const original = await importOriginal<typeof import("@school/shared")>();
  return { ...original, ReportCardBatchNavigator: () => null, ReportCardPreview: () => null,
    ReportCardToolbar: ({ onPrint }: { onPrint: () => void }) => <button onClick={onPrint}>Single print</button>,
    ReportCardBatchPrintStackV2: ({ onReady }: { onReady: () => void }) => <button onClick={onReady}>Batch ready</button> };
});
beforeEach(() => { state.batch = false; state.stale = false; state.student = "student1"; state.classId = "class1"; state.print = vi.fn(); state.replace = vi.fn(); window.print = state.print; vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; }); });

it("warns before printing a stale issued single report", () => {
  state.stale = true;
  render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Single print" }));
  expect(state.print).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  expect(state.print).toHaveBeenCalledOnce();
});

it("waits for the warning before batch auto-print, but prints unaffected batches", () => {
  state.batch = true; state.stale = true;
  const view = render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  expect(state.print).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  expect(state.print).toHaveBeenCalledOnce();
  view.unmount();
  state.stale = false;
  state.print.mockClear();
  render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(state.print).toHaveBeenCalledOnce();
});

it("does not print a new class with a previously acknowledged batch warning", () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  state.batch = true; state.stale = true;
  const view = render(<ReportPage />);
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  act(() => { frames.shift()!(0); }); // First frame ran; the second is still pending.
  state.classId = "class2";
  view.rerender(<ReportPage />);
  act(() => { while (frames.length) frames.shift()!(0); });
  expect(state.print).not.toHaveBeenCalled();
  expect(state.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Batch ready" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  act(() => { while (frames.length) frames.shift()!(0); });
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
