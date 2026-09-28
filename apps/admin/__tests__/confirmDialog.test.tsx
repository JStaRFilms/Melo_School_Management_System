import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog, ConfirmModal } from "@school/shared";
import { ConfirmDialog as AdminAlias } from "@/components/ui/ConfirmDialog";

describe("shared ConfirmModal (consolidation P17)", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConfirmModal open={false} title="T" description="D" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container.textContent).toBe("");
  });

  it("shows title, description, and labels when open", () => {
    render(
      <ConfirmModal open title="Delete?" description="Gone forever." confirmLabel="Delete" cancelLabel="Keep" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Delete?")).toBeDefined();
    expect(screen.getByText("Gone forever.")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
    expect(screen.getByText("Keep")).toBeDefined();
  });

  it("confirms and cancels through buttons and Escape", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmModal open title="T" description="D" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("keeps the admin alias identical to the shared modal", () => {
    expect(AdminAlias).toBe(ConfirmModal);
    expect(ConfirmDialog).toBe(ConfirmModal);
  });
});
