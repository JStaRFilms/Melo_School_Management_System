import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import TransfersPage from "../app/academic/students/transfers/page";
import TransferError from "../app/academic/students/transfers/error";

const mocks = vi.hoisted(() => ({
  allowed: true,
  school: "source",
  status: "initiated",
  override: false,
  initiate: vi.fn(),
  release: vi.fn(),
  accept: vi.fn(),
  abort: vi.fn(),
  departure: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { schoolId: mocks.school },
      compatibility: { legacyUserId: "operator" },
    },
  }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@school/shared/drafts", () => ({
  useDirtyForm: vi.fn(),
  useDepartureGuard: () => ({ requestDeparture: mocks.departure }),
}));
const record = () => ({
  _id: "transfer",
  sourceSchoolId: "source",
  destinationSchoolId: "destination",
  studentId: "student",
  studentName: "Synthetic Learner",
  status: mocks.status,
  sourceReleaseRecorded: mocks.status !== "initiated",
  guardianConsentRecorded: true,
  guardianConsentMethod: "Written consent",
  proposalClassName: "Year 6",
  proposalSessionName: "2026/27",
  createdAt: 1,
  updatedAt: 2,
  portableRecordPackage: {
    studentName: "Synthetic Learner",
    academicHistorySummary: "Completed Year 5",
  },
});
vi.mock("convex/react", () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name.endsWith("initiateStudentTransfer")) return mocks.initiate;
    if (name.endsWith("authorizeSourceRelease")) return mocks.release;
    if (name.endsWith("acceptDestinationTransfer")) return mocks.accept;
    return mocks.abort;
  },
  useQuery: (
    reference: Parameters<typeof getFunctionName>[0],
    args: unknown,
  ) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(reference);
    if (name.endsWith("getTransferWorkspace"))
      return mocks.allowed
        ? {
            allowed: true,
            schoolName: mocks.school,
            destinations: [{ _id: "destination", name: "Destination branch" }],
            classes: [{ _id: "class", name: "Year 6", level: "Y6" }],
            sessions: [{ _id: "session", name: "2026/27" }],
            canOverrideNumber: mocks.override,
          }
        : { allowed: false };
    if (name.endsWith("listTransferCandidates"))
      return [
        {
          _id: "student",
          name: "Synthetic Learner",
          admissionNumber: "SRC-001",
        },
      ];
    if (name.endsWith("listTransfersBySchool")) return [record()];
    if (name.endsWith("getTransfer")) return record();
    if (name.endsWith("previewTransferNumber"))
      return { available: true, allocatedNumber: "DST-002", policyVersion: 3 };
    if (name.endsWith("getStudentTransferHistory")) return [record()];
    return undefined;
  },
}));
afterEach(() => {
  cleanup();
  mocks.allowed = true;
  mocks.school = "source";
  mocks.status = "initiated";
  mocks.override = false;
  mocks.initiate.mockReset();
  mocks.release.mockReset();
  mocks.accept.mockReset();
  mocks.abort.mockReset();
  mocks.departure.mockClear();
});
it("denies without selectors; error route offers retry", () => {
  mocks.allowed = false;
  render(<TransfersPage />);
  expect(screen.getByRole("alert").textContent).toContain("denied");
  expect(screen.queryByLabelText("Source student")).toBeNull();
  cleanup();
  const reset = vi.fn();
  render(<TransferError reset={reset} />);
  fireEvent.click(screen.getByText("Retry"));
  expect(reset).toHaveBeenCalledOnce();
});
it("confirms a minimal source proposal and retries an uncertain response using the same operation key", async () => {
  mocks.initiate
    .mockRejectedValueOnce(new Error("Lost response"))
    .mockResolvedValueOnce({ transferId: "transfer" });
  render(<TransfersPage />);
  for (const [label, value] of [
    ["Source class", "class"],
    ["Source student", "student"],
    ["Destination branch", "destination"],
    ["Proposed destination class", "Year 6"],
    ["Proposed destination session", "2026/27"],
    ["Guardian consent method / evidence reference", "Signed guardian form"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByLabelText(/I verified guardian consent/));
  fireEvent.click(screen.getByLabelText(/I confirm this source student/));
  fireEvent.click(screen.getByText("Initiate transfer"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("not acknowledged"),
  );
  fireEvent.click(screen.getByText("Retry same proposal"));
  await waitFor(() => expect(mocks.initiate).toHaveBeenCalledTimes(2));
  expect(mocks.initiate.mock.calls[0][0]).toEqual(
    mocks.initiate.mock.calls[1][0],
  );
  expect(mocks.initiate.mock.calls[0][0]).not.toHaveProperty("medicalNotes");
  expect(mocks.initiate.mock.calls[0][0]).toMatchObject({
    proposalClassName: "Year 6",
    proposalSessionName: "2026/27",
    guardianConsentRecorded: true,
  });
});
it("shows source release and cancel, not acceptance, with guarded review navigation", async () => {
  mocks.release.mockResolvedValue({ status: "source_released" });
  render(<TransfersPage />);
  fireEvent.click(screen.getByText("Review Synthetic Learner"));
  await screen.findByText("Authorize source release");
  expect(mocks.departure).toHaveBeenCalled();
  expect(
    screen.queryByText("Accept and create destination enrollment"),
  ).toBeNull();
  expect(screen.getByText("Cancel transfer")).toBeTruthy();
  fireEvent.click(screen.getByLabelText(/I confirm the source/));
  fireEvent.click(screen.getByText("Authorize source release"));
  await waitFor(() =>
    expect(mocks.release).toHaveBeenCalledWith({
      transferId: "transfer",
      sourceReleaseNote: undefined,
    }),
  );
  fireEvent.click(screen.getByText("View scoped continuous history"));
  expect(
    await screen.findByRole("region", {
      name: "Scoped continuous student history",
    }),
  ).toBeTruthy();
});
it("destination requires actual class/session and confirmation, hides override without capability, retries exact acceptance", async () => {
  mocks.school = "destination";
  mocks.status = "source_released";
  mocks.accept
    .mockRejectedValueOnce(new Error("Lost response"))
    .mockResolvedValueOnce({ status: "completed" });
  render(<TransfersPage />);
  fireEvent.click(screen.getByText("Review Synthetic Learner"));
  const accept = await screen.findByText(
    "Accept and create destination enrollment",
  );
  expect((accept as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByText("Authorize source release")).toBeNull();
  expect(
    screen.queryByLabelText("Manual number (blank uses automatic)"),
  ).toBeNull();
  fireEvent.change(screen.getByLabelText("Actual destination class"), {
    target: { value: "class" },
  });
  fireEvent.change(screen.getByLabelText("Active destination session"), {
    target: { value: "session" },
  });
  fireEvent.click(screen.getByLabelText(/I confirm the destination/));
  fireEvent.click(accept);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByText("Retry identical action"));
  await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(2));
  expect(mocks.accept.mock.calls[0][0]).toEqual(mocks.accept.mock.calls[1][0]);
  expect(mocks.accept.mock.calls[0][0]).toMatchObject({
    destinationClassId: "class",
    destinationSessionId: "session",
    expectedPolicyVersion: 3,
  });
});
it("destination rejects with an explicit persona and reason; finalized records have no transition controls", async () => {
  mocks.school = "destination";
  mocks.abort.mockResolvedValue({ status: "rejected" });
  render(<TransfersPage />);
  fireEvent.click(screen.getByText("Review Synthetic Learner"));
  await screen.findByText("Reject transfer");
  fireEvent.change(
    screen.getByLabelText("Release note / rejection or cancellation reason"),
    { target: { value: "Class capacity reached" } },
  );
  fireEvent.click(screen.getByLabelText(/I confirm the destination/));
  fireEvent.click(screen.getByText("Reject transfer"));
  await waitFor(() =>
    expect(mocks.abort).toHaveBeenCalledWith({
      transferId: "transfer",
      action: "rejected",
      reason: "Class capacity reached",
    }),
  );
  cleanup();
  mocks.status = "completed";
  render(<TransfersPage />);
  fireEvent.click(screen.getByText("Review Synthetic Learner"));
  await screen.findByText("Review Synthetic Learner", { selector: "h2" });
  expect(screen.queryByText("Reject transfer")).toBeNull();
  expect(
    screen.queryByText("Accept and create destination enrollment"),
  ).toBeNull();
});

it("governed manual acceptance requires reason/confirmation and sends only explicit advancement", async () => {
  mocks.school = "destination";
  mocks.status = "source_released";
  mocks.override = true;
  mocks.accept.mockResolvedValue({ status: "completed" });
  render(<TransfersPage />);
  fireEvent.click(screen.getByText("Review Synthetic Learner"));
  const button = await screen.findByText(
    "Accept and create destination enrollment",
  );
  fireEvent.change(screen.getByLabelText("Actual destination class"), {
    target: { value: "class" },
  });
  fireEvent.change(screen.getByLabelText("Active destination session"), {
    target: { value: "session" },
  });
  fireEvent.click(screen.getByLabelText(/I confirm the destination/));
  fireEvent.change(
    screen.getByLabelText("Manual number (blank uses automatic)"),
    { target: { value: "PRESERVED-77" } },
  );
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Override reason"), {
    target: { value: "Reviewed registrar exception" },
  });
  fireEvent.change(
    screen.getByLabelText("Explicit next counter (blank leaves unchanged)"),
    { target: { value: "78" } },
  );
  fireEvent.click(screen.getByLabelText(/Confirm manual identifier/));
  fireEvent.click(button);
  await waitFor(() =>
    expect(mocks.accept).toHaveBeenCalledWith(
      expect.objectContaining({
        admissionNumberOverride: "PRESERVED-77",
        admissionNumberOverrideReason: "Reviewed registrar exception",
        admissionNumberOverrideConfirmed: true,
        advanceCounterTo: 78,
      }),
    ),
  );
});
