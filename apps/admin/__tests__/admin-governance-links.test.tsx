import { beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminManagementPage from "../app/admin/page";

const mocks = vi.hoisted(() => ({
  capabilities: ["staff.list.view"] as string[],
  permissionManaged: true,
  isProprietor: false,
}));

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
      membership: { isProprietor: mocks.isProprietor },
      compatibility: { permissionManaged: mocks.permissionManaged },
    },
  }),
}));
vi.mock("../app/admin/components/AdminCreationForm", () => ({
  AdminCreationForm: () => <div>Admin creation controls</div>,
}));
vi.mock("../app/admin/components/LeadProtectionSection", () => ({ LeadProtectionSection: () => null }));
vi.mock("../app/admin/components/TeacherPromotionSection", () => ({
  TeacherPromotionSection: () => <div>Teacher promotion controls</div>,
}));
vi.mock("../app/admin/components/AdminDirectorySection", () => ({
  AdminDirectorySection: ({
    canManagePermissions,
    canSuspendAdmins,
  }: {
    canManagePermissions: boolean;
    canSuspendAdmins: boolean;
  }) => (
    <div>
      lifecycle:{String(canManagePermissions)}:{String(canSuspendAdmins)}
    </div>
  ),
}));

beforeEach(() => {
  mocks.capabilities = ["staff.list.view"];
  mocks.permissionManaged = true;
  mocks.isProprietor = false;
});

it("keeps lifecycle controls hidden from directory-only viewers", () => {
  render(<AdminManagementPage />);

  expect(screen.queryByText("Admin creation controls")).not.toBeInTheDocument();
  expect(screen.queryByText("Teacher promotion controls")).not.toBeInTheDocument();
  expect(screen.getByText("lifecycle:false:false")).toBeInTheDocument();
});

it("does not show administrator creation to a non-proprietor delegate", () => {
  mocks.capabilities = [
    "staff.list.view",
    "staff.onboard",
    "staff.permissions.manage",
  ];
  render(<AdminManagementPage />);

  expect(screen.queryByText("Admin creation controls")).not.toBeInTheDocument();
  expect(screen.getByText("Teacher promotion controls")).toBeInTheDocument();
});

it("shows lifecycle controls only with their operation capabilities", () => {
  mocks.capabilities = [
    "staff.list.view",
    "staff.onboard",
    "staff.permissions.manage",
    "staff.account.suspend",
  ];
  mocks.isProprietor = true;
  render(<AdminManagementPage />);

  expect(screen.getByText("Admin creation controls")).toBeInTheDocument();
  expect(screen.getByText("Teacher promotion controls")).toBeInTheDocument();
  expect(screen.getByText("lifecycle:true:true")).toBeInTheDocument();
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
