import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id, Doc } from "@school/convex/_generated/dataModel";
import { AdminSheet } from "../lib/components/ui/AdminSheet";
import { StudentLifecycleActionModal, type StudentLifecycleProfile } from "../app/academic/students/components/StudentLifecycleActionModal";
import { studentLifecycleActions } from "../app/academic/students/components/StudentLifecyclePanel";
import { StudentEnrollmentDirectory } from "../app/academic/students/components/StudentEnrollmentDirectory";
import { LifecycleEvents, LifecyclePeriods } from "../lib/components/lifecycle/LifecycleHistory";

const mocks = vi.hoisted(() => ({ transition: vi.fn(), loadMore: vi.fn(), paginated: vi.fn(), query: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.transition,
  useQuery: (ref: FunctionReference<"query">, args: unknown) => args === "skip" ? undefined : mocks.query(getFunctionName(ref), args),
  usePaginatedQuery: (ref: FunctionReference<"query">, args: unknown) => mocks.paginated(getFunctionName(ref), args),
}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" }, effectiveCapabilities: ["enrollment.intakes.manage"] } }) }));
vi.mock("@school/shared/toast", () => ({ appToast: { success: mocks.success, error: mocks.error } }));

const profile: StudentLifecycleProfile = {
  _id: "student" as Id<"students">, userId: "student-user" as Id<"users">, email: "student@test.invalid", name: "Ada Student", displayName: "Ada Student", firstName: "Ada", lastName: "Student", admissionNumber: "001", classId: "class" as Id<"classes">, className: "Primary 1", houseName: null, gender: null, dateOfBirth: null, guardianName: null, guardianPhone: null, address: null, photoUrl: null, photoFileName: null, photoContentType: null, enrollmentStatus: "withdrawn", enrollmentRevision: 3, graduatedAt: null, graduatingSessionId: null, graduatingSessionName: null, graduatingClassId: null, graduatingClassName: null,
};
function open(action: "withdraw" | "re_enrol" = "withdraw", props: StudentLifecycleProfile = profile) {
  const onClose = vi.fn(), onSaved = vi.fn();
  return { ...render(<StudentLifecycleActionModal profile={props} action={action} onClose={onClose} onSaved={onSaved} />), onClose, onSaved };
}
beforeEach(() => {
  mocks.query.mockImplementation((name: string) => {
    if (name.endsWith(":listClasses")) return [{ _id: "class", name: "Primary 1" }, { _id: "class-2", name: "Primary 2" }];
    if (name.endsWith(":listSessions")) return [{ _id: "session", name: "Current session", isActive: true }];
    if (name.endsWith(":listTermsBySession")) return [{ _id: "term", name: "Current term", isActive: true }];
    if (name.endsWith(":getClassSubjects")) return [{ subjectId: "subject", subjectName: "Mathematics" }];
    return { sessionId: "session", sessionName: "Current session", termName: "Current term", revision: 3 };
  });
  mocks.paginated.mockReturnValue({ results: [], status: "CanLoadMore", loadMore: mocks.loadMore });
  mocks.transition.mockResolvedValue({ status: "withdrawn", revision: 4 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("student lifecycle UI", () => {
  it.each([
    ["active", ["suspend", "withdraw"]], ["suspended", ["reinstate", "withdraw"]], ["withdrawn", ["re_enrol"]], ["graduated", []], ["transferred_out", []],
  ] as const)("offers only legal local actions for %s", (status, actions) => {
    expect(studentLifecycleActions(status)).toEqual(actions);
    expect(studentLifecycleActions(status, true)).toEqual([]);
  });

  it("finds inactive students with no class or session dependency and continues sparse pages", () => {
    const change = vi.fn(), select = vi.fn();
    const view = render(<StudentEnrollmentDirectory status="withdrawn" onStatusChange={change} selectedStudentId={null} onSelect={select} />);
    expect(mocks.paginated).toHaveBeenCalledWith("functions/academic/studentEnrollment:listStudentEnrollmentDirectory", { status: "withdrawn" });
    fireEvent.click(screen.getByRole("button", { name: "Load more students" }));
    expect(mocks.loadMore).toHaveBeenCalledWith(25);
    mocks.paginated.mockReturnValue({ results: [{ studentId: "student", studentName: "Ada Student", admissionNumber: "001", status: "withdrawn" }], status: "Exhausted", loadMore: mocks.loadMore });
    view.rerender(<StudentEnrollmentDirectory status="withdrawn" onStatusChange={change} selectedStudentId={null} onSelect={select} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "001" } });
    fireEvent.click(screen.getByRole("button", { name: /Ada Student/ }));
    expect(select).toHaveBeenCalledWith("student");
    fireEvent.change(screen.getByLabelText("Enrollment filter"), { target: { value: "suspended" } });
    expect(change).toHaveBeenCalledWith("suspended");
  });

  it("uses server default day and records configured context without manual session selection", async () => {
    const view = open();
    expect(screen.getByText(/server UTC today at save/)).toBeInTheDocument();
    expect(screen.getByText("Current session")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Family relocated" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
    expect(mocks.transition.mock.calls[0][0]).toMatchObject({ studentId: "student", expectedRevision: 3, action: "withdraw", reason: "Family relocated" });
    expect(mocks.transition.mock.calls[0][0]).not.toHaveProperty("effectiveDay");
  });

  it("requires a deliberate local class/subjects draft and passes a corrected past day only at confirmation", async () => {
    open("re_enrol");
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Returning to school" } });
    fireEvent.click(screen.getByLabelText("Mathematics"));
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Re-enroll" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Correct effective date"));
    fireEvent.change(screen.getByLabelText("Corrected effective day"), { target: { value: "2999-01-01" } });
    fireEvent.click(screen.getByLabelText(/I reviewed this class/));
    expect(screen.getByRole("button", { name: "Re-enroll" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Corrected effective day"), { target: { value: "2026-01-10" } });
    fireEvent.change(screen.getByLabelText("Return class"), { target: { value: "class-2" } });
    expect(screen.getByLabelText(/I reviewed this class/)).not.toBeChecked();
    expect(screen.getByLabelText("Mathematics")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Mathematics"));
    fireEvent.click(screen.getByLabelText(/I reviewed this class/));
    fireEvent.click(screen.getByRole("button", { name: "Re-enroll" }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledOnce());
    expect(mocks.transition.mock.calls[0][0]).toMatchObject({ effectiveDay: "2026-01-10", placement: { confirmed: true, classId: "class-2", subjectIds: ["subject"] } });
  });

  it("preserves the unchanged operation key and original revision after an uncertain response", async () => {
    mocks.transition.mockRejectedValueOnce(new Error("Network response lost"));
    const view = open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leaving now" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await screen.findByRole("alert");
    const first = mocks.transition.mock.calls[0][0];
    view.rerender(<StudentLifecycleActionModal profile={{ ...profile, enrollmentStatus: "active", enrollmentRevision: 5 }} action="withdraw" onClose={view.onClose} onSaved={view.onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
    expect(mocks.transition.mock.calls[1][0]).toEqual(first);
    expect(first.expectedRevision).toBe(3);
  });

  it("retains errors and refuses stale confirmation until the dialog is reviewed again", async () => {
    mocks.transition.mockRejectedValue(new Error("CONFLICT: enrollment revision changed"));
    open();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leaving now" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await screen.findByText(/review the refreshed status/);
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeDisabled();
    expect(screen.getByLabelText("Reason")).toHaveValue("Leaving now");
  });

  it("cancels by keyboard without writing, and cannot cancel a busy commit", async () => {
    const view = open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(view.onClose).toHaveBeenCalledOnce();
    expect(mocks.transition).not.toHaveBeenCalled();
    mocks.transition.mockReturnValue(new Promise(() => undefined));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leaving now" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(view.onClose).toHaveBeenCalledOnce();
  });

  it("keeps the mobile profile sheet open when cancelling or waiting for a lifecycle commit", async () => {
    const sheetClose = vi.fn(), modalClose = vi.fn();
    render(<AdminSheet isOpen onClose={sheetClose} title="Mobile profile"><StudentLifecycleActionModal profile={profile} action="withdraw" onClose={modalClose} onSaved={vi.fn()} /></AdminSheet>);
    await screen.findByRole("dialog", { name: "Mobile profile" });
    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    expect(modalClose).toHaveBeenCalledOnce();
    expect(sheetClose).not.toHaveBeenCalled();
    mocks.transition.mockReturnValue(new Promise(() => undefined));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leaving now" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    expect(modalClose).toHaveBeenCalledOnce();
    expect(sheetClose).not.toHaveBeenCalled();
  });

  it("shows unknown starts, both period gaps, same-day facts and evidenced report tuples", () => {
    const event: Doc<"studentEnrollmentEvents"> = { _id: "event" as Id<"studentEnrollmentEvents">, _creationTime: 1, studentId: profile._id, schoolId: "school" as Id<"schools">, classId: profile.classId, sessionId: "old-session" as Id<"academicSessions">, termId: "old-term" as Id<"academicTerms">, type: "suspend", afterStatus: "suspended", reason: "Travel", recordedAt: 1, effectiveDay: "2026-01-01", revision: 1, operationKey: "hidden-operation" };
    const base = { schoolId: event.schoolId, studentId: profile._id, classId: profile.classId };
    const periods: Doc<"studentEnrollmentPeriods">[] = [
      { ...base, _id: "p1" as Id<"studentEnrollmentPeriods">, _creationTime: 1, recordedAt: 1, startProvenance: "legacy_unknown", endDay: "2026-01-01", closedByEventId: event._id },
      { ...base, _id: "p2" as Id<"studentEnrollmentPeriods">, _creationTime: 2, recordedAt: 2, startProvenance: "recorded", startDay: "2026-02-01", endDay: "2026-03-01" },
      { ...base, _id: "p3" as Id<"studentEnrollmentPeriods">, _creationTime: 3, recordedAt: 3, startProvenance: "recorded", startDay: "2026-03-01", endDay: "2026-04-01" },
    ];
    render(<><LifecyclePeriods periods={periods} events={[event]} inactive /><LifecycleEvents events={[event]} /></>);
    expect(screen.getByText(/Start date unknown/)).toBeInTheDocument();
    expect(screen.getByText("Gap: 2026-01-01 to 2026-02-01")).toBeInTheDocument();
    expect(screen.getByText(/same-day return/)).toBeInTheDocument();
    expect(screen.getByText(/today, continuing/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /View report/ });
    expect(link.getAttribute("href")).toContain("sessionId=old-session&termId=old-term&classId=class");
    expect(screen.queryByText("hidden-operation")).not.toBeInTheDocument();
  });
});
