import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
  auth: {
    isAuthenticated: true,
    isLoading: false,
    session: { user: { role: "teacher" } },
    workspaceAccess: undefined as WorkspaceAccessSummary | undefined,
  },
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/AuthProvider", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/convex-runtime", () => ({ isConvexConfigured: () => true }));

import HomePage from "../app/page";

const readyAccess = (
  permissionManaged: boolean,
  effectiveCapabilities: string[] = [],
): Extract<WorkspaceAccessSummary, { state: "ready" }> => ({
  state: "ready",
  branch: {
    schoolId: "school",
    name: "School",
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

describe("teacher home routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.session = { user: { role: "teacher" } };
  });

  it("opens planning for an unmanaged legacy teacher without capability records", () => {
    mocks.auth.workspaceAccess = readyAccess(false);

    expect(() => HomePage()).toThrow("redirect:/planning");
    expect(mocks.redirect).toHaveBeenCalledWith("/planning");
  });

  it("keeps a managed teacher without capabilities fail-closed", () => {
    mocks.auth.workspaceAccess = readyAccess(true);

    expect(() => HomePage()).toThrow("redirect:/sign-in?error=unauthorized");
  });
});
