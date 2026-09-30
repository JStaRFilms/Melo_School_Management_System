import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DepartureGuardProvider } from "@school/shared/drafts";
import { LessonPlanWorkspaceScreen } from "../components/LessonPlanWorkspaceScreen";
import type { LessonPlanSaveResult, LessonPlanWorkspaceData } from "../types";

const mocks = vi.hoisted(() => ({ connection: { connected: true, authenticated: true, accountId: "teacher-one" as string | null } }));
vi.mock("@/lib/useDraftConnection", () => ({ useDraftConnection: () => mocks.connection }));
vi.mock("convex/react", () => ({ useConvex: () => ({ query: vi.fn() }) }));
afterEach(() => { mocks.connection = { connected: true, authenticated: true, accountId: "teacher-one" }; vi.clearAllMocks(); });

function workspace(revisionNumber = 1, documentState = "# Fractions", canGenerate = false): LessonPlanWorkspaceData {
  return {
    schoolName: "Synthetic School", outputType: "lesson_plan", outputTypeLabel: "Lesson Plan", sourceIds: ["source-one"], selectedSourceCount: 1, accessibleSourceCount: 1, missingSourceIds: [], inaccessibleSourceIds: [], warnings: [],
    sourceContext: { subjectId: "subject-one", subjectName: "Mathematics", subjectCode: "MTH", level: "Primary 4", topicLabel: "Fractions" }, planningContext: null,
    template: { _id: "template-one", outputType: "lesson_plan", title: "Lesson Plan", description: null, templateScope: "school_default", subjectId: null, subjectName: null, subjectCode: null, level: null, isSchoolDefault: true, requiredSectionIds: ["objectives"], sectionDefinitions: [{ id: "objectives", label: "Objectives", order: 0, required: true, minimumWordCount: null }], objectiveMinimums: { minimumObjectives: 1, minimumSourceMaterials: 1, minimumSections: 1 }, resolutionPath: "school", applicabilityLabel: "School", templateKey: "school", resolutionRank: 1 },
    draft: { artifactId: "artifact-one", documentId: "document-one", revisionId: `revision-${revisionNumber}`, revisionNumber, title: "Fractions", documentState, plainText: documentState, outputType: "lesson_plan", templateId: "template-one", templateResolutionPath: "school", sourceSelectionSnapshot: "snapshot", lastSavedAt: 100 }, revisions: [], canGenerate, canAutosave: true,
    selectedSources: [{ _id: "source-one", title: "Book", description: null, sourceType: "text_entry", visibility: "private_owner", reviewStatus: "approved", processingStatus: "ready", searchStatus: "indexed", subjectId: "subject-one", subjectName: "Mathematics", subjectCode: "MTH", level: "Primary 4", topicLabel: "Fractions", canUseAsLessonSource: true }],
  };
}

it("sends the loaded revision, blocks stale overwrite, and explicitly loads reactive latest content", async () => {
  const save = vi.fn().mockRejectedValue({ data: { code: "CONFLICT", message: "newer" } });
  const props = { workspace: workspace(), onOutputTypeChange: vi.fn(), onRemoveSource: vi.fn(), onOpenLibrary: vi.fn(), onSaveDraft: save, onGenerateDraft: vi.fn() };
  const view = render(<DepartureGuardProvider><LessonPlanWorkspaceScreen {...props} /></DepartureGuardProvider>);
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  fireEvent.change(screen.getByPlaceholderText("Start drafting..."), { target: { value: "# Fractions\n\n## Local edits" } });
  fireEvent.click(screen.getByText("Save Snapshot"));
  await screen.findByText("Load latest revision");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevisionNumber: 1 }));
  expect(screen.getByText(/Conflict · load latest/i)).toBeInTheDocument();

  view.rerender(<DepartureGuardProvider><LessonPlanWorkspaceScreen {...props} workspace={workspace(2, "# Fractions\n\n## Objectives\nLatest server text")} /></DepartureGuardProvider>);
  fireEvent.click(screen.getByText("Load latest revision"));
  expect(screen.getByPlaceholderText("Start drafting...")).toHaveValue("# Fractions\n\n## Objectives\nLatest server text");
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
});

it("preserves edits made while a slow AI call is pending instead of replacing them", async () => {
  const initial = workspace(1, "# Fractions", true);
  let finish!: (value: LessonPlanSaveResult) => void;
  const generate = vi.fn(() => new Promise<LessonPlanSaveResult>(resolve => { finish = resolve; }));
  render(<DepartureGuardProvider><LessonPlanWorkspaceScreen workspace={initial} onOutputTypeChange={vi.fn()}
    onRemoveSource={vi.fn()} onOpenLibrary={vi.fn()} onSaveDraft={vi.fn()} onGenerateDraft={generate} /></DepartureGuardProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Review and generate/i }));
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByPlaceholderText("Document Title..."), { target: { value: "Teacher's newer title" } });
  fireEvent.change(screen.getByPlaceholderText("Start drafting..."), { target: { value: "# Teacher's newer text" } });
  await act(async () => { finish({
    artifactId: "artifact-one", documentId: "document-two", revisionId: "revision-two", revisionNumber: 2,
    title: "AI generated", documentState: "# AI generated", plainText: "AI generated", outputType: "lesson_plan",
    sourceIds: ["source-one"], sourceSelectionSnapshot: "snapshot", templateId: "template-one",
    templateResolutionPath: "school", savedAt: Date.now(),
  }); });
  expect(screen.getByPlaceholderText("Document Title...")).toHaveValue("Teacher's newer title");
  expect(screen.getByPlaceholderText("Start drafting...")).toHaveValue("# Teacher's newer text");
  expect(screen.getByRole("button", { name: "Save Snapshot" })).not.toBeDisabled();
  expect(screen.getByRole("button", { name: /Review and generate/i })).not.toBeDisabled();
});

it("keeps the editor available after a failed slow AI call", async () => {
  const initial = workspace(1, "# Fractions", true);
  let fail!: (error: Error) => void;
  const generate = vi.fn(() => new Promise<LessonPlanSaveResult>((_resolve, reject) => { fail = reject; }));
  render(<DepartureGuardProvider><LessonPlanWorkspaceScreen workspace={initial} onOutputTypeChange={vi.fn()}
    onRemoveSource={vi.fn()} onOpenLibrary={vi.fn()} onSaveDraft={vi.fn()} onGenerateDraft={generate} /></DepartureGuardProvider>);
  fireEvent.click(screen.getByRole("button", { name: /Review and generate/i }));
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
  await act(async () => { fail(new Error("Provider unavailable")); });
  fireEvent.change(screen.getByPlaceholderText("Document Title..."), { target: { value: "Still editable" } });
  fireEvent.change(screen.getByPlaceholderText("Start drafting..."), { target: { value: "# Local text" } });
  expect(screen.getByPlaceholderText("Document Title...")).toHaveValue("Still editable");
  expect(screen.getByPlaceholderText("Start drafting...")).toHaveValue("# Local text");
  expect(screen.getByRole("button", { name: /Review and generate/i })).not.toBeDisabled();
});

it("reports disconnect honestly and guards a source/context departure", async () => {
  const remove = vi.fn();
  const props = { workspace: workspace(), onOutputTypeChange: vi.fn(), onRemoveSource: remove, onOpenLibrary: vi.fn(), onSaveDraft: vi.fn(), onGenerateDraft: vi.fn() };
  const view = render(<DepartureGuardProvider><LessonPlanWorkspaceScreen {...props} /></DepartureGuardProvider>);
  fireEvent.change(screen.getByPlaceholderText("Document Title..."), { target: { value: "Unsaved title" } });
  mocks.connection = { connected: false, authenticated: true, accountId: "teacher-one" };
  view.rerender(<DepartureGuardProvider><LessonPlanWorkspaceScreen {...props} /></DepartureGuardProvider>);
  expect(screen.getByText(/Connection lost · not saved/i)).toBeInTheDocument();
  mocks.connection = { connected: true, authenticated: false, accountId: null };
  view.rerender(<DepartureGuardProvider><LessonPlanWorkspaceScreen {...props} /></DepartureGuardProvider>);
  expect(screen.getByText(/Sign in again · edits in this tab/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove source Book" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByText("Stay here"));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("Document Title...")).toHaveValue("Unsaved title");
});
