import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuestionBankWorkspaceScreen } from "../components/QuestionBankWorkspaceScreen";
import type { AssessmentBankSaveResult, AssessmentWorkspaceData } from "../types";

const notices = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("@/lib/hooks/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("@school/shared/toast", () => ({ appToast: notices }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

const settings = { questionStyle: "balanced" as const, totalQuestions: 1,
  questionMix: { multiple_choice: 0, short_answer: 1, essay: 0, true_false: 0, fill_in_the_blank: 0 },
  allowTeacherOverrides: true };
const initialItem = { id: "item-one", itemOrder: 0, questionType: "short_answer" as const,
  difficulty: "easy" as const, promptText: "Original prompt", answerText: "Answer",
  explanationText: "Explanation", marks: 1, tags: ["algebra"] };
function workspace(): AssessmentWorkspaceData {
  return {
    schoolName: "School", draftMode: "practice_quiz", draftModeLabel: "Practice quiz",
    outputType: "question_bank_draft", outputTypeLabel: "Question bank draft", sourceIds: ["source-one"],
    selectedSourceCount: 1, accessibleSourceCount: 1, missingSourceIds: [], inaccessibleSourceIds: [], warnings: [],
    sourceContext: { subjectId: "subject-one", subjectName: "Mathematics", subjectCode: "MTH", level: "JSS 1", topicLabel: "Algebra" },
    planningContext: null, profiles: [], draft: {
      bankId: "bank-one", title: "Original title", description: "Original description", draftMode: "practice_quiz",
      outputType: "question_bank_draft", bankStatus: "draft", visibility: "private_owner", reviewStatus: "draft",
      subjectId: "subject-one", subjectName: "Mathematics", subjectCode: "MTH", level: "JSS 1", topicLabel: "Algebra",
      sourceSelectionSnapshot: "snapshot", effectiveGenerationSettings: settings, lastSavedAt: 100, itemCount: 1,
    }, items: [initialItem], canGenerate: true, paidGenerationAvailable: true, canAutosave: true,
    selectedSources: [{ _id: "source-one", title: "Book", description: null, sourceType: "text_entry",
      visibility: "private_owner", reviewStatus: "approved", processingStatus: "ready", searchStatus: "indexed",
      subjectId: "subject-one", subjectName: "Mathematics", subjectCode: "MTH", level: "JSS 1",
      topicLabel: "Algebra", canUseAsLessonSource: true }],
  };
}
function saveResult(title: string): AssessmentBankSaveResult {
  return { bankId: "bank-one", title, description: "Original description", draftMode: "practice_quiz",
    outputType: "question_bank_draft", sourceSelectionSnapshot: "snapshot", itemCount: 1,
    savedAt: Date.now(), effectiveGenerationSettings: settings };
}
function renderScreen(onSaveDraft: Parameters<typeof QuestionBankWorkspaceScreen>[0]["onSaveDraft"], onGenerateDraft: Parameters<typeof QuestionBankWorkspaceScreen>[0]["onGenerateDraft"]) {
  render(<QuestionBankWorkspaceScreen workspace={workspace()} onDraftModeChange={vi.fn()}
    onRemoveSource={vi.fn()} onOpenLibrary={vi.fn()} onSaveDraft={onSaveDraft} onGenerateDraft={onGenerateDraft} />);
}
function editDraft() {
  fireEvent.change(screen.getByPlaceholderText("e.g. Mid-term Physics Quiz"), { target: { value: "Unsaved title" } });
  fireEvent.change(screen.getByDisplayValue("Original prompt"), { target: { value: "Unsaved question" } });
}
function editAndGenerate() {
  editDraft();
  fireEvent.click(screen.getByRole("button", { name: "Review and generate" }));
}

it("saves dirty assessment text and items before starting quote preparation", async () => {
  let finishSave!: (value: AssessmentBankSaveResult) => void;
  const save = vi.fn().mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
  const generate = vi.fn().mockImplementation(async () => ({ ...saveResult("AI draft"), items: [initialItem] }));
  renderScreen(save, generate);
  editAndGenerate();
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: "Unsaved title",
    items: [expect.objectContaining({ promptText: "Unsaved question" })] }));
  expect(generate).not.toHaveBeenCalled();
  await act(async () => { finishSave(saveResult("Unsaved title")); });
  await waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
});

it("keeps unsaved edits and never prepares a quote when the pre-generation save fails", async () => {
  vi.useFakeTimers();
  const save = vi.fn().mockRejectedValue(new Error("Save failed"));
  const generate = vi.fn();
  renderScreen(save, generate);
  editDraft();
  await act(async () => { vi.advanceTimersByTime(1200); });
  expect(save).toHaveBeenCalledTimes(1); // Autosave failed; local edits remain dirty.
  vi.useRealTimers();
  fireEvent.click(screen.getByRole("button", { name: "Review and generate" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(notices.error).toHaveBeenCalled();
  expect(generate).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("e.g. Mid-term Physics Quiz")).toHaveValue("Unsaved title");
  expect(screen.getByDisplayValue("Unsaved question")).toHaveValue("Unsaved question");
});
