import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataMigrationWorkbench } from "../../../packages/shared/src/components/migration/DataMigrationWorkbench";

const mocks = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (name: string) => name.endsWith(":commitImportWorkspace") ? mocks.commit : vi.fn(),
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (name.endsWith(":listWorkspaces")) return [{ _id: "workspace", name: "Private import", status: "reviewing", totalRecords: 100, createdAt: 1 }];
    if (name.endsWith(":getWorkspaceSummary")) return { name: "Private import", status: "reviewing", totalRecords: 100, validRecords: 100, errorRecords: 0, warningRecords: 0 };
    return [];
  },
}));
afterEach(() => { cleanup(); mocks.commit.mockReset(); });

it("labels AI unavailable and retains acknowledged partial progress for retry", async () => {
  mocks.commit.mockResolvedValueOnce({ done: false, processedRecords: 50, totalRecords: 100 })
    .mockRejectedValueOnce(new Error("Synthetic batch failure"))
    .mockResolvedValueOnce({ done: true, processedRecords: 100, totalRecords: 100 });
  const success = vi.fn();
  render(<DataMigrationWorkbench schoolId="school" mode="school_admin" onSuccess={success} />);
  expect(screen.getByText(/AI interpretation unavailable/)).toBeTruthy();
  fireEvent.click(screen.getByText("Private import"));
  fireEvent.click(screen.getByRole("button", { name: /Commit & Merge/ }));
  await waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(2));
  expect(screen.getByText(/50 \/ 100 records processed/)).toBeTruthy();
  expect(success).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: /Commit & Merge/ }).hasAttribute("disabled")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /Commit & Merge/ }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(screen.getByText(/100 \/ 100 records processed/)).toBeTruthy();
  expect(mocks.commit).toHaveBeenLastCalledWith({ schoolId: "school", workspaceId: "workspace" });
});
