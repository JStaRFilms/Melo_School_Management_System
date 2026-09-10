import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import GradingBandsPage from "../app/assessments/setup/grading-bands/page";
const mocks = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: () => mocks.save,
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: { state: "ready", branch: { schoolId: "school" } },
  }),
}));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
let allowed: boolean | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  allowed = true;
  mocks.save.mockResolvedValue(["new-band"]);
  const bands = [{minScore: 0, maxScore: 100, gradeLetter: "X", remark: "Recorded", colorHex: "#123456", version: 4}];
  mocks.query.mockImplementation(
    (ref: FunctionReference<"query">, args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(ref).split(":")[1];
      if (name === "hasViewerCapability") return allowed;
      if (name === "getPolicyGovernance") return null;
      if (name === "getActiveGradingBands")
        return bands;
    },
  );
});
it("does not mount editable rows when denied", () => {
  allowed = false;
  render(<GradingBandsPage />);
  expect(screen.getByRole("alert").textContent).toContain("Permission denied");
  expect(screen.queryByLabelText("Hex color for X")).toBeNull();
});
it("saves hue, branch and loaded revision through the live adapter, then restores six tiers", async () => {
  render(<GradingBandsPage />);
  fireEvent.change(screen.getAllByLabelText("Hex color for X")[0], {
    target: { value: "#ffffaa" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Save Changes" })[0]);
  await waitFor(() =>
    expect(mocks.save).toHaveBeenCalledWith({
      schoolId: "school",
      expectedVersion: 4,
      bands: [
        {
          minScore: 0,
          maxScore: 100,
          gradeLetter: "X",
          remark: "Recorded",
          colorHex: "#ffffaa",
          gradePoints: undefined,
        },
      ],
    }),
  );
  await waitFor(() => expect(screen.queryByText("Unsaved")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Standard" }));
  expect(screen.getAllByLabelText("Hex color for E")).toHaveLength(2);
  expect(screen.getByText("6 Tiers")).toBeDefined();
});
it("retains failed-save edits and allows explicit discard", async () => {
  mocks.save.mockRejectedValue(new Error("Policy changed"));
  render(<GradingBandsPage />);
  fireEvent.change(screen.getAllByLabelText("Hex color for X")[0], {
    target: { value: "#ffffaa" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Save Changes" })[0]);
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "Save Changes" })[0],
    ).not.toBeDisabled(),
  );
  expect(screen.getAllByLabelText("Hex color for X")[0]).toHaveValue("#ffffaa");
  fireEvent.click(screen.getAllByRole("button", { name: "Discard" })[0]);
  expect(screen.getAllByLabelText("Hex color for X")[0]).toHaveValue("#123456");
});
