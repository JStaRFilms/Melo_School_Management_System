import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { AuthProvider, useAuth } from "../lib/AuthProvider";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mocks.query(...args) }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: { id: "account-1", email: "owner@example.test", name: "Owner" },
        session: { id: "session", userId: "account-1", expiresAt: new Date("2030-01-01") },
      },
      isPending: false,
      error: null,
    }),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}));

const ready = (schoolId: string): Extract<WorkspaceAccessSummary, { state: "ready" }> => ({
  state: "ready",
  branch: { schoolId, name: schoolId === "default" ? "Default" : "Branch Two", slug: schoolId, status: "active" },
  membership: { membershipId: `membership-${schoolId}`, personId: "person", displayTitle: "Proprietor" },
  displayTitle: "Proprietor",
  effectiveCapabilities: ["staff.permissions.manage"],
  compatibility: {
    mode: "canonical",
    permissionManaged: true,
    legacyUserId: `user-${schoolId}`,
    legacyRole: "admin",
    legacyIsSchoolAdmin: true,
    adminParity: "review_required",
    legacyDefaultSchoolId: "default",
  },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: null },
});

function Probe() {
  const auth = useAuth();
  return <div>
    <p data-testid="selection">{auth.selectedSchoolId ?? "default-selection"}</p>
    <p data-testid="access">{auth.workspaceAccess?.state === "ready" ? auth.workspaceAccess.branch.schoolId : auth.workspaceAccess?.state ?? "loading"}</p>
    <p data-testid="branches">{auth.availableBranches?.length ?? 0}</p>
    <button onClick={() => auth.selectSchool("default")}>Default</button>
  </div>;
}

const branches = [
  { schoolId: "default", name: "Default", slug: "default", status: "active" as const, isHeadquarters: true },
  { schoolId: "branch-two", name: "Branch Two", slug: "branch-two", status: "active" as const, isHeadquarters: false },
];

beforeEach(() => {
  localStorage.clear();
  mocks.query.mockReset();
  mocks.query.mockImplementation((reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const functionName = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
    if (functionName.includes("listUserBranches")) return branches;
    const schoolId = (args as { schoolId?: string }).schoolId ?? "default";
    return ready(schoolId);
  });
});

describe("account-scoped selected school", () => {
  it("hydrates a persisted target, revalidates it against both server contracts, and resets to default without identity mutation", async () => {
    localStorage.setItem("melo:selected-school:account-1", "branch-two");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("branch-two"));
    expect(screen.getByTestId("selection")).toHaveTextContent("branch-two");
    expect(screen.getByTestId("branches")).toHaveTextContent("2");
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { schoolId: "branch-two" });

    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("default"));
    expect(localStorage.getItem("melo:selected-school:account-1")).toBeNull();
  });

  it("fails closed and removes an invalid persisted target for the next session", async () => {
    localStorage.setItem("melo:selected-school:account-1", "revoked");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("reconciliation_required"));
    expect(localStorage.getItem("melo:selected-school:account-1")).toBeNull();
    expect(screen.getByTestId("selection")).toHaveTextContent("revoked");
  });
});
