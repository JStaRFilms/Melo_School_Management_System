import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { DepartureGuardProvider } from "@school/shared/drafts";
import StudentOnboardingPage from "../app/academic/students/onboarding/page";
import StudentsPage from "../app/academic/students/page";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), link: vi.fn(), action: vi.fn(), subjects: vi.fn(), closure: vi.fn(), restore: null as null | ((payload: unknown) => void),
  classes: [{ _id: "class-one", name: "Synthetic Class", level: "P1" }],
  profile: undefined as Record<string, unknown> | undefined,
  matrix: { subjects: [{ _id: "math", name: "Math", code: "MTH" }], students: [] as Array<Record<string, unknown>> },
  queryParams: "",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/academic/students", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(mocks.queryParams) }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school-one" }, effectiveCapabilities: [] }, session: { user: { id: "operator" } } }) }));
vi.mock("@/useDraftConnection", () => ({ useDraftConnection: () => ({ connected: true, authenticated: true, accountId: "operator" }) }));
vi.mock("@/usePersistentFormDraft", () => ({ usePersistentFormDraft: (options: { onRestore: (payload: unknown) => void }) => {
  mocks.restore = options.onRestore;
  return { status: "idle", lastSavedAt: null, memoryDraft: null, serverDraft: null, showRecoveryModal: false,
    retrySave: vi.fn().mockResolvedValue(undefined), prepareSubmission: mocks.closure,
    handleCommitDraft: vi.fn(), handleDiscardDraft: vi.fn().mockResolvedValue(undefined),
    submissionSucceeded: vi.fn(), submissionFailed: vi.fn(), previewLatest: vi.fn(), dismissRecoveryModal: vi.fn(), handleResumeDraft: vi.fn(),
    resumeMemoryDraft: vi.fn(), discardMemoryDraft: vi.fn() };
} }));
vi.mock("convex/react", () => ({
  useQuery: (reference: FunctionReference<"query"> | string, args: unknown) => {
    if (args === "skip") return undefined;
    const name = typeof reference === "string" ? reference : getFunctionName(reference);
    if (name.endsWith(":listClasses")) return mocks.classes;
    if (name.endsWith(":listSessions")) return [{ _id: "session-new", name: "Promoted session", isActive: true }];
    if (name.endsWith(":listTermsBySession")) return [];
    if (name.endsWith(":getClassStudentSubjectMatrix")) return mocks.matrix;
    if (name.endsWith(":getAdmissionNumberPolicy")) return { policy: null, version: 0 };
    if (name.endsWith(":getStudentProfile")) return mocks.profile;
    if (name.endsWith(":getStudentFamilyProfile")) return { family: null, parents: [], students: [] };
    if (name.endsWith(":getParentEmailReview")) return { matches: [{ userId: "parent-one", name: "Grace Anthony", email: "grace@example.test", phone: "+2348012345678", role: "parent", isArchived: false, families: [{ _id: "family", name: "Anthony household", residentialAddress: "Shared address", primaryContact: { userId: "parent-one", name: "Grace Anthony" }, contactAddressSource: "different", contactAddress: "Retained override" }] }] };
    if (name.endsWith(":searchParentContacts")) return { page: [{ userId: "parent-one", displayName: "Grace Anthony", email: "grace@example.test", phone: "+2348012345678", portalState: "provisioned", households: [{ name: "Anthony household" }] }], isDone: true };
    if (name.endsWith(":getPortalAccountState")) return { state: "provisioned", email: "stable@school.local" };
    return undefined;
  },
  useMutation: (reference: FunctionReference<"mutation"> | string) => {
    const name = typeof reference === "string" ? reference : getFunctionName(reference);
    return name.endsWith(":createStudent") ? mocks.create : name.endsWith(":upsertStudentFamilyLink") ? mocks.link : name.endsWith(":setStudentSubjectSelections") ? mocks.subjects : vi.fn();
  },
  useAction: () => mocks.action,
}));
vi.mock("../app/academic/students/components/StudentPhotoPanel", () => ({ StudentPhotoPanel: () => <p>Photo upload</p> }));
beforeEach(() => {
  mocks.create.mockResolvedValue("student-one"); mocks.closure.mockResolvedValue(null); mocks.queryParams = ""; mocks.profile = undefined;
  mocks.matrix.students = [];
  Object.defineProperty(window, "matchMedia", { writable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function fillStudent() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mary Jane" } });
  fireEvent.blur(screen.getByLabelText("First name"));
  expect(screen.getByLabelText("First name")).toHaveValue("Mary");
  expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Jane");
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "De la Cruz" } });
  fireEvent.change(screen.getByLabelText("Admission ID"), { target: { value: "TEST-1" } });
  fireEvent.change(screen.getByLabelText("Gender"), { target: { value: "Female" } });
  fireEvent.change(screen.getByLabelText("House"), { target: { value: "Blue" } });
  fireEvent.change(screen.getByLabelText("DOB"), { target: { value: "2014-05-15" } });
  fireEvent.change(screen.getByLabelText("Residential address"), { target: { value: "Captured student address" } });
  fireEvent.click(screen.getByLabelText("Use a different emergency contact"));
  fireEvent.change(screen.getByLabelText("Emergency contact name"), { target: { value: "Separate Contact" } });
  fireEvent.change(screen.getByLabelText("Emergency contact phone"), { target: { value: "+2348098765432" } });
  if (screen.queryByLabelText("Target class")) fireEvent.change(screen.getByLabelText("Target class"), { target: { value: "class-one" } });
}

for (const [entry, Page] of [["standalone student-first", StudentOnboardingPage], ["unified roster Quick/Family", StudentsPage]] as const) {
  it(`${entry} submits structured names and all captured fields in one atomic request`, async () => {
    render(<DepartureGuardProvider><Page /></DepartureGuardProvider>);
    fillStudent();
    fireEvent.change(screen.getByLabelText("Contact choice"), { target: { value: "existing" } });
    fireEvent.click(await screen.findByRole("button", { name: /Grace Anthony.*grace@example.test/ }));
    await screen.findByText("Linking this contact will not change their details or reset their credentials.");
    fireEvent.change(screen.getByLabelText("Relationship"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Custom relationship"), { target: { value: "Family friend" } });
    fireEvent.click(screen.getByRole("button", { name: "Admit student" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "Mary", middleName: "Jane", lastName: "De La Cruz", admissionNumber: "TEST-1", classId: "class-one",
      gender: "Female", houseName: "Blue", dateOfBirth: Date.UTC(2014, 4, 15), address: "Captured student address", addressMode: "residential",
      emergencyContactMode: "override", guardianName: "Separate Contact", guardianPhone: "+2348098765432",
      parentGuardian: { kind: "existing", parentUserId: "parent-one", relationship: "Family friend", isPrimaryContact: false, confirmPrimaryChange: false }, requestKey: expect.any(String),
    }));
    expect(mocks.link).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled();
    expect(screen.queryByText("Account Provisioned")).not.toBeInTheDocument();
  });

  it(`${entry} preserves household confirmation when retrying a lost committed response`, async () => {
    mocks.create
      .mockRejectedValueOnce(new Error("Review the duplicate-link details and confirm"))
      .mockRejectedValueOnce(new Error("Lost response"))
      .mockResolvedValueOnce("student-one");
    render(<DepartureGuardProvider><Page /></DepartureGuardProvider>);
    fillStudent();
    fireEvent.change(screen.getByLabelText("Contact choice"), { target: { value: "existing" } });
    fireEvent.click(await screen.findByRole("button", { name: /Grace Anthony.*grace@example.test/ }));
    fireEvent.click(screen.getByRole("button", { name: "Admit student" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", {
      name: entry === "standalone student-first" ? "Confirm household link" : "Confirm Link",
    }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    const retry = await screen.findByRole("button", { name: "Retry reviewed admission" });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3));
    const [unconfirmed, confirmed, replayed] = mocks.create.mock.calls;
    expect(unconfirmed[0].confirmDuplicateLink).toBeUndefined();
    expect(confirmed[0]).toMatchObject({ confirmDuplicateLink: true });
    expect(replayed[0]).toEqual(confirmed[0]);
    expect(confirmed[0].requestKey).toBe(unconfirmed[0].requestKey);
    expect(mocks.link).not.toHaveBeenCalled();
    expect(mocks.action).not.toHaveBeenCalled();
  });
}

it("retries a lost atomic response with identical reviewed intent, never a separate family write", async () => {
  mocks.create.mockRejectedValueOnce(new Error("Lost response")).mockResolvedValueOnce("student-one");
  render(<DepartureGuardProvider><StudentOnboardingPage /></DepartureGuardProvider>);
  fillStudent();
  fireEvent.click(screen.getByRole("button", { name: "Admit student" }));
  await screen.findByText(/A reviewed request is pending/);
  fireEvent.click(screen.getByRole("button", { name: "Retry reviewed admission" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
  expect(mocks.create.mock.calls[0][0]).toEqual(mocks.create.mock.calls[1][0]);
  expect(mocks.link).not.toHaveBeenCalled();
});

it("reviews an exact-email household without sending mistyped contact identity as an edit", async () => {
  mocks.create.mockRejectedValueOnce(new Error("Review the duplicate-link details and confirm")).mockRejectedValueOnce(new Error("Review the duplicate-link details and confirm")).mockResolvedValueOnce("student-one");
  render(<DepartureGuardProvider><StudentOnboardingPage /></DepartureGuardProvider>);
  fillStudent();
  fireEvent.change(screen.getByLabelText("Contact choice"), { target: { value: "new" } });
  fireEvent.change(screen.getByLabelText("Contact first name"), { target: { value: "Mistyped" } });
  fireEvent.change(screen.getByLabelText("Contact last name"), { target: { value: "Identity" } });
  fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "grace@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Use stored contact, keep their details" }));
  fireEvent.click(screen.getByRole("button", { name: "Admit student" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("First name")).toHaveValue("Mary");
  fireEvent.click(screen.getByRole("button", { name: "Retry reviewed admission" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Confirm household link" }));
  await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(3));
  expect(mocks.create.mock.calls[2][0]).toMatchObject({ parentGuardian: { kind: "existing", parentUserId: "parent-one" }, confirmDuplicateLink: true });
  expect(mocks.create.mock.calls[2][0].parentGuardian).not.toHaveProperty("firstName");
  expect(new Set(mocks.create.mock.calls.map(([args]) => args.requestKey)).size).toBe(1);
  expect(mocks.action).not.toHaveBeenCalled();
});

it("clears and reselects promoted-session subjects without opening or saving identity", async () => {
  mocks.queryParams = "classId=class-one&sessionId=session-new";
  mocks.matrix.students = [{ _id: "promoted-student", studentName: "Promoted Student", admissionNumber: "PROM-1", photoUrl: null, selectedSubjectIds: ["math"], promotionStatus: { isPromoted: true, targetClassId: "class-one", targetSessionId: "session-new" } }];
  const view = render(<DepartureGuardProvider><StudentsPage /></DepartureGuardProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
  await waitFor(() => expect(mocks.subjects).toHaveBeenCalledWith({ studentId: "promoted-student", classId: "class-one", sessionId: "session-new", subjectIds: [] }));
  mocks.matrix = { ...mocks.matrix, students: mocks.matrix.students.map(student => ({ ...student, selectedSubjectIds: [] })) };
  view.rerender(<DepartureGuardProvider><StudentsPage /></DepartureGuardProvider>);
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  await waitFor(() => expect(mocks.subjects).toHaveBeenCalledWith({ studentId: "promoted-student", classId: "class-one", sessionId: "session-new", subjectIds: ["math"] }));
  expect(mocks.create).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Save Identity" })).not.toBeInTheDocument();
});
