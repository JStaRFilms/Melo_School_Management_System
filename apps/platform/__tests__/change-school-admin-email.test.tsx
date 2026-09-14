import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChangeSchoolAdminEmailModal } from "../app/schools/ChangeSchoolAdminEmailModal";

const mocks = vi.hoisted(() => ({ changeEmail: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => mocks.changeEmail }));
vi.mock("@school/shared/toast", () => ({ appToast: { success: mocks.success, warning: mocks.warning, error: mocks.error }, getErrorMessage: (_error: unknown, fallback: string) => fallback }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const school = { _id: "school-1", name: "Reviewed School", adminUserId: "user-1", adminName: "Ada Admin", adminEmail: "ada@old.test" };

it("requires confirmation and identifies the administrator", () => {
  render(<ChangeSchoolAdminEmailModal isOpen onClose={vi.fn()} school={school} />);
  expect(screen.getByRole("dialog")).toHaveTextContent("Ada Admin");
  expect(screen.getByRole("dialog")).toHaveTextContent("ada@old.test");
  fireEvent.change(screen.getByLabelText("New email"), { target: { value: "new@example.test" } });
  fireEvent.change(screen.getByLabelText("Confirm new email"), { target: { value: "different@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  expect(mocks.warning).toHaveBeenCalledWith("Email addresses do not match", expect.any(Object));
  expect(mocks.changeEmail).not.toHaveBeenCalled();
});

it("shows the sign-out message and refresh-safe success toast", async () => {
  mocks.changeEmail.mockResolvedValue({ success: true, requiresEmailVerification: true });
  const onClose = vi.fn();
  render(<ChangeSchoolAdminEmailModal isOpen onClose={onClose} school={school} />);
  fireEvent.change(screen.getByLabelText("New email"), { target: { value: " new@example.test " } });
  fireEvent.change(screen.getByLabelText("Confirm new email"), { target: { value: "new@example.test" } });
  expect(screen.getByRole("dialog")).toHaveTextContent("signed out of all devices");
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  await waitFor(() => expect(mocks.changeEmail).toHaveBeenCalledWith({ schoolId: "school-1", userId: "user-1", newEmail: "new@example.test" }));
  expect(mocks.success).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it("turns backend failures into a shared readable error", async () => {
  mocks.changeEmail.mockRejectedValue(new Error("internal id/hash details"));
  render(<ChangeSchoolAdminEmailModal isOpen onClose={vi.fn()} school={school} />);
  fireEvent.change(screen.getByLabelText("New email"), { target: { value: "new@example.test" } });
  fireEvent.change(screen.getByLabelText("Confirm new email"), { target: { value: "new@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Change email" }));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Could not change administrator email", expect.any(Object)));
});
