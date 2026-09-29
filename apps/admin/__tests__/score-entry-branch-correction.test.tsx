import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminScoreEntryPage from "../app/assessments/results/entry/page";
import { SessionScoringEditor } from "../app/assessments/setup/exam-recording/components/SessionScoringEditor";
import { DepartureGuardProvider } from "@school/shared/drafts";

const state = vi.hoisted(() => ({
  schoolId: "branch-school",
  calls: [] as Array<{ name: string; args: unknown }>,
  saves: [] as unknown[],
  linkParams: "",
}));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ session: { user: { id: "owner" } }, workspaceAccess: {
  state: "ready", branch: { schoolId: state.schoolId },
} }) }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
// These are the query parameters carried by an invalid-score example's correction link.
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.linkParams) }));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    state.calls.push({ name, args });
    if (name.endsWith(":getSessionScoringPolicy")) return { policy: { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 }, version: 0, source: "legacy" };
    if (name.endsWith(":getSessionScoringJob")) return { phase: "invalid", policy: { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50 },
      before: { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 },
      expectedVersion: 0, scanned: 1, invalidCount: 1, updated: 0, invalidExamples: [{ recordId: "record1", studentId: "branch-student",
        termId: "branch-term", classId: "branch-class", subjectId: "branch-subject", field: "ca3", message: "Over limit" }] };
    if (name.endsWith(":getAdminSessions")) return [{ id: "branch-session", name: "Branch Session" }];
    if (name.endsWith(":getTermsBySession")) return [{ id: "branch-term", name: "Branch Term" }];
    if (name.endsWith(":getAllClasses")) return [{ id: "branch-class", name: "Branch Class" }];
    if (name.endsWith(":getSubjectsByClass")) return [{ id: "branch-subject", name: "Math" }];
    if (name.endsWith(":getExamEntrySheet")) return {
      roster: [{ studentId: "branch-student", studentName: "Ada", assessmentRecord: {
        ca1: 10, ca2: 10, ca3: 15, examRawScore: 30,
      } }], gradingBands: [],
      settings: { examInputMode: "raw40", ca1Max: 20, ca2Max: 20, ca3Max: 20,
        examRawMax: 40, examContributionMax: 40, sessionPolicyVersion: 0 },
      editingState: { canEdit: true, hasPolicy: true, message: "Open" },
    };
    return undefined;
  },
  useMutation: () => async (args: unknown) => { state.saves.push(args); return { updated: 1, created: 0, errors: [] }; },
}));
vi.mock("../app/assessments/results/entry/components/AdminSelectionBar", () => ({ AdminSelectionBar: () => null }));
vi.mock("../app/assessments/results/entry/components/AdminRosterGrid", () => ({ AdminRosterGrid: ({ onScoreChange }: {
  onScoreChange: (id: string, field: "ca3", value: number) => void;
}) => <button onClick={() => onScoreChange("branch-student", "ca3", 8)}>Correct Ada&apos;s score</button> }));
vi.mock("../app/assessments/results/entry/components/AdminSaveActionBar", () => ({ AdminSaveActionBar: ({ onSave }: {
  onSave: () => Promise<unknown>;
}) => <button onClick={() => void onSave()}>Save scores</button> }));
vi.mock("@/components/ui/AdminHeader", () => ({ AdminHeader: () => null }));
vi.mock("@school/shared/toast", () => ({ appToast: { info: vi.fn(), warning: vi.fn() } }));

beforeEach(() => { state.calls = []; state.saves = []; state.linkParams = ""; window.sessionStorage.clear(); });
afterEach(cleanup);

it("follows a non-default branch invalid-score link and saves the corrected row in that branch", async () => {
  const editor = render(<DepartureGuardProvider><SessionScoringEditor sessionId={"branch-session" as never} /></DepartureGuardProvider>);
  const link = await screen.findByRole("link", { name: "Open the student score sheet" });
  state.linkParams = new URL(link.getAttribute("href")!, "http://localhost").search.slice(1);
  expect(new URLSearchParams(state.linkParams).get("studentId")).toBe("branch-student");
  editor.unmount();
  state.calls = [];
  render(<AdminScoreEntryPage />);
  expect(state.calls).toContainEqual({ name: "functions/academic/adminSelectors:getAdminSessions", args: { schoolId: "branch-school" } });
  expect(state.calls).toContainEqual({ name: "functions/academic/adminSelectors:getTermsBySession", args: { schoolId: "branch-school", sessionId: "branch-session" } });
  expect(state.calls).toContainEqual({ name: "functions/academic/adminSelectors:getAllClasses", args: { schoolId: "branch-school" } });
  expect(state.calls).toContainEqual({ name: "functions/academic/adminSelectors:getSubjectsByClass", args: { schoolId: "branch-school", classId: "branch-class" } });
  expect(state.calls).toContainEqual({ name: "functions/academic/assessmentRecords:getExamEntrySheet", args: {
    schoolId: "branch-school", sessionId: "branch-session", termId: "branch-term", classId: "branch-class", subjectId: "branch-subject",
  } });
  fireEvent.click(screen.getByRole("button", { name: "Correct Ada's score" }));
  fireEvent.click(screen.getByRole("button", { name: "Save scores" }));
  await waitFor(() => expect(state.saves).toEqual([{ schoolId: "branch-school", sessionId: "branch-session", termId: "branch-term",
    classId: "branch-class", subjectId: "branch-subject", records: [{ studentId: "branch-student", ca1: 10, ca2: 10, ca3: 8, examRawScore: 30 }] }]));
});
