import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReportScoringPrintWarning } from "@school/shared";

it("shows the issued-copy warning and waits for an explicit print choice", () => {
  const onContinue = vi.fn();
  const onCancel = vi.fn();
  render(<ReportScoringPrintWarning message="This issued copy predates the completed regrade." onContinue={onContinue} onCancel={onCancel} />);
  expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  expect(screen.getByText(/predates the completed regrade/)).toBeTruthy();
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
  expect(onContinue).toHaveBeenCalledOnce();
  expect(onCancel).not.toHaveBeenCalled();
});
