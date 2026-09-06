import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render as renderView, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { DepartureGuardProvider } from "@school/shared/drafts";
const render = (ui: ReactNode) => renderView(ui, { wrapper: DepartureGuardProvider });
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";
import { StaffWorkspace } from "../lib/StaffWorkspace";
import { BranchSwitcher, type BranchSummary } from "../../../packages/shared/src/components/BranchSwitcher";
import { WorkspaceNavbar } from "../../../packages/shared/src/components/WorkspaceNavbar";

const mocks = vi.hoisted(() => ({ query: vi.fn(), replace: vi.fn(), push: vi.fn(), signOut: vi.fn() }));
let access: WorkspaceAccessSummary | undefined;
let path = "/admin/dashboard";
let loading = false;
let selectedSchoolId: string | null = null;
let availableBranches: BranchSummary[] | undefined;
const selectSchool = vi.fn();
const clearSelectedSchool = vi.fn();
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mocks.query(...args) }));
vi.mock("next/navigation", () => ({ usePathname: () => path, useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/auth-client", () => ({ authClient: { changePassword: vi.fn() } }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({
  session: { user: { id: "account", name: "Test Admin", role: "admin" } },
  workspaceAccess: access, availableBranches, selectedSchoolId, selectSchool, clearSelectedSchool,
  isLoading: loading, isAuthenticated: true, signOut: mocks.signOut,
}) }));
vi.mock("@school/shared", async () => ({
  ...await import("../../../packages/shared/src/workspace-route-access"),
  ...await import("../../../packages/shared/src/components/AuthoritativeForbiddenView"),
  ...await import("../../../packages/shared/src/components/BranchSwitcher"),
  ...await import("../../../packages/shared/src/components/WorkspaceNavbar"),
  MeloLoader: ({ message }: { message: string }) => <p role="status">{message}</p>,
}));

const ready: Extract<WorkspaceAccessSummary, { state: "ready" }> = {
  state: "ready", branch: { schoolId: "default", name: "Default School", slug: "default", status: "active" },
  membership: null, displayTitle: null, effectiveCapabilities: [],
  compatibility: { mode: "legacy_default", permissionManaged: false, legacyUserId: "legacy-user", legacyRole: "admin", legacyIsSchoolAdmin: false, adminParity: "review_required", legacyDefaultSchoolId: "default" },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: null },
};

beforeEach(() => {
  // jsdom does not implement layout scrolling.
  Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  access = ready;
  path = "/admin/dashboard";
  loading = false;
  selectedSchoolId = null;
  availableBranches = undefined;
  selectSchool.mockReset();
  clearSelectedSchool.mockReset();
  mocks.query.mockImplementation((_query: unknown, args: unknown) => args === "skip" ? undefined : {
    schoolId: "default", name: "Default School", status: "active", features: { billing: false },
  });
});

describe("default-school shell", () => {
  it.each([
    ["/academic/students/onboarding", "enrollment.intakes.manage"],
    ["/billing/bank-accounts", "finance.bank_details.manage"],
    ["/admin/permissions", "staff.permissions.manage"],
    ["/admin/assets/trash", "assets.trash.manage"],
  ])("denies managed legacy direct URL %s before any child subscription", (url, capability) => {
    path = url;
    access = { ...ready, compatibility: { ...ready.compatibility, mode: "canonical", permissionManaged: true }, effectiveCapabilities: [] };
    const child = vi.fn(() => <p>Private operation</p>);
    const Child = child;
    render(<StaffWorkspace><Child /></StaffWorkspace>);
    expect(child).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("permissions");
    expect(mocks.query.mock.calls.at(-1)?.[1]).toBe("skip");
    expect(access.effectiveCapabilities).not.toContain(capability);
  });
  it("does not mount domain content or request branding during loading or denied access", () => {
    loading = true;
    access = undefined;
    const view = render(<StaffWorkspace><p>Private records</p></StaffWorkspace>);
    expect(screen.queryByText("Private records")).not.toBeInTheDocument();
    expect(mocks.query.mock.calls.at(-1)?.[1]).toBe("skip");
    loading = false;
    access = { state: "forbidden", message: "Membership revoked" };
    view.rerender(<StaffWorkspace><p>Private records</p></StaffWorkspace>);
    expect(screen.getByRole("alert")).toHaveTextContent("Membership revoked");
    expect(screen.queryByText("Private records")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it("retains legacy admin navigation but blocks disabled deep links before child mount", () => {
    path = "/billing";
    render(<StaffWorkspace><p>Private invoices</p></StaffWorkspace>);
    expect(screen.getByRole("alert")).toHaveTextContent("Module disabled");
    expect(screen.queryByText("Private invoices")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Billing & Invoices" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import Students" })).toHaveAttribute("href", "/students/import");
    expect(screen.getByText(/Branch switching is unavailable/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("switches only on a scoped route after guard approval and scopes branding to the target", async () => {
    path = "/admin/permissions";
    selectedSchoolId = "branch-two";
    availableBranches = [
      { schoolId: "default", name: "Default School", slug: "default", status: "active", isHeadquarters: true },
      { schoolId: "branch-two", name: "Branch Two", slug: "branch-two", status: "active", isHeadquarters: false },
    ];
    access = {
      ...ready,
      branch: { ...ready.branch, schoolId: "branch-two", name: "Branch Two", slug: "branch-two" },
      membership: { membershipId: "membership-two", personId: "person", displayTitle: "Admin" },
      effectiveCapabilities: ["staff.permissions.manage"],
      compatibility: { ...ready.compatibility, mode: "canonical" },
    };
    mocks.query.mockImplementation((_query: unknown, args: unknown) => args === "skip" ? undefined : {
      schoolId: "branch-two", name: "Branch Two", status: "active", features: {},
    });
    render(<StaffWorkspace><p>Scoped permissions</p></StaffWorkspace>);
    expect(screen.getByText("Scoped permissions")).toBeInTheDocument();
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { schoolId: "branch-two" });
    expect(screen.queryByRole("link", { name: "Students" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Active branch" }), { target: { value: "default" } });
    await waitFor(() => expect(selectSchool).toHaveBeenCalledWith("default"));
  });

  it("blocks a persisted selected branch on an unscoped route and offers an explicit reset", () => {
    selectedSchoolId = "branch-two";
    access = {
      ...ready,
      branch: { ...ready.branch, schoolId: "branch-two", name: "Branch Two" },
      membership: { membershipId: "membership-two", personId: "person", displayTitle: "Admin" },
      compatibility: { ...ready.compatibility, mode: "canonical" },
    };
    render(<StaffWorkspace><p>Default dashboard records</p></StaffWorkspace>);
    expect(screen.queryByText("Default dashboard records")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to default branch" }));
    expect(clearSelectedSchool).toHaveBeenCalledTimes(1);
  });

  it("unmounts records after revocation and never renders a target header over default data", () => {
    const view = render(<StaffWorkspace><p>Private records</p></StaffWorkspace>);
    expect(screen.getByText("Private records")).toBeInTheDocument();
    access = { ...ready, branch: { ...ready.branch, schoolId: "target", name: "Target School" } };
    view.rerender(<StaffWorkspace><p>Private records</p></StaffWorkspace>);
    expect(screen.queryByText("Private records")).not.toBeInTheDocument();
    expect(screen.queryByText("Target School")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Workspace access needs review");
    expect(mocks.query.mock.calls.at(-1)?.[1]).toBe("skip");
  });
});

describe("branch and departure seams", () => {
  const branch: BranchSummary = { schoolId: "default", name: "Default School", slug: "default", status: "active", isHeadquarters: false };
  it("shows no selector for zero/single branches or a blocked route", () => {
    const select = vi.fn();
    const view = render(<BranchSwitcher currentBranch={branch} availableBranches={[]} onSelectBranch={select} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    view.rerender(<BranchSwitcher currentBranch={branch} availableBranches={[branch]} onSelectBranch={select} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    view.rerender(<BranchSwitcher currentBranch={branch} availableBranches={[branch, { ...branch, schoolId: "other" }]} onSelectBranch={select} disabled />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });
  it("uses a labelled native keyboard selector with no suspended target in the DOM", async () => {
    const select = vi.fn();
    const other = { ...branch, schoolId: "other", name: "Other School" };
    render(<BranchSwitcher currentBranch={branch} availableBranches={[branch, other, { ...branch, schoolId: "suspended", name: "Suspended School", status: "suspended" }]} onSelectBranch={select} />);
    const input = screen.getByRole("combobox", { name: "Active branch" });
    input.focus();
    expect(input).toHaveFocus();
    expect(screen.queryByRole("option", { name: "Suspended School" })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "other" } });
    expect(select).toHaveBeenCalledWith(other);
    await waitFor(() => expect(screen.queryByText("Checking target branch…")).not.toBeInTheDocument());
  });
  it("awaits sign-out approval and attaches/removes browser guard callbacks", async () => {
    const requestDeparture = vi.fn().mockResolvedValue(false);
    const signOut = vi.fn();
    const beforeUnload = vi.fn();
    const popState = vi.fn();
    const view = render(<WorkspaceNavbar workspace="admin" currentPath="/admin/dashboard" requestDeparture={requestDeparture} onSignOut={signOut} onBeforeUnload={beforeUnload} onPopState={popState} renderLink={props => <a key={props.href} href={props.href}>{props.children}</a>}><p>Open form</p></WorkspaceNavbar>);
    window.dispatchEvent(new Event("beforeunload"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(beforeUnload).toHaveBeenCalledTimes(1);
    expect(popState).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(requestDeparture).toHaveBeenCalledWith({ kind: "sign_out" }));
    expect(signOut).not.toHaveBeenCalled();
    requestDeparture.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    view.unmount();
    window.dispatchEvent(new Event("beforeunload"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(beforeUnload).toHaveBeenCalledTimes(1);
    expect(popState).toHaveBeenCalledTimes(1);
  });
  it("awaits the guard for links, stays on rejection, and exposes failure without departing", async () => {
    const requestDeparture = vi.fn().mockResolvedValue(false);
    const navigate = vi.fn();
    render(<WorkspaceNavbar workspace="admin" currentPath="/admin/dashboard" requestDeparture={requestDeparture} onNavigate={navigate} renderLink={props => <a key={props.href} href={props.href}>{props.children}</a>}><p>Open form</p></WorkspaceNavbar>);
    fireEvent.click(screen.getByRole("link", { name: "Students" }));
    await waitFor(() => expect(requestDeparture).toHaveBeenCalledTimes(1));
    expect(navigate).not.toHaveBeenCalled();
    requestDeparture.mockRejectedValueOnce(new Error("Save failed"));
    fireEvent.click(screen.getByRole("link", { name: "Students" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not complete departure");
    expect(navigate).not.toHaveBeenCalled();
    requestDeparture.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole("link", { name: "Students" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/academic/students"));
  });
});
