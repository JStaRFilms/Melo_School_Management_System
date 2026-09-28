import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminScoreEntryPage from "../app/assessments/results/entry/page";
import { DepartureGuardProvider } from "@school/shared/drafts";

const state = vi.hoisted(() => ({ saves: [] as unknown[] }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ session: { user: { id: "owner" } }, workspaceAccess: { state: "ready", branch: { schoolId: "school1" } } }) }));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("sessionId=session1&termId=term1&classId=class1&subjectId=subject1") }));
vi.mock("convex/react", () => ({
  useQuery: (name: string) => {
    if (name.endsWith(":getAdminSessions")) return [{ id: "session1", name: "Session" }];
    if (name.endsWith(":getTermsBySession")) return [{ id: "term1", name: "Term" }];
    if (name.endsWith(":getAllClasses")) return [{ id: "class1", name: "Class" }];
    if (name.endsWith(":getSubjectsByClass")) return [{ id: "subject1", name: "Math" }];
    if (name.endsWith(":getExamEntrySheet")) return {
      roster: [{ studentId: "student1", studentName: "Ada", assessmentRecord: null }], gradingBands: [],
      settings: { examInputMode: "raw40", ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50, sessionPolicyVersion: 0 },
      editingState: { canEdit: true, hasPolicy: true, message: "Open" },
    };
    return undefined;
  },
  useMutation: () => async (args: unknown) => { state.saves.push(args); return { updated: 0, created: 1, errors: [] }; },
}));
vi.mock("../app/assessments/results/entry/components/AdminSelectionBar", () => ({ AdminSelectionBar: () => null }));
vi.mock("@/components/ui/AdminHeader", () => ({ AdminHeader: () => null }));
vi.mock("@school/shared/toast", () => ({ appToast: { info: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));

afterEach(() => { cleanup(); window.sessionStorage.clear(); state.saves = []; });

it("renders and saves a new raw /80 row under the legacy version-zero sheet policy", async () => {
  render(<DepartureGuardProvider><AdminScoreEntryPage /></DepartureGuardProvider>);
  expect(screen.getByText("RECORDED /80")).toBeTruthy();
  expect(screen.getByText("SYSTEM /50")).toBeTruthy();
  for (const [field, value] of [["CA1", "20"], ["CA2", "20"], ["CA3", "10"], ["exam", "80"]]) {
    fireEvent.change(screen.getAllByRole("textbox", { name: `Ada ${field} score out of ${field === "CA3" ? 10 : field === "exam" ? 80 : 20}` })[0], { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "COMMIT BATCH" }));
  await waitFor(() => expect(state.saves).toHaveLength(1));
  expect(state.saves[0]).toMatchObject({ records: [{ studentId: "student1", ca1: 20, ca2: 20, ca3: 10, examRawScore: 80 }] });
});
