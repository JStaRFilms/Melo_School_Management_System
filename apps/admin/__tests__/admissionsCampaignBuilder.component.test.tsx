import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const createCampaignConfiguration = vi.fn();
const replaceCampaignConfiguration = vi.fn();
const query = vi.fn();

vi.mock("convex/react", () => ({
  useConvex: () => ({ query }),
  useMutation: (name: string) => name.includes("createCampaignConfiguration") ? createCampaignConfiguration : replaceCampaignConfiguration,
  useQuery: () => undefined,
}));
vi.mock("@school/shared", () => ({ getUserFacingErrorMessage: () => "save failed" }));
vi.mock("@school/shared/toast", () => ({ appToast: { error: vi.fn(), success: vi.fn() } }));

import { AdmissionsFormBuilder } from "../app/admissions/AdmissionsFormBuilder";

function fillRequiredCreateFields() {
  fireEvent.change(screen.getByPlaceholderText(/Admission Form Name/), { target: { value: "Primary Intake" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. Declaration of Guardians"), { target: { value: "Guardian declaration" } });
  fireEvent.change(screen.getByPlaceholderText(/Provide legal terms/), { target: { value: "I confirm this application is accurate." } });
}

function builder() {
  return <AdmissionsFormBuilder schoolId="school" onCancel={() => undefined} onSuccess={() => undefined} publishAllowed={false} />;
}

describe("AdmissionsFormBuilder atomic command mapping", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    createCampaignConfiguration.mockReset().mockResolvedValue({});
    replaceCampaignConfiguration.mockReset().mockResolvedValue({});
    query.mockReset().mockResolvedValue({});
  });

  test("maps a draft save to one complete create command without default cards", async () => {
    render(builder());
    fillRequiredCreateFields();
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

  test("keeps a reuse error blocked across remount, then reconciles and discards it before a fresh command", async () => {
    createCampaignConfiguration.mockRejectedValueOnce(new Error("OPERATION_KEY_REUSED"));
    const first = render(builder());
    fillRequiredCreateFields();
    fireEvent.click(screen.getByRole("button", { name: "Save Campaign Draft" }));
    await screen.findByText(/blocked for reconciliation/i);
    const stalePayload = createCampaignConfiguration.mock.calls[0][0];

    first.unmount();
    render(builder());
    await screen.findByText(/blocked for reconciliation/i);
    expect(screen.getByRole("button", { name: "Save Campaign Draft" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Reconcile and discard stale command/i }));
    await waitFor(() => expect(query).toHaveBeenCalledWith("functions/admissions/settings:getCatalogue", { schoolId: "school" }));
    await waitFor(() => expect(screen.queryByText(/blocked for reconciliation/i)).not.toBeInTheDocument());

    fillRequiredCreateFields();
    fireEvent.click(screen.getByRole("button", { name: "Save Campaign Draft" }));
    await waitFor(() => expect(createCampaignConfiguration).toHaveBeenCalledTimes(2));
    expect(createCampaignConfiguration.mock.calls[1][0]).toEqual(expect.objectContaining({ operationKey: expect.any(String) }));
    expect(createCampaignConfiguration.mock.calls[1][0].operationKey).not.toBe(stalePayload.operationKey);
  });
});
