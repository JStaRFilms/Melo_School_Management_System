import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GradeColorControl } from "../app/assessments/setup/grading-bands/components/GradeColorControl";
import {
  STANDARD_DEFAULT_GRADING_BANDS,
  validateBandsClient,
} from "../lib/exam-helpers";
it("restores the existing six-band scale and validates custom hex", () => {
  expect(STANDARD_DEFAULT_GRADING_BANDS).toHaveLength(6);
  expect(validateBandsClient(STANDARD_DEFAULT_GRADING_BANDS)).toEqual([]);
  expect(
    validateBandsClient(
      STANDARD_DEFAULT_GRADING_BANDS.map((b, i) =>
        i ? b : { ...b, colorHex: "blue" },
      ),
    ),
  ).not.toEqual([]);
});
it("labels picker, presets and hex and previews a light hue with readable ink", () => {
  const change = vi.fn();
  const { rerender } = render(
    <GradeColorControl grade="OUT" value="#ffffaa" onChange={change} />,
  );
  fireEvent.change(screen.getByLabelText("Hex color for OUT"), {
    target: { value: "#aabbcc" },
  });
  expect(change).toHaveBeenCalledWith("#aabbcc");
  fireEvent.click(screen.getByLabelText("Use #065f46"));
  expect(change).toHaveBeenCalledWith("#065f46");
  expect(screen.getByLabelText("Safe preview: OUT").style.color).not.toBe(
    "rgb(255, 255, 170)",
  );
  rerender(
    <GradeColorControl grade="OUT" value="#invalid" onChange={change} />,
  );
  expect(screen.getByRole("alert").textContent).toContain("six hex digits");
});
