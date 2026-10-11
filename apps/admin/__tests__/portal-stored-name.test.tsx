import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { ReactNode } from "react";
import PortalLayout from "../../portal/app/(portal)/layout";

const mocks = vi.hoisted(() => {
  const state: { workspace?: { viewer: { name: string; role: string } } } = {};
  return state;
});
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ session: { user: { name: "Stale auth name", role: "student" } }, signOut: vi.fn(), isAuthenticated: true, isLoading: false }) }));
vi.mock("@/auth-client", () => ({ authClient: { changePassword: vi.fn() } }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("@school/shared", () => ({
  WorkspaceNavbar: ({ userName, userRole, children }: { userName?: string; userRole?: string; children?: ReactNode }) => <><p>{userName ?? "Name loading"}</p><p>{userRole}</p>{children}</>,
  getWorkspaceModuleDenial: () => null, MeloLoader: () => <p>Loading</p>, AuthoritativeForbiddenView: () => <p>Denied</p>, SchoolSuspendedLockScreen: () => <p>Suspended</p>,
}));
vi.mock("convex/react", () => ({ useQuery: (ref: FunctionReference<"query">) => {
  const name = getFunctionName(ref);
  if (name.endsWith(":canAccessPortal")) return true;
  if (name.endsWith(":getPortalShellContext")) return { schoolId: "school", selectedStudentId: "student" };
  if (name.endsWith(":getWorkspaceData")) return mocks.workspace;
  return { name: "Synthetic school", features: {} };
} }));
afterEach(cleanup);

it("uses authorized school identity after reload instead of stale auth-session name", () => {
  mocks.workspace = undefined;
  const view = render(<PortalLayout>Portal content</PortalLayout>);
  expect(screen.getByText("Name loading")).toBeInTheDocument();
  expect(screen.queryByText("Stale auth name")).not.toBeInTheDocument();
  mocks.workspace = { viewer: { name: "Mary Anne De La Cruz", role: "student" } };
  view.rerender(<PortalLayout>Portal content</PortalLayout>);
  expect(screen.getByText("Mary Anne De La Cruz")).toBeInTheDocument();
  expect(screen.queryByText("Stale auth name")).not.toBeInTheDocument();
});
