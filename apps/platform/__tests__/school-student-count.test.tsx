import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StudentCountValue } from "../app/schools/StudentCountValue";

const mocks = vi.hoisted(() => ({
  recalculate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.recalculate,
}));

vi.mock("@school/shared/toast", () => ({
  appToast: {
    success: mocks.success,
    error: mocks.error,
  },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

afterEach(() => {
  cleanup();
  mocks.recalculate.mockReset();
  mocks.success.mockReset();
  mocks.error.mockReset();
});

it("renders a calculated current enrollment", () => {
  render(
    <StudentCountValue
      school={{
        _id: "school-1",
        name: "Visible School",
        currentStudentCount: 1234,
      }}
    />,
  );

  expect(screen.getByText("1,234")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("renders zero as a known aggregate instead of offering calculation", () => {
  render(<StudentCountValue school={{ _id: "school-1", name: "Empty school", currentStudentCount: 0 }} />);
  expect(screen.getByText("0")).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("keeps null during a busy calculation and reports failure without fabricating a zero", async () => {
  let reject: (error: Error) => void = () => undefined;
  mocks.recalculate.mockReturnValue(new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
  render(<StudentCountValue school={{ _id: "school-1", name: "Unknown school", currentStudentCount: null }} />);
  expect(screen.getByText("Not calculated")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));
  expect(screen.getByRole("button", { name: "Calculating..." })).toBeDisabled();
  reject(new Error("Not authorized"));
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Could not calculate student count", expect.any(Object)));
  expect(screen.queryByText("0")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Calculate" })).toBeEnabled();
});

it("lets a platform admin calculate a missing count", async () => {
  mocks.recalculate.mockResolvedValue({ currentStudentCount: 42 });
  render(
    <StudentCountValue
      school={{
        _id: "school-1",
        name: "Visible School",
        currentStudentCount: null,
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Calculate" }));

  await waitFor(() => {
    expect(mocks.recalculate).toHaveBeenCalledWith({ schoolId: "school-1" });
  });
  expect(mocks.success).toHaveBeenCalledWith("Student count calculated", {
    description: "Visible School now has a current enrollment count.",
  });
});
