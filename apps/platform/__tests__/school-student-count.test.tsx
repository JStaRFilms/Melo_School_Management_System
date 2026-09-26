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
