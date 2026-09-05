import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DataMigrationWorkbench } from "../../../packages/shared/src/components/migration/DataMigrationWorkbench";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  approve: vi.fn(),
  review: vi.fn(),
  status: "reviewing",
  reviewed: false,
}));
const record = {
  _id: "row", rowNumber: 1, entityType: "student", rowRevision: 1,
  parsedData: { firstName: "Ada", lastName: "Example", gender: "Female", className: "Raw JSS1" },
  validationStatus: "warning", validationErrors: [], isResolved: false,
};
vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({
    results: [{ ...record, reviewStatus: mocks.reviewed ? "approved" : "pending", validationStatus: mocks.reviewed ? "valid" : "warning", isResolved: mocks.reviewed }],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
  useMutation: (name: string) => {
    if (name.endsWith(":commitImportWorkspace")) return mocks.commit;
    if (name.endsWith(":approveImportWorkspace")) return mocks.approve;
    if (name.endsWith(":reviewStagedRecord")) return mocks.review;
    return vi.fn();
  },
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (name.endsWith(":listWorkspaces")) return [{ _id: "workspace", name: "Private import", status: mocks.status, totalRecords: 1, createdAt: 1 }];
    if (name.endsWith(":getWorkspaceSummary")) return { name: "Private import", status: mocks.status, totalRecords: 1, validRecords: mocks.reviewed ? 1 : 0, errorRecords: 0, warningRecords: mocks.reviewed ? 0 : 1 };
    if (name.endsWith(":getWorkspaceReviewOptions")) return {
      classes: [{ id: "class", name: "JSS 1A", level: "JSS 1" }], subjects: [], families: [], students: [],
      availableStudentUsers: [{ id: "user", name: "Ada Identity" }], sessions: [],
      numbering: { available: true, nextNumber: "SCH/2026/0010", nextSequence: 10, policyVersion: 1 },
    };
    return [];
  },
}));
afterEach(() => {
  cleanup();
  mocks.commit.mockReset(); mocks.approve.mockReset(); mocks.review.mockReset();
  mocks.status = "reviewing"; mocks.reviewed = false;
});

it("truthfully gates commit until explicit row review and plan approval", async () => {
  render(<DataMigrationWorkbench schoolId="school" mode="school_admin" />);
  expect(screen.getByText(/AI interpretation unavailable/)).toBeTruthy();
  fireEvent.click(screen.getByText("Private import"));
  expect(screen.getByRole("button", { name: "Commit approved plan" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Approve reviewed plan" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Review row" }));
  expect(screen.getByText(/Imported text is reference data, never a database instruction/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Existing un-enrolled student identity"), { target: { value: "user" } });
  fireEvent.change(screen.getByLabelText("Existing class placement"), { target: { value: "class" } });
  fireEvent.click(screen.getByRole("button", { name: "Save reviewed decision" }));
  await waitFor(() => expect(mocks.review).toHaveBeenCalledWith(expect.objectContaining({
    recordId: "row", selectedUserId: "user", selectedClassId: "class",
    admissionNumberMode: "official_generated", expectedNumberPolicyVersion: 1,
  })));
  expect(mocks.commit).not.toHaveBeenCalled();
});

it("retains acknowledged audited-batch progress and retries only through approved commit", async () => {
  mocks.status = "ready"; mocks.reviewed = true;
  mocks.commit.mockResolvedValueOnce({ done: false, processedRecords: 1, totalRecords: 2, receiptId: "receipt-1" })
    .mockRejectedValueOnce(new Error("Synthetic batch failure"))
    .mockResolvedValueOnce({ done: true, processedRecords: 2, totalRecords: 2, receiptId: "receipt-2" });
  const success = vi.fn();
  render(<DataMigrationWorkbench schoolId="school" mode="school_admin" onSuccess={success} />);
  fireEvent.click(screen.getByText("Private import"));
  fireEvent.click(screen.getByRole("button", { name: "Commit approved plan" }));
  await waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(2));
  expect(screen.getByText(/1 \/ 2 records processed/)).toBeTruthy();
  expect(success).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Commit approved plan" }));
  await waitFor(() => expect(success).toHaveBeenCalledOnce());
  expect(screen.getByText(/2 \/ 2 records processed/)).toBeTruthy();
  expect(mocks.commit).toHaveBeenLastCalledWith({ schoolId: "school", workspaceId: "workspace" });
});
