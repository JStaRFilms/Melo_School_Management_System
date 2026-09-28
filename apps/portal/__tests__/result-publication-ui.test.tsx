// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortalWorkspaceData, PortalWorkspaceMode } from "../lib/portal-types";
import { PortalWorkspaceContent } from "../app/(portal)/components/portal-workspace/PortalWorkspaceContent";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), action: vi.fn(), replace: vi.fn(),
  params: new URLSearchParams("studentId=child&sessionId=current&termId=current-term"),
  pathname: "/results",
}));
vi.mock("convex/react", () => ({ useQuery: mocks.query, useAction: () => mocks.action }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock("@school/shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@school/shared")>();
  return {
    ...original,
    ReportCardToolbar: () => <div data-testid="print-toolbar">Print controls</div>,
    ReportCardPreview: () => <div data-testid="print-sheet">Issued sheet</div>,
  };
});

const child = {
  studentId: "child", userId: "user", name: "Ada Smith", admissionNumber: "001", classId: "class",
  className: "Year 1", schoolId: "school", schoolName: "Example School", schoolLogoUrl: null,
  relationship: null, photoUrl: null, isActive: true, enrollmentState: "active" as const,
};
const older = {
  sessionId: "older", termId: "older-term", sessionName: "2025", termName: "First term",
  classId: "class", className: "Year 1", generatedAt: 1, totalSubjects: 2,
  recordedSubjects: 2, pendingSubjects: 0, averageScore: 83, totalScore: 166,
  resultCalculationMode: "standalone" as const, href: "/report-cards", note: null,
};
function workspace(overrides: Partial<PortalWorkspaceData> = {}): PortalWorkspaceData {
  return {
    school: { id: "school", name: "Example School", logoUrl: null, theme: { primaryColor: "#000", accentColor: "#fff" } },
    viewer: { userId: "user", name: "Parent Smith", role: "parent", schoolId: "school" },
    students: [child], selectedStudentId: "child", selectedStudent: child,
    selectedSessionId: "current", selectedTermId: "current-term",
    activeSession: { id: "current", name: "2026" }, activeTerm: { id: "current-term", name: "Second term" },
    selectedResultState: "withheld", selectedReportCard: null, history: [older],
    notifications: [{ id: "event", title: "School event", body: "Sports day", tone: "info", href: null }],
    ...overrides,
  };
}
function show(mode: PortalWorkspaceMode, data: PortalWorkspaceData | undefined = workspace()) {
  mocks.query.mockReturnValue(data);
  return render(<PortalWorkspaceContent mode={mode} />);
}
function released(data = workspace()): PortalWorkspaceData {
  return workspace({
    ...data, selectedResultState: "released",
    selectedReportCard: {
      student: { _id: data.selectedStudentId, name: "Ada Smith" },
      sessionName: data.activeSession?.name, termName: data.activeTerm?.name,
      classId: "class", summary: { averageScore: 94, recordedSubjects: 2, pendingSubjects: 0 }, results: [],
    } as unknown as PortalWorkspaceData["selectedReportCard"],
  });
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/results";
  mocks.params = new URLSearchParams("studentId=child&sessionId=current&termId=current-term");
});

describe("family graded publication states", () => {
  it("keeps an older released average out of the withheld dashboard snapshot", () => {
    show("dashboard");
    expect(screen.getByText("Results for this term have not been published.")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.queryByText(/scored an average/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Full report/ })).not.toBeInTheDocument();
    expect(screen.getByText("School event")).toBeInTheDocument();
  });

  it("shows only released older history on desktop and mobile, without a current report action", () => {
    show("results");
    expect(screen.getByText("Published past results")).toBeInTheDocument();
    expect(screen.getByText("Results for this term have not been published.")).toBeInTheDocument();
    expect(screen.getAllByText("83")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Open report card" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2025" }));
    expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining("termId=older-term"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading results...");
    expect(screen.queryByText("83")).not.toBeInTheDocument();
  });

  it("does not render a sheet or print controls for withheld or no-eligible states", () => {
    const view = show("report-cards");
    expect(screen.getByText("Results for this term have not been published.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2025 · First term/ })).toBeInTheDocument();
    expect(screen.queryByTestId("print-sheet")).not.toBeInTheDocument();
    mocks.query.mockReturnValue(workspace({ selectedResultState: "no_eligible_record", history: [] }));
    view.rerender(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByText("No report card is available for this enrollment.")).toBeInTheDocument();
    expect(screen.queryByTestId("print-toolbar")).not.toBeInTheDocument();
  });

  it("renders the matching issued sheet but rejects a different student's cached sheet", () => {
    const view = show("report-cards", released());
    expect(screen.getByTestId("print-sheet")).toBeInTheDocument();
    mocks.query.mockReturnValue(released(workspace({ selectedStudentId: "other" })));
    view.rerender(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results...");
    expect(screen.queryByTestId("print-sheet")).not.toBeInTheDocument();
  });

  it("clears prior child results and result notifications before navigation resolves", () => {
    const other = { ...child, studentId: "other", name: "Bea Smith" };
    const view = show("notifications", released(workspace({ students: [child, other], notifications: [
      { id: "comment", title: "A class comment is attached", body: "Open report", tone: "info", href: "/report-cards" },
    ] })));
    expect(screen.getByText("A class comment is attached")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bea/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Loading results...");
    expect(screen.queryByText("A class comment is attached")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith(expect.not.stringContaining("termId="));
    mocks.params = new URLSearchParams("studentId=other");
    view.rerender(<PortalWorkspaceContent mode="notifications" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("opens the older issued sheet only after the URL and response select that term", () => {
    const view = show("report-cards");
    fireEvent.click(screen.getByRole("button", { name: /2025 · First term/ }));
    expect(screen.queryByTestId("print-sheet")).not.toBeInTheDocument();
    mocks.params = new URLSearchParams("studentId=child&sessionId=older&termId=older-term");
    view.rerender(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading results...");
    mocks.query.mockReturnValue(workspace({
      ...released(workspace({
        selectedSessionId: "older", selectedTermId: "older-term",
        activeSession: { id: "older", name: "2025" }, activeTerm: { id: "older-term", name: "First term" },
      })),
      activeSession: { id: "current", name: "2026" }, activeTerm: { id: "current-term", name: "Second term" },
    }));
    view.rerender(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByTestId("print-sheet")).toBeInTheDocument();
  });

  it("offers the selected report link only for a matching released result", () => {
    show("results", released());
    expect(screen.getByRole("link", { name: /Open report card/ })).toHaveAttribute("href", expect.stringContaining("termId=current-term"));
  });
});
