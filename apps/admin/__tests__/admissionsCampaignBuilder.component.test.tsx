import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const createCampaignConfiguration = vi.fn();
const replaceCampaignConfiguration = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (name: string) => name.includes("createCampaignConfiguration") ? createCampaignConfiguration : replaceCampaignConfiguration,
  useQuery: () => undefined,
}));
vi.mock("@school/shared", () => ({ getUserFacingErrorMessage: () => "save failed" }));
vi.mock("@school/shared/toast", () => ({ appToast: { error: vi.fn(), success: vi.fn() } }));

import { AdmissionsFormBuilder } from "../app/admissions/AdmissionsFormBuilder";

describe("AdmissionsFormBuilder atomic command mapping", () => {
  beforeEach(() => {
    createCampaignConfiguration.mockReset().mockResolvedValue({});
    replaceCampaignConfiguration.mockReset().mockResolvedValue({});
  });

  test("maps a draft save to one complete create command without default cards", async () => {
    render(<AdmissionsFormBuilder schoolId="school" onCancel={() => undefined} onSuccess={() => undefined} publishAllowed={false} />);
    fireEvent.change(screen.getByPlaceholderText(/Admission Form Name/), { target: { value: "Primary Intake" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Declaration of Guardians"), { target: { value: "Guardian declaration" } });
    fireEvent.change(screen.getByPlaceholderText(/Provide legal terms/), { target: { value: "I confirm this application is accurate." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Campaign Draft" }));

    await waitFor(() => expect(createCampaignConfiguration).toHaveBeenCalledTimes(1));
    expect(replaceCampaignConfiguration).not.toHaveBeenCalled();
    expect(createCampaignConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school",
      targetStatus: "draft",
      configuration: expect.objectContaining({
        programme: expect.objectContaining({ slug: "primary-intake" }),
        fields: [],
        requirements: expect.arrayContaining([expect.objectContaining({ requirementKey: "birth_cert" }), expect.objectContaining({ requirementKey: "passport" }), expect.objectContaining({ requirementKey: "transcripts" })]),
      }),
    }));
  });
});
