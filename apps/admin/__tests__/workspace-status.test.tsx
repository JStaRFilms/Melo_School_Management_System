import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DraftHeaderStatus, WorkspaceConnectionStatus } from "@school/shared/drafts";
import { WorkspaceNavbar } from "../../../packages/shared/src/components/WorkspaceNavbar";
import { MobileProgressIndicator } from "../../../packages/shared/src/components/MobileProgressIndicator";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("reserves fixed mobile/desktop bounds and portals draft actions out of page flow without mobile duplicates", () => {
  const shell = (dirty: boolean) => <WorkspaceNavbar workspace="admin" currentPath="/academic/students" connectionStatus={<WorkspaceConnectionStatus connected authenticated />} renderLink={props => <a href={props.href}>{props.children}</a>}>
    <div data-testid="form-body"><DraftHeaderStatus>{dirty && <button>Preview unsaved draft</button>}</DraftHeaderStatus><MobileProgressIndicator mode="scroll" draftStatus="save_failed" /><p>Form fields</p></div>
  </WorkspaceNavbar>;
  const view = render(shell(false));
  const slot = view.container.querySelector("[data-workspace-status-slot]");
  expect(slot).toHaveClass("h-8", "min-h-8", "max-h-8", "shrink-0");
  const bounds = slot?.className;
  view.rerender(shell(true));
  expect(slot).toContainElement(screen.getByRole("button", { name: "Preview unsaved draft" }));
  expect(screen.getByTestId("form-body")).not.toContainElement(screen.getByRole("button", { name: "Preview unsaved draft" }));
  expect(screen.queryByText("Save failed")).not.toBeInTheDocument();
  expect(slot?.className).toBe(bounds);
  view.rerender(shell(false));
  expect(slot?.className).toBe(bounds);
});

it("distinguishes backend, browser and authentication state", () => {
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const view = render(<WorkspaceConnectionStatus connected={false} authenticated />);
  expect(screen.getByRole("status")).toHaveTextContent("Server reconnecting");
  view.rerender(<WorkspaceConnectionStatus connected authenticated={false} />);
  expect(screen.getByRole("status")).toHaveTextContent("Sign in required");
  online.mockReturnValue(false);
  act(() => { window.dispatchEvent(new Event("offline")); });
  expect(screen.getByRole("status")).toHaveTextContent("Browser offline");
  online.mockReturnValue(true);
  act(() => { window.dispatchEvent(new Event("online")); });
  view.rerender(<WorkspaceConnectionStatus connected authenticated />);
  expect(screen.getByRole("status")).toHaveTextContent("Connected");
});
