import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import SchoolsPage from "../app/schools/page";

const mocks = vi.hoisted(() => ({ schools: [
  { _id: "zero-school", name: "Zero school", slug: "zero", status: "active", createdAt: 1, adminUserId: null, adminName: null, adminEmail: null, currentStudentCount: 0 as number | null, features: {} },
  { _id: "unknown-school", name: "Unknown school", slug: "unknown", status: "active", createdAt: 1, adminUserId: null, adminName: null, adminEmail: null, currentStudentCount: null as number | null, features: {} },
] }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.schools, useMutation: () => vi.fn(), useAction: () => vi.fn() }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@school/shared", async importOriginal => ({ ...await importOriginal<typeof import("@school/shared")>(), useAutoAnimate: () => [null] }));
vi.mock("../app/schools/ManageFeaturesModal", () => ({ ManageFeaturesModal: () => null }));
vi.mock("../app/schools/FreeTrialStorageModal", () => ({ FreeTrialStorageModal: () => null }));
vi.mock("../app/schools/ResetSchoolAdminPasswordModal", () => ({ ResetSchoolAdminPasswordModal: () => null }));
vi.mock("../app/schools/ChangeSchoolAdminEmailModal", () => ({ ChangeSchoolAdminEmailModal: () => null }));
afterEach(cleanup);

it("uses aggregate null and zero in both desktop rows and mobile cards, then reacts to count updates", () => {
  const view = render(<SchoolsPage />);
  const table = screen.getByRole("table");
  const zeroRow = within(table).getByText("Zero school").closest("tr");
  const unknownRow = within(table).getByText("Unknown school").closest("tr");
  const zeroCard = screen.getByRole("heading", { name: "Zero school" }).closest("div.bg-white");
  const unknownCard = screen.getByRole("heading", { name: "Unknown school" }).closest("div.bg-white");
  if (!zeroRow || !unknownRow || !(zeroCard instanceof HTMLElement) || !(unknownCard instanceof HTMLElement)) throw new Error("Expected desktop and mobile school consumers");
  expect(within(zeroRow).getByText("0")).toBeInTheDocument();
  expect(within(zeroCard).getByText("0")).toBeInTheDocument();
  expect(within(unknownRow).getByRole("button", { name: "Calculate" })).toBeInTheDocument();
  expect(within(unknownCard).getByRole("button", { name: "Calculate" })).toBeInTheDocument();
  mocks.schools = mocks.schools.map(school => school._id === "zero-school" ? { ...school, currentStudentCount: 7 } : school);
  view.rerender(<SchoolsPage />);
  expect(within(zeroRow).getByText("7")).toBeInTheDocument();
  expect(within(zeroCard).getByText("7")).toBeInTheDocument();
  expect(screen.queryByText(/student identity/i)).not.toBeInTheDocument();
});
