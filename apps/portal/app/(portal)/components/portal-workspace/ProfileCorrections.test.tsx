// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@school/convex/_generated/dataModel";
import { ProfileCorrections, type CorrectionWorkspace, type CorrectionDetail } from "./ProfileCorrections";
const mocks = vi.hoisted(() => ({ workspace: undefined as CorrectionWorkspace | undefined, detail: undefined as CorrectionDetail | undefined, request: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => args === "skip" ? undefined : getFunctionName(reference).endsWith(":getWorkspace") ? mocks.workspace : mocks.detail, useMutation: () => mocks.request }));
vi.mock("./ProfileCorrectionEditor", () => ({ CorrectionEditor: () => <p>Granted editor</p> }));
const schoolId = "school" as Id<"schools">, studentId = "child" as Id<"students">, requestId = "request" as Id<"profileCorrectionRequests">;
function workspace(): CorrectionWorkspace {
  return { parent: { name: "Pat Smith", firstName: "Pat", middleName: null, lastName: "Smith", phone: "Old phone" },
    addresses: [{ memberId: "member" as Id<"familyMembers">, familyName: "Household", mode: "residential", value: null, residential: "Shared road" }],
    child: { studentId, name: "Sam Smith", firstName: "Sam", middleName: null, lastName: "Smith", dateOfBirth: null, gender: "Male", addressMode: null, address: null, residential: "Shared road" }, requests: [] };
}
function detail(): CorrectionDetail {
  return { _id: requestId, _creationTime: 1, schoolId, requesterUserId: "parent" as Id<"users">, requestKey: "request-key", requestedScope: { parentFields: ["phone"], childFields: [] }, state: "requested", revision: 0, draftRevision: 0, reason: "Correct details", createdAt: 1, updatedAt: 1, stale: false };
}
afterEach(() => { cleanup(); mocks.request.mockReset(); mocks.workspace = undefined; mocks.detail = undefined; });
it("requests named parent/child fields from persisted context with a bounded reason", async () => {
  mocks.workspace = workspace(); mocks.request.mockResolvedValue(requestId);
  render(<ProfileCorrections schoolId={schoolId} studentId={studentId} />);
  expect(screen.getByRole("button", { name: "Request edit permission" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Phone" })); fireEvent.click(screen.getByRole("checkbox", { name: "Date of birth" }));
  fireEvent.change(screen.getByLabelText("Reason for correction"), { target: { value: "Correct recorded details" } });
  expect(screen.getByLabelText("Reason for correction")).toHaveAttribute("maxlength", "500");
  fireEvent.click(screen.getByRole("button", { name: "Request edit permission" }));
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ schoolId, scope: { parentFields: ["phone"], childFields: ["dateOfBirth"], childId: studentId, parentMemberId: undefined }, reason: "Correct recorded details" })));
});
it("legacy name selections request both required parts without guessing display-name tokens", async () => {
  mocks.workspace = workspace(); mocks.workspace.parent.firstName = null; mocks.workspace.parent.lastName = null;
  if (mocks.workspace.child) { mocks.workspace.child.firstName = null; mocks.workspace.child.lastName = null; }
  mocks.request.mockResolvedValue(requestId);
  render(<ProfileCorrections schoolId={schoolId} studentId={studentId} />);
  const first = screen.getAllByRole("checkbox", { name: "First name" });
  const middle = screen.getAllByRole("checkbox", { name: "Middle name" });
  const last = screen.getAllByRole("checkbox", { name: "Last name" });
  fireEvent.click(first[0]); expect(last[0]).toBeChecked();
  fireEvent.click(last[0]); expect(first[0]).not.toBeChecked();
  fireEvent.click(middle[0]); expect(first[0]).toBeChecked(); expect(last[0]).toBeChecked();
  fireEvent.click(middle[1]); expect(first[1]).toBeChecked(); expect(last[1]).toBeChecked();
  fireEvent.change(screen.getByLabelText("Reason for correction"), { target: { value: "Enter explicit name parts" } });
  fireEvent.click(screen.getByRole("button", { name: "Request edit permission" }));
  await waitFor(() => expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ scope: expect.objectContaining({
    parentFields: expect.arrayContaining(["firstName", "middleName", "lastName"]),
    childFields: expect.arrayContaining(["firstName", "middleName", "lastName"]),
  }) })));
});

it("requested permission is not presented as a pending change approval", () => {
  mocks.detail = detail(); mocks.workspace = { ...workspace(), requests: [{ requestId, requesterUserId: "parent" as Id<"users">, state: "requested", requestedScope: mocks.detail.requestedScope, allowedScope: undefined, appliedAt: undefined, revision: 0, createdAt: 1, currentAccess: true }] };
  render(<ProfileCorrections schoolId={schoolId} />);
  expect(screen.getByText(/No profile changes have been submitted/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Apply changes now" })).not.toBeInTheDocument();
});
it("applied receipt is read-only; further editing starts a fresh permission request", () => {
  mocks.detail = { ...detail(), state: "applied", revision: 2, applied: { key: "submit-key", reviewToken: "token", appliedAt: 100, grantRevision: 1, draftRevision: 1, changes: [{ target: "parent", targetId: "parent", field: "phone", before: "Old phone", after: "New phone" }] } };
  mocks.workspace = { ...workspace(), requests: [{ requestId, requesterUserId: "parent" as Id<"users">, state: "applied", requestedScope: mocks.detail.requestedScope, allowedScope: mocks.detail.allowedScope, revision: 2, createdAt: 1, appliedAt: 100, currentAccess: true }] };
  render(<ProfileCorrections schoolId={schoolId} />);
  fireEvent.click(screen.getByText(/^applied ·/));
  expect(screen.getByText("Applied receipt")).toBeInTheDocument(); expect(screen.getByText("New phone")).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start a new permission request" }));
  expect(screen.getByRole("button", { name: "Request edit permission" })).toBeInTheDocument();
  expect(mocks.request).not.toHaveBeenCalled();
});
it("request failures retain scope and reason and do not claim the school granted access", async () => {
  mocks.workspace = workspace(); mocks.request.mockRejectedValueOnce(new Error("An open correction request already exists"));
  render(<ProfileCorrections schoolId={schoolId} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Phone" })); fireEvent.change(screen.getByLabelText("Reason for correction"), { target: { value: "Correct phone" } }); fireEvent.click(screen.getByRole("button", { name: "Request edit permission" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("open correction request");
  expect(screen.getByLabelText("Reason for correction")).toHaveValue("Correct phone"); expect(screen.getByRole("checkbox", { name: "Phone" })).toBeChecked();
  expect(screen.queryByText("Granted editor")).not.toBeInTheDocument();
});
