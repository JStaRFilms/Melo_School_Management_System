import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../packages/convex/_generated/dataModel";
import GroupBranding from "../app/admin/group/GroupBranding";
import OperationalOverview from "../app/admin/group/OperationalOverview";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  preview: vi.fn(),
  save: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useConvex: () => ({ query: mocks.preview }),
  useMutation: () => mocks.save,
}));
const groupId = "group" as Id<"schoolGroups">;
const schoolId = "school" as Id<"schools">;
const branches = [{ schoolId, name: "Headquarters" }];
const defaults = { groupId, slug: "group", version: 0, defaults: null };

beforeEach(() => {
  vi.clearAllMocks();
});

it("branding distinguishes loading/empty, previews without mutation and confirms exact slug", async () => {
  mocks.query.mockReturnValue(undefined);
  const view = render(<GroupBranding groupId={groupId} branches={branches} />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading group branding",
  );
  mocks.query.mockImplementation((ref) =>
    getFunctionName(ref).endsWith(":getGroupBranding") ? defaults : [],
  );
  view.rerender(<GroupBranding groupId={groupId} branches={branches} />);
  expect(
    screen.getByText(/No explicit active branch memberships/),
  ).toBeInTheDocument();
  const primary = screen.getByLabelText("Primary hex");
  primary.focus();
  expect(primary).toHaveFocus();
  fireEvent.change(primary, { target: { value: "#123456" } });
  mocks.preview.mockResolvedValue({
    ...defaults,
    candidate: {
      version: 1,
      theme: { primaryColor: "#123456", accentColor: "#2563eb" },
      allowBranchOverride: true,
    },
    warning: "Issued documents unchanged",
  });
  fireEvent.click(screen.getByRole("button", { name: "Preview change" }));
  const confirm = await screen.findByRole("button", {
    name: "Confirm default",
  });
  expect(mocks.save).not.toHaveBeenCalled();
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Confirm group slug: group"), {
    target: { value: "group" },
  });
  mocks.save.mockRejectedValue(new Error("Conflict: reload latest"));
  fireEvent.click(confirm);
  await screen.findByText("Conflict: reload latest");
  expect(mocks.save.mock.calls[0][0]).toMatchObject({
    expectedVersion: 0,
    confirmation: "group",
    theme: { primaryColor: "#123456" },
  });
  expect(primary).toHaveValue("#123456");
});

it("retains draft against a remote version and requires explicit discard/reload", async () => {
  mocks.query.mockImplementation((ref) =>
    getFunctionName(ref).endsWith(":getGroupBranding") ? defaults : [],
  );
  const view = render(<GroupBranding groupId={groupId} branches={[]} />);
  fireEvent.change(screen.getByLabelText("Primary hex"), {
    target: { value: "#abcdef" },
  });
  mocks.query.mockImplementation((ref) =>
    getFunctionName(ref).endsWith(":getGroupBranding")
      ? {
          ...defaults,
          version: 1,
          defaults: {
            version: 1,
            theme: { primaryColor: "#000000", accentColor: "#ffffff" },
            allowBranchOverride: false,
          },
        }
      : [],
  );
  view.rerender(<GroupBranding groupId={groupId} branches={[]} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Your edits are retained",
  );
  expect(screen.getByLabelText("Primary hex")).toHaveValue("#abcdef");
  fireEvent.click(
    screen.getByRole("button", { name: "Discard edits and load latest" }),
  );
  expect(screen.getByLabelText("Primary hex")).toHaveValue("#000000");
  expect(mocks.save).not.toHaveBeenCalled();
});

it("reviews a versioned branch reset before saving and does not activate a workspace", async () => {
  mocks.query.mockImplementation((ref) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getGroupBranding")) return defaults;
    if (name.endsWith(":listUserBranches")) return [{ schoolId }];
    return {
      theme: { primaryColor: "#112233", accentColor: "#445566" },
      defaultTheme: { primaryColor: "#abcdef", accentColor: "#123456" },
      source: "branch_legacy",
      mode: "legacy",
      groupVersion: 2,
      revision: 3,
      allowBranchOverride: true,
      slug: "hq",
    };
  });
  mocks.save.mockResolvedValue(4);
  render(<GroupBranding groupId={groupId} branches={branches} />);
  const selector = screen.getByRole("combobox", {
    name: "Branch branding (explicit membership required)",
  });
  selector.focus();
  expect(selector).toHaveFocus();
  fireEvent.change(selector, { target: { value: schoolId } });
  expect(screen.getByText(/Use group version 2: #abcdef/)).toBeInTheDocument();
  const confirm = screen.getByRole("button", { name: "Confirm branch change" });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Confirm branch slug: hq"), {
    target: { value: "hq" },
  });
  fireEvent.click(confirm);
  await screen.findByText("Branch branding saved");
  expect(mocks.save).toHaveBeenCalledWith({
    groupId,
    schoolId,
    expectedVersion: 2,
    expectedRevision: 3,
    confirmation: "hq",
    change: { mode: "inherit" },
  });
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("operations shows denied vs unavailable, validates dates, and never enables a fake drilldown", async () => {
  mocks.query.mockReturnValue(undefined);
  const view = render(
    <OperationalOverview groupId={groupId} branches={branches} />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Checking operational scope",
  );
  mocks.query.mockReturnValue({
    note: "No numeric totals are available.",
    period: { startDate: 0, endDate: 86400000 },
    branches: [
      {
        schoolId,
        name: "Headquarters",
        status: "active",
        access: "denied",
        metrics: [],
        drilldown: null,
      },
    ],
  });
  view.rerender(<OperationalOverview groupId={groupId} branches={branches} />);
  expect(
    screen.getByText(/Operational access denied or revoked/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  const start = screen.getByLabelText("Start (UTC)");
  start.focus();
  expect(start).toHaveFocus();
  fireEvent.change(start, { target: { value: "2026-09-05" } });
  fireEvent.change(screen.getByLabelText("End (UTC, exclusive)"), {
    target: { value: "2026-09-04" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply period" }));
  expect(screen.getByRole("alert")).toHaveTextContent("end after the start");
  fireEvent.change(screen.getByLabelText("End (UTC, exclusive)"), {
    target: { value: "2026-09-06" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Branch" }), {
    target: { value: schoolId },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply period" }));
  await waitFor(() =>
    expect(mocks.query.mock.calls.at(-1)?.[1]).toEqual({
      groupId,
      branchId: schoolId,
      startDate: Date.parse("2026-09-05"),
      endDate: Date.parse("2026-09-06"),
    }),
  );
});
