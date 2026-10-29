import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { DepartureGuardProvider } from "@school/shared/drafts";
import { StudentProfileEditor } from "../app/academic/students/components/StudentProfileEditor";

const mocks = vi.hoisted(() => ({ schoolId: "branch-school", read: vi.fn(), query: vi.fn(), archive: vi.fn(), other: vi.fn() }));
const client = { query: mocks.query };
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: mocks.schoolId }, effectiveCapabilities: [] } }) }));
vi.mock("convex/react", () => ({
  useConvex: () => client,
  useQuery: (...args: unknown[]) => mocks.read(...args),
  useMutation: (ref: FunctionReference<"mutation"> | string) => (typeof ref === "string" ? ref : getFunctionName(ref)).endsWith(":archiveStudent") ? mocks.archive : mocks.other,
  useAction: () => mocks.other,
}));
vi.mock("../app/academic/students/components/StudentPhotoPanel", () => ({ StudentPhotoPanel: () => null }));
vi.mock("../app/academic/students/components/PortalCredentialPanel", () => ({ PortalCredentialPanel: () => null }));
vi.mock("../app/academic/students/components/StudentFamilyPanel", () => ({ StudentFamilyPanel: () => null }));

const offer = { sessionId: "active-session", sessionName: "2026-2027", termId: "active-term", termName: "First term", classId: "stored-class", className: "JSS 1", reviewedKey: "review-1" };
const context = { schoolId: "branch-school", schoolName: "Branch School", studentId: "student", studentName: "Ada Cole", admissionNumber: "ADM-1", classId: "stored-class", className: "JSS 1", canArchiveAndExclude: true, unavailableReason: null, offer };
const profile = { _id: "student", userId: "user", email: "ada@example.test", name: "Ada Cole", displayName: "Ada Cole", firstName: "Ada", lastName: "Cole", middleName: null, admissionNumber: "ADM-1", classId: "stored-class", className: "JSS 1", activeSessionId: "active-session", houseName: null, gender: null, dateOfBirth: null, guardianName: null, guardianPhone: null, address: null, storedAddress: null, addressMode: null, addressSource: "none", emergencyContactMode: null, emergencyContact: { source: "legacy", name: null, phone: null }, photoUrl: null, photoFileName: null, photoContentType: null };
const otherProfile = { ...profile, _id: "another-student" };
const classes = [{ _id: "stored-class", name: "JSS 1", level: "JSS1" }, { _id: "unsaved-class", name: "JSS 2", level: "JSS2" }];
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function mount() {
  const onNotice = vi.fn(), onArchived = vi.fn();
  const editor = (id: string) => <DepartureGuardProvider><StudentProfileEditor studentId={id} classes={classes} onNotice={onNotice} onStudentArchived={onArchived} /></DepartureGuardProvider>;
  const view = render(editor("student"));
  return { ...view, onNotice, onArchived, switchTo: (id: string) => view.rerender(editor(id)) };
}
function open() { fireEvent.click(screen.getByRole("button", { name: "Archive Record" })); }
async function chooseCombined() {
  fireEvent.click(await screen.findByRole("radio", { name: "Archive and exclude from First term results" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Reason for exclusion" }), { target: { value: "Reviewed withdrawal this term" } });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.schoolId = "branch-school";
  mocks.read.mockImplementation((ref: unknown, args: unknown) => {
    if (typeof ref !== "string" || !ref.endsWith(":getStudentProfile") || !args || typeof args !== "object" || !("studentId" in args)) return undefined;
    return args.studentId === "student" ? profile : otherProfile;
  });
  mocks.query.mockResolvedValue(context);
  mocks.archive.mockResolvedValue(null);
});
afterEach(cleanup);

describe("student profile archive and result exclusion", () => {
  it("passes the selected school, defaults to archive only and does not wait for calendar loading", async () => {
    mocks.query.mockReturnValue(new Promise(() => {}));
    const { onArchived, onNotice } = mount(); open();
    expect(mocks.read).toHaveBeenCalledWith(expect.stringContaining(":getStudentProfile"), { studentId: "student", schoolId: "branch-school" });
    expect(getFunctionName(mocks.query.mock.calls[0][0])).toMatch(/:getStudentArchiveContext$/);
    expect(mocks.query.mock.calls[0][1]).toEqual({ studentId: "student", schoolId: "branch-school" });
    expect(screen.getByRole("radio", { name: "Archive only" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Archive and exclude/ })).toBeDisabled();
    expect(screen.getByText("Checking current term...")).toBeInTheDocument();
    expect(screen.getByText("This does not exclude the student from this term's results.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive student" }));
    await waitFor(() => expect(onArchived).toHaveBeenCalledWith("student"));
    expect(mocks.archive).toHaveBeenCalledOnce();
    expect(mocks.archive).toHaveBeenCalledWith({ studentId: "student", schoolId: "branch-school" });
    expect(onNotice).toHaveBeenCalledWith({ tone: "success", message: "Student archived." });
  });

  it("shows a denied context without disabling archive only or claiming an exclusion", async () => {
    mocks.query.mockRejectedValue(new Error("School admin access required"));
    mount(); open();
    expect(await screen.findByText("School admin access required")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Archive and exclude/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive student" })).toBeEnabled();
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it.each(["Current class results are already released", "Student is already excluded from this term", "Active term needs review"])("keeps archive only available when %s", async unavailableReason => {
    mocks.query.mockResolvedValue({ ...context, canArchiveAndExclude: false, unavailableReason, offer: unavailableReason.startsWith("Active") ? null : offer });
    mount(); open();
    expect(await screen.findByText(unavailableReason)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Archive and exclude/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Archive student" })).toBeEnabled();
  });

  it("reviews the stored tuple and persisted identity, validates reason length and sends one atomic request", async () => {
    const { onNotice } = mount();
    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Unsaved" } });
    fireEvent.change(screen.getByLabelText("Active Class"), { target: { value: "unsaved-class" } });
    open(); await chooseCombined();
    expect(screen.getByRole("dialog")).toHaveTextContent("Ada Cole, ADM-1");
    expect(screen.getByText("Branch School / JSS 1 / 2026-2027 / First term")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Existing records and released reports are kept.");
    expect(screen.getByRole("dialog")).toHaveTextContent("The student will not receive this class release, even if a report is certified.");
    expect(screen.getByRole("dialog")).toHaveTextContent("terms that begin after the archive date unless their records need review");
    const reason = screen.getByRole("textbox", { name: "Reason for exclusion" });
    for (const length of [9, 501]) {
      fireEvent.change(reason, { target: { value: "x".repeat(length) } });
      expect(screen.getByRole("button", { name: "Archive and exclude" })).toBeDisabled();
    }
    for (const length of [10, 500]) {
      fireEvent.change(reason, { target: { value: "x".repeat(length) } });
      expect(screen.getByRole("button", { name: "Archive and exclude" })).toBeEnabled();
    }
    fireEvent.change(reason, { target: { value: "  Reviewed withdrawal this term  " } });
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith({ tone: "success", message: "Student archived and excluded from First term results." }));
    expect(mocks.archive).toHaveBeenCalledOnce();
    expect(mocks.archive).toHaveBeenCalledWith({ studentId: "student", schoolId: "branch-school", resultExclusion: { sessionId: offer.sessionId, termId: offer.termId, classId: offer.classId, reviewedKey: offer.reviewedKey, reason: "Reviewed withdrawal this term" } });
    expect(mocks.other).not.toHaveBeenCalled();
  });

  it("omits result exclusion after changing back to archive only", async () => {
    mount(); open(); await chooseCombined();
    fireEvent.click(screen.getByRole("radio", { name: "Archive only" }));
    expect(screen.queryByRole("textbox", { name: "Reason for exclusion" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive student" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.archive).toHaveBeenCalledOnce();
    expect(mocks.archive).toHaveBeenCalledWith({ studentId: "student", schoolId: "branch-school" });
  });

  it.each(["Cancel", "Escape"])("%s closes without writes and restores the archive trigger", async action => {
    mount(); const trigger = screen.getByRole("button", { name: "Archive Record" }); trigger.focus(); open();
    await chooseCombined();
    if (action === "Cancel") fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    else fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mocks.archive).not.toHaveBeenCalled();
    open();
    await screen.findByRole("radio", { name: "Archive and exclude from First term results" });
    expect(screen.getByRole("radio", { name: "Archive only" })).toBeChecked();
    expect(screen.queryByRole("textbox", { name: "Reason for exclusion" })).not.toBeInTheDocument();
  });

  it("prevents dismissal, duplicate submission and option changes while pending", async () => {
    const request = deferred<null>(); mocks.archive.mockReturnValue(request.promise);
    mount(); open(); await chooseCombined();
    const submit = screen.getByRole("button", { name: "Archive and exclude" });
    fireEvent.click(submit); fireEvent.click(submit);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Archive only" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Reason for exclusion" })).toBeDisabled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.archive).toHaveBeenCalledOnce();
    await act(async () => request.resolve(null));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves a reason on ordinary validation error and shows no success", async () => {
    mocks.archive.mockRejectedValueOnce(new Error("Provide a specific reason (10-500 characters)"));
    const { onNotice, onArchived } = mount(); open(); await chooseCombined();
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Provide a specific reason");
    expect(screen.getByRole("textbox", { name: "Reason for exclusion" })).toHaveValue("Reviewed withdrawal this term");
    expect(onNotice).not.toHaveBeenCalled(); expect(onArchived).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Archive and exclude" })).toBeEnabled();
  });

  it.each(["Archive offer unavailable: A unique active academic session and term are required", "Archive offer unavailable: Current class needs review"]) ("requires a fresh explicit review when the active offer is invalidated: %s", async response => {
    const reason = response.replace("Archive offer unavailable: ", "");
    mocks.archive.mockRejectedValueOnce(new Error(response));
    mount(); open(); await chooseCombined();
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(reason);
    expect(screen.getByRole("alert")).not.toHaveTextContent("Archive offer unavailable");
    expect(screen.getByRole("textbox", { name: "Reason for exclusion" })).toHaveValue("Reviewed withdrawal this term");
    expect(screen.getByRole("button", { name: "Archive and exclude" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Check current term again" })).toBeInTheDocument();
    expect(mocks.archive).toHaveBeenCalledOnce();

    mocks.query.mockResolvedValue({ ...context, offer: { ...offer, termId: "fresh-term", termName: "Second term", reviewedKey: "fresh-review" } });
    fireEvent.click(screen.getByRole("button", { name: "Check current term again" }));
    const freshChoice = await screen.findByRole("radio", { name: "Archive and exclude from Second term results" });
    expect(screen.getByRole("radio", { name: "Archive only" })).toBeChecked();
    expect(freshChoice).not.toBeChecked();
    expect(mocks.archive).toHaveBeenCalledOnce();
    fireEvent.click(freshChoice);
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(2));
    expect(mocks.archive.mock.calls[1][0].resultExclusion).toMatchObject({ termId: "fresh-term", reviewedKey: "fresh-review" });
  });

  it.each(["Archive context changed; review again", "Current class results are already released", "Student is already excluded from this term"])("requires fresh explicit review after %s", async message => {
    mocks.archive.mockRejectedValueOnce(new Error(message));
    mount(); open(); await chooseCombined();
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Archive and exclude" })).toBeDisabled();
    expect(mocks.query).toHaveBeenCalledOnce();
    mocks.query.mockResolvedValue({ ...context, offer: { ...offer, termId: "new-term", termName: "Second term", reviewedKey: "review-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Check current term again" }));
    const newChoice = await screen.findByRole("radio", { name: "Archive and exclude from Second term results" });
    expect(screen.getByRole("radio", { name: "Archive only" })).toBeChecked();
    expect(newChoice).not.toBeChecked();
    fireEvent.click(newChoice);
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(2));
    expect(mocks.archive.mock.calls[1][0].resultExclusion).toMatchObject({ termId: "new-term", reviewedKey: "review-2" });
  });

  it.each(["student", "school"])("ignores a late archive response after a %s change without closing the new editor", async change => {
    const oldRequest = deferred<null>(); mocks.archive.mockReturnValueOnce(oldRequest.promise);
    const { switchTo, onNotice, onArchived } = mount(); open(); await chooseCombined();
    fireEvent.click(screen.getByRole("button", { name: "Archive and exclude" }));
    if (change === "school") mocks.schoolId = "another-school";
    switchTo(change === "student" ? "another-student" : "student");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    open();
    await act(async () => oldRequest.resolve(null));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Archive only" })).toBeChecked();
    expect(onNotice).not.toHaveBeenCalled(); expect(onArchived).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Archive student" })).toBeEnabled();
  });

  it("ignores a late context response from a cancelled review", async () => {
    const oldContext = deferred<typeof context>(); mocks.query.mockReturnValueOnce(oldContext.promise);
    mount(); open(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    mocks.query.mockResolvedValue({ ...context, canArchiveAndExclude: false, unavailableReason: "Active term needs review", offer: null });
    open(); expect(await screen.findByText("Active term needs review")).toBeInTheDocument();
    await act(async () => oldContext.resolve(context));
    expect(screen.getByRole("radio", { name: /Archive and exclude/ })).toBeDisabled();
    expect(screen.getByText("Active term needs review")).toBeInTheDocument();
  });
});
