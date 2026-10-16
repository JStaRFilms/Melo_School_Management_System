import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@school/convex/_generated/dataModel";
import { api } from "@school/convex/_generated/api";
import { StaffLifecycleActionModal, type StaffProfile } from "../app/admin/components/StaffLifecycleActionModal";
import { StaffLifecyclePanel } from "../app/admin/components/StaffLifecyclePanel";
import { StaffServiceDirectory } from "../app/admin/components/StaffServiceDirectory";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transition: vi.fn(), review: vi.fn(), profile: vi.fn(), loadMore: vi.fn(), paginated: vi.fn(), capabilities: ["staff.list.view", "staff.onboard", "staff.account.suspend"], success: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => {
  const client = { query: (ref: FunctionReference<"query">, args: unknown) => mocks.query(getFunctionName(ref), args) };
  return {
  useConvex: () => client,
  useMutation: (ref: FunctionReference<"mutation">) => getFunctionName(ref).endsWith(":confirmStaffRehireReview") ? mocks.review : mocks.transition,
  useQuery: (_ref: unknown, args: unknown) => args === "skip" ? undefined : mocks.profile(),
  usePaginatedQuery: (ref: FunctionReference<"query">, args: unknown) => mocks.paginated(getFunctionName(ref), args),
}; });
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" }, effectiveCapabilities: mocks.capabilities } }) }));
vi.mock("@school/shared/toast", () => ({ appToast: { success: mocks.success, error: mocks.error } }));
const schoolId = "school" as Id<"schools">;
const userId = "employee" as Id<"users">;
const profile: StaffProfile = { userId, personId: "person" as Id<"persons">, name: "Former Staff", email: "staff@test.invalid", role: "teacher", isSchoolAdmin: false, status: "departed", revision: 3, isArchived: false, currentPeriodId: null, reviewedEventId: null, canDepart: false, canReviewRehire: true, departureBlockers: [], rehireBlockers: [], context: { sessionName: "Current school session", termName: "Current school term" } };
type Preview = FunctionReturnType<typeof api.functions.academic.academicSetup.previewStaffRehirePermissions>;
const configuration: Preview["previous"] = { displayTitle: "Former title", roleTemplateIds: [], grants: ["staff.list.view"], restrictions: ["staff.password.reset"], ceiling: [], effective: ["staff.list.view"], legacyBaseline: false, compatibilityGrants: [{ grantId: "grant" as Id<"schoolCapabilityGrants">, capability: "settings.view", scope: "school", programmeId: undefined, intakeId: undefined, expiresAt: undefined, revokedAt: 1 }] };
const preview: Preview = { userId, personId: profile.personId, membershipId: "membership" as Id<"branchMemberships">, role: "teacher", name: profile.name, schoolId, revision: 3, previous: configuration, proposed: configuration, permissionState: "opaque-private-state" };

beforeEach(() => {
  mocks.query.mockImplementation(async (name: string, args: { decision?: Preview["proposed"] }) => name.endsWith(":getPermissionWorkspace") ? { templates: [], catalog: ["staff.list.view", "staff.onboard", "staff.password.reset"] } : { ...preview, proposed: args.decision ? { ...configuration, ...args.decision, effective: args.decision.grants } : configuration });
  mocks.review.mockResolvedValue({ eventId: "review-event", revision: 4, status: "departed", periodId: null });
  mocks.transition.mockResolvedValue({ eventId: "rehire-event", revision: 5, status: "active", periodId: "new-period" });
  mocks.profile.mockReturnValue(profile);
  mocks.paginated.mockReturnValue({ results: [], status: "CanLoadMore", loadMore: mocks.loadMore });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.capabilities = ["staff.list.view", "staff.onboard", "staff.account.suspend"]; });
function open(props: StaffProfile = profile, action: "depart" | "rehire" = "rehire") {
  const onSaved = vi.fn(), onClose = vi.fn();
  return { ...render(<StaffLifecycleActionModal schoolId={schoolId} profile={props} action={action} onSaved={onSaved} onClose={onClose} />), onSaved, onClose };
}
async function readyReview() {
  await screen.findByText("Previous permissions, not restored");
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Reviewed access for return" } });
  fireEvent.click(screen.getByRole("button", { name: "Preview access decision" }));
  await screen.findByText("Proposed permissions after rehire");
  fireEvent.click(screen.getByLabelText(/I reviewed the previous and proposed/));
}

it.each(["teacher", "admin", "staff"] as const)("requires a server review then same-operator rehire for %s", async role => {
  const view = open({ ...profile, role });
  await screen.findByText("Previous permissions, not restored");
  expect(screen.queryByText("opaque-private-state")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Reviewed access for return" } });
  expect(screen.getByRole("button", { name: "Confirm review and rehire" })).toBeDisabled();
  expect(screen.getByText(/Revoked/)).toBeInTheDocument();
  await readyReview();
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
  expect(mocks.review.mock.calls[0][0]).toMatchObject({ schoolId: "school", userId: "employee", expectedRevision: 3, expectedPermissionState: "opaque-private-state", decision: { mode: "retain", grants: ["staff.list.view"], restrictions: ["staff.password.reset"] } });
  expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school", userId: "employee", action: "rehire", expectedRevision: 4, reviewedEventId: "review-event" }));
  expect(mocks.transition.mock.calls[0][0]).not.toHaveProperty("effectiveDay");
  expect(mocks.review.mock.invocationCallOrder[0]).toBeLessThan(mocks.transition.mock.invocationCallOrder[0]);
});

it("supports a replacement decision for the departed target without an active-only selector", async () => {
  open();
  await screen.findByLabelText("Permission decision");
  fireEvent.change(screen.getByLabelText("Permission decision"), { target: { value: "replace" } });
  const grants = await screen.findByRole("group", { name: /Direct grants/ });
  fireEvent.click(within(grants).getByLabelText("staff.onboard"));
  await readyReview();
  expect(screen.getByRole("button", { name: "Confirm review and rehire" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Display title"), { target: { value: "Office staff" } });
  expect(screen.queryByText("Proposed permissions after rehire")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm review and rehire" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Preview access decision" }));
  await screen.findByText("Proposed permissions after rehire");
  fireEvent.click(screen.getByLabelText(/I reviewed the previous and proposed/));
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await waitFor(() => expect(mocks.review).toHaveBeenCalledOnce());
  expect(mocks.review.mock.calls[0][0].decision).toMatchObject({ mode: "replace", displayTitle: "Office staff", grants: ["staff.list.view", "staff.onboard"] });
});

it("retries an uncertain review unchanged and does not trust an old transition projection", async () => {
  mocks.review.mockRejectedValueOnce(new Error("Network response lost"));
  const view = open(); await readyReview();
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await screen.findByRole("alert");
  const first = mocks.review.mock.calls[0][0];
  view.rerender(<StaffLifecycleActionModal schoolId={schoolId} profile={{ ...profile, revision: 4 }} action="rehire" onSaved={view.onSaved} onClose={view.onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
  expect(mocks.review.mock.calls[1][0]).toEqual(first);
});

it("retries a lost rehire response without creating another review or operation", async () => {
  mocks.transition.mockRejectedValueOnce(new Error("Network response lost"));
  const view = open(); await readyReview();
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Reason")).toBeDisabled();
  const first = mocks.transition.mock.calls[0][0];
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
  expect(mocks.review).toHaveBeenCalledOnce();
  expect(mocks.transition.mock.calls[1][0]).toEqual(first);
});

it("keeps a stale permission conflict visible and refuses automatic retry", async () => {
  mocks.review.mockRejectedValue(new Error("CONFLICT: permission revision changed"));
  open(); await readyReview();
  fireEvent.click(screen.getByRole("button", { name: "Confirm review and rehire" }));
  await screen.findByText(/Close and reopen/);
  expect(screen.getByRole("button", { name: "Confirm review and rehire" })).toBeDisabled();
  expect(mocks.transition).not.toHaveBeenCalled();
});

it("blocks departure with named assignments and independent archive restrictions", () => {
  mocks.profile.mockReturnValue({ ...profile, status: "active", canDepart: true, canReviewRehire: false, departureBlockers: ["Primary 1 Mathematics teaching link", "Transfer leadership first"] });
  const view = render(<StaffLifecyclePanel schoolId={schoolId} userId={userId} />);
  expect(screen.getByRole("button", { name: "Record departure" })).toBeDisabled();
  expect(screen.getByText("Primary 1 Mathematics teaching link")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Subjects" })).toHaveAttribute("href", "/academic/subjects");
  mocks.profile.mockReturnValue({ ...profile, isArchived: true, canReviewRehire: false, rehireBlockers: ["Restore the archived account before rehire"] });
  view.rerender(<StaffLifecyclePanel schoolId={schoolId} userId={userId} />);
  expect(screen.queryByRole("button", { name: "Review access and rehire" })).not.toBeInTheDocument();
  expect(screen.getByText(/Restore removes the archive restriction only/)).toBeInTheDocument();
});

it("hides staff actions when profile capabilities deny them, regardless of role title", () => {
  mocks.profile.mockReturnValue({ ...profile, role: "admin", canReviewRehire: false, rehireBlockers: [] });
  render(<StaffLifecyclePanel schoolId={schoolId} userId={userId} />);
  expect(screen.queryByRole("button", { name: "Review access and rehire" })).not.toBeInTheDocument();
});

it("continues empty staff pages and resets discovery status without owning the selection", () => {
  const select = vi.fn();
  render(<StaffServiceDirectory schoolId={schoolId} role="staff" selectedUserId="employee" onSelect={select} />);
  fireEvent.click(screen.getByRole("button", { name: "Load more staff" }));
  expect(mocks.loadMore).toHaveBeenCalledWith(25);
  fireEvent.change(screen.getByLabelText("Service filter"), { target: { value: "departed" } });
  expect(mocks.paginated).toHaveBeenLastCalledWith("functions/academic/academicSetup:listStaffServiceDirectory", { schoolId, role: "staff", status: "departed" });
  expect(select).not.toHaveBeenCalled();
});

it("supports cancel and corrected context on departure without a permission review", async () => {
  const view = open({ ...profile, status: "active" }, "depart");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.onClose).toHaveBeenCalledOnce();
  expect(mocks.review).not.toHaveBeenCalled();
  expect(mocks.transition).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Leaving role" } });
  fireEvent.click(screen.getByLabelText("Correct effective date"));
  fireEvent.change(screen.getByLabelText("Corrected effective day"), { target: { value: "2026-01-11" } });
  fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce());
  expect(mocks.transition).toHaveBeenCalledWith(expect.objectContaining({ action: "depart", effectiveDay: "2026-01-11" }));
  expect(mocks.query).not.toHaveBeenCalled();
});
