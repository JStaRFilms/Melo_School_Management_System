import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import ClassReleasePage from "../app/assessments/report-cards/release/page";

const mocks = vi.hoisted(() => ({ context: vi.fn(), pause: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("sessionId=session&termId=term&classId=class") }));
vi.mock("../lib/AuthProvider",  () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } } }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">) => getFunctionName(ref).endsWith(":getReleaseContext") ? mocks.context() : undefined,
  useMutation: () => mocks.pause,
}));
const school = {
  schoolId: "school", schoolName: "Example School", canRelease: false, canExclude: false,
  releasesPaused: true, releasePauseReason: "Roster requires review", releasePauseUpdatedAt: 1000,
  sessions: [{ id: "session", name: "2026" }], terms: [{ id: "term", sessionId: "session", name: "First" }], classes: [{ id: "class", name: "Year 1" }],
};

describe("release page pause context", () => {
  it("shows exam officers the school pause but no toggle and disables release", () => {
    mocks.context.mockReturnValue(school);
    render(<ClassReleasePage />);
    expect(screen.getByText(/New class releases are paused for Example School/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause releases|resume releases/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review release" })).toBeDisabled();
  });
});
