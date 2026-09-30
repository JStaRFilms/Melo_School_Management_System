// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import TeacherReportCardPage from "../app/assessments/report-cards/page";

const state = vi.hoisted(() => ({ mode: "graded" as "graded" | "narrative", calls: [] as Array<{ name: string; args: unknown }> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/assessments/report-cards",
  useSearchParams: () => new URLSearchParams("studentId=student&sessionId=session&termId=term") }));
vi.mock("convex/react", () => ({ useQuery: (name: string, args: unknown) => {
  state.calls.push({ name, args });
  if (args === "skip") return undefined;
  if (name.endsWith("getStaffPeriodReportMode")) return { classId: "class", mode: state.mode };
  if (name.endsWith("getStudentReportCard")) return { classId: "class", className: "Nursery", sessionName: "2025", termName: "First", student: { name: "Ada" }, results: [] };
  return [];
} }));
vi.mock("@school/shared", () => ({ ReportCardBatchNavigator: () => null, ReportCardBatchPrintStackV2: () => null,
  ReportCardPreview: () => <p>Graded preview</p>, ReportCardToolbar: () => null, ReportCardPrintBlockedNotice: () => null,
  buildReportCardExtrasHref: () => "#" }));
afterEach(() => { cleanup(); state.calls.length = 0; });
it("opens the verified graded report from a teacher legacy link", () => {
  state.mode = "graded";
  render(<TeacherReportCardPage />);
  expect(screen.getByText("Graded preview")).toBeTruthy();
  expect(state.calls.find(call => call.name.endsWith("getStudentReportCard"))?.args).toMatchObject({ classId: "class" });
});
it("keeps a narrative legacy link away from graded printing", () => {
  state.mode = "narrative";
  render(<TeacherReportCardPage />);
  expect(screen.getByText(/This class uses subject comments/)).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getStudentReportCard") && call.args !== "skip")).toBe(false);
});
