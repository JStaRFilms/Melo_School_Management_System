import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScoreInput } from "../components/ScoreInput";

it("does not clear a saved score during decimal typing", () => {
  const onChange = vi.fn();
  render(<ScoreInput field="examRawScore" studentName="Ada" max={80} value={12} onChange={onChange} />);
  const input = screen.getAllByRole("textbox", { name: "Ada exam score out of 80" })[0] as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.change(input, { target: { value: "12." } });
  expect(input.value).toBe("12.");
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "12.25" } });
  expect(onChange).toHaveBeenCalledWith(12.25);
});
