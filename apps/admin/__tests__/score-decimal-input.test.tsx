import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScoreNumberInput } from "@school/shared/drafts";
import { AdminRosterGrid } from "../app/assessments/results/entry/components/AdminRosterGrid";

it("selects and scrolls a deep-linked roster row only once", () => {
  const scroll = vi.fn();
  const originalScroll = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = scroll;
  const roster = ["student1", "student2"].map(id => ({ studentId: id, studentName: id, assessmentRecord: null })) as never;
  try {
    const props = { roster, examInputMode: "raw40" as const, gradingBands: [], draftScores: new Map(), validationErrors: new Map(), sheetLabel: "Scores", sessionId: "s", termId: "t", classId: "c", onScoreChange: vi.fn(), highlightedStudentId: "student2" };
    const view = render(<AdminRosterGrid {...props} />);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("student2");
    expect(scroll).toHaveBeenCalledTimes(1);
    view.rerender(<AdminRosterGrid {...props} draftScores={new Map()} />);
    expect(scroll).toHaveBeenCalledTimes(1);
  } finally { Element.prototype.scrollIntoView = originalScroll; }
});

it("keeps mobile roster decimals out of the cleared-score draft", () => {
  const onScoreChange = vi.fn();
  const { container } = render(<AdminRosterGrid roster={[{ studentId: "student1", studentName: "Ada Doe", assessmentRecord: { ca1: 12, ca2: 10, ca3: 10, examRawScore: 30 } } as never]} examInputMode="raw40" gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} sheetLabel="Scores" sessionId="s" termId="t" classId="c" onScoreChange={onScoreChange} />);
  const mobile = container.querySelector<HTMLInputElement>('#mobile-student-student1 input[aria-label="Ada Doe CA1 score out of 20"]')!;
  fireEvent.focus(mobile);
  fireEvent.change(mobile, { target: { value: "" } });
  fireEvent.change(mobile, { target: { value: "12." } });
  expect(onScoreChange).not.toHaveBeenCalled();
  fireEvent.change(mobile, { target: { value: "12.5" } });
  expect(onScoreChange).toHaveBeenCalledWith("student1", "ca1", 12.5);
});

it("keeps empty and trailing decimal as text until a score or intentional blur clear", () => {
  const onScoreChange = vi.fn();
  const view = render(<ScoreNumberInput aria-label="Score" value={12} onScoreChange={onScoreChange} />);
  const input = screen.getByRole("textbox", { name: "Score" }) as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "" } });
  expect(onScoreChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "12." } });
  expect(input.value).toBe("12.");
  expect(onScoreChange).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "12.25" } });
  expect(onScoreChange).toHaveBeenCalledWith(12.25);
  view.rerender(<ScoreNumberInput aria-label="Score" value={12.25} onScoreChange={onScoreChange} />);
  fireEvent.change(input, { target: { value: "" } });
  expect(onScoreChange).toHaveBeenCalledTimes(1);
  fireEvent.blur(input);
  expect(onScoreChange).toHaveBeenLastCalledWith(null);
});
