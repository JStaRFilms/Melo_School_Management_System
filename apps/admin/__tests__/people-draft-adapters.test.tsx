import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { parseDraftPayload } from "@school/shared/drafts";
import { usePersistentFormDraft } from "@/usePersistentFormDraft";
import { restoreAdmissionContact } from "../app/academic/students/components/admissionContact";

const mocks = vi.hoisted(() => ({
  server: null as null | Record<string, unknown>,
  begin: vi.fn(),
  save: vi.fn(),
  discard: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.server,
  useMutation: (reference: object) => {
    const symbol = Object.getOwnPropertySymbols(reference)[0];
    const name = symbol ? String((reference as Record<symbol, unknown>)[symbol]) : "";
    if (name.endsWith(":beginFormDraft")) return mocks.begin;
    if (name.endsWith(":saveFormDraft")) return mocks.save;
    if (name.endsWith(":discardFormDraft")) return mocks.discard;
    throw new Error(`Unexpected mutation ${name}`);
  },
}));

afterEach(() => {
  mocks.server = null;
  vi.clearAllMocks();
});

const schoolId = "school-one" as never;
const connection = { connected: true, authenticated: true, accountId: "account-one" };
const payload = parseDraftPayload("staff_onboarding", {
  name: "Synthetic Teacher",
  email: "teacher@example.test",
});

it("allocates one instance, saves only the approved projection, and hands the exact revision to the domain submission", async () => {
  mocks.begin.mockResolvedValue({ draftId: "draft-one", revision: 0, expiresAt: Date.now() + 10000 });
  mocks.save.mockImplementation(async (args: { expectedRevision: number }) => ({
    draftId: "draft-one",
    revision: args.expectedRevision + 1,
    lastSavedAt: 123,
  }));
  const hook = renderHook(() => usePersistentFormDraft({
    formKey: "staff_onboarding",
    schoolId,
    accountId: "account-one",
    connection,
    currentData: payload,
    isDirty: true,
    instanceKey: 0,
    onRestore: vi.fn(),
  }));

  await waitFor(() => expect(mocks.begin).toHaveBeenCalledOnce());
  mocks.server = {
    schoolId,
    draftId: "draft-one",
    formKey: "staff_onboarding",
    payload: {},
    revision: 0,
    lastSavedAt: 123,
    expiresAt: Date.now() + 10000,
    schemaVersion: 1,
  };
  hook.rerender();
  expect(hook.result.current.showRecoveryModal).toBe(false);
  await act(async () => hook.result.current.retrySave());
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
    draftId: "draft-one",
    expectedRevision: 0,
    payload: { name: "Synthetic Teacher", email: "teacher@example.test" },
  }));
  expect(JSON.stringify(mocks.save.mock.calls[0]?.[0])).not.toMatch(/password|credential/i);

  let submission: Awaited<ReturnType<typeof hook.result.current.prepareSubmission>> = null;
  await act(async () => { submission = await hook.result.current.prepareSubmission(); });
  expect(submission).toEqual({ schoolId, draftId: "draft-one", expectedRevision: 1 });
  act(() => hook.result.current.submissionSucceeded());
});

it("offers timestamped recovery without overwriting edits and resumes the server revision explicitly", async () => {
  const restored = vi.fn();
  mocks.server = {
    schoolId,
    draftId: "draft-recovery",
    formKey: "staff_onboarding",
    payload: { name: "Recovered Teacher", email: "recovered@example.test" },
    revision: 4,
    lastSavedAt: 456,
    expiresAt: Date.now() + 10000,
    schemaVersion: 1,
  };
  mocks.save.mockResolvedValue({ draftId: "draft-recovery", revision: 5, lastSavedAt: 789 });

  const hook = renderHook(() => usePersistentFormDraft({
    formKey: "staff_onboarding",
    schoolId,
    accountId: "account-one",
    connection,
    currentData: payload,
    isDirty: true,
    instanceKey: 0,
    onRestore: restored,
  }));

  await waitFor(() => expect(hook.result.current.showRecoveryModal).toBe(true));
  expect(restored).not.toHaveBeenCalled();
  expect(hook.result.current.serverDraft?.lastSavedAt).toBe(456);
  act(() => hook.result.current.handleResumeDraft());
  expect(restored).toHaveBeenCalledWith({
    name: "Recovered Teacher",
    email: "recovered@example.test",
  });
  await act(async () => hook.result.current.retrySave());
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
    draftId: "draft-recovery",
    expectedRevision: 4,
  }));
});

it("recovers existing family drafts into the unified contact choice without guessing name parts", () => {
  const old = parseDraftPayload("family_onboarding", { studentFirstName: "Synthetic", studentLastName: "Student", parentFirstName: "Existing", parentLastName: "Parent", parentEmail: "parent@example.test", parentRelationship: "Family friend" });
  expect(restoreAdmissionContact(old)).toMatchObject({ contactChoice: "new", parentRelationship: "Family friend", parentMiddleName: "" });
  const selected = parseDraftPayload("student_onboarding", { contactChoice: "existing", selectedContactId: "parent-one", parentEmail: "parent@example.test", middleName: "Middle", emergencyContactMode: "override" });
  expect(restoreAdmissionContact(selected)).toMatchObject({ contactChoice: "existing", selectedContactId: "parent-one" });
  expect(selected.middleName).toBe("Middle");
});

it("rejects credential and raw-file shaped people payloads", () => {
  expect(() => parseDraftPayload("student_onboarding", {
    firstName: "Synthetic",
    temporaryPassword: "must-not-persist",
  })).toThrow();
  expect(() => parseDraftPayload("family_onboarding", {
    studentFirstName: "Synthetic",
    photoStorageId: "raw-upload",
  })).toThrow();
  expect(() => parseDraftPayload("staff_onboarding", {
    name: "Synthetic Teacher",
    email: "teacher@example.test",
    credentialSummary: { password: "must-not-persist" },
  })).toThrow();
});
