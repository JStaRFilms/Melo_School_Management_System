import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlatformAdminBootstrapForm } from "../app/bootstrap/platform-admin/PlatformAdminBootstrapForm";
import AssignAdminPage from "../app/schools/[schoolId]/assign-admin/page";

const mocks = vi.hoisted(() => ({ action: vi.fn(), push: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => mocks.action, useQuery: () => [{ _id: "school", name: "Synthetic School", status: "provisioning" }] }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("next/navigation", () => ({ useParams: () => ({ schoolId: "school" }), useRouter: () => ({ push: mocks.push }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function fill() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mary Jane" } });
  fireEvent.blur(screen.getByLabelText("First name"));
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "De la Cruz" } });
}

it("bootstraps platform admin names with normalized structured parts", async () => {
  mocks.action.mockResolvedValue({ platformAdminId: "admin", adminEmail: "admin@example.test" });
  const { container } = render(<PlatformAdminBootstrapForm />);
  fill();
  fireEvent.change(screen.getByPlaceholderText("admin@school.com"), { target: { value: "admin@example.test" } });
  const password = container.querySelector('input[autocomplete="new-password"]');
  if (!password) throw new Error("Password input missing");
  fireEvent.change(password, { target: { value: "Synthetic!123" } });
  fireEvent.change(screen.getByPlaceholderText("Enter the recovery token"), { target: { value: "synthetic-token-for-mock-only" } });
  fireEvent.click(screen.getByRole("button", { name: "Bootstrap platform admin" }));
  await waitFor(() => expect(mocks.action).toHaveBeenCalledWith(expect.objectContaining({ adminName: "Mary Jane De La Cruz", firstName: "Mary", middleName: "Jane", lastName: "De La Cruz" })));
});

it("assigns school-admin names using the approved structured API", async () => {
  mocks.action.mockRejectedValue(new Error("Synthetic rejection retains the form"));
  const { container } = render(<AssignAdminPage />);
  fill();
  fireEvent.change(screen.getByLabelText("Admin Email *"), { target: { value: "admin@example.test" } });
  const password = container.querySelector('input[type="password"]');
  if (!password) throw new Error("Password input missing");
  fireEvent.change(password, { target: { value: "Synthetic!123" } });
  const form = container.querySelector("form");
  if (!form) throw new Error("Form missing");
  fireEvent.submit(form);
  await waitFor(() => expect(mocks.action).toHaveBeenCalledWith(expect.objectContaining({ schoolId: "school", adminName: "Mary Jane De La Cruz", firstName: "Mary", middleName: "Jane", lastName: "De La Cruz" })));
});
