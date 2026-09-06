import { createRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StudentCreationForm } from "../app/academic/students/components/StudentCreationForm";
import { StudentProfileEditor } from "../app/academic/students/components/StudentProfileEditor";

const mocks = vi.hoisted(() => ({
  updateStudent: vi.fn(),
  otherMutation: vi.fn(),
  action: vi.fn(),
  profile: {
    _id: "student",
    userId: "student-user",
    email: "old001@students.local",
    name: "Ada Student",
    displayName: "Ada Student",
    firstName: "Ada",
    lastName: "Student",
    admissionNumber: "OLD/001",
    classId: "class",
    className: "Primary 1",
    houseName: null,
    gender: "Female",
    dateOfBirth: null,
    guardianName: null,
    guardianPhone: null,
    address: null,
    photoUrl: null,
    photoFileName: null,
    photoContentType: null,
  },
}));

vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { schoolId: "school" },
      effectiveCapabilities: ["enrollment.admissions.override_number"],
    },
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (_reference: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "studentId" in args) {
      return mocks.profile;
    }
    return { policy: { pattern: "{SCHOOL}-{SEQ:4}" } };
  },
  useMutation: (reference: unknown) =>
    String(reference).includes("updateStudent")
      ? mocks.updateStudent
      : mocks.otherMutation,
  useAction: () => mocks.action,
}));

afterEach(() => {
  cleanup();
  mocks.updateStudent.mockReset();
  mocks.otherMutation.mockReset();
  mocks.action.mockReset();
});

it("keeps a governed creation form nonmutating until submit and permits automatic allocation without a typed number", () => {
  const onSubmit = vi.fn(async () => undefined);
  render(
    <StudentCreationForm
      selectedClassName="Primary 1"
      studentFirstName="Ada"
      studentLastName="Student"
      admissionNumber=""
      admissionNumberMode="automatic"
      numberingPolicyConfigured
      numberingPolicyLoading={false}
      numberingPreview="SCH-0001"
      canOverrideAdmissionNumber={false}
      overrideReason=""
      overrideConfirmed={false}
      overrideCounterDecision=""
      advanceCounterTo=""
      gender="Female"
      houseName=""
      dateOfBirth=""
      guardianName=""
      guardianPhone=""
      address=""
      photoPreviewUrl={null}
      photoResetKey={0}
      isSubmitting={false}
      selectedClassId="class"
      sectionRef={createRef<HTMLDivElement>()}
      inputRef={createRef<HTMLInputElement>()}
      onStudentFirstNameChange={vi.fn()}
      onStudentFirstNameBlur={vi.fn()}
      onStudentLastNameChange={vi.fn()}
      onStudentLastNameBlur={vi.fn()}
      onAdmissionNumberChange={vi.fn()}
      onAdmissionNumberModeChange={vi.fn()}
      onOverrideReasonChange={vi.fn()}
      onOverrideConfirmedChange={vi.fn()}
      onOverrideCounterDecisionChange={vi.fn()}
      onAdvanceCounterToChange={vi.fn()}
      onGenderChange={vi.fn()}
      onHouseNameChange={vi.fn()}
      onDateOfBirthChange={vi.fn()}
      onGuardianNameChange={vi.fn()}
      onGuardianPhoneChange={vi.fn()}
      onAddressChange={vi.fn()}
      onPhotoChange={vi.fn()}
      onRemovePhoto={vi.fn()}
      onPhotoValidationError={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByText("SCH-0001")).toBeInTheDocument();
  expect(onSubmit).not.toHaveBeenCalled();
  const submit = screen.getByRole("button", { name: "Complete Admission" });
  expect(submit).toBeEnabled();
  const form = submit.closest("form");
  if (!form) throw new Error("Expected creation form");
  fireEvent.submit(form);
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

it("requires profile corrections to send reason, authorization, and an explicit counter choice", async () => {
  render(
    <StudentProfileEditor
      studentId="student"
      classes={[{ _id: "class", name: "Primary 1", level: "Primary" }]}
      onNotice={vi.fn()}
    />,
  );

  fireEvent.change(await screen.findByLabelText("Admission ID"), {
    target: { value: "HIST/002" },
  });
  const save = screen.getByRole("button", { name: "Save Identity" });
  expect(save).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Audit reason"), {
    target: { value: "Registrar corrected historical record" },
  });
  fireEvent.click(
    screen.getByLabelText("No, keep the automatic counter unchanged"),
  );
  fireEvent.click(
    screen.getByLabelText(
      "I confirm this override, its reason, and the counter decision.",
    ),
  );
  expect(save).toBeEnabled();
  fireEvent.click(save);

  await waitFor(() =>
    expect(mocks.updateStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: "student",
        admissionNumber: "HIST/002",
        overrideConfirmed: true,
        overrideReason: "Registrar corrected historical record",
        overrideCounterDecision: "keep",
        advanceCounterTo: undefined,
      }),
    ),
  );
});
