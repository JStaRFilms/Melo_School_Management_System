import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DepartureGuardProvider, useDepartureGuard } from "@school/shared/drafts";
import { TeacherCreationForm } from "../app/academic/teachers/components/TeacherCreationForm";
import { SessionCreationModal } from "../app/academic/sessions/components/SessionCreationModal";
import { feePlanValidation } from "../app/billing/fee-plan-validation";
import { initialFeePlanDraft } from "../app/billing/utils";

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => undefined, useMutation: () => mocks.mutate }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function Leave({ onLeave }: { onLeave: () => void }) {
  const { requestDeparture } = useDepartureGuard();
  return <button onClick={async () => { if (await requestDeparture({ kind: "account" })) onLeave(); }}>Leave account</button>;
}

it("guards teacher edits after a failed submission; Stay retains them and discard clears them", async () => {
  const provision = vi.fn().mockRejectedValue(new Error("private provider detail"));
  const leave = vi.fn();
  const { container } = render(<DepartureGuardProvider><TeacherCreationForm onProvision={provision} isSubmitting={false} /><Leave onLeave={leave} /></DepartureGuardProvider>);
  const name = screen.getByPlaceholderText("Adebayo Ogunlesi");
  fireEvent.change(name, { target: { value: "Synthetic Teacher" } });
  fireEvent.change(screen.getByPlaceholderText("teacher@school.edu"), { target: { value: "synthetic@example.test" } });
  const form = container.querySelector("form");
  if (!form) throw new Error("Missing teacher form");
  fireEvent.submit(form);
  await screen.findByText("We could not create that teacher account right now.");
  expect(screen.queryByText("private provider detail")).toBeNull();
  expect(container.querySelector('input[type="password"]')).not.toBeNull();
  fireEvent.click(screen.getByText("Leave account"));
  await screen.findByRole("dialog");
  expect(screen.queryByText("Save draft and leave")).toBeNull();
  fireEvent.click(screen.getByText("Stay here"));
  expect(name).toHaveValue("Synthetic Teacher");
  expect(leave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Leave account"));
  fireEvent.click(await screen.findByText("Discard and leave"));
  await waitFor(() => expect(leave).toHaveBeenCalledOnce());
  expect(name).toHaveValue("");
});

it("does not allow departure discard while teacher creation is pending", async () => {
  const leave = vi.fn();
  render(<DepartureGuardProvider><TeacherCreationForm onProvision={vi.fn()} isSubmitting /><Leave onLeave={leave} /></DepartureGuardProvider>);
  fireEvent.click(screen.getByText("Leave account"));
  fireEvent.click(await screen.findByText("Discard and leave"));
  await screen.findByRole("alert");
  expect(leave).not.toHaveBeenCalled();
});

it("protects session modal close and retains invalid dates without a mutation", async () => {
  const close = vi.fn();
  render(<DepartureGuardProvider><SessionCreationModal isOpen onClose={close} /></DepartureGuardProvider>);
  await waitFor(() => expect(document.querySelectorAll('input[type="date"]')).toHaveLength(2));
  const dates = document.querySelectorAll('input[type="date"]');
  fireEvent.change(dates[0], { target: { value: "2030-09-01" } });
  fireEvent.change(dates[1], { target: { value: "2029-01-01" } });
  const form = document.querySelector("form");
  if (!form) throw new Error("Missing session form");
  fireEvent.submit(form);
  expect(mocks.mutate).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "Escape" });
  await screen.findByText("Stay here");
  fireEvent.click(screen.getByText("Stay here"));
  expect(dates[0]).toHaveValue("2030-09-01");
  expect(close).not.toHaveBeenCalled();
});

it("rejects an invalid optional fee instead of silently dropping it", () => {
  const draft = initialFeePlanDraft();
  draft.name = "Synthetic fee plan";
  draft.lineItems[0].amount = "100";
  expect(feePlanValidation(draft)).toBeNull();
  draft.lineItems.push({ ...draft.lineItems[0], draftId: "optional", label: "Transport", isOptional: true, amount: "Infinity" });
  expect(feePlanValidation(draft)).toContain("Every fee item");
  draft.lineItems[1].amount = "30";
  draft.installmentEnabled = true;
  draft.installmentCount = "2.5";
  expect(feePlanValidation(draft)).toContain("Installments");
  draft.installmentCount = "2";
  expect(feePlanValidation(draft)).toBeNull();
});
