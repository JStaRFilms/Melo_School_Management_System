// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminReportCardPage from "../app/assessments/report-cards/page";

const state = vi.hoisted(() => ({ inferred: { classId: "class", mode: "graded" } as { classId: string; mode: "graded" | "narrative" } | null,
  params: "studentId=student&sessionId=session&termId=term", explicitMode: "narrative" as "graded" | "narrative" | undefined,
  calls: [] as Array<{ name: string; args: unknown }> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), usePathname: () => "/assessments/report-cards",
  useSearchParams: () => new URLSearchParams(state.params) }));
vi.mock("convex/react", () => ({ useQuery: (name: string, args: unknown) => {
  state.calls.push({ name, args });
  if (args === "skip") return undefined;
  if (name.endsWith("getStaffPeriodReportMode")) return state.inferred;
  if (name.endsWith("getClassMode")) return state.explicitMode;
  if (name.endsWith("getStudentReportCard")) return { classId: "class", className: "Nursery", sessionName: "2025", termName: "First", student: { name: "Ada" }, results: [] };
  return [];
} }));
vi.mock("@school/shared", () => ({ ReportCardBatchNavigator: () => null, ReportCardBatchPrintStackV2: () => null,
  ReportCardPreview: () => <p>Graded preview</p>, ReportCardToolbar: () => null, ReportCardPrintBlockedNotice: () => null,
  buildReportCardExtrasHref: () => "#" }));
vi.mock("../app/assessments/report-cards/components/NarrativeReview", () => ({ NarrativeReview: () => <p>Narrative review</p> }));
vi.mock("../app/assessments/report-cards/components/ReportCardAdminPanel", () => ({ ReportCardAdminPanel: () => null }));
vi.mock("../app/assessments/report-cards/components/ReportCardLauncher", () => ({ ReportCardLauncher: () => null }));
vi.mock("../app/assessments/report-cards/components/NarrativeClassPrint", () => ({ NarrativeClassPrint: ({ classId }: { classId: string }) => <p>Issued batch for {classId}</p> }));
afterEach(() => { cleanup(); state.calls.length = 0; state.params = "studentId=student&sessionId=session&termId=term"; state.explicitMode = "narrative"; });
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
it("loads issued narrative batch without a graded roster or seed student", () => {
  state.params = "sessionId=session&termId=term&classId=class&printClass=1";
  state.explicitMode = "narrative";
  render(<AdminReportCardPage />);
  expect(screen.getByText("Issued batch for class")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getStudentReportCard") && call.args !== "skip")).toBe(false);
  expect(state.calls.some(call => call.name.endsWith("getClassReportCards") && call.args !== "skip")).toBe(false);
  expect(state.calls.some(call => call.name.endsWith("getStudentsForReportCardBatch") && call.args !== "skip")).toBe(false);
});
it("waits for a positive mode before querying graded batch on a seedless narrative link", () => {
  state.params = "sessionId=session&termId=term&classId=class&printClass=1";
  state.explicitMode = undefined;
  const view = render(<AdminReportCardPage />);
  expect(screen.getByText("Checking reporting mode...")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getClassReportCards") && call.args !== "skip")).toBe(false);
  state.calls.length = 0;
  state.explicitMode = "narrative";
  view.rerender(<AdminReportCardPage />);
  expect(screen.getByText("Issued batch for class")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getClassReportCards") && call.args !== "skip")).toBe(false);
});
it("keeps a seed student requirement for graded batch printing", () => {
  state.params = "sessionId=session&termId=term&classId=class&printClass=1";
  state.explicitMode = "graded";
  render(<AdminReportCardPage />);
  expect(screen.queryByText("Issued batch for class")).toBeNull();
  expect(state.calls.some(call => call.name.endsWith("getStudentReportCard") && call.args !== "skip")).toBe(false);
});
it("asks for a class if no historical evidence exists", () => {
  state.inferred = null;
  render(<AdminReportCardPage />);
  expect(screen.getByText(/No verified class was found/)).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getStudentReportCard") && call.args !== "skip")).toBe(false);
});
