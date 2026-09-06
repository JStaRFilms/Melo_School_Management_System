import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { AuthProvider, useAuth } from "../lib/AuthProvider";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mocks.query(...args) }));
vi.mock("@/lib/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "teacher-account", email: "teacher@example.test", name: "Teacher" }, session: { id: "session", userId: "teacher-account", expiresAt: new Date("2030-01-01") } }, isPending: false, error: null }),
    signIn: { email: vi.fn() }, signOut: vi.fn(),
  },
}));

const ready = (schoolId: string): Extract<WorkspaceAccessSummary, { state: "ready" }> => ({
  state: "ready", branch: { schoolId, name: schoolId === "default" ? "Default" : "Branch Two", slug: schoolId, status: "active" },
  membership: { membershipId: `membership-${schoolId}`, personId: "person", displayTitle: "Teacher" },
  displayTitle: "Teacher", effectiveCapabilities: ["academic.assessments.enter"],
  compatibility: { mode: "canonical", permissionManaged: true, legacyUserId: `teacher-${schoolId}`, legacyRole: "teacher", legacyIsSchoolAdmin: false, adminParity: "not_applicable", legacyDefaultSchoolId: "default" },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: `teacher-${schoolId}` },
});
const branches = [
  { schoolId: "default", name: "Default", slug: "default", status: "active" as const, isHeadquarters: true },
  { schoolId: "branch-two", name: "Branch Two", slug: "branch-two", status: "active" as const, isHeadquarters: false },
];
function Probe() {
  const auth = useAuth();
  return <div><p data-testid="selection">{auth.selectedSchoolId ?? "default"}</p><p data-testid="access">{auth.workspaceAccess?.state === "ready" ? auth.workspaceAccess.branch.schoolId : auth.workspaceAccess?.state ?? "loading"}</p><button onClick={() => auth.selectSchool("default")}>Default</button></div>;
}

beforeEach(() => {
  localStorage.clear();
  mocks.query.mockReset();
  mocks.query.mockImplementation((reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
    if (name.includes("listUserBranches")) return branches;
    return ready((args as { schoolId?: string }).schoolId ?? "default");
  });
});

describe("teacher account-scoped branch selection", () => {
  it("hydrates and revalidates a persisted branch, then clears only this account selection", async () => {
    localStorage.setItem("melo:selected-school:teacher-account", "branch-two");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("branch-two"));
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { schoolId: "branch-two" });
    fireEvent.click(screen.getByRole("button", { name: "Default" }));
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("default"));
    expect(localStorage.getItem("melo:selected-school:teacher-account")).toBeNull();
  });

  it("fails closed for a stale persisted selection and removes it only for the next session", async () => {
    localStorage.setItem("melo:selected-school:teacher-account", "revoked");
    localStorage.setItem("melo:selected-school:another-account", "another-branch");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("access")).toHaveTextContent("reconciliation_required"));
    expect(screen.getByTestId("selection")).toHaveTextContent("revoked");
    expect(localStorage.getItem("melo:selected-school:teacher-account")).toBeNull();
    expect(localStorage.getItem("melo:selected-school:another-account")).toBe("another-branch");
  });
});
