import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { UsagePreflight } from "../../teacher/app/planning/lesson-plans/components/UsagePreflight";
const state = vi.hoisted(() => ({ calls: vi.fn(), failQuote: false }));
vi.mock("convex/react", () => ({ useMutation: (reference: Parameters<typeof getFunctionName>[0]) => async (args: unknown) => {
  const name = getFunctionName(reference); state.calls(name, args);
  if (name.endsWith("quoteHeavyOperation")) { if (state.failQuote) throw new Error("No active contract-bound usage cycle"); return { _id: "attempt", estimatedUnits: 20, meterType: "ai_tokens", modelProfile: "reviewed-lesson" }; }
  if (name.endsWith("confirmHeavyOperation")) return { message: "Provider execution is unavailable; the reservation was released and customer usage charged is zero." };
  return "attempt";
} }));
afterEach(() => { cleanup(); state.calls.mockReset(); state.failQuote = false; });
it("shows an authoritative estimate before confirmation and truthfully releases unavailable dispatch", async () => {
  render(<UsagePreflight schoolId={"school" as never} itemCount={2} task="teacher_lesson_plan" label="lesson plan" />);
  fireEvent.click(screen.getByRole("button", { name: "Review lesson plan estimate" }));
  expect(await screen.findByText(/20 ai_tokens for 2 selected sources/)).toBeTruthy();
  expect(screen.getByText(/not a money price/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirm and test safe dispatch" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("customer usage charged is zero"));
  expect(state.calls).toHaveBeenCalledWith(expect.stringContaining("confirmHeavyOperation"), expect.objectContaining({ expectedUnits: 20, confirmation: "CONFIRM" }));
});
it("fails closed and keeps provider dispatch unavailable when no cycle exists", async () => {
  state.failQuote = true;
  render(<UsagePreflight schoolId={"school" as never} itemCount={1} task="provider_ocr" label="OCR" />);
  fireEvent.click(screen.getByRole("button", { name: "Review OCR estimate" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("No active contract-bound usage cycle"));
  expect(screen.queryByRole("button", { name: /Confirm and test/ })).toBeNull();
});
