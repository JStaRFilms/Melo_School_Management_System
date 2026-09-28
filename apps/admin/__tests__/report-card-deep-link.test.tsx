// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminReportCardPage from "../app/assessments/report-cards/page";

const state = vi.hoisted(() => ({ inferred: { classId: "class", mode: "graded" } as { classId: string; mode: "graded" | "narrative" } | null, calls: [] as Array<{ name: string; args: unknown }> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/assessments/report-cards",
  useSearchParams: () => new URLSearchParams("studentId=student&sessionId=session&termId=term") }));
vi.mock("convex/react", () => ({ useQuery: (name: string, args: unknown) => {
  state.calls.push({ name, args });
  if (args === "skip") return undefined;
  if (name.endsWith("getStaffPeriodReportMode")) return state.inferred;
  if (name.endsWith("getStudentReportCard")) return { classId: "class", className: "Nursery", sessionName: "2025", termName: "First", student: { name: "Ada" }, results: [] };
  return [];
} }));
vi.mock("@school/shared", () => ({ ReportCardBatchNavigator: () => null, ReportCardBatchPrintStackV2: () => null,
  ReportCardPreview: () => <p>Graded preview</p>, ReportCardToolbar: () => null, ReportCardPrintBlockedNotice: () => null,
  buildReportCardExtrasHref: () => "#" }));
vi.mock("../app/assessments/report-cards/components/NarrativeReview", () => ({ NarrativeReview: () => <p>Narrative review</p> }));
vi.mock("../app/assessments/report-cards/components/ReportCardAdminPanel", () => ({ ReportCardAdminPanel: () => null }));
vi.mock("../app/assessments/report-cards/components/ReportCardLauncher", () => ({ ReportCardLauncher: () => null }));
vi.mock("../app/assessments/report-cards/components/NarrativeClassPrint", () => ({ NarrativeClassPrint: () => null }));
afterEach(() => { cleanup(); state.calls.length = 0; });
it("loads the graded builder only after resolving a verified legacy class", () => {
  state.inferred = { classId: "class", mode: "graded" };
  render(<AdminReportCardPage />);
  expect(screen.getByText("Graded preview")).toBeTruthy();
  expect(state.calls.find(call => call.name.endsWith("getStudentReportCard"))?.args).toMatchObject({ classId: "class" });
});
it("routes a no-class narrative link without querying any graded report", () => {
  state.inferred = { classId: "class", mode: "narrative" };
  render(<AdminReportCardPage />);
  expect(screen.getByText("Narrative review")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getStudentReportCard") && call.args !== "skip")).toBe(false);
});
it("asks for a class if no historical evidence exists", () => {
  state.inferred = null;
  render(<AdminReportCardPage />);
  expect(screen.getByText(/No verified class was found/)).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getStudentReportCard") && call.args !== "skip")).toBe(false);
});
