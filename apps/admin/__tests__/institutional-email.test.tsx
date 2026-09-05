import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import EmailDomainsPage from "../app/admin/settings/email-domains/page";

const mocks = vi.hoisted(() => ({
  allowed: true as boolean | undefined, loading: false, empty: false, policy: true, version: 1, candidate: "ada.example2",
  save: vi.fn(), guard: vi.fn(),
}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } } }) }));
vi.mock("@school/shared/drafts", () => ({ useDirtyForm: (options: unknown) => mocks.guard(options) }));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => (args: unknown) => mocks.save(getFunctionName(reference), args),
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    if (name.endsWith("hasViewerCapability")) return mocks.allowed;
    if (name.endsWith("getEmailWorkbench")) return mocks.loading ? undefined : {
      permissions: { policy: mocks.policy, staff: true, student: true, lifecycle: true },
      policy: mocks.empty ? null : { domainId: "domain", staffTemplate: "firstname.lastname", studentTemplate: "firstname.lastname", version: mocks.version },
      people: mocks.empty ? [] : [{ personId: "person", name: "Ada Example", kind: "student" }],
      domains: mocks.empty ? [] : [{ _id: "domain", schoolId: "school", domain: "school.example", provider: "google", status: "pending_verification", isDefault: true }],
      mailboxes: mocks.empty ? [] : [
        { _id: "login", personId: "person", email: "login@school.example", kind: "student", state: "login_only", providerType: "none", status: "active" },
        { _id: "external", personId: "person", email: "external@school.example", kind: "student", state: "external_verified", providerType: "none", status: "suspended", aliasOfMailboxId: "login" },
        { _id: "managed", personId: "person", email: "managed@school.example", kind: "staff", state: "provider_provisioned", providerType: "google", status: "active", reconciliationRequired: true },
      ], groupName: "Synthetic group", providerActivation: "unavailable", limit: 100,
    };
    if (name.endsWith("proposeEmailAddresses")) return [{ personId: "person", proposedEmail: `${mocks.candidate}@school.example`, localPart: mocks.candidate, domain: "school.example", stage: 3, reason: "Collision: deterministic alternative proposed", alternatives: ["ada.example@school.example", "ada.example2@school.example"], policyVersion: mocks.version }];
    if (name.endsWith("reviewEmailAddress") && typeof args === "object" && args !== null && "localPart" in args && "expectedPolicyVersion" in args) {
      const valid = args.localPart !== "admin" && args.expectedPolicyVersion === mocks.version;
      return { valid, email: `${args.localPart}@school.example`, reason: valid ? "Available; approval rechecks transactionally" : "Reserved collision or policy changed; repeat dry run" };
    }
    return undefined;
  },
}));
afterEach(() => {
  cleanup(); mocks.allowed = true; mocks.loading = false; mocks.empty = false; mocks.policy = true; mocks.version = 1; mocks.candidate = "ada.example2";
  mocks.save.mockReset(); mocks.guard.mockReset();
});
it("distinguishes permission loading, denied, data loading and empty states without exposing controls", () => {
  mocks.allowed = undefined; render(<EmailDomainsPage />);
  expect(screen.getByText("Checking email permissions…")).toBeTruthy(); cleanup();
  mocks.allowed = false; render(<EmailDomainsPage />);
  expect(screen.getByRole("alert").textContent).toContain("access denied");
  expect(screen.queryByLabelText("Domain")).toBeNull(); cleanup();
  mocks.allowed = true; mocks.loading = true; render(<EmailDomainsPage />);
  expect(screen.getByText("Loading institutional email settings…")).toBeTruthy(); cleanup();
  mocks.loading = false; mocks.empty = true; render(<EmailDomainsPage />);
  expect(screen.getByText(/No domains registered/)).toBeTruthy();
  expect(screen.getByText(/No approved address allocations/)).toBeTruthy();
  expect(screen.getByText("Run address dry run").closest("fieldset")?.disabled).toBe(true);
});
it("shows three distinct evidence badges and failure/alias/lifecycle gates without provider controls", () => {
  render(<EmailDomainsPage />);
  expect(screen.getByText(/Login-only identifier — no inbox/)).toBeTruthy();
  expect(screen.getByText(/External mailbox evidence recorded/)).toBeTruthy();
  expect(screen.getByText(/Provider-provisioned mailbox evidence recorded/)).toBeTruthy();
  expect(screen.getByText(/Provider failure \/ unknown outcome/)).toBeTruthy();
  expect(screen.getByText(/Approved additional-address relation/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /verify|provision|send|retry provider/i })).toBeNull();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("blocks duplicate registration and requires explicit policy confirmation with reviewed version", async () => {
  render(<EmailDomainsPage />);
  fireEvent.change(screen.getByLabelText("Domain"), { target: { value: " SCHOOL.EXAMPLE " } });
  expect((screen.getByText("Review registration") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Domain already registered/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Student template"), { target: { value: "f.lastname" } });
  fireEvent.click(screen.getByText("Review policy"));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Confirm policy"));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining("saveEmailPolicy"), expect.objectContaining({ studentTemplate: "f.lastname", expectedVersion: 1, confirmed: true })));
  expect(mocks.guard).toHaveBeenCalledWith(expect.objectContaining({ isDirty: true }));
});
it("requires dry-run/manual review and human approval, retaining failed edits without identity/provider arguments", async () => {
  mocks.save.mockRejectedValue(new Error("conflict"));
  render(<EmailDomainsPage />);
  fireEvent.change(screen.getByLabelText("Person"), { target: { value: "person" } });
  fireEvent.click(screen.getByText("Run address dry run"));
  expect(screen.getByText(/Collision: deterministic alternative proposed/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Review / manually edit local part"), { target: { value: "admin" } });
  expect((screen.getByText("Review approval") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Review / manually edit local part"), { target: { value: "ada.reviewed" } });
  fireEvent.change(screen.getByLabelText("Additional-address / alias metadata for"), { target: { value: "login" } });
  fireEvent.click(screen.getByText("Review approval"));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Confirm login-only approval"));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining("assignInstitutionalMailbox"), {
    schoolId: "school", personId: "person", email: "ada.reviewed@school.example", expectedPolicyVersion: 1,
    aliasOfMailboxId: "login", isMinor: true, minorPrivacyRequested: false,
  }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Your edits remain here"));
  expect((screen.getByLabelText("Review / manually edit local part") as HTMLInputElement).value).toBe("ada.reviewed");
});
it("a reactive policy change cannot silently refresh an already-reviewed approval version", () => {
  const view = render(<EmailDomainsPage />);
  fireEvent.change(screen.getByLabelText("Person"), { target: { value: "person" } });
  fireEvent.click(screen.getByText("Run address dry run"));
  fireEvent.click(screen.getByText("Review approval"));
  mocks.version = 2; view.rerender(<EmailDomainsPage />);
  expect((screen.getByText("Confirm login-only approval") as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.save).not.toHaveBeenCalled();
});
it("never silently changes the confirmed address after a reactive collision update", () => {
  const view = render(<EmailDomainsPage />);
  fireEvent.change(screen.getByLabelText("Person"), { target: { value: "person" } });
  fireEvent.click(screen.getByText("Run address dry run"));
  fireEvent.click(screen.getByText("Review approval"));
  mocks.candidate = "ada.example3"; view.rerender(<EmailDomainsPage />);
  expect((screen.getByText("Confirm login-only approval") as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Candidate changed after review/)).toBeTruthy();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("requires source-owner confirmation before enabling group domain inheritance", async () => {
  render(<EmailDomainsPage />);
  fireEvent.click(screen.getByText("Review sharing with this group"));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Confirm sharing policy"));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining("setEmailDomainSharing"), { domainId: "domain", sharedWithGroup: true, confirmed: true }));
});
it("lifecycle is confirmed local intent only and domain policy is read-only without its capability", async () => {
  mocks.policy = false; render(<EmailDomainsPage />);
  expect(screen.queryByLabelText("Domain")).toBeNull();
  expect((screen.getByLabelText("Student template") as HTMLSelectElement).closest("fieldset")?.disabled).toBe(true);
  fireEvent.click(screen.getAllByText("Record archive")[0]);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.getByText(/This does not revoke provider or Melo login access/)).toBeTruthy();
  fireEvent.click(screen.getByText("Confirm lifecycle"));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining("suspendOrArchiveMailbox"), { mailboxId: "login", action: "archive" }));
});
