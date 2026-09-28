import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExamEntryWorkspace } from "../components/ExamEntryWorkspace";

vi.mock("../components/SelectionBar", () => ({ SelectionBar: () => null }));
vi.mock("../components/RosterGrid", () => ({ RosterGrid: ({ draftScores, onScoreChange }: { draftScores: Map<string, { examRawScore?: number }>; onScoreChange: (id: string, field: "examRawScore", value: number) => void }) => <><button onClick={() => onScoreChange("student1", "examRawScore", 50)}>Enter 50</button><span>Draft: {draftScores.get("student1")?.examRawScore ?? "empty"}</span></> }));
vi.mock("../components/SaveActionBar", () => ({ SaveActionBar: ({ onSave, isEditingLocked }: { onSave: () => Promise<unknown>; isEditingLocked: boolean }) => <button disabled={isEditingLocked} onClick={() => void Promise.resolve(onSave()).catch(() => {})}>Save scores</button> }));
vi.mock("@school/shared/toast", () => ({ appToast: { info: vi.fn(), warning: vi.fn() } }));

const selection = { sessionId: "session1", termId: "term1", classId: "class1", subjectId: "subject1" } as never;
const sheet = (version: number, canEdit = true) => ({ roster: [{ studentId: "student1", studentName: "Ada", assessmentRecord: null }], gradingBands: [],
  settings: { examInputMode: "raw40", ca1Max: 20, ca2Max: 20, ca3Max: version ? 10 : 20, examRawMax: version ? 80 : 40, examContributionMax: version ? 50 : 40, sessionPolicyVersion: version },
  editingState: { canEdit, hasPolicy: true, message: canEdit ? "Open" : "Locked for regrade" } }) as never;
const props = { selection, schoolId: "school1:teacher1", sessions: [], terms: [], classes: [], subjects: [], onSaveRecords: vi.fn() };
beforeEach(() => { window.sessionStorage.clear(); props.onSaveRecords.mockClear(); });
afterEach(cleanup);

describe("teacher score draft during session lock", () => {
  it("restores unsaved scores after a guarded query unmount and requires review under a new policy", async () => {
    const view = render(<ExamEntryWorkspace {...props} sheetData={sheet(0)} isLoadingSheet={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter 50" }));
    expect(screen.getByText("Draft: 50")).toBeTruthy();
    view.unmount(); // guarded reactive read throws; Next error boundary replaces the sheet
    const recovered = render(<ExamEntryWorkspace {...props} sheetData={sheet(1, false)} isLoadingSheet={false} />);
    expect(screen.getByText("Draft: 50")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save scores" }).hasAttribute("disabled")).toBe(true);
    recovered.rerender(<ExamEntryWorkspace {...props} sheetData={sheet(1)} isLoadingSheet={false} />);
    expect(screen.getByText(/scoring policy changed while this draft was unsaved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save scores" }));
    expect(props.onSaveRecords).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I reviewed this draft" }));
    await waitFor(() => expect(screen.queryByText(/scoring policy changed while this draft was unsaved/)).toBeNull());
  });
});
