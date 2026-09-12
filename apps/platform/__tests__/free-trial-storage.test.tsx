import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FreeTrialStorageModal } from "../app/schools/FreeTrialStorageModal";

type StorageFixture = {
  school: { _id: string; name: string; status: "active" | "pending" | "suspended" };
  recordState: "not_configured" | "configured" | "requires_review";
  proposal: { allocatedUnits: number; durationDays: number };
  contract: null | {
    _id: string;
    code: string;
    version: number;
    effectiveFrom: number;
    effectiveTo: number;
  };
  cycle: null | {
    _id: string;
    code: string;
    version: number;
    startAt: number;
    endAt: number;
    status: "active" | "closed";
  };
  meter: null | {
    _id: string;
    allocatedUnits: number;
    consumedUnits: number;
    reservedUnits: number;
    availableUnits: number;
  };
};

const mocks = vi.hoisted(() => ({
  storage: null as StorageFixture | null,
  provision: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: () => mocks.storage,
  useMutation: () => mocks.provision,
}));

const emptyStorage: StorageFixture = {
  school: { _id: "school-1", name: "Reviewed School", status: "active" },
  recordState: "not_configured",
  proposal: { allocatedUnits: 100 * 1024 * 1024, durationDays: 365 },
  contract: null,
  cycle: null,
  meter: null,
};

const configuredStorage: StorageFixture = {
  ...emptyStorage,
  recordState: "configured",
  contract: {
    _id: "contract-1",
    code: "free_trial",
    version: 2,
    effectiveFrom: 1_800_057_600_000,
    effectiveTo: 1_831_593_600_000,
  },
  cycle: {
    _id: "cycle-1",
    code: "free_trial_storage",
    version: 2,
    startAt: 1_800_057_600_000,
    endAt: 1_831_593_600_000,
    status: "active",
  },
  meter: {
    _id: "meter-1",
    allocatedUnits: 100 * 1024 * 1024,
    consumedUnits: 0,
    reservedUnits: 0,
    availableUnits: 100 * 1024 * 1024,
  },
};

afterEach(() => {
  cleanup();
  mocks.storage = null;
  mocks.provision.mockReset();
});

it("requires the exact confirmation and shows refreshed contract, cycle, and meter state", async () => {
  mocks.storage = emptyStorage;
  mocks.provision.mockResolvedValue({ status: "created" });
  const { rerender } = render(
    <FreeTrialStorageModal
      school={{ _id: "school-1", name: "Reviewed School" }}
      onClose={vi.fn()}
    />,
  );

  expect(screen.getByRole("dialog")).toHaveTextContent("Not configured");
  expect(screen.getByRole("dialog")).toHaveTextContent("100.0 MiB for 365 days");
  const submit = screen.getByRole("button", { name: "Provision storage" });
  expect(submit).toBeDisabled();

  fireEvent.change(
    screen.getByLabelText("Type PROVISION FREE TRIAL STORAGE to confirm"),
    { target: { value: "PROVISION FREE TRIAL STORAGE" } },
  );
  fireEvent.click(submit);

  await waitFor(() =>
    expect(mocks.provision).toHaveBeenCalledWith({
      schoolId: "school-1",
      confirmation: "PROVISION FREE TRIAL STORAGE",
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "The 100 MiB free-trial storage entitlement was created.",
  );

  mocks.storage = configuredStorage;
  rerender(
    <FreeTrialStorageModal
      school={{ _id: "school-1", name: "Reviewed School" }}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("free_trial v2");
  expect(screen.getByRole("dialog")).toHaveTextContent("free_trial_storage (active)");
  expect(screen.getByRole("dialog")).toHaveTextContent("100.0 MiB available of 100.0 MiB");
});

it("displays an exhausted-pool result without claiming success", async () => {
  mocks.storage = emptyStorage;
  mocks.provision.mockResolvedValue({ status: "pool_exhausted" });
  render(
    <FreeTrialStorageModal
      school={{ _id: "school-1", name: "Reviewed School" }}
      onClose={vi.fn()}
    />,
  );

  fireEvent.change(
    screen.getByLabelText("Type PROVISION FREE TRIAL STORAGE to confirm"),
    { target: { value: "PROVISION FREE TRIAL STORAGE" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Provision storage" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "The reviewed free-trial storage pool has no capacity left.",
  );
});
