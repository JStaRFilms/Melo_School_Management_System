import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@school/convex/_generated/dataModel";
import { AccountNoticePanel } from "../app/academic/students/components/AccountNoticePanel";

const mocks = vi.hoisted(() => ({ state: undefined as unknown, enqueue: vi.fn(), retry: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.state, useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference).endsWith(":retryAccountNotice") ? mocks.retry : mocks.enqueue }));
afterEach(() => { cleanup(); mocks.enqueue.mockReset(); mocks.retry.mockReset(); });
const userId = "stored-user" as Id<"users">;
const base = { linked: true, operationId: "committed-operation", student: true, ownRecipient: null, guardians: [{ userId: "linked-parent", name: "Grace", email: "real@example.test" }], notice: null };

it("does not send on opening and uses an explicit stored linked guardian and operation ID", async () => {
  mocks.state = base;
  render(<AccountNoticePanel userId={userId} />);
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Queue account notice" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "linked-parent" } });
  fireEvent.click(screen.getByRole("button", { name: "Queue account notice" }));
  await waitFor(() => expect(mocks.enqueue).toHaveBeenCalledWith({ userId, operationId: "committed-operation", guardianUserId: "linked-parent" }));
  expect(JSON.stringify(mocks.enqueue.mock.calls)).not.toContain("real@example.test");
});

it("reopens persisted provider acceptance without claiming delivery or recovering credentials", () => {
  mocks.state = { ...base, notice: { id: "notice-one", state: "accepted", recipientEmail: "real@example.test", attemptCount: 1 } };
  const view = render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByRole("status")).toHaveTextContent("Delivery is not confirmed");
  view.unmount(); render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByRole("status")).toHaveTextContent("Email provider accepted");
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(mocks.retry).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("reopens persisted operator review without configuration messaging or another retry", () => {
  mocks.state = { ...base, notice: { id: "notice-one", state: "reconciliation_required", recipientEmail: "real@example.test", attemptCount: 1 } };
  const view = render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByRole("status")).toHaveTextContent("Notice needs operator review. Account credentials are unchanged.");
  view.unmount(); render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByRole("status")).toHaveTextContent("Notice needs operator review");
  expect(screen.queryByText(/email is not configured/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(mocks.retry).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("retries only the existing outbox record and keeps notice failure distinct from account status", async () => {
  mocks.state = { ...base, notice: { id: "notice-one", state: "failed", recipientEmail: "real@example.test", attemptCount: 1 } };
  render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByRole("status")).toHaveTextContent("Account credentials are unchanged");
  fireEvent.click(screen.getByRole("button", { name: "Retry notice" }));
  await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith({ outboxId: "notice-one" }));
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("offers deliberate retry of an ineligible row after its original recipient is repaired", async () => {
  mocks.state = { ...base, notice: { id: "notice-one", state: "ineligible", recipientEmail: "real@example.test", attemptCount: 1 } };
  render(<AccountNoticePanel userId={userId} />);
  expect(mocks.retry).not.toHaveBeenCalled();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry notice" }));
  await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith({ outboxId: "notice-one" }));
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("shows a rejected still-ineligible retry without selecting another guardian or enqueueing", async () => {
  mocks.state = { ...base, guardians: [], notice: { id: "notice-one", state: "ineligible", recipientEmail: "real@example.test", attemptCount: 1 } };
  mocks.retry.mockRejectedValueOnce(new Error("Notice recipient is no longer eligible"));
  render(<AccountNoticePanel userId={userId} />);
  fireEvent.click(screen.getByRole("button", { name: "Retry notice" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Notice recipient is no longer eligible");
  expect(mocks.retry).toHaveBeenCalledWith({ outboxId: "notice-one" });
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});

it.each(["failed", "not_configured", "ineligible"])("does not offer retry for exhausted %s notices", state => {
  mocks.state = { ...base, notice: { id: "notice-one", state, recipientEmail: "real@example.test", attemptCount: 5 } };
  render(<AccountNoticePanel userId={userId} />);
  expect(screen.queryByRole("button", { name: "Retry notice" })).not.toBeInTheDocument();
  expect(mocks.retry).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("does not offer student login delivery without eligible guardians or a committed operation", () => {
  mocks.state = { ...base, guardians: [] };
  const view = render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByText(/student login ID cannot receive notices/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  mocks.state = { ...base, operationId: null };
  view.rerender(<AccountNoticePanel userId={userId} />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("does not queue a committed but unlinked account or call it a credential failure", () => {
  mocks.state = { ...base, linked: false, student: false, ownRecipient: "admin@example.test" };
  render(<AccountNoticePanel userId={userId} />);
  expect(screen.getByText(/account linkage needs review/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
