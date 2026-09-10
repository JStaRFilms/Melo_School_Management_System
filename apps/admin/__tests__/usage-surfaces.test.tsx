import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import Usage from "../app/billing/usage/page";
import { UsageCosts } from "../../platform/app/commercial/UsageCosts";
import type { Id } from "../../../packages/convex/_generated/dataModel";
const state = vi.hoisted(() => ({ allowed: true as boolean | undefined, populated: false }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } } }) }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
  if (args === "skip") return undefined;
  const name = getFunctionName(ref);
  if (name.endsWith("hasViewerCapability")) return state.allowed;
  if (name.includes("usageEntitlements")) return { cycle: null, meters: [], requests: [], groupPools: [], canAllocatePool: false };
  if (name.endsWith("listUsageEvents")) return [];
  if (name.endsWith("getUsageStatus")) return state.populated ? [{ meterType: "storage_bytes", consumedUnits: 90, reservedUnits: 0, availableUnits: 10, allocatedUnits: 100, utilizationPercent: 90, isCritical90: true, isHardStopped: false, isWarning75: false, resetCadence: "termly", lastResetAt: 1, activeStorageBytes: 60, trashStorageBytes: 30, tempStorageBytes: null }] : [];
  if (name.endsWith("getPlatformUsageCosts")) return { truncated: false, providerExecutionAvailable: false, rows: state.populated ? [{ _id: "cost", provider: "local-double", model: "synthetic", operationId: "operation", outcome: "failed", currency: "USD", costMinor: 3, inputTokens: 40, measuredAt: 1 }] : [] };
  return undefined;
} }));
afterEach(() => { cleanup(); state.allowed = true; state.populated = false; });
it("has denied/loading/no-entitlement states and never invents purchase or prices", () => {
  state.allowed = undefined;
  render(<Usage />);
  expect(screen.getByRole("status").textContent).toContain("Loading");
  cleanup(); state.allowed = false;
  render(<Usage />);
  expect(screen.getByRole("alert").textContent).toContain("denied");
  cleanup(); state.allowed = true;
  render(<Usage />);
  expect(screen.getByText(/No current contract-bound entitlement cycle/)).toBeTruthy();
  expect(screen.getByText(/Customer monetary usage charges: unavailable/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Buy top-up/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: /Request exception/ })).toBeNull();
});
it("shows urgent allowance and separate unknown storage bucket without freeing trash", () => {
  state.populated = true; render(<Usage />);
  expect(screen.getByRole("alert").textContent).toContain("90% warning");
  expect(screen.getByText(/Storage bytes/).textContent).toContain("temporary: not recorded");
  expect(screen.getByText(/Storage bytes/).textContent).toContain("Trash is not free space");
});
it("shows actual recorded monetary dimensions, including failed cost, without inventing missing evidence", () => {
  render(<UsageCosts schoolId={"school" as Id<"schools">} />);
  expect(screen.getByText(/Spend is unknown, not zero/)).toBeTruthy();
  cleanup(); state.populated = true;
  render(<UsageCosts schoolId={"school" as Id<"schools">} />);
  expect(screen.getByText(/failed.*USD 3 minor units/)).toBeTruthy();
  expect(screen.getByText(/Input tokens: 40/).textContent).toContain("output tokens: unknown");
});
