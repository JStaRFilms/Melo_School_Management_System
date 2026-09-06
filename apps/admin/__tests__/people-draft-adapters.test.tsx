import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { parseDraftPayload } from "@school/shared/drafts";
import { usePersistentFormDraft } from "@/usePersistentFormDraft";
import { FamilyOnboardingForm } from "../app/academic/students/components/FamilyOnboardingForm";

const mocks = vi.hoisted(() => ({
  server: null as null | Record<string, unknown>,
  begin: vi.fn(),
  save: vi.fn(),
  discard: vi.fn(),
  commit: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.server,
  useMutation: (reference: object) => {
    const symbol = Object.getOwnPropertySymbols(reference)[0];
    const name = symbol ? String((reference as Record<symbol, unknown>)[symbol]) : "";
    if (name.endsWith(":beginFormDraft")) return mocks.begin;
    if (name.endsWith(":saveFormDraft")) return mocks.save;
    if (name.endsWith(":discardFormDraft")) return mocks.discard;
    if (name.endsWith(":commitFormDraft")) return mocks.commit;
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

it("allocates one instance, saves only the approved projection, and closes the exact revision", async () => {
  mocks.begin.mockResolvedValue({ draftId: "draft-one", revision: 0, expiresAt: Date.now() + 10000 });
  mocks.save.mockImplementation(async (args: { expectedRevision: number }) => ({
    draftId: "draft-one",
    revision: args.expectedRevision + 1,
    lastSavedAt: 123,
  }));
  mocks.commit.mockResolvedValue({ success: true });

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
  await act(async () => hook.result.current.retrySave());
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
    draftId: "draft-one",
    expectedRevision: 0,
    payload: { name: "Synthetic Teacher", email: "teacher@example.test" },
  }));
  expect(JSON.stringify(mocks.save.mock.calls[0]?.[0])).not.toMatch(/password|credential/i);

  await act(async () => hook.result.current.handleCommitDraft());
  expect(mocks.commit).toHaveBeenCalledWith({
    schoolId,
    draftId: "draft-one",
    expectedRevision: 1,
  });
  await act(async () => {
    await expect(hook.result.current.retrySave()).rejects.toThrow(/closed/);
  });
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

it("uses validated required progress while exposing an invalid optional family section", () => {
  const noop = vi.fn();
  const props: ComponentProps<typeof FamilyOnboardingForm> = {
    selectedClassName: "Synthetic Class",
    classes: [{ _id: "class-one", name: "Synthetic Class", level: "Primary" }],
    selectedClassId: null,
    onClassIdChange: noop,
    studentFirstName: "",
    onStudentFirstNameChange: noop,
    onStudentFirstNameBlur: noop,
    studentLastName: "",
    onStudentLastNameChange: noop,
    onStudentLastNameBlur: noop,
    admissionNumber: "",
    onAdmissionNumberChange: noop,
    gender: "",
    onGenderChange: noop,
    parentFirstName: "",
    onParentFirstNameChange: noop,
    onParentFirstNameBlur: noop,
    parentLastName: "",
    onParentLastNameChange: noop,
    onParentLastNameBlur: noop,
    parentEmail: "",
    onParentEmailChange: noop,
    parentPhone: "",
    onParentPhoneChange: noop,
    parentRelationship: "",
    onParentRelationshipChange: noop,
    isParentPrimaryContact: true,
    onIsParentPrimaryContactChange: noop,
    isSubmitting: false,
    draftStatus: "idle",
    draftLastSavedAt: null,
    onSubmit: vi.fn(),
    inputRef: { current: null },
  };
  const view = render(<FamilyOnboardingForm {...props} />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  view.rerender(<FamilyOnboardingForm
    {...props}
    selectedClassId="class-one"
    studentFirstName="Synthetic"
    studentLastName="Student"
    admissionNumber="SYN-1"
    gender="Female"
    parentFirstName="Incomplete"
  />);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  expect(screen.getByText(/Family link: error/)).toBeInTheDocument();
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
