import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
  auth: {
    isAuthenticated: true,
    isLoading: false,
    session: { user: { role: "teacher", name: "Joan Teacher" } },
    workspaceAccess: undefined as WorkspaceAccessSummary | undefined,
  },
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/AuthProvider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/lib/StaffWorkspace", () => ({
  StaffWorkspace: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

import HomePage from "../app/page";

const readyAccess = (
  permissionManaged: boolean,
  effectiveCapabilities: string[] = [],
): Extract<WorkspaceAccessSummary, { state: "ready" }> => ({
  state: "ready",
  branch: {
    schoolId: "school",
    name: "Villanova School",
    slug: "school",
    status: "active",
  },
  membership: null,
  displayTitle: "Teacher",
  effectiveCapabilities,
  compatibility: {
    mode: "legacy_default",
    permissionManaged,
    legacyUserId: "teacher",
    legacyRole: "teacher",
    legacyIsSchoolAdmin: false,
    adminParity: "not_applicable",
    legacyDefaultSchoolId: "school",
  },
  teacherAssignments: {
    source: "domain_checks_required",
    legacyTeacherId: "teacher",
  },
});

describe("teacher home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.session = { user: { role: "teacher", name: "Joan Teacher" } };
    mocks.auth.workspaceAccess = undefined;
  });

  it("shows a signed-in school dashboard instead of forcing a workflow redirect", () => {
    mocks.auth.workspaceAccess = readyAccess(false);

    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Welcome, Joan Teacher" })).toBeInTheDocument();
    expect(screen.getByText(/logged in to Villanova School/)).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps a managed teacher on the dashboard when no workflow capability is available", () => {
    mocks.auth.workspaceAccess = readyAccess(true);

    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Welcome, Joan Teacher" })).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
