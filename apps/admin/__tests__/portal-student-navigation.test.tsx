import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import PortalLayout from "../../portal/app/(portal)/layout";

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), query: vi.fn() }));

vi.mock("convex/react", () => ({
  useQuery: (reference: string, args: unknown) => {
    mocks.query(reference, args);
    if (reference.includes("canAccessPortal")) return true;
    if (reference.includes("getPortalShellContext")) return { schoolId: "source-school", selectedStudentId: "resolved-student" };
    if (reference.includes("getCurrentSchoolBranding")) return { name: "Source School", status: "active", logoUrl: null, theme: { primaryColor: "#123456", accentColor: "#654321" } };
    return undefined;
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/report-cards",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams("studentId=requested-student"),
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({ session: { user: { name: "Parent", role: "parent" } }, signOut: vi.fn(), isAuthenticated: true, isLoading: false }),
}));
vi.mock("@/auth-client", () => ({ authClient: { changePassword: vi.fn() } }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@school/shared", () => ({
  AuthoritativeForbiddenView: () => <p>Forbidden</p>,
  MeloLoader: ({ message }: { message: string }) => <p>{message}</p>,
  SchoolSuspendedLockScreen: () => <p>Suspended</p>,
  WorkspaceNavbar: ({ renderLink, children }: { renderLink: (props: { href: string; className?: string; children: ReactNode }) => ReactNode; children: ReactNode }) => <nav>{renderLink({ href: "/billing?tab=invoices#current", children: "Billing" })}{children}</nav>,
}));

it("carries the server-resolved student through portal navigation links", () => {
  render(<PortalLayout><p>Portal content</p></PortalLayout>);

  expect(screen.getByRole("link", { name: "Billing" })).toHaveAttribute(
    "href",
    "/billing?tab=invoices&studentId=resolved-student#current",
  );
  expect(mocks.query).toHaveBeenCalledWith(
    expect.stringContaining("getPortalShellContext"),
    { studentId: "requested-student" },
  );
});
