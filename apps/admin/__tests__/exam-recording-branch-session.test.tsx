import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ExamRecordingSettingsPage from "../app/assessments/setup/exam-recording/page";

const state = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; args: unknown }>,
  sessions: [{ id: "branch-session", name: "Branch Session" }, { id: "other-session", name: "Other Session" }],
}));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: {
  state: "ready", branch: { schoolId: "branch-school" },
  compatibility: { legacyDefaultSchoolId: "default-school" },
} }) }));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    state.calls.push({ name, args });
    return name.endsWith(":getAdminSessions") ? state.sessions : undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@school/shared/drafts", () => ({ useDepartureGuard: () => ({ requestDeparture: vi.fn() }), useDirtyForm: vi.fn() }));
vi.mock("../app/assessments/setup/exam-recording/components/SessionScoringEditor", () => ({
  SessionScoringEditor: ({ sessionId }: { sessionId: string }) => <div data-testid="scoring-session">{sessionId}</div>,
}));
vi.mock("@/components/ui/AdminHeader", () => ({ AdminHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

beforeEach(() => { state.calls = []; });

it("loads only the selected branch sessions and mounts scoring for the chosen session", () => {
  render(<ExamRecordingSettingsPage />);
  expect(state.calls).toEqual([{ name: "functions/academic/adminSelectors:getAdminSessions", args: { schoolId: "branch-school" } }]);
  expect(screen.queryByTestId("scoring-session")).toBeNull();
  fireEvent.change(screen.getByLabelText("Session"), { target: { value: "other-session" } });
  expect(screen.getByTestId("scoring-session").textContent).toBe("other-session");
  expect(state.calls.every(call => call.name.endsWith(":getAdminSessions") &&
    (call.args as { schoolId: string }).schoolId === "branch-school")).toBe(true);
});
