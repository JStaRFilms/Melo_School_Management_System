import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DepartureGuardProvider, parseDraftPayload } from "@school/shared/drafts";
import { usePersistentFormDraft } from "@/usePersistentFormDraft";
import { FeePlanForm } from "../app/billing/components/forms/FeePlanForm";
import { initialFeePlanDraft } from "../app/billing/utils";
import { ReportCardBundlesScreen } from "../app/assessments/setup/report-card-bundles/components/ReportCardBundlesScreen";

const mocks = vi.hoisted(() => ({
  server: null as null | Record<string, unknown>,
  begin: vi.fn(), save: vi.fn(), discard: vi.fn(), commit: vi.fn(),
}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: undefined }) }));
vi.mock("convex/react", () => ({
  useQuery: (reference: object) => {
    const symbol = Object.getOwnPropertySymbols(reference)[0];
    const name = symbol ? String((reference as Record<symbol, unknown>)[symbol]) : "";
    return name.endsWith(":getFormDraft") ? mocks.server : [];
  },
  useMutation: (reference: object) => {
    const symbol = Object.getOwnPropertySymbols(reference)[0];
    const name = symbol ? String((reference as Record<symbol, unknown>)[symbol]) : "";
    if (name.endsWith(":beginFormDraft")) return mocks.begin;
    if (name.endsWith(":saveFormDraft")) return mocks.save;
    if (name.endsWith(":discardFormDraft")) return mocks.discard;
    if (name.endsWith(":commitFormDraft")) return mocks.commit;
    throw new Error(`Unexpected mutation ${name}`);
  },
}));
afterEach(() => { mocks.server = null; vi.clearAllMocks(); });

const schoolId = "school-one" as never;
const connection = { connected: true, authenticated: true, accountId: "account-one" };
const payload = parseDraftPayload("fee_plan_builder", {
  bankAccountId: "bank-one", name: "Synthetic fees", description: "Private operational notes", currency: "NGN", billingMode: "class_default", targetClassIds: ["class-one"], installmentEnabled: true, installmentCount: "2", intervalDays: "30", firstDueDays: "14",
  lineItems: [{ label: "Tuition", amount: "5000", category: "tuition", isOptional: false }],
});

it("recovers a complete fee projection, returns the exact closure revision, and never persists secrets", async () => {
  mocks.server = { schoolId, draftId: "fee-draft", formKey: "fee_plan_builder", payload, revision: 3, lastSavedAt: 123, expiresAt: Date.now() + 10000, schemaVersion: 1 };
  mocks.save.mockResolvedValue({ draftId: "fee-draft", revision: 4, lastSavedAt: 456 });
  const restore = vi.fn();
  const hook = renderHook(() => usePersistentFormDraft({ formKey: "fee_plan_builder", schoolId, accountId: "account-one", connection, currentData: payload, isDirty: true, instanceKey: 0, onRestore: restore }));
  await waitFor(() => expect(hook.result.current.showRecoveryModal).toBe(true));
  expect(restore).not.toHaveBeenCalled();
  act(() => hook.result.current.handleResumeDraft());
  expect(restore).toHaveBeenCalledWith(payload);
  const closure = await act(async () => hook.result.current.prepareSubmission());
  expect(closure).toEqual({ schoolId, draftId: "fee-draft", expectedRevision: 4 });
  expect(JSON.stringify(mocks.save.mock.calls[0]?.[0])).not.toMatch(/accountNumber|secret|token|document|password/i);
});

it("strictly excludes bank details, provider payloads, credentials, and raw documents", () => {
  for (const extra of [{ accountNumber: "0123456789" }, { secretKey: "secret" }, { providerPayload: {} }, { password: "secret" }, { file: "raw" }]) {
    expect(() => parseDraftPayload("fee_plan_builder", { ...payload, ...extra })).toThrow();
  }
  expect(() => parseDraftPayload("academic_setup", { name: "2030/2031", startDate: "2030-09-01", endDate: "2031-07-01", isActive: true, autoGenerateTerms: true, documentUrl: "https://example.test/raw" })).toThrow();
});

it("uses validated completion independently from save status", () => {
  const draft = initialFeePlanDraft();
  const view = render(<DepartureGuardProvider><FeePlanForm draft={draft} onChange={vi.fn()} onSubmit={vi.fn()} classes={[]} draftStatus="saving" /></DepartureGuardProvider>);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  expect(screen.getByText(/Saving/i)).toBeInTheDocument();
  draft.name = "Synthetic fees";
  draft.lineItems[0].amount = "5000";
  view.rerender(<DepartureGuardProvider><FeePlanForm draft={{ ...draft }} onChange={vi.fn()} onSubmit={vi.fn()} classes={[]} draftStatus="saved" draftLastSavedAt={123} /></DepartureGuardProvider>);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect(screen.getByText(/Saved/i)).toBeInTheDocument();
  fireEvent.scroll(window);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
});

it("retains report edits made during an in-flight domain save", async () => {
  let resolveSave!: (id: string) => void;
  const onSaveScaleTemplate = vi.fn(() => new Promise<string>((resolve) => { resolveSave = resolve; }));
  render(
    <DepartureGuardProvider>
      <ReportCardBundlesScreen
        scaleTemplates={[{ _id: "scale-one", updatedAt: 1, name: "Conduct", description: "Original", options: [{ id: "excellent", label: "Excellent", shortLabel: "A", order: 0 }] }]}
        bundles={[]}
        onSaveScaleTemplate={onSaveScaleTemplate}
        onSaveBundle={vi.fn()}
        renderAssignmentPanel={() => null}
      />
    </DepartureGuardProvider>,
  );
  fireEvent.click(screen.getByText("Rating Scales"));
  const description = await screen.findByPlaceholderText("e.g. Used for Primary affective evaluation");
  fireEvent.change(description, { target: { value: "Submitted snapshot" } });
  fireEvent.click(screen.getByText("Save Scale"));
  await screen.findByText("Processing...");
  fireEvent.change(description, { target: { value: "Newer local edit" } });
  await act(async () => { resolveSave("scale-one"); });
  expect(description).toHaveValue("Newer local edit");
  expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
  expect(onSaveScaleTemplate).toHaveBeenCalledTimes(1);
});
