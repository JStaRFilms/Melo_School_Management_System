import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { AuthProvider, useAuth } from "../lib/AuthProvider";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  convexAuth: vi.fn(() => ({ isLoading: false, isAuthenticated: true })),
  isConvexConfigured: vi.fn(() => true),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mocks.query(...args),
  useConvexAuth: () => mocks.convexAuth(),
}));
vi.mock("@/convex-runtime", () => ({
  isConvexConfigured: () => mocks.isConvexConfigured(),
}));
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
  membership: { membershipId: `membership-${schoolId}`, personId: "person", displayTitle: "Proprietor", isProprietor: true },
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
  return (
    <div>
      <p data-testid="selection">{auth.selectedSchoolId ?? "default-selection"}</p>
      <p data-testid="access">
        {auth.workspaceAccess?.state === "ready"
          ? auth.workspaceAccess.branch.schoolId
          : auth.workspaceAccess?.state ?? "loading"}
      </p>
      <p data-testid="branches">{auth.availableBranches?.length ?? 0}</p>
      <p data-testid="is-loading">{String(auth.isLoading)}</p>
      <p data-testid="is-authenticated">{String(auth.isAuthenticated)}</p>
      <p data-testid="has-session">{String(Boolean(auth.session))}</p>
      <button onClick={() => auth.selectSchool("default")}>Default</button>
    </div>
  );
}

const branches = [
  { schoolId: "default", name: "Default", slug: "default", status: "active" as const, isHeadquarters: true },
  { schoolId: "branch-two", name: "Branch Two", slug: "branch-two", status: "active" as const, isHeadquarters: false },
];

beforeEach(() => {
  localStorage.clear();
  mocks.query.mockReset();
  mocks.convexAuth.mockReset();
  mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
  mocks.isConvexConfigured.mockReset();
  mocks.isConvexConfigured.mockReturnValue(true);
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

describe("authentication synchronization and query gating", () => {
  it("passes skip to both Convex queries and exposes isLoading true while Convex auth is loading", async () => {
    mocks.convexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("is-loading")).toHaveTextContent("true"));
    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("has-session")).toHaveTextContent("false");
    expect(screen.getByTestId("access")).toHaveTextContent("loading");

    const queryCalls = mocks.query.mock.calls;
    expect(queryCalls.length).toBeGreaterThan(0);
    for (const [, args] of queryCalls) {
      expect(args).toBe("skip");
    }
  });

  it("passes skip to both Convex queries, stops loading, and resolves unauthenticated when Convex auth finishes unauthenticated", async () => {
    mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("is-loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("has-session")).toHaveTextContent("false");
    expect(screen.getByTestId("access")).toHaveTextContent("loading");

    const queryCalls = mocks.query.mock.calls;
    expect(queryCalls.length).toBeGreaterThan(0);
    for (const [, args] of queryCalls) {
      expect(args).toBe("skip");
    }
  });

  it("executes queries after Convex becomes authenticated", async () => {
    mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("default"));
    expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("is-authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("has-session")).toHaveTextContent("true");
    expect(screen.getByTestId("branches")).toHaveTextContent("2");

    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), {});
  });

  it("does not call useConvexAuth in unconfigured preview mode outside a provider", () => {
    mocks.isConvexConfigured.mockReturnValue(false);
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(mocks.convexAuth).not.toHaveBeenCalled();
    expect(screen.getByTestId("is-loading")).toHaveTextContent("false");
    expect(screen.getByTestId("has-session")).toHaveTextContent("true");
  });
});
