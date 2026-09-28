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
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledTimes(1);
});

it("holds a dirty score when another teacher updates it while focused", () => {
  const onChange = vi.fn();
  const props = { field: "examRawScore" as const, studentName: "Ada", max: 80, onChange };
  const { rerender } = render(<ScoreInput {...props} value={12} />);
  const input = screen.getAllByRole("textbox", { name: "Ada exam score out of 80" })[0] as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "12." } });
  expect(onChange).not.toHaveBeenCalled();
  rerender(<ScoreInput {...props} value={15} />);
  expect(input.value).toBe("12.");
  expect(screen.getAllByRole("alert")[0].textContent).toContain("Score changed elsewhere to 15");
  fireEvent.blur(input);
  expect(input.value).toBe("12.");
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "12.25" } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Use my score" })[0]);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(12.25);
});

it("does not clear a newer score when a blank entry loses focus", () => {
  const onChange = vi.fn();
  const props = { field: "examRawScore" as const, studentName: "Ada", max: 80, onChange };
  const { rerender } = render(<ScoreInput {...props} value={12} />);
  const input = screen.getAllByRole("textbox", { name: "Ada exam score out of 80" })[0] as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "" } });
  rerender(<ScoreInput {...props} value={15} />);
  fireEvent.blur(input);
  expect(onChange).not.toHaveBeenCalled();
  expect(input.value).toBe("");
  fireEvent.click(screen.getAllByRole("button", { name: "Use latest score" })[0]);
  expect(input.value).toBe("15");
  expect(onChange).not.toHaveBeenCalled();
});

it("does not resend an acknowledged local score update on blur", () => {
  const onChange = vi.fn();
  const props = { field: "examRawScore" as const, studentName: "Ada", max: 80, onChange };
  const { rerender } = render(<ScoreInput {...props} value={12} />);
  const input = screen.getAllByRole("textbox", { name: "Ada exam score out of 80" })[0] as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "12.25" } });
  rerender(<ScoreInput {...props} value={12.25} />);
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.blur(input);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(12.25);
});
