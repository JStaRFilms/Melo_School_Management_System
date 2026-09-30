// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ExamEntryPage from "../app/assessments/exams/entry/page";

const state = vi.hoisted(() => ({
  entry: { mode: "graded", canEnterNarrative: false } as { mode: "graded" | "narrative"; canEnterNarrative: boolean },
  options: [{ id: "art", name: "Art" }] as { id: string; name: string }[] | undefined,
  gradedOptions: [{ id: "art", name: "Art" }] as { id: string; name: string }[] | undefined,
  assignedClasses: [{ _id: "class", name: "Nursery" }] as { _id: string; name: string }[] | undefined,
  calls: [] as Array<{ name: string; args: unknown }>,
}));
vi.mock("@/lib/convex-runtime", () => ({ isConvexConfigured: () => true }));
vi.mock("@/lib/AuthProvider", () => ({ useAuth: () => ({ workspaceAccess: { state: "ready", branch: { schoolId: "school" } } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("sessionId=session&termId=term&classId=class&subjectId=art") }));
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    state.calls.push({ name, args });
    if (args === "skip") return undefined;
    if (name.endsWith("getEntryClassMode")) return state.entry;
    if (name.endsWith("getSubjectOptions")) return state.options;
    if (name.endsWith("getSheet")) return [];
    if (name.endsWith("getTeacherSessions")) return [{ _id: "session", name: "2025" }];
    if (name.endsWith("getTeacherAssignableClasses")) return state.assignedClasses;
    if (name.endsWith("getTermsBySession")) return [{ id: "term", name: "First" }];
    if (name.endsWith("getTeacherAssignableSubjectsByClass")) return state.gradedOptions;
    return [];
  },
  useMutation: () => vi.fn(),
}));
vi.mock("../app/assessments/exams/entry/components/ExamEntryWorkspace", () => ({ ExamEntryWorkspace: ({ subjectUnavailable, isLoadingSubjects }: { subjectUnavailable?: boolean; isLoadingSubjects?: boolean }) => <div><p>Graded entry</p>{subjectUnavailable ? <p role="status">Choose an available subject</p> : isLoadingSubjects ? <p role="status">Loading available subjects</p> : null}</div> }));
afterEach(() => { cleanup(); state.calls.length = 0; state.options = [{ id: "art", name: "Art" }]; state.gradedOptions = [{ id: "art", name: "Art" }]; state.assignedClasses = [{ _id: "class", name: "Nursery" }]; });

it("routes a graded exam officer to the existing score sheet", () => {
  state.entry = { mode: "graded", canEnterNarrative: false };
  render(<ExamEntryPage />);
  expect(screen.getByText("Graded entry")).toBeTruthy();
  expect(state.calls.find(call => call.name.endsWith("getEntryClassMode"))?.args).toMatchObject({ schoolId: "school" });
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(true);
  expect(state.calls.some(call => call.name.endsWith("getSheet") && call.args !== "skip")).toBe(false);
});
it("waits for graded subject options and skips stale subject or unassigned class", () => {
  state.entry = { mode: "graded", canEnterNarrative: false };
  state.gradedOptions = undefined;
  const view = render(<ExamEntryPage />);
  expect(state.calls.filter(call => call.name.endsWith("getExamEntrySheet")).every(call => call.args === "skip")).toBe(true);
  expect(screen.getByRole("status").textContent).toMatch(/Loading available subjects/);
  state.gradedOptions = [{ id: "music", name: "Music" }];
  view.rerender(<ExamEntryPage />);
  expect(screen.getByText("Graded entry")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toMatch(/Choose an available subject/);
  state.assignedClasses = [{ _id: "another", name: "Other" }];
  state.gradedOptions = [{ id: "art", name: "Art" }];
  view.rerender(<ExamEntryPage />);
  expect(screen.getByRole("status").textContent).toMatch(/Choose an available subject/);
  expect(state.calls.filter(call => call.name.endsWith("getTeacherAssignableSubjectsByClass")).at(-1)?.args).toBe("skip");
  expect(state.calls.filter(call => call.name.endsWith("getExamEntrySheet")).every(call => call.args === "skip")).toBe(true);
  state.assignedClasses = [{ _id: "class", name: "Nursery" }];
  view.rerender(<ExamEntryPage />);
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(true);
});
it("shows assignment guidance for narrative exam officer or stale teacher class without reading drafts", () => {
  state.entry = { mode: "narrative", canEnterNarrative: false };
  render(<ExamEntryPage />);
  expect(screen.getByRole("alert").textContent).toMatch(/class assignment/);
  expect(state.calls.some(call => call.name.endsWith("getSubjectOptions") || call.name.endsWith("getSheet") && call.args !== "skip")).toBe(false);
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(false);
});
it("mounts narrative entry for a teacher assigned to the class", () => {
  state.entry = { mode: "narrative", canEnterNarrative: true };
  render(<ExamEntryPage />);
  expect(screen.getByText("Subject comments")).toBeTruthy();
  expect(state.calls.some(call => call.name.endsWith("getSheet") && call.args !== "skip")).toBe(true);
  expect(state.calls.some(call => call.name.endsWith("getExamEntrySheet") && call.args !== "skip")).toBe(false);
});
it("waits for subject options and rejects an unavailable URL subject without querying the roster", () => {
  state.entry = { mode: "narrative", canEnterNarrative: true };
  state.options = undefined;
  const view = render(<ExamEntryPage />);
  expect(state.calls.find(call => call.name.endsWith("getSheet"))?.args).toBe("skip");
  state.options = [{ id: "music", name: "Music" }];
  view.rerender(<ExamEntryPage />);
  expect(screen.getByRole("alert").textContent).toMatch(/Subject unavailable. Choose another subject/);
  expect(state.calls.filter(call => call.name.endsWith("getSheet")).every(call => call.args === "skip")).toBe(true);
});
