import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SheetBase } from "@school/shared/components/SheetBase";
import { AdminSheet } from "@/components/ui/AdminSheet";

describe("shared SheetBase (consolidation P18)", () => {
  it("renders nothing when closed and portals content when open", () => {
    const { container, rerender } = render(
      <SheetBase open={false} onClose={vi.fn()} title="T">
        <p>Body</p>
      </SheetBase>,
    );
    expect(container.textContent).toBe("");
    rerender(
      <SheetBase open onClose={vi.fn()} title="Sheet title" description="Desc">
        <p>Body</p>
      </SheetBase>,
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Sheet title")).toBeDefined();
    expect(screen.getByText("Desc")).toBeDefined();
    expect(screen.getByText("Body")).toBeDefined();
  });

  it("closes on Escape and overlay click unless dismissal is disabled", () => {
    const onClose = vi.fn();
    const { rerender } = render(<SheetBase open onClose={onClose} title="T">x</SheetBase>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <SheetBase open onClose={onClose} title="T" dismissDisabled>
        x
      </SheetBase>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders footer and labelledBy contract", () => {
    render(
      <SheetBase open onClose={vi.fn()} title="T" labelledBy="sheet-title" describedBy="sheet-desc" footer={<button>Save</button>}>
        x
      </SheetBase>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-labelledby")).toBe("sheet-title");
    expect(dialog.getAttribute("aria-describedby")).toBe("sheet-desc");
    expect(screen.getByText("Save")).toBeDefined();
  });

  it("keeps the admin wrapper on the shared base", () => {
    render(
      <AdminSheet isOpen title="Admin sheet" description="D" onClose={vi.fn()}>
        <p>Admin body</p>
      </AdminSheet>,
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Admin sheet")).toBeDefined();
    expect(screen.getByText("Admin body")).toBeDefined();
  });
});
