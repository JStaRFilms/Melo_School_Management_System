import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { DepartureGuardProvider } from "@school/shared/drafts";
import StudentOnboardingPage from "../app/academic/students/onboarding/page";
import type { StudentFirstOnboardingForm } from "../app/academic/students/onboarding/StudentFirstOnboardingForm";

const mocks = vi.hoisted(() => ({ create: vi.fn(), link: vi.fn(), action: vi.fn(), classes: [{ _id: "class-one", name: "Synthetic Class", level: "P1" }] }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: undefined }) }));
vi.mock("@/useDraftConnection", () => ({ useDraftConnection: () => ({ connected: true, authenticated: true, accountId: "operator-one" }) }));
vi.mock("@/usePersistentFormDraft", () => ({ usePersistentFormDraft: () => ({
  status: "idle", lastSavedAt: null, memoryDraft: null, serverDraft: null, showRecoveryModal: false,
  retrySave: vi.fn().mockResolvedValue(undefined), prepareSubmission: vi.fn().mockResolvedValue(null),
  handleCommitDraft: vi.fn().mockResolvedValue(undefined), handleDiscardDraft: vi.fn().mockResolvedValue(undefined),
  submissionFailed: vi.fn(), previewLatest: vi.fn(), dismissRecoveryModal: vi.fn(), handleResumeDraft: vi.fn(),
  resumeMemoryDraft: vi.fn(), discardMemoryDraft: vi.fn(),
}) }));
vi.mock("convex/react", () => ({
  useQuery: (reference: unknown) => typeof reference === "string" ? mocks.classes : undefined,
  useMutation: (reference: string) => reference.endsWith(":createStudent") ? mocks.create : reference.endsWith(":upsertStudentFamilyLink") ? mocks.link : vi.fn(),
  useAction: () => mocks.action,
}));
vi.mock("../app/academic/students/onboarding/StudentFirstOnboardingForm", () => ({
  StudentFirstOnboardingForm: (props: ComponentProps<typeof StudentFirstOnboardingForm>) => <form onSubmit={props.onSubmit}>
    <button type="button" onClick={() => {
      props.onFirstNameChange("Synthetic"); props.onLastNameChange("Student"); props.onAdmissionNumberChange("TEST-1"); props.onGenderChange("Female"); props.onClassIdChange("class-one");
      props.onParentFirstNameChange("Synthetic"); props.onParentLastNameChange("Parent"); props.onParentEmailChange("parent@example.test");
    }}>Fill synthetic enrollment</button>
    <button type="submit">Enroll</button>
  </form>,
}));

it("retries failed family follow-up on the confirmed student, without creating it again", async () => {
  mocks.create.mockResolvedValue("student-one");
  mocks.link.mockRejectedValueOnce(new Error("synthetic failure")).mockResolvedValueOnce({ familyId: "family-one", parentUserId: "parent-one", familyMemberId: "member-one" });
  render(<DepartureGuardProvider><StudentOnboardingPage /></DepartureGuardProvider>);
  fireEvent.click(screen.getByText("Fill synthetic enrollment"));
  fireEvent.click(screen.getByText("Enroll"));
  await screen.findByText(/Student created; follow-up setup is pending/);
  fireEvent.click(screen.getByText("Enroll"));
  await waitFor(() => expect(mocks.link).toHaveBeenCalledTimes(2));
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.link.mock.calls.map(([args]) => args.studentId)).toEqual(["student-one", "student-one"]);
  expect(mocks.action).not.toHaveBeenCalled();
});
