import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const createCampaignConfiguration = vi.fn();
const replaceCampaignConfiguration = vi.fn();
const query = vi.fn();
const useQuery = vi.hoisted(() => vi.fn());

vi.mock("convex/react", () => ({
  useConvex: () => ({ query }),
  useMutation: (name: string) => name.includes("createCampaignConfiguration") ? createCampaignConfiguration : replaceCampaignConfiguration,
  useQuery,
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
    useQuery.mockReset().mockReturnValue(undefined);
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

  test("uses visible schedule and suggested declaration defaults in a new campaign payload and local draft", async () => {
    render(builder());

    expect(screen.getByDisplayValue("Guardian declaration")).toBeInTheDocument();
    expect(screen.getByDisplayValue("I confirm that the information in this application is complete and accurate to the best of my knowledge.")).toBeInTheDocument();
    expect((screen.getByLabelText("Opening date and time") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect((screen.getByLabelText("Closing date and time") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

    fireEvent.change(screen.getByPlaceholderText(/Admission Form Name/), { target: { value: "Primary Intake" } });
    fireEvent.change(screen.getByLabelText("Opening date and time"), { target: { value: "2030-01-01T09:00" } });
    fireEvent.change(screen.getByLabelText("Closing date and time"), { target: { value: "2030-02-01T17:00" } });
    fireEvent.change(screen.getByPlaceholderText(/Provide legal terms/), { target: { value: "Reviewed declaration." } });

    await waitFor(() => expect(JSON.parse(localStorage.getItem("admissions_form_draft_school") ?? "{}")).toMatchObject({
      opensAt: "2030-01-01T09:00",
      closesAt: "2030-02-01T17:00",
      declarationTitle: "Guardian declaration",
      declarationBody: "Reviewed declaration.",
    }));

    fireEvent.click(screen.getByRole("button", { name: "Save Campaign Draft" }));
    await waitFor(() => expect(createCampaignConfiguration).toHaveBeenCalledTimes(1));
    expect(createCampaignConfiguration).toHaveBeenCalledWith(expect.objectContaining({
      configuration: expect.objectContaining({
        intake: expect.objectContaining({
          opensAt: new Date("2030-01-01T09:00").getTime(),
          closesAt: new Date("2030-02-01T17:00").getTime(),
        }),
        declaration: { title: "Guardian declaration", body: "Reviewed declaration.", purpose: "service" },
      }),
    }));
  });

  test("uses an existing campaign declaration instead of the new campaign suggestion", async () => {
    useQuery.mockImplementation((name: string) => {
      if (name.includes("getCatalogue")) {
        return {
          programmes: [{ id: "programme", name: "Primary", description: null }],
          intakes: [{ id: "intake", programmeId: "programme", slug: "2030-entry", name: "2030 Entry", cycleLabel: "Primary School", status: "draft", opensAt: new Date("2030-01-01T09:00").getTime(), closesAt: new Date("2030-02-01T17:00").getTime() }],
          products: [{ id: "product", intakeId: "intake" }],
          forms: [{ id: "form", intakeId: "intake", version: 1, status: "draft" }],
          declarations: [{ id: "declaration", programmeId: "programme", version: 1, title: "Stored declaration", body: "Stored campaign wording.", status: "published" }],
        };
      }
      if (name.includes("getFormConfiguration")) return { fields: [], requirements: [] };
      if (name.includes("listProductPrices")) return [];
      return undefined;
    });

    render(<AdmissionsFormBuilder schoolId="school" intakeId="intake" onCancel={() => undefined} onSuccess={() => undefined} publishAllowed={false} />);

    expect(await screen.findByDisplayValue("Stored declaration")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stored campaign wording.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Guardian declaration")).not.toBeInTheDocument();
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
