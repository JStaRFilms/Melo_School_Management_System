import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import AssetsWorkspace from "../app/admin/assets/AssetsWorkspace";
const state = vi.hoisted(() => ({ allowed: true as boolean | undefined, area: "library", error: false, empty: false, held: false, mutate: vi.fn() }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } } }) }));
const row = () => ({ _id: "asset", schoolId: "school", fileName: "Policy.pdf", category: "Policy", description: "Private rules", mimeType: "application/pdf", byteSize: 12, sha256: "abc", validationStatus: "pending", scanStatus: "quarantined", archivedAt: state.area === "archive" ? 1 : null, isTrashed: state.area === "trash", trashedAt: state.area === "trash" ? 1 : null, purgeScheduledAt: state.area === "trash" ? 2 : null, accountingReady: true, createdAt: 1, updatedAt: 1, ownerName: "School Owner", holds: state.held ? [{ _id: "hold", reason: "Statutory retention", appliedAt: 1 }] : [], shares: [], candidates: [], pdfEligibility: "unavailable: runtime approval", hasRollbackOriginal: false, rollbackExpiryAt: null, isOptimized: false });
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name.endsWith("hasViewerCapability")) return state.allowed;
    if (name.endsWith("getWorkspace")) return { capabilities: ["assets.library.view", "assets.upload", "assets.metadata.edit", "assets.trash.manage", "assets.archive.manage", "assets.restore", "assets.holds.apply", "assets.permanent_delete"], uploadAvailable: false, maxFileSizeBytes: 26214400, policyReference: null, trashRetentionDays: 30, storage: { active: 12, trash: 5, temp: null, consumed: 17, reserved: 0, available: 83, allocated: 100 } };
    if (name.endsWith("inspectAsset")) return row();
    if (name.endsWith("listSharedAssets")) return { rows: [], truncated: false };
    return [];
  },
  usePaginatedQuery: () => ({ results: state.empty ? [] : [row()], status: "Exhausted", loadMore: vi.fn() }),
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => async (args: unknown) => { state.mutate(getFunctionName(ref), args); if (state.error) throw new Error("Storage deletion failed; bytes remain charged"); },
}));
afterEach(() => { cleanup(); state.allowed = true; state.area = "library"; state.error = false; state.empty = false; state.held = false; state.mutate.mockReset(); });
it("renders denied, loading, empty, navigation and independent unknown storage states", () => {
  state.allowed = undefined; render(<AssetsWorkspace area="library" />); expect(screen.getByRole("status").textContent).toContain("Loading");
  cleanup(); state.allowed = false; render(<AssetsWorkspace area="library" />); expect(screen.getByRole("alert").textContent).toContain("denied");
  cleanup(); state.allowed = true; state.empty = true; render(<AssetsWorkspace area="library" />);
  expect(screen.getByText("No matching loaded assets.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Asset Archive" }).getAttribute("href")).toBe("/admin/assets/archive");
  expect(screen.getByRole("link", { name: "Trash" }).getAttribute("href")).toBe("/admin/assets/trash");
  expect(screen.getByText(/Temporary \/ rollback/).textContent).toContain("not recorded");
  expect(screen.getByText(/Uploads unavailable: secure tenant ownership/)).toBeTruthy();
});
it("filters loaded records and inspects real metadata without clean or download claims", () => {
  render(<AssetsWorkspace area="library" />);
  fireEvent.change(screen.getByLabelText("Search loaded assets"), { target: { value: "missing" } });
  expect(screen.getByText("No matching loaded assets.")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search loaded assets"), { target: { value: "rules" } });
  fireEvent.click(screen.getByRole("button", { name: "Inspect Policy.pdf" }));
  expect(screen.getByText(/Owner: School Owner/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Download unavailable/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: /Optimize unavailable/ }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("link", { name: /Download/ })).toBeNull();
});
it("Archive is not Trash; archive return calls its own mutation", async () => {
  state.area = "archive"; render(<AssetsWorkspace area="archive" />);
  expect(screen.getByText(/Archive keeps files indefinitely/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Inspect Policy.pdf" }));
  fireEvent.click(screen.getByRole("button", { name: "Return to library" }));
  await waitFor(() => expect(state.mutate).toHaveBeenCalledWith(expect.stringContaining("setArchived"), { schoolId: "school", assetId: "asset", archived: false }));
});
it("requires exact purge confirmation and retains retryable storage failure without success", async () => {
  state.area = "trash"; state.error = true; render(<AssetsWorkspace area="trash" />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Policy.pdf" }));
  const purge = screen.getByRole("button", { name: "Permanently purge this asset" });
  expect(purge.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Type PURGE Policy.pdf"), { target: { value: "PURGE Policy.pdf" } });
  expect(purge.hasAttribute("disabled")).toBe(false); fireEvent.click(purge);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("bytes remain charged"));
  expect(state.mutate).toHaveBeenCalledWith(expect.stringContaining("permanentPurgeAsset"), { schoolId: "school", assetId: "asset", confirmation: "PURGE Policy.pdf" });
  expect(screen.getByRole("button", { name: "Restore to library" })).toBeTruthy();
});
it("retention hold blocks exact-confirmed purge and does not imply removal authority", () => {
  state.area = "trash"; state.held = true; render(<AssetsWorkspace area="trash" />);
  fireEvent.click(screen.getByRole("button", { name: "Inspect Policy.pdf" }));
  fireEvent.change(screen.getByLabelText("Type PURGE Policy.pdf"), { target: { value: "PURGE Policy.pdf" } });
  expect(screen.getByRole("button", { name: "Permanently purge this asset" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Proprietor hold-removal authority required.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Release hold/ })).toBeNull();
});
