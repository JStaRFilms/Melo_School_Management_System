import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DepartureGuardProvider } from "@school/shared/drafts";
import { TeacherCreationForm } from "../app/academic/teachers/components/TeacherCreationForm";
import { TeacherEditForm } from "../app/academic/teachers/components/TeacherEditForm";
import { AdminCreationForm } from "../app/admin/components/AdminCreationForm";
import { ImportNameFields } from "../../../packages/shared/src/components/migration/ImportNameFields";
import type { StagedStudentRow } from "../../../packages/shared/src/components/migration/Tabs/RosterReviewTab";

const mocks = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("convex/react", () => ({ useAction: () => mocks.action, useQuery: () => undefined, useMutation: () => vi.fn(), useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }), useConvexConnectionState: () => ({ isWebSocketConnected: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function fill() {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mary Jane" } });
  fireEvent.blur(screen.getByLabelText("First name"));
  expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Jane");
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "De la Cruz" } });
}

it("provisions teacher names with exact structured parts and no password in the draft projection", async () => {
  const provision = vi.fn().mockResolvedValue({ teacherId: "teacher", email: "teacher@example.test", temporaryPassword: "Synthetic!123" });
  render(<DepartureGuardProvider><TeacherCreationForm onProvision={provision} isSubmitting={false} /></DepartureGuardProvider>);
  fill();
  fireEvent.change(screen.getByPlaceholderText("teacher@school.edu"), { target: { value: "teacher@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Teacher Account" }));
  await waitFor(() => expect(provision).toHaveBeenCalledWith("Mary Jane De La Cruz", "teacher@example.test", "Teacher123!Pass", undefined, { firstName: "Mary", middleName: "Jane", lastName: "De La Cruz" }));
});

it("preserves a teacher's explicit middle and compound surname during a first-name edit", async () => {
  const update = vi.fn();
  render(<TeacherEditForm teacher={{ _id: "teacher", name: "Mary Anne De La Cruz", firstName: "Mary", middleName: "Anne", lastName: "De La Cruz", email: "teacher@example.test", createdAt: 1 }} onUpdate={update} onResetPassword={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} isSaving={false} isResetting={false} canEditProfile canResetPassword={false} canArchive={false} />);
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mary Jane" } });
  fireEvent.blur(screen.getByLabelText("First name"));
  expect(screen.getByLabelText("First name")).toHaveValue("Mary Jane");
  expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Anne");
  fireEvent.click(screen.getByRole("button", { name: "Update Teacher" }));
  expect(update).toHaveBeenCalledWith("teacher", "Mary Jane Anne De La Cruz", "teacher@example.test", { firstName: "Mary Jane", middleName: "Anne", lastName: "De La Cruz" });
});

it("creates admin names with parts rather than reparsing a combined full name", async () => {
  mocks.action.mockResolvedValue({ email: "admin@example.test" });
  render(<AdminCreationForm onSuccess={vi.fn()} onError={vi.fn()} />);
  fill();
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "admin@example.test" } });
  fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "Synthetic!123" } });
  fireEvent.click(screen.getByRole("button", { name: "Authorize Role" }));
  await waitFor(() => expect(mocks.action).toHaveBeenCalledWith(expect.objectContaining({ name: "Mary Jane De La Cruz", firstName: "Mary", middleName: "Jane", lastName: "De La Cruz" })));
});

it("keeps full-name-only import rows editable and switches to parts only by deliberate input", async () => {
  const patch = vi.fn();
  const record: StagedStudentRow = { _id: "row", rowNumber: 1, entityType: "student", parsedData: { name: "Ambiguous Legacy Full Name", firstName: "", lastName: "", className: "P1", gender: "Female" }, validationStatus: "valid", validationErrors: [], isResolved: false };
  render(<ImportNameFields record={record} onPatchField={patch} />);
  expect(screen.getByLabelText("Full name")).toHaveValue("Ambiguous Legacy Full Name");
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Edited Legacy Full Name" } });
  fireEvent.click(screen.getByRole("button", { name: "Save row name" }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith("row", { name: "Edited Legacy Full Name", firstName: "", middleName: null, lastName: "" }));
  fireEvent.click(screen.getByRole("button", { name: "Enter name parts" }));
  expect(screen.getByLabelText("First name")).toHaveValue("");
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Save row name" }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith("row", { firstName: "Mary", middleName: "Jane", lastName: "De La Cruz" }));
});
