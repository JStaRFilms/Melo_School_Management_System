import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import ClassReleasePage from "../app/assessments/report-cards/release/page";

const mocks = vi.hoisted(() => ({ context: vi.fn(), pause: vi.fn(), selected: vi.fn(), readiness: vi.fn(), pages: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("sessionId=session&termId=term&classId=class") }));
vi.mock("../lib/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } } }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getReleaseContext")) return mocks.context();
    if (args === "skip") return undefined;
    return name.endsWith(":getReleaseSelection") ? mocks.selected(args) : mocks.readiness(args);
  },
  usePaginatedQuery: (ref: FunctionReference<"query">, args: unknown) => mocks.pages(getFunctionName(ref), args),
  useMutation: () => mocks.pause,
}));
const school = {
  schoolId: "school", schoolName: "Example School", canRelease: false, canExclude: false,
  releasesPaused: true, releasePauseReason: "Roster requires review", releasePauseUpdatedAt: 1000,
};
const active = {
  session: { id: "session", name: "2026", isActive: true, isArchived: false },
  term: { id: "term", sessionId: "session", name: "First", isActive: true, isArchived: false },
  klass: { id: "class", name: "Year 1", isArchived: false }, released: false,
};
const published = Array.from({ length: 257 }, (_, i) => ({ id: `release-${i}`, sessionId: `old-session-${i}`,
  termId: `old-term-${i}`, classId: `old-class-${i}`, label: `Old class ${i} / Old session / Old term`, releasedAt: 1000 }));
let visible = 24;
beforeEach(() => {
  vi.clearAllMocks(); visible = 24;
  mocks.context.mockReturnValue(school);
  mocks.selected.mockImplementation((args: { sessionId: string; termId: string; classId: string }) =>
    args.sessionId === "session" ? active : {
      session: { id: args.sessionId, name: "Old session", isActive: false, isArchived: true },
      term: { id: args.termId, sessionId: args.sessionId, name: "Old term", isActive: false, isArchived: true },
      klass: { id: args.classId, name: "Old class", isArchived: true }, released: true,
    });
  mocks.readiness.mockImplementation((args: { sessionId: string }) => ({ released: args.sessionId === "session" ? null :
    { releasedAt: 1000, releasedBy: "officer", eligibleCount: 0, certifiedCount: 0, excludedCount: 0 },
  eligibleCount: 0, certifiedCount: 0, excludedCount: 0, ready: false, reviewKey: null, rows: [] }));
  mocks.pages.mockImplementation((name: string) => {
    const data = name.endsWith(":listReleaseSessions") ? [active.session] : name.endsWith(":listReleaseTerms") ? [active.term] :
      name.endsWith(":listReleaseClasses") ? [active.klass] : published.slice(0, visible);
    return { results: data, status: name.endsWith(":listReleasedClasses") && visible < 257 ? "CanLoadMore" : "Exhausted",
      loadMore: vi.fn(() => { visible += 24; }) };
  });
});

describe("release page selectors", () => {
  it("shows exam officers the school pause but no toggle and disables active release", () => {
    render(<ClassReleasePage />);
    expect(screen.getByText(/New class releases are paused for Example School/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pause releases|resume releases/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review release" })).toBeDisabled();
  });
  it("pages 257 published classes and inspects an archived frozen release", async () => {
    const { rerender } = render(<ClassReleasePage />);
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Load more published classes" }));
      rerender(<ClassReleasePage />);
    }
    expect(screen.getByRole("button", { name: /Old class 256 \/ Old session/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Old class 256 \/ Old session/ }));
    expect(await screen.findByRole("heading", { name: "Released to families" })).toBeInTheDocument();
    expect(screen.getByText(/Original release:/)).toHaveTextContent("officer");
    expect(screen.queryByRole("button", { name: "Review release" })).not.toBeInTheDocument();
  });
  it("rejects a wrong-school deep link instead of showing a roster", async () => {
    mocks.selected.mockReturnValue(null);
    render(<ClassReleasePage />);
    expect(await screen.findByText("This class, session or term is unavailable for this school.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reviewed roster" })).not.toBeInTheDocument();
  });
  it("labels unpublished inactive periods as historical rather than offering release", async () => {
    mocks.selected.mockReturnValue({ ...active, term: { ...active.term, isActive: false } });
    render(<ClassReleasePage />);
    expect(await screen.findByText(/needs historical roster reconciliation/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review release" })).not.toBeInTheDocument();
  });
});
