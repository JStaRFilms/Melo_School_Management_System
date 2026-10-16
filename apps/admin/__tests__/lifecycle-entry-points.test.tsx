import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import StudentsPage from "../app/academic/students/page";
import { StaffDirectorySection } from "../app/admin/components/StaffDirectorySection";
import type { Id } from "@school/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({ query: vi.fn(), action: vi.fn(), mutation: vi.fn(), prepare: vi.fn(), mobile: false, paginated: vi.fn(), succeeded: vi.fn(), failed: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/academic/students", useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ session: { user: { id: "operator" } }, workspaceAccess: { state: "ready", branch: { schoolId: "school" }, effectiveCapabilities: ["enrollment.intakes.manage", "staff.list.view", "staff.onboard", "staff.account.suspend"] } }) }));
vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => mocks.mobile }));
vi.mock("@/useDraftConnection", () => ({ useDraftConnection: () => ({ connected: true, authenticated: true, accountId: "operator" }) }));
vi.mock("@/usePersistentFormDraft", () => ({ usePersistentFormDraft: () => ({ status: "saved", retrySave: vi.fn(), handleDiscardDraft: vi.fn(), prepareSubmission: mocks.prepare, submissionSucceeded: mocks.succeeded, submissionFailed: mocks.failed }) }));
vi.mock("@/components/drafts/PersistentFormDraftControls", () => ({ PersistentFormDraftControls: () => null }));
vi.mock("@school/shared/drafts", async importOriginal => ({ ...await importOriginal<typeof import("@school/shared/drafts")>(), useDirtyForm: () => async () => true }));
vi.mock("convex/react", () => ({
  useQuery: (ref: string | FunctionReference<"query">, args: unknown) => { const name = typeof ref === "string" ? ref : getFunctionName(ref); mocks.query(name, args); if (args === "skip") return undefined;
    if (name.endsWith(":listClasses")) return [];
    if (name.endsWith(":listSessions")) return [];
    if (name.endsWith(":getStudentProfile")) return { _id: "student", userId: "student-user", email: "student@test.invalid", name: "Ada Student", displayName: "Ada Student", firstName: "Ada", lastName: "Student", admissionNumber: "001", classId: "old-class", className: "Old class", enrollmentStatus: "withdrawn", enrollmentRevision: 3, houseName: null, gender: null, dateOfBirth: null, guardianName: null, guardianPhone: null, address: null, photoUrl: null, photoFileName: null, photoContentType: null };
    if (name.endsWith(":getTransferPilotAccess")) return { allowed: false };
    if (name.endsWith(":getStaffServiceProfile")) return { userId: "staff", name: "Generic Staff", email: "staff@test.invalid", role: "staff", status: "departed", revision: 1, isArchived: false, canDepart: false, canReviewRehire: true, departureBlockers: [], rehireBlockers: [], context: {} };
    return { policy: null };
  },
  usePaginatedQuery: (ref: FunctionReference<"query">, args: unknown) => mocks.paginated(getFunctionName(ref), args),
  useAction: (ref: string | FunctionReference<"action">) => (args: unknown) => mocks.action(typeof ref === "string" ? ref : getFunctionName(ref), args),
  useMutation: () => mocks.mutation,
}));

beforeEach(() => {
  mocks.prepare.mockResolvedValue({ draftId: "draft", expectedRevision: 7, schoolId: "school" });
  mocks.action.mockResolvedValue({ userId: "staff", email: "staff@test.invalid", temporaryPassword: "Staff123!Pass" });
  mocks.paginated.mockImplementation((name: string, args: { status?: string }) => ({ results: name.endsWith(":listStudentEnrollmentDirectory") ? [{ studentId: "student", studentName: "Ada Student", admissionNumber: "001", status: args.status }] : name.endsWith(":listStaffServiceDirectory") ? [{ userId: "staff", name: "Generic Staff", email: "staff@test.invalid", role: "staff", status: args.status }] : [], status: "Exhausted", loadMore: vi.fn() }));
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.mobile = false; window.history.replaceState(null, "", "/"); });

it("opens an inactive student profile with no setup context and retains it after filter change", async () => {
  render(<StudentsPage />);
  fireEvent.change(await screen.findByLabelText("Enrollment filter"), { target: { value: "withdrawn" } });
  fireEvent.click(screen.getByRole("button", { name: /Ada Student • 001/ }));
  await screen.findByRole("heading", { name: "Enrollment: withdrawn" });
  expect(screen.getByRole("button", { name: "Re-enroll" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Enrollment filter"), { target: { value: "suspended" } });
  expect(screen.getByRole("heading", { name: "Enrollment: withdrawn" })).toBeInTheDocument();
  expect(mocks.query.mock.calls.filter(([name]) => name.endsWith(":getClassStudentSubjectMatrix")).every(([, args]) => args === "skip")).toBe(true);
  expect(screen.getByLabelText("Active Class")).toBeDisabled();
});

it("opens inactive mobile profile through AdminSheet and offers lifecycle rather than immediate subject writes", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  render(<StudentsPage />);
  fireEvent.change(await screen.findByLabelText("Enrollment filter"), { target: { value: "withdrawn" } });
  fireEvent.click(screen.getByRole("button", { name: /Ada Student • 001/ }));
  const sheet = await screen.findByRole("dialog", { name: "Ada Student" });
  expect(within(sheet).getByRole("button", { name: "Re-enroll" })).toBeInTheDocument();
  fireEvent.click(within(sheet).getByRole("button", { name: "subjects" }));
  expect(within(sheet).getByText(/Inactive students review placement/)).toBeInTheDocument();
  expect(within(sheet).queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(mocks.mutation).not.toHaveBeenCalled();
});

it("creates genuine generic staff using a prepared active staff onboarding draft and joining correction", async () => {
  render(<StaffDirectorySection schoolId={"school" as Id<"schools">} />);
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Generic" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Staff" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "staff@test.invalid" } });
  fireEvent.change(screen.getByLabelText(/Joining day correction/), { target: { value: "2026-01-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Other staff Account" }));
  await waitFor(() => expect(mocks.action).toHaveBeenCalledOnce());
  expect(mocks.prepare).toHaveBeenCalledOnce();
  expect(mocks.action).toHaveBeenCalledWith("functions/academic/academicSetup:createStaff", expect.objectContaining({ name: "Generic Staff", firstName: "Generic", lastName: "Staff", draftId: "draft", expectedDraftRevision: 7, joiningDay: "2026-01-10", origin: window.location.origin }));
  expect(mocks.succeeded).toHaveBeenCalledOnce();
});

it("opens departed generic staff on mobile and keeps their profile selected after filter changes", async () => {
  mocks.mobile = true;
  render(<StaffDirectorySection schoolId={"school" as Id<"schools">} />);
  fireEvent.change(screen.getByLabelText("Service filter"), { target: { value: "departed" } });
  fireEvent.click(screen.getByRole("button", { name: /Generic Staff/ }));
  const sheet = await screen.findByRole("dialog", { name: "Other staff service" });
  expect(within(sheet).getByRole("button", { name: "Review access and rehire" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Service filter"), { target: { value: "active" } });
  expect(within(sheet).getByRole("heading", { name: "Generic Staff • Service departed" })).toBeInTheDocument();
  expect(mocks.action).not.toHaveBeenCalled();
});
