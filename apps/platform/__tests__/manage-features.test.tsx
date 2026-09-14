import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManageFeaturesModal, type SchoolFeatureSet } from "../app/schools/ManageFeaturesModal";

const mocks = vi.hoisted(() => ({
  updateFeatures: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.updateFeatures,
}));

vi.mock("@school/shared/toast", () => ({
  appToast: { success: mocks.success, error: mocks.error },
  getErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

const disabledModules: SchoolFeatureSet = {
  familyPortal: false,
  billing: false,
  curriculum: false,
  knowledgeLibrary: false,
  admissions: false,
};

beforeEach(() => {
  mocks.updateFeatures.mockReset().mockResolvedValue({ success: true });
  mocks.success.mockReset();
  mocks.error.mockReset();
});

afterEach(cleanup);

describe("school module access", () => {
  it("separates always-on areas from optional modules and describes real admissions routes", () => {
    render(
      <ManageFeaturesModal
        isOpen
        onClose={vi.fn()}
        school={{ _id: "school-1", name: "Meridian Crest Academy", features: disabledModules }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Included with every school" })).toBeInTheDocument();
    expect(screen.getByText("School operations")).toBeInTheDocument();
    expect(screen.getByText("Administration and groups")).toBeInTheDocument();
    expect(screen.getByText("Student Onboarding")).toBeInTheDocument();
    expect(screen.getByText("School Group")).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /school group/i })).not.toBeInTheDocument();

    expect(screen.getByRole("switch", { name: "Online admissions: disabled" })).toBeInTheDocument();
    expect(screen.getByText("Campaigns & Applications")).toBeInTheDocument();
    expect(screen.getByText("Applicant Account")).toBeInTheDocument();
    expect(screen.queryByText("New-student onboarding and reviewed student imports.")).not.toBeInTheDocument();
  });

  it("saves explicit manual module selections", async () => {
    const onClose = vi.fn();
    render(
      <ManageFeaturesModal
        isOpen
        onClose={onClose}
        school={{ _id: "school-1", name: "Meridian Crest Academy", features: disabledModules }}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Family portal: disabled" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 module change ready to save");
    fireEvent.click(screen.getByRole("button", { name: "Save access" }));

    await waitFor(() => {
      expect(mocks.updateFeatures).toHaveBeenCalledWith({
        schoolId: "school-1",
        features: { ...disabledModules, familyPortal: true },
      });
    });
    expect(mocks.success).toHaveBeenCalledWith("Module access updated", expect.any(Object));
    expect(onClose).toHaveBeenCalled();
  });
});
