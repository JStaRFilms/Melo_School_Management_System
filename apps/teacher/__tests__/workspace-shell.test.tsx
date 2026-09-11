import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { WorkspaceAccessSummary } from "@school/shared/workspace-access";
import type { BranchSummary } from "@school/shared";
import { StaffWorkspace } from "../lib/StaffWorkspace";

const mocks = vi.hoisted(() => ({ query: vi.fn(), replace: vi.fn(), push: vi.fn(), departure: vi.fn(), select: vi.fn(), clear: vi.fn(), signOut: vi.fn() }));
let path = "/assessments/exams/entry";
let access: WorkspaceAccessSummary | undefined;
let selectedSchoolId: string | null = null;
let sessionRole = "teacher";
let branches: BranchSummary[] = [];

vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => mocks.query(...args) }));
vi.mock("next/navigation", () => ({ usePathname: () => path, useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock("@/lib/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/lib/auth-client", () => ({ authClient: { changePassword: vi.fn() } }));
vi.mock("@school/shared/drafts", () => ({ useDepartureGuard: () => ({ requestDeparture: mocks.departure }) }));
vi.mock("@/lib/AuthProvider", () => ({ useAuth: () => ({
  session: { user: { id: "account", name: "Teacher", role: sessionRole } }, workspaceAccess: access,
  availableBranches: branches, selectedSchoolId, selectSchool: mocks.select, clearSelectedSchool: mocks.clear,
  isAuthenticated: true, isLoading: false, signOut: mocks.signOut,
}) }));

const defaultAccess: Extract<WorkspaceAccessSummary, { state: "ready" }> = {
  state: "ready", branch: { schoolId: "default", name: "Default", slug: "default", status: "active" },
  membership: { membershipId: "membership-default", personId: "person", displayTitle: "Teacher", isProprietor: false }, displayTitle: "Teacher",
  effectiveCapabilities: ["academic.assessments.enter", "enrollment.intakes.manage"],
  compatibility: { mode: "canonical", permissionManaged: true, legacyUserId: "teacher-default", legacyRole: "teacher", legacyIsSchoolAdmin: false, adminParity: "not_applicable", legacyDefaultSchoolId: "default" },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: "teacher-default" },
};
const branchAccess: Extract<WorkspaceAccessSummary, { state: "ready" }> = {
  ...defaultAccess, branch: { schoolId: "branch-two", name: "Branch Two", slug: "branch-two", status: "active" },
  membership: { membershipId: "membership-two", personId: "person", displayTitle: "Teacher", isProprietor: false },
  compatibility: { ...defaultAccess.compatibility, legacyUserId: "teacher-two" },
  teacherAssignments: { source: "domain_checks_required", legacyTeacherId: "teacher-two" },
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  path = "/assessments/exams/entry";
  access = defaultAccess;
  selectedSchoolId = null;
  sessionRole = "teacher";
  branches = [
    { schoolId: "default", name: "Default", slug: "default", status: "active", isHeadquarters: true },
    { schoolId: "branch-two", name: "Branch Two", slug: "branch-two", status: "active", isHeadquarters: false },
  ];
  mocks.departure.mockResolvedValue(true);
  mocks.query.mockImplementation((reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
    if (name.includes("hasTeacherAssignments")) return true;
    return { schoolId: access?.state === "ready" ? access.branch.schoolId : "default", name: "School", status: "active", features: {} };
  });
});

describe("teacher selected-branch shell", () => {
  it("awaits the dirty departure guard and clears route entity parameters only after approval", async () => {
    mocks.departure.mockResolvedValueOnce(false);
    render(<StaffWorkspace><p>Exam records</p></StaffWorkspace>);
    expect(mocks.query).toHaveBeenCalledWith(expect.anything(), { schoolId: "default" });
    fireEvent.change(screen.getByRole("combobox", { name: "Active branch" }), { target: { value: "branch-two" } });
    await waitFor(() => expect(mocks.departure).toHaveBeenCalledWith({ kind: "branch", schoolId: "branch-two" }));
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.departure.mockResolvedValueOnce(true);
    fireEvent.change(screen.getByRole("combobox", { name: "Active branch" }), { target: { value: "branch-two" } });
    await waitFor(() => expect(mocks.select).toHaveBeenCalledWith("branch-two"));
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/exams/entry");
  });

  it("does not flash old data while a selected branch summary is revalidating", () => {
    const view = render(<StaffWorkspace><p>Default exam records</p></StaffWorkspace>);
    expect(screen.getByText("Default exam records")).toBeInTheDocument();
    selectedSchoolId = "branch-two";
    access = undefined;
    view.rerender(<StaffWorkspace><p>Default exam records</p></StaffWorkspace>);
    expect(screen.queryByText("Default exam records")).not.toBeInTheDocument();
    expect(screen.getByText("Checking workspace access…")).toBeInTheDocument();
  });

  it("denies a selected direct URL whose caller chain is still unscoped", () => {
    path = "/planning/lesson-plans";
    selectedSchoolId = "branch-two";
    access = branchAccess;
    render(<StaffWorkspace><p>Legacy planning data</p></StaffWorkspace>);
    expect(screen.queryByText("Legacy planning data")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Branch switching is unavailable on this route");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("keeps navigation available while blocking assignment-dependent routes", () => {
    selectedSchoolId = "branch-two";
    access = { ...branchAccess, effectiveCapabilities: [] };
    const denied = render(<StaffWorkspace><p>Branch student data</p></StaffWorkspace>);
    expect(screen.queryByText("Branch student data")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("permissions");

    access = branchAccess;
    mocks.query.mockImplementation((reference: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
      return name.includes("hasTeacherAssignments") ? false : { schoolId: "branch-two", name: "Branch Two", status: "active", features: {} };
    });
    denied.rerender(<StaffWorkspace><p>Branch student data</p></StaffWorkspace>);
    expect(screen.getByRole("alert")).toHaveTextContent("No class or subject assignment yet");
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Exam Entry" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Report Cards" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to teacher dashboard" }));
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/");
    expect(screen.queryByText(/Sign out \/ use another account/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Active branch" })).toBeInTheDocument();
  });

  it("welcomes an unassigned teacher on the dashboard without ending the session", () => {
    path = "/";
    access = {
      ...defaultAccess,
      membership: null,
      compatibility: {
        ...defaultAccess.compatibility,
        mode: "legacy_default",
        permissionManaged: false,
      },
    };
    mocks.query.mockImplementation((reference: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
      return name.includes("hasTeacherAssignments")
        ? false
        : { schoolId: "default", name: "Default", status: "active", features: {} };
    });

    render(<StaffWorkspace><p>Teacher dashboard content</p></StaffWorkspace>);

    expect(screen.getByText("Teacher dashboard content")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No class or subject has been assigned yet");
    expect(screen.getByRole("link", { name: "Planning" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Exam Entry" })).not.toBeInTheDocument();
  });

  it("does not require a teacher assignment from an authorized school administrator", () => {
    sessionRole = "admin";
    access = {
      ...defaultAccess,
      membership: null,
      compatibility: {
        ...defaultAccess.compatibility,
        mode: "legacy_default",
        permissionManaged: false,
        legacyRole: "admin",
        legacyIsSchoolAdmin: true,
      },
      teacherAssignments: {
        source: "domain_checks_required",
        legacyTeacherId: null,
      },
    };
    mocks.query.mockImplementation((reference: unknown, args: unknown) => {
      if (args === "skip") return undefined;
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
      return name.includes("hasTeacherAssignments")
        ? false
        : { schoolId: "default", name: "Default", status: "active", features: {} };
    });

    render(<StaffWorkspace><p>Administrator exam entry</p></StaffWorkspace>);

    expect(screen.getByText("Administrator exam entry")).toBeInTheDocument();
    expect(screen.queryByText(/No class has been assigned/)).not.toBeInTheDocument();
  });

  it("fails closed after branch revocation without mounting route callers", () => {
    selectedSchoolId = "branch-two";
    access = { state: "forbidden", message: "Membership revoked" };
    render(<StaffWorkspace><p>Branch assessment data</p></StaffWorkspace>);
    expect(screen.queryByText("Branch assessment data")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Membership revoked");
  });
});
