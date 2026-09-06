import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminDashboardPage from "../app/admin/dashboard/page";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/react", () => ({ useQuery: mocks.query }));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { name: "Test School" },
      effectiveCapabilities: [],
    },
  }),
}));

it("renders a capability-free landing without starting dashboard queries", () => {
  mocks.query.mockReturnValue(undefined);

  render(<AdminDashboardPage />);

  expect(
    screen.getByRole("heading", { name: "Welcome to Test School" }),
  ).toBeInTheDocument();
  expect(mocks.query).toHaveBeenCalledTimes(7);
  expect(mocks.query.mock.calls.every(([, args]) => args === "skip")).toBe(true);
});
