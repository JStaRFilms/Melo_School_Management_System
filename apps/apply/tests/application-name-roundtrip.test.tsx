import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Id } from "@school/convex/_generated/dataModel";
import { ApplicationForm } from "../components/AdmissionsApply";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: () => ({ available: false }), useMutation: () => mocks.save, useAction: () => vi.fn(), useConvexAuth: () => ({ isAuthenticated: true }) }));
vi.mock("../lib/auth-client", () => ({ authClient: { useSession: () => ({ data: { user: { email: "guardian@example.test" } } }) } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const draft: NonNullable<ComponentProps<typeof ApplicationForm>["draft"]> = {
  state: "draft", draftVersion: 4, currentRevision: 0, safeMessages: [], requestedEntryLabel: "P1", profile: { firstName: "Mary", middleName: "Anne", lastName: "De La Cruz", dateOfBirth: Date.UTC(2018, 0, 1), gender: "Female", nationality: "Nigerian", address: "Student residential address" }, primaryContact: { fullName: "Legacy Guardian Full Name", relationship: "Family friend", email: "guardian@example.test", phone: "08000000000", address: "Previously stored contact address" },
  form: { version: 1, schemaVersion: "v1", status: "published", fields: [], requirements: [] }, declaration: { version: 1, title: "Declaration", body: "Synthetic declaration", purpose: "admissions", status: "published" }, correction: null, answers: [], documents: [],
};
function mount(value = draft) { return render(<ApplicationForm schoolSlug="synthetic-school" applicationId={"application" as Id<"admissionsApplications">} draft={value} safeMessages={[]} conversion={null} financialHold={false} />); }

it("retains legacy guardian full names and student middle/compound names when saving unrelated contact fields", async () => {
  mocks.save.mockResolvedValue({ draftVersion: 5, replayed: false });
  mount();
  expect(screen.getByLabelText("Full name")).toHaveValue("Legacy Guardian Full Name");
  expect(screen.getByLabelText("Middle Name")).toHaveValue("Anne");
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "08111111111" } });
  fireEvent.click(screen.getByRole("button", { name: "Save application" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 4, profile: expect.objectContaining({ firstName: "Mary", middleName: "Anne", lastName: "De La Cruz", gender: "Female", nationality: "Nigerian", address: "Student residential address" }), primaryContact: expect.objectContaining({ fullName: "Legacy Guardian Full Name", relationship: "Family friend", phone: "08111111111", address: "Previously stored contact address", addressMode: "different" }) })));
  const saved = mocks.save.mock.calls[0][0];
  expect(saved.primaryContact).not.toHaveProperty("firstName");
});

it("reopens structured contacts and saves approved two-word first normalization without losing the surname", async () => {
  mocks.save.mockResolvedValue({ draftVersion: 5, replayed: false });
  mount({ ...draft, primaryContact: { fullName: "Mary Jane De La Cruz", firstName: "Mary", middleName: "Jane", lastName: "De La Cruz", relationship: "Mother" } });
  expect(screen.getByLabelText("First name")).toHaveValue("Mary");
  expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Jane");
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Ada Jane" } });
  fireEvent.change(screen.getByLabelText("Middle name (optional)"), { target: { value: "" } });
  fireEvent.blur(screen.getByLabelText("First name"));
  fireEvent.click(screen.getByRole("button", { name: "Save application" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ primaryContact: expect.objectContaining({ fullName: "Ada Jane De La Cruz", firstName: "Ada", middleName: "Jane", lastName: "De La Cruz" }) })));
});
