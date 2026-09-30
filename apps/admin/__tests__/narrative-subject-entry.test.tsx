import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NarrativeSubjectEntry } from "@school/shared";

const selection = { sessionId: "session", termId: "term", classId: "class", subjectId: "art" };
const options = [{ id: "art", name: "Art" }];
const rows = [{ studentId: "one", studentName: "One", comment: "", issued: false }, { studentId: "two", studentName: "Two", comment: "", issued: false }];
describe("subject comments entry", () => {
  it("saves separate students in one subject without score cells", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<NarrativeSubjectEntry selection={selection} sessions={options} terms={options} classes={options} subjects={options} rows={rows} onSelect={vi.fn()} onSave={save} />);
    fireEvent.change(screen.getByLabelText("One - subject comment"), { target: { value: "Paints carefully" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save draft" })[0]);
    await waitFor(() => expect(save).toHaveBeenCalledWith("one", "Paints carefully"));
    expect((screen.getByLabelText("Two - subject comment") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText("Exam score")).toBeNull();
  });
  it("shows empty roster and issued copy is read-only", () => {
    const view = render(<NarrativeSubjectEntry selection={selection} sessions={[]} terms={[]} classes={[]} subjects={options} rows={[]} onSelect={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText(/No enrolled students/)).toBeTruthy();
    view.rerender(<NarrativeSubjectEntry selection={selection} sessions={[]} terms={[]} classes={[]} subjects={options} rows={[{ ...rows[0], comment: "Fixed", issued: true }]} onSelect={vi.fn()} onSave={vi.fn()} />);
    expect((screen.getByLabelText("One - subject comment") as HTMLTextAreaElement).disabled).toBe(true);
  });
});
