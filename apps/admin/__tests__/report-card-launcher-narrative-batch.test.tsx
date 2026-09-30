// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReportCardLauncher } from "../app/assessments/report-cards/components/ReportCardLauncher";

const state = vi.hoisted(() => ({ mode: "narrative" as "graded" | "narrative",
  roster: [] as Array<{ studentId: string; studentName: string; admissionNumber: string }>,
  push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }),
  useSearchParams: () => new URLSearchParams("sessionId=session&termId=term&classId=class") }));
vi.mock("convex/react", () => ({ useQuery: (name: string) => {
  if (name.endsWith("getAdminSessions")) return [{ id: "session", name: "2025" }];
  if (name.endsWith("getTermsBySession")) return [{ id: "term", name: "First" }];
  if (name.endsWith("getAllClasses")) return [{ id: "class", name: "Nursery" }];
  if (name.endsWith("getClassMode")) return state.mode;
  if (name.endsWith("getStudentsForReportCardBatch")) return state.roster;
  return undefined;
} }));
vi.mock("@/components/ui/AdminSurface", () => ({ AdminSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
afterEach(() => { cleanup(); state.push.mockClear(); state.mode = "narrative"; state.roster = []; });

it("offers issued narrative batch without a graded roster and never supplies a seed student", () => {
  render(<ReportCardLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Print issued reports" }));
  expect(state.push).toHaveBeenCalledWith("/assessments/report-cards?sessionId=session&termId=term&classId=class&printClass=1");
  expect(screen.getByText("No students found")).toBeTruthy();
  expect(screen.getByText(/Use Print issued reports to check published reports/)).toBeTruthy();
});
it("keeps graded batch tied to the graded student roster", () => {
  state.mode = "graded";
  const view = render(<ReportCardLauncher />);
  expect(screen.queryByRole("button", { name: "Print Class Batch" })).toBeNull();
  state.roster = [{ studentId: "student", studentName: "Ada", admissionNumber: "A-1" }];
  view.rerender(<ReportCardLauncher />);
  fireEvent.click(screen.getByRole("button", { name: "Print Class Batch" }));
  expect(state.push).toHaveBeenCalledWith("/assessments/report-cards?sessionId=session&termId=term&classId=class&studentId=student&printClass=1");
});
