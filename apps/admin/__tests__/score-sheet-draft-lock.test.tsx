import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AdminScoreEntryPage from "../app/assessments/results/entry/page";

const state = vi.hoisted(() => ({ locked: false, version: 0 }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ session: { user: { id: "admin1" } }, workspaceAccess: { state: "ready", branch: { schoolId: "school1" } } }) }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("sessionId=s1&termId=t1&classId=c1&subjectId=sub1&studentId=student1") }));
vi.mock("convex/react", () => ({ useQuery: (name: string) => {
  if (name.endsWith(":getExamEntrySheet")) return { roster: [{ studentId: "student1", studentName: "Ada", assessmentRecord: null }], gradingBands: [],
    settings: { examInputMode: "raw40", ca1Max: 20, ca2Max: 20, ca3Max: state.version ? 10 : 20, examRawMax: state.version ? 80 : 40, examContributionMax: state.version ? 50 : 40, sessionPolicyVersion: state.version },
    editingState: { canEdit: !state.locked, hasPolicy: true, message: state.locked ? "Locked" : "Open" } };
  if (name.endsWith(":getSubjectsByClass")) return [{ id: "sub1", name: "Math" }];
  return [];
}, useMutation: () => vi.fn() }));
vi.mock("../app/assessments/results/entry/components/AdminSelectionBar", () => ({ AdminSelectionBar: () => null }));
vi.mock("../app/assessments/results/entry/components/AdminRosterGrid", () => ({ AdminRosterGrid: ({ draftScores, onScoreChange }: { draftScores: Map<string, { examRawScore?: number }>; onScoreChange: (id: string, field: "examRawScore", value: number) => void }) => <><button onClick={() => onScoreChange("student1", "examRawScore", 35)}>Enter 35</button><span>Draft: {draftScores.get("student1")?.examRawScore ?? "empty"}</span></> }));
vi.mock("../app/assessments/results/entry/components/AdminSaveActionBar", () => ({ AdminSaveActionBar: ({ isEditingLocked, onSave }: { isEditingLocked: boolean; onSave: () => Promise<unknown> }) => <button disabled={isEditingLocked} onClick={() => void onSave().catch(() => {})}>Save scores</button> }));
vi.mock("@/components/ui/AdminHeader", () => ({ AdminHeader: () => null }));
vi.mock("@school/shared/toast", () => ({ appToast: { info: vi.fn(), warning: vi.fn() } }));

beforeEach(() => { state.locked = false; state.version = 0; window.sessionStorage.clear(); });
afterEach(cleanup);
describe("admin score draft during scan lock", () => {
  it("keeps the draft after an unmount and blocks saving until unlocked and reviewed", () => {
    const view = render(<AdminScoreEntryPage />);
    fireEvent.click(screen.getByRole("button", { name: "Enter 35" }));
    expect(screen.getByText("Draft: 35")).toBeTruthy();
    view.unmount();
    state.locked = true;
    state.version = 1;
    const recovered = render(<AdminScoreEntryPage />);
    expect(screen.getByText("Draft: 35")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save scores" }).hasAttribute("disabled")).toBe(true);
    state.locked = false;
    recovered.rerender(<AdminScoreEntryPage />);
    expect(screen.getByText(/scoring policy changed while this draft was unsaved/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I reviewed this draft" }));
    expect(screen.queryByText(/scoring policy changed while this draft was unsaved/)).toBeNull();
  });
});
