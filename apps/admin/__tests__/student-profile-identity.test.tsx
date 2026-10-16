import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { DepartureGuardProvider } from "@school/shared/drafts";
import { StudentProfileEditor } from "../app/academic/students/components/StudentProfileEditor";
import { StudentUnifiedEditorSheet } from "../app/academic/students/components/StudentUnifiedEditorSheet";

const mocks = vi.hoisted(() => ({ update: vi.fn(), query: vi.fn(), capabilities: [] as string[], profile: {
  _id: "student", userId: "user", email: "persisted@school.local", name: "Mary Jane De La Cruz", displayName: "Mary Jane De La Cruz",
  firstName: "Mary" as string | null, middleName: "Jane" as string | null, lastName: "De La Cruz" as string | null,
  enrollmentStatus: "active", enrollmentRevision: 0,
  admissionNumber: "ADM-1", classId: "promoted", className: "Promoted class", activeSessionId: "session-new" as string | null,
  gender: "Female", houseName: "Blue", dateOfBirth: Date.UTC(2014, 4, 15),
  guardianName: "Recorded Guardian", guardianPhone: "legacy phone", address: "Household address", storedAddress: "Retained address", addressMode: "residential", addressSource: "residential",
  emergencyContactMode: null, emergencyContact: { source: "legacy", name: "Recorded Guardian", phone: "legacy phone" },
  photoUrl: "https://example.test/photo.jpg", photoFileName: "photo.jpg", photoContentType: "image/jpeg",
} }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" }, effectiveCapabilities: mocks.capabilities } }) }));
vi.mock("convex/react", () => ({
  useQuery: (reference: string | FunctionReference<"query">, args: unknown) => {
    if (args === "skip") return undefined;
    const name = typeof reference === "string" ? reference : getFunctionName(reference);
    mocks.query(name, args);
    if (name.endsWith(":getStudentProfile")) return mocks.profile;
    return undefined;
  },
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
  useMutation: (reference: string | FunctionReference<"mutation">) => (typeof reference === "string" ? reference : getFunctionName(reference)).endsWith(":updateStudent") ? mocks.update : vi.fn(),
  useAction: () => vi.fn(),
}));
vi.mock("../app/academic/students/components/StudentPhotoPanel", () => ({ StudentPhotoPanel: ({ previewUrl }: { previewUrl: string }) => <img alt="Retained photo" src={previewUrl} /> }));
const classes = [{ _id: "promoted", name: "Promoted class", level: "P2" }, { _id: "other", name: "Other class", level: "P3" }];
beforeEach(() => { mocks.query.mockClear(); mocks.capabilities = []; mocks.profile.enrollmentStatus = "active"; mocks.profile.activeSessionId = "session-new"; mocks.profile.firstName = "Mary"; mocks.profile.middleName = "Jane"; mocks.profile.lastName = "De La Cruz"; });
afterEach(() => { cleanup(); mocks.update.mockReset(); });
function mount(onNotice = vi.fn()) { return render(<DepartureGuardProvider><StudentProfileEditor studentId="student" classes={classes} onNotice={onNotice} /></DepartureGuardProvider>); }

it.each(["profile", "family", "subjects"] as const)("opens a transferred-out source sheet's %s section as read-only history", async initialTab => {
  mocks.profile.enrollmentStatus = "transferred_out";
  mocks.capabilities = ["enrollment.intakes.manage"];
  const toggle = vi.fn(), setSubjects = vi.fn();
  render(<DepartureGuardProvider><StudentUnifiedEditorSheet
    activeStudent={{ _id: "student", studentName: mocks.profile.displayName, admissionNumber: "ADM-1", photoUrl: null, selectedSubjectIds: [] }}
    subjects={[]} totalSubjects={0} isOpen onClose={vi.fn()} onToggle={toggle} onSetStudentSubjects={setSubjects}
    classes={classes} onNotice={vi.fn()} initialTab={initialTab}
  /></DepartureGuardProvider>);
  expect(await screen.findByText(/read-only source-school record/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /governed transfer or reversal workflow/i })).toHaveAttribute("href", "/academic/students/transfers");
  expect(screen.getByText("Enrollment periods and history")).toBeInTheDocument();
  expect(screen.getByText("Recorded Guardian")).toBeInTheDocument();
  for (const role of ["textbox", "combobox", "checkbox"] as const) expect(screen.queryByRole(role)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /save identity|archive record|re-enroll|reinstate|provision|refresh|select all|clear selection/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/contacts remain editable/i)).not.toBeInTheDocument();
  expect(mocks.query.mock.calls.map(call => call[0])).not.toContain("functions/academic/studentEnrollment:getStudentFamilyProfile");
  expect(mocks.update).not.toHaveBeenCalled();
  expect(toggle).not.toHaveBeenCalled();
  expect(setSubjects).not.toHaveBeenCalled();
});

it("reopens captured names, demographics, effective class, legacy emergency details and photo", async () => {
  mount();
  expect(await screen.findByLabelText("First Name")).toHaveValue("Mary");
  expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Jane");
  expect(screen.getByLabelText("Last Name")).toHaveValue("De La Cruz");
  expect(screen.getByLabelText("Active Class")).toHaveValue("promoted");
  expect(screen.getByLabelText("House Group")).toHaveValue("Blue");
  expect(screen.getByLabelText("Birth Date")).toHaveValue("2014-05-15");
  expect(screen.getByLabelText("Guardian Name")).toHaveValue("Recorded Guardian");
  expect(screen.getByLabelText("Contact Phone")).toHaveValue("legacy phone");
  expect(screen.getByText(/Effective address: Household address/)).toBeInTheDocument();
  expect(screen.getByAltText("Retained photo")).toHaveAttribute("src", "https://example.test/photo.jpg");
  expect(screen.queryByLabelText("Confirm class assignment")).not.toBeInTheDocument();
});

it("name-only edits omit reassignment, unchanged addresses/emergency and admission-number intent", async () => {
  mount();
  fireEvent.change(await screen.findByLabelText("First Name"), { target: { value: "Marie" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update.mock.calls[0][0]).toMatchObject({ firstName: "Marie", middleName: "Jane", lastName: "De La Cruz" });
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("classId");
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("confirmClassAssignment");
  for (const field of ["admissionNumber", "guardianName", "guardianPhone", "address", "addressMode", "emergencyContactMode"]) expect(mocks.update.mock.calls[0][0][field]).toBeUndefined();
});

it.each(["structured", "full-name"] as const)("reports normalized saved names in %s mode without relying on blur", async (mode) => {
  const notice = vi.fn();
  mount(notice);
  await screen.findByLabelText("First Name");
  if (mode === "structured") {
    fireEvent.change(screen.getByLabelText("Last Name"), { target: { value: "de la CRUZ-roBERTs" } });
  } else {
    fireEvent.click(screen.getByRole("button", { name: "Use full name" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "mARY jANE de la CRUZ-roBERTs" } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(notice).toHaveBeenCalledWith({ tone: "success", message: "Mary Jane De La Cruz-Roberts updated." });
});

it("confirms only an actual class change, preserves fields on cancel and sends reviewed effective expectations", async () => {
  mount();
  fireEvent.change(await screen.findByLabelText("Active Class"), { target: { value: "other" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("Are you sure?");
  expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("Active Class")).toHaveValue("other");
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm class change" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ classId: "other", confirmClassAssignment: true, expectedClassId: "promoted", expectedSessionId: "session-new" })));
});

it("sends an explicit reviewed null sentinel when there is no active session", async () => {
  mocks.profile.activeSessionId = null;
  mount();
  fireEvent.change(await screen.findByLabelText("Active Class"), { target: { value: "other" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  expect(mocks.update).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Confirm class change" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ classId: "other", confirmClassAssignment: true, expectedClassId: "promoted", expectedSessionId: null })));
});

it("reports stale assignments without retrying or overwriting them", async () => {
  const notice = vi.fn(); mocks.update.mockRejectedValueOnce(new Error("Assignment changed. Reload and review."));
  mount(notice);
  fireEvent.change(await screen.findByLabelText("Active Class"), { target: { value: "other" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm class change" }));
  await waitFor(() => expect(notice).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", message: expect.stringMatching(/reload and review/i) })));
  expect(mocks.update).toHaveBeenCalledOnce();
});

it("keeps legacy full-name-only identities editable without fabricated parts", async () => {
  mocks.profile.firstName = null; mocks.profile.middleName = null; mocks.profile.lastName = null;
  mount();
  expect(await screen.findByLabelText("Full name")).toHaveValue("Mary Jane De La Cruz");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Mary Jane De la Cruz-Roberts" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Identity" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update.mock.calls[0][0]).toHaveProperty("name", "Mary Jane De la Cruz-Roberts");
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("firstName");
});
