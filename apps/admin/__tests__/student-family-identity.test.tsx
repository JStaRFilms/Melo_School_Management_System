import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { StudentFamilyPanel } from "../app/academic/students/components/StudentFamilyPanel";

const mocks = vi.hoisted(() => ({ edit: vi.fn(), household: vi.fn(), remove: vi.fn(), delete: vi.fn(), link: vi.fn(), action: vi.fn(), search: vi.fn(), contactsDone: true,
  parent: { _id: "member", parentUserId: "parent", name: "Grace Marie Anthony", firstName: "Grace", middleName: "Marie", lastName: "Anthony", email: "grace@example.test", phone: "+2348012345678", role: "parent", relationship: "Family friend", isPrimaryContact: true, portalState: "provisioned", addressMode: "different", addressOverride: "Retained override", effectiveAddress: "Retained override", addressSource: "different" },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: FunctionReference<"query">, args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    if (name.endsWith(":getStudentFamilyProfile")) return { family: { _id: "family", name: "Anthony household", residentialAddress: "Shared address", studentCount: 2, parentCount: 1 }, parents: [mocks.parent], students: [] };
    if (name.endsWith(":getPortalAccountState")) return { state: "provisioned", email: "grace@example.test" };
    if (name.endsWith(":searchParentContacts")) {
      mocks.search(args);
      return { page: [{ userId: "parent-two", displayName: "Stored Contact", email: "stored@example.test", portalState: "provisioned", households: [] }], isDone: mocks.contactsDone, continueCursor: "next-contact-page" };
    }
    if (name.endsWith(":getParentEmailReview")) return { matches: [{ userId: "parent-two", name: "Stored Contact", email: "stored@example.test", role: "parent", isArchived: false, families: [] }] };
    return undefined;
  },
  useMutation: (reference: FunctionReference<"mutation">) => {
    const name = getFunctionName(reference);
    if (name.endsWith(":updateStudentFamilyParentContact")) return mocks.edit;
    if (name.endsWith(":updateHousehold")) return mocks.household;
    if (name.endsWith(":removeStudentFamilyLink")) return mocks.remove;
    if (name.endsWith(":deleteUnusedParent")) return mocks.delete;
    if (name.endsWith(":upsertStudentFamilyLink")) return mocks.link;
    return vi.fn();
  },
  useAction: () => mocks.action,
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.contactsDone = true; });
function mount(onNotice = vi.fn()) { return render(<StudentFamilyPanel studentId="student" studentName="Synthetic Student" onNotice={onNotice} />); }

it("edits the household label/address only after confirming inheritance consequences", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Edit household label and address" }));
  fireEvent.change(screen.getByLabelText("Household label"), { target: { value: "Reviewed label" } });
  fireEvent.change(screen.getByLabelText("Household residential address"), { target: { value: "New common address" } });
  fireEvent.click(screen.getByRole("button", { name: "Review household change" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("Different-address overrides and identities remain unchanged.");
  expect(mocks.household).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await waitFor(() => expect(mocks.household).toHaveBeenCalledWith({ familyId: "family", name: "Reviewed label", residentialAddress: "New common address", confirmed: true }));
  expect(mocks.edit).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled();
});

it("reopens middles/custom relationships/overrides and preserves them during an unrelated contact edit", async () => {
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Edit contact" }));
  expect(screen.getByLabelText("Middle name (optional)")).toHaveValue("Marie");
  expect(screen.getByLabelText("Custom relationship")).toHaveValue("Family friend");
  expect(screen.getByLabelText("Different address")).toHaveValue("Retained override");
  fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "+2348098765432" } });
  fireEvent.click(screen.getByRole("button", { name: "Save contact" }));
  await waitFor(() => expect(mocks.edit).toHaveBeenCalledOnce());
  const args = mocks.edit.mock.calls[0][0];
  expect(args).toMatchObject({ familyMemberId: "member", phone: "+2348098765432" });
  for (const field of ["firstName", "middleName", "lastName", "relationship", "addressMode", "addressOverride"]) expect(args[field]).toBeUndefined();
  expect(mocks.household).not.toHaveBeenCalled();
});

it("resets matching-result pagination when the search field or text changes", async () => {
  mocks.contactsDone = false;
  mount();
  fireEvent.change(screen.getByLabelText("Contact choice"), { target: { value: "existing" } });
  expect(mocks.search).toHaveBeenLastCalledWith({ search: "", searchField: "name", paginationOpts: { numItems: 20, cursor: null } });
  fireEvent.click(await screen.findByRole("button", { name: "Next contact page" }));
  expect(mocks.search).toHaveBeenLastCalledWith(expect.objectContaining({ paginationOpts: { numItems: 20, cursor: "next-contact-page" } }));
  fireEvent.change(screen.getByLabelText("Search field"), { target: { value: "email" } });
  expect(mocks.search).toHaveBeenLastCalledWith({ search: "", searchField: "email", paginationOpts: { numItems: 20, cursor: null } });
  expect(screen.getByText("Matches word prefixes, not text inside a word.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next contact page" }));
  fireEvent.change(screen.getByLabelText("Search contacts by email"), { target: { value: "stored" } });
  expect(mocks.search).toHaveBeenLastCalledWith({ search: "stored", searchField: "email", paginationOpts: { numItems: 20, cursor: null } });
  expect(mocks.link).not.toHaveBeenCalled();
  expect(mocks.edit).not.toHaveBeenCalled();
  expect(mocks.action).not.toHaveBeenCalled();
});

it("links an existing stored ID read-only without provisioning or identity fields", async () => {
  mount();
  fireEvent.change(screen.getByLabelText("Contact choice"), { target: { value: "existing" } });
  fireEvent.click(await screen.findByRole("button", { name: /Stored Contact.*stored@example.test/ }));
  await screen.findByText("Linking this contact will not change their details or reset their credentials.");
  fireEvent.click(screen.getByRole("button", { name: "Link contact" }));
  await waitFor(() => expect(mocks.link).toHaveBeenCalledWith(expect.objectContaining({ parentUserId: "parent-two", studentId: "student", isPrimaryContact: false })));
  expect(mocks.link.mock.calls[0][0]).not.toHaveProperty("firstName");
  expect(mocks.edit).not.toHaveBeenCalled(); expect(mocks.action).not.toHaveBeenCalled();
});

it("keeps unlink distinct from deletion and exposes retained-reference blockers", async () => {
  const notice = vi.fn(); mocks.delete.mockRejectedValueOnce(new Error("This record has retained references and cannot be deleted"));
  mount(notice);
  fireEvent.click(await screen.findByRole("button", { name: "Unlink contact" }));
  fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Unlink contact" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ familyMemberId: "member" }));
  expect(mocks.delete).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Delete if genuinely unused" }));
  fireEvent.click(await screen.findByRole("button", { name: "Delete unused parent" }));
  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith({ parentUserId: "parent", confirmed: true }));
  expect(notice).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", message: expect.stringMatching(/retained references/) }));
});
