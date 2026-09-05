import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import Subscription from "../app/billing/subscription/page";
import Settlements from "../app/billing/settlements/page";
const mocks = vi.hoisted(() => ({
  allowed: true as boolean | undefined,
  loading: false,
  populated: false,
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: { state: "ready", branch: { schoolId: "school" } },
  }),
}));
vi.mock("convex/react", () => ({
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    if (name.endsWith("hasViewerCapability")) return mocks.allowed;
    if (mocks.loading) return undefined;
    if (name.endsWith("getCommercialWorkspace"))
      return {
        mandates: [],
        contracts: [],
        rates: [],
        invoices: [],
        legacy: { status: "active" },
        gates: {
          merchantConnection: "unverified",
          recurringMandate: "unavailable",
          reason: "Provider, finance and legal approval required.",
        },
        truncated: false,
      };
    if (name.endsWith("getSettlementLedger"))
      return mocks.populated
        ? [
            {
              _id: "ledger",
              transactionRef: "synthetic-ref",
              routingMode: "mode_a_direct",
              status: "held_dispute",
              currency: "NGN",
              grossAmountKobo: 10000,
              paystackFeeKobo: 100,
              platformFeeKobo: 0,
              netPayoutKobo: 9900,
              clearingCycle: "NIBSS_T_PLUS_1",
              estimatedSettlementDate: 1,
              legs: [
                {
                  _id: "leg",
                  kind: "refund",
                  amountMinor: -1000,
                  evidenceReference: "refund-proof",
                },
              ],
            },
          ]
        : [];
    return undefined;
  },
}));
afterEach(() => {
  cleanup();
  mocks.allowed = true;
  mocks.loading = false;
  mocks.populated = false;
});
it("shows loading/denied/empty legacy subscription and fail-closed purchase states", () => {
  mocks.allowed = undefined;
  render(<Subscription />);
  expect(screen.getByRole("status").textContent).toContain("Loading");
  cleanup();
  mocks.allowed = false;
  render(<Subscription />);
  expect(screen.getByRole("alert").textContent).toContain("denied");
  cleanup();
  mocks.allowed = true;
  render(<Subscription />);
  expect(screen.getByText(/No versioned contract/)).toBeTruthy();
  expect(
    screen.getByText(/Historical price snapshot unavailable/),
  ).toBeTruthy();
  expect(screen.getByText(/No subscription invoices issued/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /Purchase/ }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen
      .getByRole("link", { name: "Collection settlements" })
      .getAttribute("href"),
  ).toBe("/billing/settlements");
});
it("separates settlement legs, never presents historical next-day estimate as evidence", () => {
  render(<Settlements />);
  expect(screen.getByText(/No settlement records/)).toBeTruthy();
  cleanup();
  mocks.populated = true;
  render(<Settlements />);
  expect(screen.getByText(/-1000.*refund-proof/)).toBeTruthy();
  expect(
    screen.getByText(/Verified clearing evidence unavailable/),
  ).toBeTruthy();
  expect(screen.queryByText(/1970/)).toBeNull();
  expect(screen.getByText(/Recorded net payout/)).toBeTruthy();
  cleanup();
  mocks.allowed = false;
  render(<Settlements />);
  expect(screen.getByRole("alert").textContent).toContain("denied");
});
