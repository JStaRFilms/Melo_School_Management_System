import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import GroupPage from "../app/admin/group/page";
import GroupError from "../app/admin/group/error";
const mocks = vi.hoisted(() => ({
  directory: vi.fn(),
  query: vi.fn(),
  push: vi.fn(),
  selectSchool: vi.fn(),
}));
vi.mock("convex/react", () => ({
  usePaginatedQuery: mocks.directory,
  useQuery: mocks.query,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/AuthProvider", () => ({
  useAuth: () => ({ selectSchool: mocks.selectSchool }),
}));
vi.mock("@school/shared/drafts", () => ({
  useDepartureGuard: () => ({
    requestDeparture: vi.fn().mockResolvedValue(true),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockReturnValue({ results: [], status: "LoadingFirstPage" });
});
it("distinguishes loading and empty canonical ownership without fake metrics", () => {
  const view = render(<GroupPage />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading owned groups");
  mocks.directory.mockReturnValue({ results: [], status: "Exhausted" });
  view.rerender(<GroupPage />);
  expect(screen.getByText("No owned groups")).toBeInTheDocument();
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
  const selector = screen.getByRole("combobox", { name: "Owned group" });
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
