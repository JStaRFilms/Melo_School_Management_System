import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminManagementPage from "../app/admin/page";

const mocks = vi.hoisted(() => ({ capabilities: ["staff.list.view"] as string[] }));

vi.mock("convex/react", () => ({
  useQuery: (reference: string) =>
    reference.includes("listSchoolAdmins")
      ? { viewerUserId: "viewer", leadAdmin: null, admins: [] }
      : [],
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      effectiveCapabilities: mocks.capabilities,
    },
  }),
}));
vi.mock("../app/admin/components/AdminCreationForm", () => ({ AdminCreationForm: () => null }));
vi.mock("../app/admin/components/LeadProtectionSection", () => ({ LeadProtectionSection: () => null }));
vi.mock("../app/admin/components/TeacherPromotionSection", () => ({ TeacherPromotionSection: () => null }));
vi.mock("../app/admin/components/AdminDirectorySection", () => ({ AdminDirectorySection: () => null }));

beforeEach(() => {
  mocks.capabilities = ["staff.list.view"];
});

it("shows the school-group link only with group audit authority", () => {
  const view = render(<AdminManagementPage />);
  expect(screen.queryByRole("link", { name: "School group" })).not.toBeInTheDocument();

  mocks.capabilities = ["staff.list.view", "audit.group.view"];
  view.rerender(<AdminManagementPage />);
  expect(screen.getByRole("link", { name: "School group" })).toHaveAttribute(
    "href",
    "/admin/group",
  );
});
