import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import Commercial from "../../platform/app/commercial/page";
const mocks = vi.hoisted(() => ({ platform: true, save: vi.fn() }));
vi.mock("../../platform/lib/AuthProvider", () => ({
  useAuth: () => ({ isLoading: false, isPlatformAdmin: mocks.platform }),
}));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({
    results: [{ schoolId: "school", name: "Synthetic" }],
    status: "Exhausted",
  }),
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) =>
    args === "skip"
      ? undefined
      : getFunctionName(reference).endsWith("getPlatformUsageCosts")
        ? { rows: [], truncated: false, providerExecutionAvailable: false }
        : getFunctionName(reference).includes("usageEntitlements")
          ? { versions: [], cycles: [], requests: [] }
          : {
          mandates: [],
          choices: [],
          corrections: [],
          rates: [],
          contracts: [],
          invoices: [],
          rosterPreview: { studentCount: 0, excludedCount: 0 },
          gates: {
            reason: "Provider approval required.",
            merchantConnection: "unverified",
            recurringMandate: "unavailable",
          },
        },
  useMutation:
    (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) =>
      mocks.save(getFunctionName(reference), args),
}));
afterEach(() => {
  cleanup();
  mocks.platform = true;
  mocks.save.mockReset();
});
it("denies Platform editing without authority", () => {
  mocks.platform = false;
  render(<Commercial />);
  expect(screen.getByRole("alert").textContent).toContain("Permission denied");
  expect(screen.queryByLabelText("Catalog code")).toBeNull();
});
it("publishes only a confirmed explicit version and retains values after failure", async () => {
  mocks.save.mockRejectedValue(new Error("Catalog version conflict: reload"));
  render(<Commercial />);
  fireEvent.change(screen.getByLabelText("School / catalog audit journal"), {
    target: { value: "school" },
  });
  expect(screen.getByText(/No catalog configured/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Purchase/ }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.change(screen.getAllByLabelText("Effective UTC date")[1], {
    target: { value: "2030-01-01" },
  });
  const confirmation = screen.getByLabelText(
    "Type CONFIRM to publish an immutable version",
  );
  fireEvent.change(confirmation, { target: { value: "CONFIRM" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish new version" }));
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith(
      expect.stringContaining("publishRateVersion"),
      expect.objectContaining({
        confirmation: "CONFIRM",
        expectedVersion: 0,
        rate: expect.objectContaining({
          perStudentMinor: 100000,
          setupMinor: 3000000,
          discountBps: 0,
          minimumMinor: 0,
        }),
      }),
    ),
  );
  expect(screen.getByText("Catalog version conflict: reload")).toBeTruthy();
  expect(
    (screen.getByLabelText("Catalog code") as HTMLInputElement).value,
  ).toBe("core_basic");
});
