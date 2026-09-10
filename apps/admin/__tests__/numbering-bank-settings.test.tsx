import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import NumberingPage from "../app/admin/settings/admission-numbering/page";
import { BankAccountsPanel } from "../app/billing/components/BankAccountsPanel";
import { appToast } from "@school/shared";

const mockPolicyState = {
  policy: null as unknown,
  branchCounter: null as { nextSequence: number; configVersion: number; resetFrequency: "continuous"; status: "active" } | null,
  version: 0,
  nextSequence: 1,
  sessionYear: 2025,
  preview: null,
  effectiveFormat: null,
  formatSource: "branch",
  formatVersion: null,
  governance: null,
  counter: null,
  sequences: [],
};

const mocks = vi.hoisted(() => ({ allowed: true, save: vi.fn() }));
const toastErrorSpy = vi.spyOn(appToast, "error");
const toastSuccessSpy = vi.spyOn(appToast, "success");

vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: { state: "ready", branch: { schoolId: "school" } },
  }),
}));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.save,
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    if (name.endsWith("hasViewerCapability")) return mocks.allowed;
    if (name.endsWith("listBankAccounts")) return [];
    if (name.endsWith("getAdmissionNumberPolicy")) {
      return mockPolicyState;
    }
    return undefined;
  },
}));
afterEach(() => {
  cleanup();
  mocks.allowed = true;
  mocks.save.mockReset();
  toastErrorSpy.mockReset();
  toastSuccessSpy.mockReset();
  mockPolicyState.branchCounter = null;
});
it("shows explicit denied settings without mounting sensitive inputs", () => {
  mocks.allowed = false;
  render(<NumberingPage />);
  expect(screen.getByRole("alert").textContent).toContain("denied");
  cleanup();
  render(<BankAccountsPanel />);
  expect(screen.getByText("Bank management access denied.")).toBeTruthy();
  expect(screen.queryByLabelText("accountNumber")).toBeNull();
});
it("submits the reviewed numbering version and exact next sequence and preserves failed edits", async () => {
  mocks.save.mockRejectedValue(new Error("Policy changed"));
  render(<NumberingPage />);
  fireEvent.change(screen.getByLabelText("schoolCode"), {
    target: { value: "SYN" },
  });
  fireEvent.change(screen.getByLabelText("campusCode"), {
    target: { value: "MAIN" },
  });
  fireEvent.change(screen.getByLabelText("Confirm next sequence"), {
    target: { value: "1" },
  });
  fireEvent.click(screen.getByText("Save prospective policy"));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedVersion: 0,
        confirmedNextSequence: 1,
        schoolCode: "SYN",
      }),
    ),
  );
  expect((screen.getByLabelText("schoolCode") as HTMLInputElement).value).toBe(
    "SYN",
  );
  await waitFor(() => {
    expect(screen.getByRole("status").textContent).toContain("Policy changed");
    expect(toastErrorSpy).toHaveBeenCalledWith(
      "Policy updated elsewhere",
      expect.objectContaining({
        description: expect.stringContaining("Policy changed"),
      }),
    );
  });
});
it("cleans raw Convex errors into human-friendly messages and offers sequence reset in toast", async () => {
  mockPolicyState.branchCounter = {
    nextSequence: 1000,
    configVersion: 1,
    resetFrequency: "continuous",
    status: "active",
  };
  const rawConvexError =
    "[CONVEX M(functions/academic/admissionNumbers:updateAdmissionNumberPolicy)] [Request ID: 16ee4c8bc41a0216] Server Error Uncaught ConvexError: The next sequence cannot be moved backwards Called by client";
  mocks.save.mockRejectedValue(new Error(rawConvexError));

  render(<NumberingPage />);

  fireEvent.change(screen.getByLabelText("schoolCode"), {
    target: { value: "MCA" },
  });
  fireEvent.change(screen.getByLabelText("campusCode"), {
    target: { value: "MAIN" },
  });
  fireEvent.change(screen.getByLabelText("Confirm next sequence"), {
    target: { value: "1000" },
  });
  fireEvent.click(screen.getByText("Save prospective policy"));

  await waitFor(() => {
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Sequence cannot be moved backwards");
    expect(status.textContent).toContain("cannot be set lower than #1000");
    // Ensure raw Convex debug metadata is completely scrubbed
    expect(status.textContent).not.toContain("[CONVEX");
    expect(status.textContent).not.toContain("Request ID");
    expect(status.textContent).not.toContain("Called by client");

    // Ensure the unified toast was triggered with human-friendly title, description, and action
    expect(toastErrorSpy).toHaveBeenCalledWith(
      "Sequence cannot be moved backwards",
      expect.objectContaining({
        description: expect.stringContaining("cannot be set lower than #1000"),
        action: expect.objectContaining({
          label: "Reset to #1000",
        }),
      }),
    );
  });

  // Verify invoking the toast action button resets draft sequence to minimum
  const toastAction = toastErrorSpy.mock.calls[0]?.[1]?.action;
  expect(toastAction?.label).toBe("Reset to #1000");
  act(() => { toastAction?.onClick(); });
  expect(
    (screen.getByLabelText("Next sequence") as HTMLInputElement).value,
  ).toBe("1000");
});
it("prevents submitting when the next sequence is set below the active counter", () => {
  mockPolicyState.branchCounter = {
    nextSequence: 500,
    configVersion: 1,
    resetFrequency: "continuous",
    status: "active",
  };
  render(<NumberingPage />);

  const nextSeqInput = screen.getByLabelText("Next sequence");
  fireEvent.change(nextSeqInput, { target: { value: "450" } });

  expect(screen.getByText("Cannot be lower than #500")).toBeTruthy();
  const submitButton = screen.getByRole("button", {
    name: /Save prospective policy/i,
  }) as HTMLButtonElement;
  expect(submitButton.disabled).toBe(true);

  // Click match button to quickly align confirmation
  const matchButton = screen.getByRole("button", { name: /Match #450/i });
  fireEvent.click(matchButton);
  expect(
    (screen.getByLabelText("Confirm next sequence") as HTMLInputElement).value,
  ).toBe("450");

  // Click inline reset to return to minimum allowed counter
  const resetBtn = screen.getByRole("button", { name: /Reset to #500/i });
  fireEvent.click(resetBtn);
  expect((nextSeqInput as HTMLInputElement).value).toBe("500");
  expect(submitButton.disabled).toBe(false);
});
it("requires bank confirmation, sends full values only to authorized save and retains errors", async () => {
  mocks.save.mockRejectedValue(new Error("Save unavailable"));
  render(<BankAccountsPanel />);
  expect(
    screen.getByText(
      "No accounts. The first active account becomes the default.",
    ),
  ).toBeTruthy();
  for (const [label, value] of [
    ["bankName", "Synthetic Bank"],
    ["accountName", "School"],
    ["accountNumber", "1234567890"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  expect(
    (screen.getByText("Save bank details") as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.change(
    screen.getByLabelText("Type CONFIRM for the reviewed change"),
    { target: { value: "CONFIRM" } },
  );
  fireEvent.click(screen.getByText("Save bank details"));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmation: "CONFIRM",
        accountNumber: "1234567890",
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "Save unavailable",
    ),
  );
  expect(
    (screen.getByLabelText("accountNumber") as HTMLInputElement).value,
  ).toBe("1234567890");
});
