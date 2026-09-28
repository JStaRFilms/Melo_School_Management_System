// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortalWorkspaceData } from "@/portal-types";

const state = vi.hoisted(() => ({ workspace: null as unknown }));
vi.mock("convex/react", () => ({ useQuery: () => state.workspace, useAction: () => vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/report-cards", useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@school/shared", async importOriginal => ({
  ...await importOriginal<typeof import("@school/shared")>(),
  ReportCardToolbar: () => <div>Graded toolbar</div>,
  ReportCardPreview: () => <div>Graded sheet</div>,
}));
import { PortalWorkspaceContent } from "./PortalWorkspaceContent";

afterEach(cleanup);
const base = {
  school: { id: "school", name: "School", logoUrl: null, theme: { primaryColor: "#0f172a", accentColor: "#2563eb" } },
  viewer: { userId: "parent", name: "Parent", role: "parent", schoolId: "school" },
  students: [], selectedStudentId: "child", selectedSessionId: "session", selectedTermId: "term",
  selectedStudent: null, activeSession: null, activeTerm: null,
  history: [{ mode: "narrative", issued: false, sessionId: "session", termId: "term", sessionName: "2025", termName: "Term 1",
    classId: "class", className: "Nursery", generatedAt: 1, href: "/report-cards", note: "Report not ready" }],
  notifications: [], selectedReportMode: "narrative", selectedReportCard: null, selectedNarrativeReport: null,
} as unknown as PortalWorkspaceData;

describe("portal report dispatch", () => {
  it("shows neutral unissued results and report without print or numeric fallback", () => {
    state.workspace = base;
    const view = render(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByText("Report not ready")).toBeTruthy();
    expect(screen.queryByText(/Print issued report/)).toBeNull();
    expect(screen.queryByText("Graded sheet")).toBeNull();
    view.rerender(<PortalWorkspaceContent mode="results" />);
    expect(screen.getAllByText("Not ready").length).toBeGreaterThan(0);
    expect(screen.queryByText(/0 subjects/)).toBeNull();
    view.rerender(<PortalWorkspaceContent mode="dashboard" />);
    expect(screen.getByText(/The school has not published this term/)).toBeTruthy();
    expect(screen.queryByText(/scored an average/)).toBeNull();
  });
  it("shows issued subject comments, while graded reports retain the existing sheet", () => {
    state.workspace = { ...base, history: [{ ...base.history[0], issued: true }], selectedNarrativeReport: {
      issuedAt: 1750000000000, snapshot: { schoolName: "School", studentName: "Ada", admissionNumber: "A-01",
        className: "Nursery", sessionName: "2025", termName: "Term 1",
        subjects: [{ subjectId: "art", name: "Art", order: 0, comment: "Paints carefully." }],
      },
    } };
    const view = render(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByText("Paints carefully.")).toBeTruthy();
    expect(screen.getByText("Print issued report")).toBeTruthy();
    expect(screen.queryByText("Graded sheet")).toBeNull();
    state.workspace = { ...base, selectedReportMode: "graded", selectedNarrativeReport: null,
      history: [{ ...base.history[0], mode: "graded", totalSubjects: 1, recordedSubjects: 1, pendingSubjects: 0,
        averageScore: 80, totalScore: 80, resultCalculationMode: "standalone" }], selectedReportCard: { student: { name: "Ada" } } };
    view.rerender(<PortalWorkspaceContent mode="report-cards" />);
    expect(screen.getByText("Graded sheet")).toBeTruthy();
    expect(screen.queryByText("Paints carefully.")).toBeNull();
  });
});
