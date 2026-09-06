import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import NumberingPage from "../app/admin/settings/admission-numbering/page";
import { BankAccountsPanel } from "../app/billing/components/BankAccountsPanel";
const mocks = vi.hoisted(() => ({ allowed: true, save: vi.fn() }));
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
    if (name.endsWith("getAdmissionNumberPolicy"))
      return {
        policy: null,
        branchCounter: null,
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
    return undefined;
  },
}));
afterEach(() => {
  cleanup();
  mocks.allowed = true;
  mocks.save.mockReset();
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
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("Policy changed"),
  );
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
