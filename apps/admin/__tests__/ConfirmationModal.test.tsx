import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ConfirmationModal } from "../lib/components/ui/ConfirmationModal";

function FailingConfirmationHarness() {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 0);
  };

  return (
    <>
      <button type="button">Outside control</button>
      <ConfirmationModal
        isOpen
        onClose={() => undefined}
        onConfirm={handleConfirm}
        title="Remove current logo?"
        description="This action cannot be undone."
        confirmLabel="Remove logo"
        confirmVariant="danger"
        isLoading={isLoading}
      />
    </>
  );
}

describe("ConfirmationModal", () => {
  it("focuses Cancel initially and contains keyboard navigation after a failed submission", async () => {
    render(<FailingConfirmationHarness />);

    const cancelButton = await screen.findByRole("button", { name: "Cancel" });
    const confirmButton = screen.getByRole("button", { name: "Remove logo" });
    const dialog = screen.getByRole("dialog");
    const outsideControl = screen.getByRole("button", { name: "Outside control" });

    await waitFor(() => expect(cancelButton).toHaveFocus());

    fireEvent.click(confirmButton);
    expect(cancelButton).toBeDisabled();
    await waitFor(() => expect(cancelButton).toBeEnabled());

    dialog.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancelButton).toHaveFocus();

    dialog.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(confirmButton).toHaveFocus();

    outsideControl.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancelButton).toHaveFocus();
  });
});
