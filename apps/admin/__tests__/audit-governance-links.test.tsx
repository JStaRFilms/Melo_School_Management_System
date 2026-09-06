import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AuditPage from "../app/admin/audit/page";

const mocks = vi.hoisted(() => ({ capabilities: ["audit.branch.view"] as string[] }));

vi.mock("convex/react", () => ({
  useQuery: () => false,
  useConvex: vi.fn(),
  useMutation: vi.fn(),
  usePaginatedQuery: vi.fn(),
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { schoolId: "school" },
      membership: { membershipId: "membership" },
      effectiveCapabilities: mocks.capabilities,
    },
  }),
}));

beforeEach(() => {
  mocks.capabilities = ["audit.branch.view"];
});

it("does not advertise cross-governance routes without their capabilities", () => {
  const view = render(<AuditPage />);
  expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "School group" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Permissions" })).not.toBeInTheDocument();

  mocks.capabilities = [
    "audit.branch.view",
    "audit.group.view",
    "staff.list.view",
    "staff.permissions.manage",
  ];
  view.rerender(<AuditPage />);
  expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "School group" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Permissions" })).toBeInTheDocument();
});
