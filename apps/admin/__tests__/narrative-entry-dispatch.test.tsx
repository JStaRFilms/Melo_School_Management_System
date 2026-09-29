// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AdminScoreEntryPage from "../app/assessments/results/entry/page";

const state = vi.hoisted(() => ({
  entry: { mode: "graded", canEnterNarrative: false } as { mode: "graded" | "narrative"; canEnterNarrative: boolean },
  options: [{ id: "art", name: "Art" }] as { id: string; name: string }[] | undefined,
  gradedOptions: [{ id: "art", name: "Art" }] as { id: string; name: string }[] | undefined,
  calls: [] as Array<{ name: string; args: unknown }>,
}));
vi.mock("@/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("sessionId=session&termId=term&classId=class&subjectId=art") }));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    state.calls.push({ name, args });
    if (args === "skip") return undefined;
    if (name.endsWith("getEntryClassMode")) return state.entry;
    if (name.endsWith("getSubjectOptions")) return state.options;
    if (name.endsWith("getSheet")) return [];
    if (name.endsWith("getAdminSessions")) return [{ id: "session", name: "2025" }];
    if (name.endsWith("getAllClasses")) return [{ id: "class", name: "Nursery" }];
    if (name.endsWith("getTermsBySession")) return [{ id: "term", name: "First" }];
    if (name.endsWith("getSubjectsByClass")) return state.gradedOptions;
    return undefined;
  },
  useMutation: () => vi.fn(),
}));
vi.mock("@/components/ui/AdminHeader", () => ({ AdminHeader: () => null }));
vi.mock("../app/assessments/results/entry/components/AdminSelectionBar", () => ({ AdminSelectionBar: () => <p>Graded selector</p> }));
vi.mock("../app/assessments/results/entry/components/AdminRosterGrid", () => ({ AdminRosterGrid: () => null }));
afterEach(() => { cleanup(); state.calls.length = 0; state.options = [{ id: "art", name: "Art" }]; state.gradedOptions = [{ id: "art", name: "Art" }]; });

it("keeps the existing graded entry available to an exam officer", () => {
  state.entry = { mode: "graded", canEnterNarrative: false };
  render(<AdminScoreEntryPage />);
  expect(screen.getByText("Graded selector")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(true);
  expect(state.calls.some(call => call.name.endsWith("getSheet") && call.args !== "skip")).toBe(false);
});
it("waits for graded subject options and keeps a stale subject away from the score-sheet query", () => {
  state.entry = { mode: "graded", canEnterNarrative: false };
  state.gradedOptions = undefined;
  const view = render(<AdminScoreEntryPage />);
  expect(state.calls.filter(call => call.name.endsWith("getExamEntrySheet")).every(call => call.args === "skip")).toBe(true);
  expect(screen.getByRole("status").textContent).toMatch(/Loading available subjects/);
  state.gradedOptions = [{ id: "music", name: "Music" }];
  view.rerender(<AdminScoreEntryPage />);
  expect(screen.getByText("Graded selector")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toMatch(/Choose an available subject/);
  expect(state.calls.filter(call => call.name.endsWith("getExamEntrySheet")).every(call => call.args === "skip")).toBe(true);
  state.gradedOptions = [{ id: "art", name: "Art" }];
  view.rerender(<AdminScoreEntryPage />);
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(true);
});
it("does not mount narrative entry for an exam officer without preview permission", () => {
  state.entry = { mode: "narrative", canEnterNarrative: false };
  render(<AdminScoreEntryPage />);
  expect(screen.getByRole("alert").textContent).toMatch(/report preview permission/);
  expect(state.calls.some(call => call.name.endsWith("getSubjectOptions") || call.name.endsWith("getSheet") && call.args !== "skip")).toBe(false);
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(false);
});
it("mounts the narrative sheet only when entry access is granted", () => {
  state.entry = { mode: "narrative", canEnterNarrative: true };
  render(<AdminScoreEntryPage />);
  expect(screen.getByText("Subject comments")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getSheet") && call.args !== "skip")).toBe(true);
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(false);
});
it("waits for subject options then shows unavailable subject guidance without reading a draft", () => {
  state.entry = { mode: "narrative", canEnterNarrative: true };
  state.options = undefined;
  const view = render(<AdminScoreEntryPage />);
  expect(state.calls.find(call => call.name.endsWith("getSheet"))?.args).toBe("skip");
  state.options = [{ id: "music", name: "Music" }];
  view.rerender(<AdminScoreEntryPage />);
  expect(screen.getByRole("alert").textContent).toMatch(/Subject unavailable. Choose another subject/);
  expect(state.calls.filter(call => call.name.endsWith("getSheet")).every(call => call.args === "skip")).toBe(true);
});
