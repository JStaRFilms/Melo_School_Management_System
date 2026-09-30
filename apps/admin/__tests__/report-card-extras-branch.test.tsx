import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExtrasPage from "../app/assessments/report-card-extras/page";

const mocks = vi.hoisted(() => ({
  branch: "branch-b", params: new URLSearchParams(), query: vi.fn(), save: vi.fn(), replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => mocks.params,
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({ workspaceAccess: mocks.branch
    ? { state: "ready", branch: { schoolId: mocks.branch }, effectiveCapabilities: ["academic.assessments.enter"] }
    : { state: "loading" } }),
}));
vi.mock("convex/react", () => ({ useQuery: mocks.query, useMutation: () => mocks.save }));
vi.mock("@/components/ui/AdminSurface", () => ({ AdminSurface: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/AdminHeader", () => ({ AdminHeader: () => null }));
vi.mock("../app/assessments/report-card-extras/components/ExtrasWorkspace", () => ({
  ExtrasWorkspace: ({ entry, reportCardHref, onSave }: { entry?: { studentName: string }; reportCardHref?: string; onSave: (values: []) => Promise<void> }) =>
    <div>{entry?.studentName}<a href={reportCardHref}>Report card</a><button onClick={() => void onSave([])}>Save extras</button></div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.branch = "branch-b";
  mocks.params = new URLSearchParams("schoolId=branch-b&sessionId=session-b&termId=term-b&classId=class-b&studentId=student-b");
  mocks.query.mockImplementation((ref: string, args: { schoolId?: string } | "skip") => {
    if (args === "skip") return undefined;
    if (ref.endsWith("getAdminSessions")) return [{ id: "session-b", name: "Session B" }];
    if (ref.endsWith("getTermsBySession")) return [{ id: "term-b", name: "Term B" }];
    if (ref.endsWith("getAllClasses")) return [{ id: "class-b", name: "Class B" }];
    if (ref.endsWith("getStudentsForReportCardBatch")) return [{ studentId: "student-b", studentName: "Pupil B", admissionNumber: "B-1" }];
    if (ref.endsWith("getStudentReportCardExtrasEntry")) return { studentName: "Pupil B", bundles: [], canEdit: true };
  });
});

describe("Admin report extras branch routing", () => {
  it("uses the workspace branch for all reads and keeps it in selector and report-card links", () => {
    render(<ExtrasPage />);
    for (const name of ["getAdminSessions", "getTermsBySession", "getAllClasses", "getStudentsForReportCardBatch", "getStudentReportCardExtrasEntry"]) {
      expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining(name), expect.objectContaining({ schoolId: "branch-b" }));
    }
    const report = new URL(screen.getByRole("link", { name: "Report card" }).getAttribute("href")!, "http://localhost");
    expect(report.searchParams.get("schoolId")).toBe("branch-b");
    expect(new URL(report.searchParams.get("returnTo")!, "http://localhost").searchParams.get("schoolId")).toBe("branch-b");
    fireEvent.click(screen.getByRole("button", { name: "Save extras" }));
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "branch-b", studentId: "student-b", bundleValues: [] }));
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "" } });
    expect(new URLSearchParams(mocks.replace.mock.calls.at(-1)![0].slice(1)).get("schoolId")).toBe("branch-b");
  });

  it("skips reads for a mismatched URL or while workspace access is loading", () => {
    mocks.params.set("schoolId", "branch-a");
    const view = render(<ExtrasPage />);
    expect(screen.getByText(/different branch/)).toBeInTheDocument();
    expect(mocks.query).toHaveBeenCalledTimes(5);
    expect(mocks.query.mock.calls.every(([, args]) => args === "skip")).toBe(true);
    mocks.query.mockClear();
    mocks.branch = "";
    view.rerender(<ExtrasPage />);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(screen.queryByText("Pupil B")).not.toBeInTheDocument();
  });

  it("clears the old tuple and stale editor when switching workspace branches", () => {
    const view = render(<ExtrasPage />);
    expect(screen.getByText("Pupil B")).toBeInTheDocument();
    mocks.query.mockClear();
    mocks.branch = "branch-a";
    view.rerender(<ExtrasPage />);
    expect(screen.queryByText("Pupil B")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/report-card-extras");
    expect(mocks.query.mock.calls.every(([, args]) => args === "skip")).toBe(true);
  });
});
