import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportCardLauncher } from "../app/assessments/report-cards/components/ReportCardLauncher";
import type { Id } from "../../../packages/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({ query: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mocks.params,
}));
vi.mock("convex/react", () => ({ useQuery: mocks.query }));
vi.mock("@school/shared", () => ({ Avatar: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = new URLSearchParams("schoolId=branch-a&sessionId=session-a&termId=term-a&classId=class-a");
});

describe("report card launcher branch options", () => {
  it("requests selected-branch selectors and never fetches or shows the old roster during a switch", async () => {
    let ready = false;
    mocks.query.mockImplementation((ref: string, args: { schoolId?: string; sessionId?: string } | "skip") => {
      if (args === "skip") return undefined;
      if (args.schoolId === "branch-a") {
        if (ref.endsWith("getAdminSessions")) return [{ id: "session-a", name: "Session A" }];
        if (ref.endsWith("getTermsBySession")) return [{ id: "term-a", name: "Term A" }];
        if (ref.endsWith("getAllClasses")) return [{ id: "class-a", name: "Class A" }];
        if (ref.endsWith("getStudentsForReportCardBatch")) return [{ studentId: "student-a", studentName: "Branch A Student", admissionNumber: "A-1" }];
      }
      if (args.schoolId !== "branch-b") return undefined;
      if (ref.endsWith("getAdminSessions")) return ready ? [{ id: "session-b", name: "Session B" }] : undefined;
      if (ref.endsWith("getTermsBySession")) return ready ? [{ id: "term-b", name: "Term B" }] : undefined;
      if (ref.endsWith("getAllClasses")) return ready ? [{ id: "class-b", name: "Class B" }] : undefined;
      if (ref.endsWith("getStudentsForReportCardBatch")) return [{ studentId: "student-b", studentName: "Branch B Student", admissionNumber: "B-1" }];
    });
    const schoolId = "branch-b" as Id<"schools">;
    const view = render(<ReportCardLauncher key="branch-a" schoolId={"branch-a" as Id<"schools">} />);
    expect(screen.getByText("Branch A Student")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Term Defaults & Remarks/ }).getAttribute("href"))
      .toContain("schoolId=branch-a");
    mocks.query.mockClear();
    view.rerender(<ReportCardLauncher key={schoolId} schoolId={schoolId} />);
    expect(screen.queryByText("Branch A Student")).not.toBeInTheDocument();
    expect(screen.queryByText("Session A")).not.toBeInTheDocument();
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/adminSelectors:getAdminSessions", { schoolId });
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/adminSelectors:getAllClasses", { schoolId });
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/adminSelectors:getTermsBySession", "skip");
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/reportCards:getStudentsForReportCardBatch", "skip");
    expect(screen.queryByText("Branch B Student")).not.toBeInTheDocument();
    ready = true;
    view.rerender(<ReportCardLauncher key={schoolId} schoolId={schoolId} />);
    await waitFor(() => expect(mocks.query).toHaveBeenCalledWith("functions/academic/adminSelectors:getTermsBySession", { schoolId, sessionId: "session-b" }));
    await waitFor(() => expect(mocks.query).toHaveBeenCalledWith("functions/academic/reportCards:getStudentsForReportCardBatch", {
      schoolId, sessionId: "session-b", termId: "term-b", classId: "class-b",
    }));
    expect(screen.getByText("Branch B Student")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Term Defaults & Remarks/ }).getAttribute("href"))
      .toContain("schoolId=branch-b");
    expect(screen.queryByText("Session A")).not.toBeInTheDocument();
  });
});
