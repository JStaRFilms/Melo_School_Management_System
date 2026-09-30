import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportCardAdminPanel } from "../app/assessments/report-cards/components/ReportCardAdminPanel";
import type { Id } from "../../../packages/convex/_generated/dataModel";
import type { ReportCardSheetData } from "@school/shared";

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutations: new Map<string, ReturnType<typeof vi.fn>>() }));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: (ref: string) => mocks.mutations.get(ref),
}));
vi.mock("../app/assessments/report-cards/components/CertifyReportCard", () => ({ CertifyReportCard: () => null }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));

const sheet = { student: { nextTermBegins: null }, results: [], classId: "class-b" } as unknown as ReportCardSheetData;
const branch = "branch-b" as Id<"schools">;
const props = { schoolId: branch, studentId: "student-b", sessionId: "session-b", termId: "term-b", reportCard: sheet };
const settings = { termId: "term-b", termEndDate: 50, nextTermBegins: null, linkedNextTermName: null, defaultTimesSchoolOpened: 15, resultCalculationMode: "standalone", groups: [{ _id: "group-b", name: "Existing", classIds: ["class-b"], nextTermBegins: null, timesSchoolOpened: 9 }] };
const refs = {
  comments: "functions/academic/reportCards:saveStudentReportCardComments",
  defaults: "functions/academic/reportCardTermSettings:saveTermReportCardDefaults",
  saveGroup: "functions/academic/reportCardTermSettings:saveTermReportCardSettingGroup",
  deleteGroup: "functions/academic/reportCardTermSettings:deleteTermReportCardSettingGroup",
};

beforeEach(() => {
  mocks.query.mockReset();
  mocks.mutations.clear();
  for (const ref of Object.values(refs)) mocks.mutations.set(ref, vi.fn().mockResolvedValue(ref === refs.saveGroup ? "group-b" : null));
  mocks.query.mockImplementation((ref: string, args: { schoolId: string }) => {
    if (ref.endsWith("getTermReportCardSettings")) return args.schoolId === branch ? settings : undefined;
    if (ref.endsWith("getAllClasses")) return args.schoolId === branch ? [{ id: "class-b", name: "Class B" }] : undefined;
  });
});

describe("report card Admin panel selected branch", () => {
  it("scopes both queries and every write to the selected school", async () => {
    render(<ReportCardAdminPanel {...props} />);
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/reportCardTermSettings:getTermReportCardSettings", { schoolId: branch, termId: "term-b" });
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/adminSelectors:getAllClasses", { schoolId: branch });
    fireEvent.click(screen.getByRole("button", { name: "Save Comments" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Defaults" }));
    await waitFor(() => expect(mocks.mutations.get(refs.comments)).toHaveBeenCalledWith(expect.objectContaining({ schoolId: branch, studentId: "student-b" })));
    await waitFor(() => expect(mocks.mutations.get(refs.defaults)).toHaveBeenCalledWith(expect.objectContaining({ schoolId: branch, termId: "term-b" })));
    fireEvent.click(screen.getByRole("button", { name: "Existing" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Group" }));
    await waitFor(() => expect(mocks.mutations.get(refs.saveGroup)).toHaveBeenCalledWith(expect.objectContaining({ schoolId: branch, groupId: "group-b", classIds: ["class-b"] })));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(mocks.mutations.get(refs.deleteGroup)).toHaveBeenCalledWith({ schoolId: branch, groupId: "group-b" }));
  });

  it("clears edited comments and selected groups across a branch switch while settings load", () => {
    const view = render(<ReportCardAdminPanel {...props} />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Old branch draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Existing" }));
    expect(screen.getByText(/Edit "Existing"/)).toBeInTheDocument();
    mocks.query.mockClear();
    view.rerender(<ReportCardAdminPanel {...props} schoolId={"branch-c" as Id<"schools">} />);
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/reportCardTermSettings:getTermReportCardSettings", { schoolId: "branch-c", termId: "term-b" });
    expect(mocks.query).toHaveBeenCalledWith("functions/academic/adminSelectors:getAllClasses", { schoolId: "branch-c" });
    expect(screen.queryByText(/Edit "Existing"/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save Defaults" })).toBeDisabled();
  });
});
