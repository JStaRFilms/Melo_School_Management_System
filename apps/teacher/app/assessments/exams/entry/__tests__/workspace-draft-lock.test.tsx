import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ExamEntryWorkspace } from "../components/ExamEntryWorkspace";
import { scoreSheetDraftKey } from "@school/shared/drafts";
import { appToast } from "@school/shared/toast";

vi.mock("../components/SelectionBar", () => ({ SelectionBar: () => null }));
vi.mock("../components/RosterGrid", () => ({ RosterGrid: ({ draftScores, onScoreChange, policy }: { draftScores: Map<string, { examRawScore?: number }>; onScoreChange: (id: string, field: "examRawScore", value: number) => void; policy?: { examRawMax: number } }) => <><button onClick={() => onScoreChange("student1", "examRawScore", 50)}>Enter 50</button><button onClick={() => onScoreChange("student1", "examRawScore", 35)}>Enter 35</button><span>Draft: {draftScores.get("student1")?.examRawScore ?? "empty"}</span><span>Exam max: {policy?.examRawMax ?? "missing"}</span></> }));
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
  it("passes legacy /80 policy to the roster before any explicit session version", () => {
    render(<ExamEntryWorkspace {...props} sheetData={{ roster: [{ studentId: "student1", studentName: "Ada", assessmentRecord: null }], gradingBands: [], editingState: { canEdit: true, hasPolicy: true, message: "Open" }, settings: { examInputMode: "raw40", ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50, sessionPolicyVersion: 0 } } as never} isLoadingSheet={false} />);
    expect(screen.getByText("Exam max: 80")).toBeTruthy();
  });
  it("sends the captured row baseline after a recovered draft is saved", async () => {
    const record = { _id: "record1", updatedAt: 1, ca1: 10, ca2: 10, ca3: 10, examRawScore: 30 };
    const withRecord = { ...(sheet(1) as object), roster: [{ studentId: "student1", studentName: "Ada", assessmentRecord: record }] } as never;
    props.onSaveRecords.mockResolvedValue({ updated: 1, created: 0, errors: [] });
    const first = render(<ExamEntryWorkspace {...props} sheetData={withRecord} isLoadingSheet={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter 35" }));
    first.unmount();
    render(<ExamEntryWorkspace {...props} sheetData={withRecord} isLoadingSheet={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Save scores" }));
    await waitFor(() => expect(props.onSaveRecords).toHaveBeenCalledWith(expect.objectContaining({ records: [
      { studentId: "student1", ca1: 10, ca2: 10, ca3: 10, examRawScore: 35,
        expectedRow: { id: "record1", updatedAt: 1, ca1: 10, ca2: 10, ca3: 10, examRawScore: 30 } },
    ] })));
  });
  it("blocks an old-format recovered draft even when the sheet is editable", async () => {
    const key = scoreSheetDraftKey(props.schoolId, "session1", "term1", "class1", "subject1")!;
    window.sessionStorage.setItem(key, JSON.stringify([["student1", { ca1: 10, ca2: 10, ca3: 10, examRawScore: 20 }]]));
    render(<ExamEntryWorkspace {...props} sheetData={sheet(0)} isLoadingSheet={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Save scores" }));
    await waitFor(() => expect(appToast.warning).toHaveBeenCalledWith("Review required before saving", expect.objectContaining({ description: expect.stringContaining("no safe score baseline") })));
    expect(props.onSaveRecords).not.toHaveBeenCalled();
  });
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
