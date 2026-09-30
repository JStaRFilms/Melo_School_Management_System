import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import ClassReleasePage from "../app/assessments/report-cards/release/page";

const mocks = vi.hoisted(() => ({ schoolId: "school" as string | null, url: "sessionId=session&termId=term&classId=class",
  push: vi.fn(), replace: vi.fn(), context: vi.fn(), pause: vi.fn(), selected: vi.fn(), readiness: vi.fn(), pages: vi.fn() }));
const router = { push: mocks.push, replace: mocks.replace };
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.url), useRouter: () => router }));
vi.mock("../lib/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: mocks.schoolId
  ? { state: "ready", branch: { schoolId: mocks.schoolId } } : { state: "loading" } }) }));
vi.mock("convex/react", () => ({
  useQuery: (ref: FunctionReference<"query">, args: unknown) => {
    const name = getFunctionName(ref);
    if (name.endsWith(":getReleaseContext")) return mocks.context(args);
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
  vi.clearAllMocks(); visible = 24; mocks.schoolId = "school";
  mocks.url = "sessionId=session&termId=term&classId=class";
  mocks.push.mockImplementation((href: string) => { mocks.url = href.split("?")[1] ?? ""; });
  mocks.replace.mockImplementation((href: string) => { mocks.url = href.split("?")[1] ?? ""; });
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
  it("does not query a school before a workspace branch is selected", () => {
    mocks.schoolId = null;
    render(<ClassReleasePage />);
    expect(screen.getByText("Loading release options...")).toBeInTheDocument();
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.pages).not.toHaveBeenCalled();
  });
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
    rerender(<ClassReleasePage />);
    expect(await screen.findByRole("heading", { name: "Released to families" })).toBeInTheDocument();
    expect(screen.getByText(/Original release:/)).toHaveTextContent("Staff member");
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
  it("follows same-route push, back and forward without retaining a stale release tuple", () => {
    const newer = { session: { ...active.session, id: "session-2", name: "2027" },
      term: { ...active.term, id: "term-2", sessionId: "session-2", name: "Second" },
      klass: { ...active.klass, id: "class-2", name: "Year 2" }, released: false };
    mocks.selected.mockImplementation((args: { sessionId: string }) => args.sessionId === "session-2" ? newer : active);
    mocks.pages.mockImplementation((name: string) => ({ results: name.endsWith(":listReleaseSessions") ? [active.session, newer.session] :
      name.endsWith(":listReleaseClasses") ? [active.klass, newer.klass] : [active.term, newer.term],
    status: "Exhausted", loadMore: vi.fn() }));
    const { rerender } = render(<ClassReleasePage />);
    expect(screen.getByText("Example School / Year 1 / 2026 / First")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Session" }), { target: { value: "session-2" } });
    expect(mocks.push).toHaveBeenCalledWith("/assessments/report-cards/release?sessionId=session-2");
    expect(screen.queryByText("Example School / Year 1 / 2026 / First")).not.toBeInTheDocument();
    rerender(<ClassReleasePage />);
    expect(screen.getByRole("combobox", { name: "Term" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Class" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Review release" })).not.toBeInTheDocument();
    mocks.url = "sessionId=session-2&termId=term-2&classId=class-2";
    rerender(<ClassReleasePage />);
    expect(screen.getByText("Example School / Year 2 / 2027 / Second")).toBeInTheDocument();
    expect(mocks.readiness).toHaveBeenLastCalledWith(expect.objectContaining({ schoolId: "school", sessionId: "session-2", termId: "term-2", classId: "class-2" }));
    mocks.url = "sessionId=session&termId=term&classId=class";
    rerender(<ClassReleasePage />);
    expect(screen.getByText("Example School / Year 1 / 2026 / First")).toBeInTheDocument();
    mocks.url = "sessionId=session-2&termId=term-2&classId=class-2";
    rerender(<ClassReleasePage />);
    expect(screen.getByText("Example School / Year 2 / 2027 / Second")).toBeInTheDocument();
  });
  it("uses the selected non-default branch for selectors and pause, then drops the old tuple on switch", async () => {
    mocks.schoolId = "branch-b";
    mocks.context.mockImplementation((args: { schoolId: string }) => ({ ...school, schoolId: args.schoolId,
      schoolName: args.schoolId, canExclude: true }));
    mocks.pause.mockResolvedValue({ releasesPaused: false });
    const { rerender } = render(<ClassReleasePage />);
    expect(mocks.context).toHaveBeenCalledWith({ schoolId: "branch-b" });
    for (const [name, args] of mocks.pages.mock.calls as [string, { schoolId: string }][]) {
      expect(args.schoolId).toBe("branch-b");
      expect(name).toMatch(/listRelease/);
    }
    expect(mocks.selected).toHaveBeenCalledWith({ schoolId: "branch-b", sessionId: "session", termId: "term", classId: "class" });
    fireEvent.click(screen.getByRole("button", { name: "Resume releases" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), { target: { value: "Reviewed and ready to resume" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm this change/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm resume" }));
    await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith({ schoolId: "branch-b", releasesPaused: false,
      reason: "Reviewed and ready to resume" }));
    mocks.selected.mockClear();
    mocks.schoolId = null;
    rerender(<ClassReleasePage />);
    expect(screen.getByText("Loading release options...")).toBeInTheDocument();
    mocks.schoolId = "school";
    rerender(<ClassReleasePage />);
    expect(mocks.replace).toHaveBeenCalledWith("/assessments/report-cards/release");
    rerender(<ClassReleasePage />);
    expect(screen.getByText("Select a session, term and class to review the roster.")).toBeInTheDocument();
    expect(mocks.selected).not.toHaveBeenCalled();
    expect(mocks.context).toHaveBeenLastCalledWith({ schoolId: "school" });
  });
});
