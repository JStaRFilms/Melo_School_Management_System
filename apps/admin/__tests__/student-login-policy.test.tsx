import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DepartureGuardProvider } from "@school/shared/drafts";
import type { Id } from "@school/convex/_generated/dataModel";
import { StudentLoginPolicy } from "../app/admin/settings/email-domains/StudentLoginPolicy";

const mocks = vi.hoisted(() => ({ policy: { domainId: null, suffix: "school.students.local", version: 4, state: "default", unavailableReason: null, canEdit: true }, save: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.policy, useMutation: () => mocks.save }));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.policy.version = 4; mocks.policy.canEdit = true; });
const schoolId = "school" as Id<"schools">;
const domains = [
  { _id: "verified" as Id<"schoolEmailDomains">, schoolId, domain: "school.edu", provider: "none" as const, status: "verified" as const, isDefault: false, sharedWithGroup: false, verifiedAt: 1 },
  { _id: "pending" as Id<"schoolEmailDomains">, schoolId, domain: "pending.edu", provider: "none" as const, status: "pending_verification" as const, isDefault: false, sharedWithGroup: false, verifiedAt: undefined },
  { _id: "shared" as Id<"schoolEmailDomains">, schoolId: "other-school" as Id<"schools">, domain: "group.edu", provider: "none" as const, status: "verified" as const, isDefault: false, sharedWithGroup: true, verifiedAt: 1 },
];
function mount() { return render(<DepartureGuardProvider><StudentLoginPolicy schoolId={schoolId} domains={domains} /></DepartureGuardProvider>); }

it("offers the default plus verified registry-owned/shared choices without implying mailbox creation", () => {
  mount();
  expect(screen.getByRole("option", { name: "School-namespaced .local default" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /school.edu.*school-owned/ })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: /group.edu.*shared active-group/ })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /pending.edu/ })).not.toBeInTheDocument();
  expect(screen.getByText(/Login IDs are not inboxes/)).toBeInTheDocument();
  expect(mocks.save).not.toHaveBeenCalled();
});

it("confirms only new-user policy changes and retains the reviewed version if policy changes meanwhile", async () => {
  const view = mount();
  fireEvent.change(screen.getByLabelText("Suffix for new student logins"), { target: { value: "verified" } });
  fireEvent.click(screen.getByRole("button", { name: "Review suffix change" }));
  mocks.policy.version = 5;
  view.rerender(<DepartureGuardProvider><StudentLoginPolicy schoolId={schoolId} domains={domains} /></DepartureGuardProvider>);
  mocks.save.mockRejectedValueOnce(new Error("Student login policy changed. Reload before saving."));
  fireEvent.click(screen.getByRole("button", { name: "Confirm student suffix" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ schoolId: "school", domainId: "verified", expectedVersion: 4, confirmed: true }));
  expect(await screen.findByRole("status")).toHaveTextContent("Reload before saving.");
  expect(mocks.save).toHaveBeenCalledOnce();
});

it("cancels without saving and respects backend edit authority", () => {
  const view = mount();
  fireEvent.change(screen.getByLabelText("Suffix for new student logins"), { target: { value: "verified" } });
  fireEvent.click(screen.getByRole("button", { name: "Review suffix change" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel suffix change" }));
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.policy.canEdit = false;
  view.rerender(<DepartureGuardProvider><StudentLoginPolicy schoolId={schoolId} domains={domains} /></DepartureGuardProvider>);
  expect(screen.getByLabelText("Suffix for new student logins")).toBeDisabled();
});
