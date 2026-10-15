import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@school/convex/_generated/dataModel";
import { api } from "@school/convex/_generated/api";
import { CorrectionDecision, InvalidCorrectionRequestAction } from "../app/academic/students/profile-corrections/CorrectionActions";
const mocks = vi.hoisted(() => ({ decide: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.decide }));
const schoolId = "school" as Id<"schools">;
const requestId = "request" as Id<"profileCorrectionRequests">;
function fixture(): FunctionReturnType<typeof api.functions.academic.profileCorrections.getAdminRequest> {
  return { _id: requestId, _creationTime: 1, schoolId, requesterUserId: "parent" as Id<"users">,
    requestKey: "request-key-0001", requestedScope: { parentFields: ["phone", "address"], parentMemberId: "member" as Id<"familyMembers">, childFields: ["gender"], childId: "child" as Id<"students"> },
    requesterName: "Pat Smith", childName: "Sam Smith", parentRequiresNamePair: false, childRequiresNamePair: false, reason: "Correct details", state: "requested", revision: 0, draftRevision: 0, createdAt: 1, updatedAt: 1, stale: false };
}
afterEach(() => { cleanup(); mocks.decide.mockReset(); });
it("changed-link permissions can only be closed from the redacted list, never applied or regranted", async () => {
  const request = fixture();
  render(<InvalidCorrectionRequestAction schoolId={schoolId} request={{ requestId, requesterUserId: request.requesterUserId, state: "granted", requestedScope: request.requestedScope, allowedScope: undefined, revision: 1, createdAt: 1, appliedAt: undefined, currentAccess: false }} />);
  expect(screen.queryByText("Pat Smith")).not.toBeInTheDocument(); expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason to close invalid permission"), { target: { value: "Child moved schools" } });
  fireEvent.click(screen.getByRole("button", { name: "Close invalid permission" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith({ schoolId, requestId, expectedRevision: 1, decision: "revoke", reason: "Child moved schools" }));
});
it("admin grants only an explicit nonempty requested subset, not arbitrary child/profile fields", async () => {
  render(<CorrectionDecision schoolId={schoolId} request={fixture()} />);
  expect(screen.getByRole("button", { name: "Grant selected edit permission" })).toBeDisabled();
  expect(screen.queryByRole("checkbox", { name: /Date of birth/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · Phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Grant selected edit permission" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledOnce());
  expect(mocks.decide).toHaveBeenCalledWith({ schoolId, requestId, expectedRevision: 0, decision: "grant", allowedScope: { parentFields: ["phone"], childFields: [], parentMemberId: undefined, childId: undefined } });
});
it("legacy name grants keep the required pair and can still grant only phone", async () => {
  const request: FunctionReturnType<typeof api.functions.academic.profileCorrections.getAdminRequest> = {
    ...fixture(), parentRequiresNamePair: true, childRequiresNamePair: true,
    requestedScope: { parentFields: ["firstName", "middleName", "lastName", "phone"], childFields: ["firstName", "lastName"], childId: "child" as Id<"students"> },
  };
  render(<CorrectionDecision schoolId={schoolId} request={request} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · Middle name" }));
  expect(screen.getByRole("checkbox", { name: "Parent · First name" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Parent · Last name" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Child · Last name" }));
  expect(screen.getByRole("checkbox", { name: "Child · First name" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Child · First name" }));
  expect(screen.getByRole("checkbox", { name: "Child · Last name" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · First name" }));
  expect(screen.getByRole("checkbox", { name: "Parent · Middle name" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · Phone" }));
  fireEvent.click(screen.getByRole("button", { name: "Grant selected edit permission" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ allowedScope: { parentFields: ["phone"], childFields: [], parentMemberId: undefined, childId: undefined } })));
});

it("old partial legacy name requests cannot grant missing unrequested parts but can grant phone", async () => {
  render(<CorrectionDecision schoolId={schoolId} request={{ ...fixture(), parentRequiresNamePair: true,
    requestedScope: { parentFields: ["firstName", "phone"], childFields: [] } }} />);
  expect(screen.queryByRole("checkbox", { name: "Parent · Last name" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · First name" }));
  expect(screen.getByRole("button", { name: "Grant selected edit permission" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · Phone" }));
  expect(screen.getByRole("button", { name: "Grant selected edit permission" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · First name" }));
  fireEvent.click(screen.getByRole("button", { name: "Grant selected edit permission" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ allowedScope: { parentFields: ["phone"], childFields: [], parentMemberId: undefined, childId: undefined } })));
});

it("reject and revoke require a reason and only change initial permission", async () => {
  const view = render(<CorrectionDecision schoolId={schoolId} request={fixture()} />);
  expect(screen.getByRole("button", { name: "Reject permission request" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Reason to reject"), { target: { value: "Please contact the school" } }); fireEvent.click(screen.getByRole("button", { name: "Reject permission request" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ decision: "reject", reason: "Please contact the school", expectedRevision: 0 })));
  view.rerender(<CorrectionDecision key="granted" schoolId={schoolId} request={{ ...fixture(), state: "granted", revision: 1, allowedScope: { parentFields: ["phone"], childFields: [] } }} />);
  expect(screen.queryByRole("button", { name: "Grant selected edit permission" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason to revoke"), { target: { value: "Contact link needs review" } }); fireEvent.click(screen.getByRole("button", { name: "Revoke unused permission" }));
  await waitFor(() => expect(mocks.decide).toHaveBeenCalledWith(expect.objectContaining({ decision: "revoke", reason: "Contact link needs review", expectedRevision: 1 })));
});
it("applied evidence is read-only and never presents a second approval action", () => {
  render(<CorrectionDecision schoolId={schoolId} request={{ ...fixture(), state: "applied", revision: 2, applied: { key: "submit-key", reviewToken: "token", appliedAt: 100, grantRevision: 1, draftRevision: 1, changes: [{ target: "parent", targetId: "parent", field: "phone", before: "Old phone", after: "New phone" }] } }} />);
  expect(screen.getByText("Immutable applied evidence")).toBeInTheDocument(); expect(screen.getByText("New phone")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("failed decisions do not claim success or remove the pending request", async () => {
  mocks.decide.mockRejectedValueOnce(new Error("CONFLICT: Reload request")); render(<CorrectionDecision schoolId={schoolId} request={fixture()} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Parent · Phone" })); fireEvent.click(screen.getByRole("button", { name: "Grant selected edit permission" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("CONFLICT: Reload request");
  expect(screen.getByRole("button", { name: "Grant selected edit permission" })).toBeInTheDocument();
});
