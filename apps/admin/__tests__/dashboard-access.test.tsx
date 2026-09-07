import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminDashboardPage from "../app/admin/dashboard/page";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  capabilities: [] as string[],
}));

vi.mock("convex/react", () => ({ useQuery: mocks.query }));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { name: "Test School" },
      effectiveCapabilities: mocks.capabilities,
    },
  }),
}));

it("renders a capability-free landing without starting dashboard queries", () => {
  mocks.capabilities.splice(0);
  mocks.query.mockReturnValue(undefined);

  render(<AdminDashboardPage />);

  expect(
    screen.getByRole("heading", { name: "Welcome to Test School" }),
  ).toBeInTheDocument();
  expect(mocks.query).toHaveBeenCalledTimes(7);
  expect(mocks.query.mock.calls.every(([, args]) => args === "skip")).toBe(true);
});

it("shows academic dashboard details without querying or linking billing", () => {
  mocks.capabilities.splice(
    0,
    mocks.capabilities.length,
    "staff.list.view",
    "academic.classes.manage",
  );
  mocks.query.mockImplementation((_name, args) =>
    args === "skip" ? undefined : [],
  );

  render(<AdminDashboardPage />);

  expect(
    screen.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Billing Hub" })).toBeNull();
  expect(
    mocks.query.mock.calls.find(
      ([name]) => name === "functions/billing:getBillingDashboard",
    )?.[1],
  ).toBe("skip");
});
