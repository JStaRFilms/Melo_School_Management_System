import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CertifyReportCard } from "../app/assessments/report-cards/components/CertifyReportCard";
import ReportCardPage from "../app/assessments/report-cards/page";
import type { Id } from "../../../packages/convex/_generated/dataModel";
import type { ReportCardSheetData } from "@school/shared";

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(), branch: "branch-b", query: vi.fn(), certify: vi.fn(), replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/assessments/report-cards",
  useSearchParams: () => mocks.params,
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({ workspaceAccess: mocks.branch
    ? { state: "ready", branch: { schoolId: mocks.branch } }
    : { state: "loading" } }),
}));
vi.mock("convex/react", () => ({ useQuery: mocks.query, useMutation: () => mocks.certify }));
vi.mock("@school/shared", () => ({
  ReportCardBatchNavigator: ({ extrasHref }: { extrasHref?: string }) => <span data-testid="extras-href">{extrasHref}</span>, ReportCardBatchPrintStackV2: () => null,
  ReportCardPreview: () => null, ReportCardToolbar: () => null,
  ReportCardPrintBlockedNotice: () => null, buildReportCardExtrasHref: () => "/assessments/report-card-extras?studentId=student-b",
}));
vi.mock("../app/assessments/report-cards/components/ReportCardLauncher", () => ({
  ReportCardLauncher: () => <p>Launcher</p>,
}));
vi.mock("../app/assessments/report-cards/components/ReportCardAdminPanel", () => ({
  ReportCardAdminPanel: () => null,
}));
vi.mock("@school/shared/exam-recording", () => ({ reportCardReviewKey: () => "review-key" }));

const sheet = {
  student: { _id: "student-b", admissionNumber: "B-100", name: "Student B" },
  classId: "class-b", className: "Class B", sessionName: "2026", termName: "First",
  summary: { pendingSubjects: 0 }, gradingPolicy: { source: "current" }, results: [],
} as unknown as ReportCardSheetData;
const selectedSchool = "branch-b" as Id<"schools">;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.branch = "branch-b";
  mocks.params = new URLSearchParams("schoolId=branch-b&studentId=student-b&classId=class-b&sessionId=session-b&termId=term-b");
  mocks.query.mockImplementation((ref, args) => args === "skip" ? undefined :
    String(ref).includes("getClassReportCards") || String(ref).includes("getStudentsForReportCardBatch") ? [] : sheet);
});

describe("report card branch handoff", () => {
  it("passes the selected school to preview, batch and class-print queries", async () => {
    mocks.params.set("printClass", "1");
    render(<ReportCardPage />);
    await waitFor(() => expect(mocks.query).toHaveBeenCalledWith(
      "functions/academic/reportCards:getStudentReportCard", expect.objectContaining({ schoolId: selectedSchool, studentId: "student-b" }),
    ));
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/reportCards:getStudentsForReportCardBatch",
      expect.objectContaining({ schoolId: selectedSchool, classId: "class-b" }));
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/reportCards:getClassReportCards",
      expect.objectContaining({ schoolId: selectedSchool, classId: "class-b" }));
  });

  it("includes the branch in the report-card extras link", () => {
    render(<ReportCardPage />);
    expect(screen.getByTestId("extras-href")).toHaveTextContent("/assessments/report-card-extras?studentId=student-b&schoolId=branch-b");
  });

  it("does not request or display a tuple from a link to another branch", () => {
    mocks.params.set("schoolId", "branch-a");
    render(<ReportCardPage />);
    expect(screen.getByText(/different branch/)).toBeInTheDocument();
    expect(mocks.query).not.toHaveBeenCalledWith("functions/academic/reportCards:getStudentReportCard", expect.any(Object));
    expect(screen.queryByText("Student B")).not.toBeInTheDocument();
  });

  it("removes the old tuple and skips requests on a branch change", () => {
    const { rerender } = render(<ReportCardPage />);
    mocks.query.mockClear();
    mocks.branch = "";
    rerender(<ReportCardPage />);
    expect(screen.getByText("Loading report card workspace...")).toBeInTheDocument();
    expect(mocks.query).not.toHaveBeenCalledWith("functions/academic/reportCards:getStudentReportCard", expect.any(Object));
    mocks.branch = "branch-a";
    rerender(<ReportCardPage />);
    expect(screen.getByText("Loading report card workspace...")).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/report-cards");
    expect(mocks.query).not.toHaveBeenCalledWith("functions/academic/reportCards:getStudentReportCard", expect.any(Object));
  });

  it("certifies the preview's selected branch, not a new or default branch", async () => {
    mocks.query.mockReturnValue(true);
    mocks.certify.mockResolvedValue(123);
    render(<CertifyReportCard schoolId={selectedSchool} reportCard={sheet} sessionId="session-b" termId="term-b" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "B-100" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm certification" }));
    await waitFor(() => expect(mocks.certify).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: selectedSchool, studentId: "student-b", classId: "class-b", reviewedKey: "review-key",
    })));
  });
});
