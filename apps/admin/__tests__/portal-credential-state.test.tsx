import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PortalCredentialPanel } from "../app/academic/students/components/PortalCredentialPanel";

const mocks = vi.hoisted(() => ({ state: "provisioned" as string | undefined, fail: false, action: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: () => { if (mocks.fail) throw new Error("query failed"); return mocks.state ? { userId: "user-one", email: "stable@school.local", state: mocks.state } : undefined; },
  useAction: () => mocks.action,
  useMutation: () => vi.fn(),
}));
afterEach(() => { cleanup(); mocks.state = "provisioned"; mocks.fail = false; vi.restoreAllMocks(); mocks.action.mockReset(); });
const props = { title: "Portal access", userId: "user-one", userName: "Synthetic Student", email: "stored@school.local", defaultPassword: "", onNotice: vi.fn() };

it("reopens persisted provisioned state and actual login without a password replay or action", () => {
  render(<PortalCredentialPanel {...props} />);
  expect(screen.getByText("Provisioned")).toBeInTheDocument();
  expect(screen.getByText("stable@school.local")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset password" })).toBeEnabled();
  expect(screen.getByLabelText("Temporary Password")).toHaveValue("");
  expect(mocks.action).not.toHaveBeenCalled();
});

it.each([undefined, "provisioning", "resetting", "reconciliation_required"])("blocks credential operations while state is %s", state => {
  mocks.state = state;
  render(<PortalCredentialPanel {...props} />);
  expect(screen.getByRole("button", { name: "Provision access" })).toBeDisabled();
  expect(mocks.action).not.toHaveBeenCalled();
});

it("shows query failure rather than claiming unprovisioned", () => {
  mocks.fail = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<PortalCredentialPanel {...props} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not check portal access.");
  expect(screen.queryByText("Not provisioned")).not.toBeInTheDocument();
});

it("shows only a successful current operation and clears it when the target changes", async () => {
  mocks.action.mockResolvedValue({ userId: "user-one", email: "stable@school.local", temporaryPassword: "CurrentOnly!123", operationId: "op-one" });
  const view = render(<PortalCredentialPanel {...props} />);
  fireEvent.change(screen.getByLabelText("Temporary Password"), { target: { value: "CurrentOnly!123" } });
  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  await screen.findByText("CurrentOnly!123");
  expect(mocks.action).toHaveBeenCalledWith({ userId: "user-one", temporaryPassword: "CurrentOnly!123", requestKey: expect.any(String) });
  view.rerender(<PortalCredentialPanel {...props} userId="user-two" />);
  await waitFor(() => expect(screen.queryByText("CurrentOnly!123")).not.toBeInTheDocument());
  expect(screen.getByLabelText("Temporary Password")).toHaveValue("");
});
