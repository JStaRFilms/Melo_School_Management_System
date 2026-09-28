import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("keeps the scroll lock while another sheet is open and restores prior overflow", () => {
    vi.useFakeTimers();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "scroll";
    const onClose = vi.fn();
    const sheets = (firstOpen: boolean, secondOpen: boolean) => (
      <>
        <SheetBase open={firstOpen} onClose={onClose} title="First" exitMs={100}>First body</SheetBase>
        <SheetBase open={secondOpen} onClose={onClose} title="Second" exitMs={100}>Second body</SheetBase>
        <SheetBase open={false} onClose={onClose} title="Never opened" exitMs={100}>Unused</SheetBase>
      </>
    );
    try {
      const { rerender, unmount } = render(sheets(true, true));
      expect(document.body.style.overflow).toBe("hidden");
      act(() => vi.advanceTimersByTime(100)); // The never-opened sheet's exit timer fires.
      expect(document.body.style.overflow).toBe("hidden");
      rerender(sheets(false, true));
      act(() => vi.advanceTimersByTime(100));
      expect(screen.queryByText("First body")).toBeNull();
      expect(document.body.style.overflow).toBe("hidden");
      rerender(sheets(false, false));
      act(() => vi.advanceTimersByTime(100));
      expect(document.body.style.overflow).toBe("scroll");
      unmount();
      expect(document.body.style.overflow).toBe("scroll");
    } finally {
      document.body.style.overflow = priorOverflow;
      vi.useRealTimers();
    }
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

  it("positions a custom panel above the absolute overlay", () => {
    render(
      <SheetBase open onClose={vi.fn()} title="T" panelClass="w-full bg-white">
        x
      </SheetBase>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.previousElementSibling?.classList.contains("absolute")).toBe(true);
    expect(dialog.classList.contains("relative")).toBe(true);
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
