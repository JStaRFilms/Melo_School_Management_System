import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import PermissionsPage from "../app/admin/permissions/page";
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  save: vi.fn(),
  capabilities: ["staff.permissions.manage"] as string[],
}));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: () => mocks.save,
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      branch: { schoolId: "school" },
      effectiveCapabilities: mocks.capabilities,
    },
  }),
}));
let allowed: boolean | undefined;
let legacyBaseline: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  allowed = true;
  legacyBaseline = false;
  mocks.capabilities = ["staff.permissions.manage"];
  mocks.query.mockImplementation((ref: FunctionReference<"query">) => {
    const name = getFunctionName(ref).split(":")[1];
    if (name === "hasViewerCapability") return allowed;
    if (name === "getPermissionWorkspace")
      return {
        catalog: ["academic.classes.manage"],
        members: [{ membershipId: "member", name: "Test member" }],
        templates: [],
        factoryTemplates: [],
        canConfigureTemplates: false,
      };
    if (name === "getMemberPermissionConfiguration")
      return {
        revision: 1,
        displayTitle: "",
        roleTemplateIds: [],
        grants: [],
        restrictions: [],
        ceiling: [],
        effective: [],
        editable: true,
        legacyBaseline,
      };
    if (name === "previewEffectiveCapabilities") return [];
  });
});
it("hides governance links without their destination capabilities", () => {
  const view = render(<PermissionsPage />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();

  mocks.capabilities = [
    "staff.permissions.manage",
    "staff.list.view",
    "audit.group.view",
    "audit.branch.view",
  ];
  view.rerender(<PermissionsPage />);
  expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "School group" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Audit" })).toBeInTheDocument();
});

it("distinguishes checking from denied and does not mount the editor", () => {
  allowed = undefined;
  const view = render(<PermissionsPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Checking");
  allowed = false;
  view.rerender(<PermissionsPage />);
  expect(screen.getByRole("alert")).toHaveTextContent("Permission denied");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
});
it("requires review and reason; native checklist updates the candidate preview without writing", () => {
  render(<PermissionsPage />);
  fireEvent.change(screen.getByRole("combobox", { name: "Staff member" }), {
    target: { value: "member" },
  });
  expect(
    screen.getByRole("button", { name: "Confirm access changes" }),
  ).toBeDisabled();
  const domain = screen.getAllByText("academic", {
    exact: false,
    selector: "summary",
  })[0];
  fireEvent.click(domain);
  const checkboxes = screen.getAllByLabelText("academic.classes.manage");
  checkboxes[0].focus();
  expect(checkboxes[0]).toHaveFocus();
  fireEvent.click(checkboxes[0]);
  const previewCall = mocks.query.mock.calls
    .filter(([ref]) =>
      getFunctionName(ref).endsWith(":previewEffectiveCapabilities"),
    )
    .at(-1);
  expect(previewCall?.[1].candidateDirectGrants).toEqual([
    "academic.classes.manage",
  ]);
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Review reason"), {
    target: { value: "Reviewed temporary teaching assignment" },
  });
  fireEvent.click(
    screen.getByRole("checkbox", { name: /I reviewed the target/ }),
  );
  expect(
    screen.getByRole("button", { name: "Confirm access changes" }),
  ).toBeEnabled();
});
it("warns and requires acknowledgement before retiring legacy access", () => {
  legacyBaseline = true;
  render(<PermissionsPage />);
  fireEvent.change(screen.getByRole("combobox", { name: "Staff member" }), {
    target: { value: "member" },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "retires that baseline permanently",
  );
  expect(
    screen.getByRole("checkbox", {
      name: /I understand this save permanently retires legacy access/,
    }),
  ).toBeInTheDocument();
});
