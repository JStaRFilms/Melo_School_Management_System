import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import GroupPage from "../app/admin/group/page";
import GroupError from "../app/admin/group/error";
const mocks = vi.hoisted(() => ({
  directory: vi.fn(),
  query: vi.fn(),
  capabilities: [
    "staff.list.view",
    "staff.permissions.manage",
    "audit.branch.view",
  ] as string[],
}));
vi.mock("convex/react", () => ({
  usePaginatedQuery: mocks.directory,
  useQuery: mocks.query,
}));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({
    workspaceAccess: {
      state: "ready",
      effectiveCapabilities: mocks.capabilities,
      membership: { isProprietor: false },
    },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockReturnValue({ results: [], status: "LoadingFirstPage" });
  mocks.capabilities = [
    "staff.list.view",
    "staff.permissions.manage",
    "audit.branch.view",
  ];
});
it("distinguishes loading and empty canonical ownership without fake metrics", () => {
  const view = render(<GroupPage />);
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading accessible groups",
  );
  mocks.directory.mockReturnValue({ results: [], status: "Exhausted" });
  view.rerender(<GroupPage />);
  expect(screen.getByText("No accessible groups")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute(
    "href",
    "/admin",
  );
});
it("has a labelled native selector and explicit denied retry", () => {
  mocks.directory.mockReturnValue({
    results: [{ _id: "group", name: "Test group", status: "active" }],
    status: "Exhausted",
  });
  const view = render(<GroupPage />);
  const selector = screen.getByRole("combobox", { name: "Accessible group" });
  selector.focus();
  expect(selector).toHaveFocus();
  fireEvent.change(selector, { target: { value: "group" } });
  expect(mocks.query.mock.calls.at(-1)?.[1]).toEqual({ groupId: "group" });
  view.unmount();
  const retry = vi.fn();
  render(<GroupError reset={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "active canonical ownership",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});

it("hides governance links outside their target capabilities", () => {
  mocks.capabilities = ["audit.group.view"];
  render(<GroupPage />);
  expect(screen.queryByRole("link", { name: "Administration" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Permissions" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Audit" })).toBeNull();
});
