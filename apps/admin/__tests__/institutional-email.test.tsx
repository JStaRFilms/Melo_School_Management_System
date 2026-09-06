import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import EmailDomainsPage from "../app/admin/settings/email-domains/page";

const mocks = vi.hoisted(() => ({
  allowed: true as boolean | undefined, loading: false, empty: false, policy: true, version: 1, candidate: "ada.example2",
  pageStatus: "Exhausted" as "Exhausted" | "CanLoadMore" | "LoadingMore", draft: null as null | Record<string, unknown>,
  save: vi.fn(), guard: vi.fn(), loadMore: vi.fn(), begin: vi.fn(), draftSave: vi.fn(), draftDiscard: vi.fn(), draftCommit: vi.fn(),
}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } }, session: { user: { id: "account" } } }) }));
vi.mock("@/useDraftConnection", () => ({ useDraftConnection: () => ({ connected: true, authenticated: true, accountId: "account" }) }));
vi.mock("@school/shared/drafts", async importOriginal => ({ ...(await importOriginal<typeof import("@school/shared/drafts")>()), useDirtyForm: (options: unknown) => mocks.guard(options) }));
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name.endsWith("beginFormDraft")) return mocks.begin;
    if (name.endsWith("saveFormDraft")) return mocks.draftSave;
    if (name.endsWith("discardFormDraft")) return mocks.draftDiscard;
    if (name.endsWith("commitFormDraft")) return mocks.draftCommit;
    return (args: unknown) => mocks.save(name, args);
  },
  usePaginatedQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference);
    if (args === "skip") return { results: [], status: "Exhausted", loadMore: mocks.loadMore };
    if (name.endsWith("listEmailDomainsPage")) return { results: mocks.empty ? [] : [{ _id: "domain", schoolId: "school", domain: "school.example", provider: "google", status: "pending_verification", isDefault: true }], status: mocks.pageStatus, loadMore: mocks.loadMore };
    if (name.endsWith("listEmailProposalPeoplePage")) return { results: mocks.empty ? [] : [{ personId: "person", name: "Ada Example", kind: "student" }], status: mocks.pageStatus, loadMore: mocks.loadMore };
    return { results: mocks.empty ? [] : [
      { _id: "login", personId: "person", email: "login@school.example", kind: "student", state: "login_only", providerType: "none", status: "active" },
      { _id: "external", personId: "person", email: "external@school.example", kind: "student", state: "external_verified", providerType: "none", status: "suspended", aliasOfMailboxId: "login" },
      { _id: "managed", personId: "person", email: "managed@school.example", kind: "staff", state: "provider_provisioned", providerType: "google", status: "active", reconciliationRequired: true },
    ], status: mocks.pageStatus, loadMore: mocks.loadMore };
  },
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    if (name.endsWith("getFormDraft")) return mocks.draft;
    if (name.endsWith("hasViewerCapability")) return mocks.allowed;
    if (name.endsWith("getEmailWorkbench")) return mocks.loading ? undefined : {
      permissions: { policy: mocks.policy, staff: true, student: true, lifecycle: true },
      policy: mocks.empty ? null : { domainId: "domain", staffTemplate: "firstname.lastname", studentTemplate: "firstname.lastname", version: mocks.version },
      groupName: "Synthetic group", providerActivation: "unavailable", policyDomainUnavailable: false, pageSize: 25,
    };
    if (name.endsWith("proposeEmailAddresses")) return [{ personId: "person", proposedEmail: `${mocks.candidate}@school.example`, localPart: mocks.candidate, domain: "school.example", stage: 3, reason: "Collision: deterministic alternative proposed", alternatives: ["ada.example@school.example", "ada.example2@school.example"], policyVersion: mocks.version }];
    if (name.endsWith("reviewEmailAddress") && typeof args === "object" && args !== null && "localPart" in args && "expectedPolicyVersion" in args) {
      const valid = args.localPart !== "admin" && args.expectedPolicyVersion === mocks.version;
      return { valid, email: `${args.localPart}@school.example`, reason: valid ? "Available; approval rechecks transactionally" : "Reserved collision or policy changed; repeat dry run" };
    }
    return undefined;
  },
}));
beforeEach(() => {
  mocks.allowed = true; mocks.loading = false; mocks.empty = false; mocks.policy = true; mocks.version = 1; mocks.candidate = "ada.example2"; mocks.pageStatus = "Exhausted"; mocks.draft = null;
  mocks.save.mockReset(); mocks.guard.mockReset(); mocks.loadMore.mockReset(); mocks.begin.mockReset(); mocks.draftSave.mockReset(); mocks.draftDiscard.mockReset(); mocks.draftCommit.mockReset();
  mocks.begin.mockResolvedValue({ draftId: "review-draft", revision: 0, expiresAt: Date.now() + 10000 });
  mocks.draftSave.mockResolvedValue({ draftId: "review-draft", revision: 1, lastSavedAt: 100 });
  mocks.draftDiscard.mockResolvedValue({ success: true }); mocks.draftCommit.mockResolvedValue({ success: true });
});
afterEach(cleanup);
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
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.stringContaining("assignInstitutionalMailbox"), expect.objectContaining({
    schoolId: "school", personId: "person", email: "ada.reviewed@school.example", expectedPolicyVersion: 1,
    aliasOfMailboxId: "login", isMinor: true, minorPrivacyRequested: false,
    draftId: "review-draft", expectedDraftRevision: 1,
  })));
  const approvalArgs = mocks.save.mock.calls.find(([name]) => String(name).endsWith("assignInstitutionalMailbox"))?.[1];
  expect(JSON.stringify(approvalArgs)).not.toMatch(/dnsTxtRecord|providerAccountId|providerOperation|approvalEmail/);
  await waitFor(() => expect(screen.getByText(/Operation failed or permission\/policy changed/).textContent).toContain("Your edits remain here"));
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
it("loads bounded cursor pages explicitly for domains, proposal candidates and allocations", () => {
  mocks.pageStatus = "CanLoadMore";
  render(<EmailDomainsPage />);
  fireEvent.click(screen.getByText("Load more branch domains"));
  fireEvent.click(screen.getByText("Load more shared domains"));
  fireEvent.click(screen.getByText("Load more proposal candidates"));
  fireEvent.click(screen.getByText("Load more allocations"));
  expect(mocks.loadMore).toHaveBeenCalledTimes(4);
  expect(mocks.loadMore).toHaveBeenCalledWith(25);
});
it("offers explicit private recovery, restores only approved fields and requires a fresh dry run", () => {
  mocks.draft = { schoolId: "school", draftId: "recovered-draft", formKey: "institutional_email_review", revision: 3, lastSavedAt: 100,
    expiresAt: Date.now() + 10000, schemaVersion: 1, payload: { personId: "person", firstName: "Recovered", middleName: "M", lastName: "Minor", isMinor: true, minorPrivacyRequested: true, localPart: "r.minor", aliasOfMailboxId: "login" } };
  render(<EmailDomainsPage />);
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByText("Preview Draft"));
  expect(screen.getByText((content, element) => element?.tagName === "PRE" && content.includes('\"localPart\": \"r.minor\"'))).toBeTruthy();
  expect(screen.queryByText(/dnsTxtRecord|providerAccountId|providerOperationId/)).toBeNull();
  fireEvent.click(screen.getByText("Resume Editing Draft"));
  expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Recovered");
  expect(screen.queryByLabelText("Review / manually edit local part")).toBeNull();
  expect(screen.queryByText(/Collision: deterministic alternative proposed/)).toBeNull();
  fireEvent.click(screen.getByText("Run address dry run"));
  expect(screen.getByText(/Collision: deterministic alternative proposed/)).toBeTruthy();
  expect((screen.getByLabelText("Review / manually edit local part") as HTMLInputElement).value).toBe("r.minor");
});
it("discards the exact recovered revision and clears private review fields", async () => {
  mocks.draft = { schoolId: "school", draftId: "recovered-draft", formKey: "institutional_email_review", revision: 3, lastSavedAt: 100,
    expiresAt: Date.now() + 10000, schemaVersion: 1, payload: { personId: "person", firstName: "Private", middleName: "", lastName: "Minor", isMinor: true, minorPrivacyRequested: true, localPart: "p.minor", aliasOfMailboxId: "" } };
  render(<EmailDomainsPage />);
  fireEvent.click(screen.getByText("Discard Draft & Start Fresh"));
  await waitFor(() => expect(mocks.draftDiscard).toHaveBeenCalledWith({ schoolId: "school", draftId: "recovered-draft", expectedRevision: 3 }));
  expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("");
});
it("surfaces a stale draft revision conflict without clearing current review data", async () => {
  mocks.draftSave.mockRejectedValue({ data: { code: "CONFLICT" } });
  render(<EmailDomainsPage />);
  fireEvent.change(screen.getByLabelText("Person"), { target: { value: "person" } });
  await waitFor(() => expect(mocks.begin).toHaveBeenCalled());
  fireEvent.click(screen.getByText("Save draft"));
  await waitFor(() => expect(screen.getByText("Conflict detected")).toBeTruthy());
  expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Ada");
  expect(mocks.save).not.toHaveBeenCalledWith(expect.stringContaining("assignInstitutionalMailbox"), expect.anything());
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
