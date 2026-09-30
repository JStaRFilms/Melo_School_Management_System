import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { Id } from "@school/convex/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { useAiSpendReview } from "../AiSpendReview";

const mocks = vi.hoisted(() => ({ confirm: vi.fn(), cancel: vi.fn() }));
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference).endsWith(":confirm") ? mocks.confirm : mocks.cancel,
  useQuery: () => undefined,
}));

afterEach(() => { mocks.confirm.mockReset(); mocks.cancel.mockReset(); });

type Quote = { attemptId: Id<"usageOperationAttempts">; estimate: number; modelProfile: string; expiresAt: number; status: string; availableUnits: number; remainingAfterHold: number };
const quote: Quote = { attemptId: "attempt-1" as Id<"usageOperationAttempts">, estimate: 100, modelProfile: "reviewed-model", expiresAt: Date.now() + 300_000, status: "quoted", availableUnits: 400, remainingAfterHold: 300 };

function ReviewHarness({ prepare }: { prepare: () => Promise<Quote> }) {
  const [formKey, setFormKey] = useState("topic-one");
  const [message, setMessage] = useState("");
  const { reviewAfterQuote, reviewDialog } = useAiSpendReview(formKey);
  return <>
    <input aria-label="Topic" value={formKey} onChange={event => setFormKey(event.target.value)} />
    <button onClick={() => { void reviewAfterQuote(prepare, "lesson plan", 1)
      .then(() => setMessage("Dispatched")).catch(error => setMessage(error.message)); }}>Prepare quote</button>
    <p role="status">{message}</p>
    {reviewDialog}
  </>;
}

it("cancels a delayed quote if the form changed before the review dialog opens", async () => {
  let deliver!: (value: Quote) => void;
  const deferred = new Promise<Quote>(resolve => { deliver = resolve; });
  mocks.cancel.mockResolvedValue(null);
  render(<ReviewHarness prepare={() => deferred} />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare quote" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Topic" }), { target: { value: "topic-two" } });
  await act(async () => { deliver(quote); });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("form changed while preparing"));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.cancel).toHaveBeenCalledWith({ attemptId: quote.attemptId });
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it("invalidates an open quote before confirmation when the form changes", async () => {
  mocks.cancel.mockResolvedValue(null);
  render(<ReviewHarness prepare={async () => quote} />);
  fireEvent.click(screen.getByRole("button", { name: "Prepare quote" }));
  await screen.findByRole("dialog");
  fireEvent.change(screen.getByRole("textbox", { name: "Topic" }), { target: { value: "topic-two" } });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(mocks.cancel).toHaveBeenCalledWith({ attemptId: quote.attemptId });
});
