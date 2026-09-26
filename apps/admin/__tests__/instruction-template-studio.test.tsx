import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { InstructionTemplateStudioScreen } from "../app/academic/knowledge/templates/components/InstructionTemplateStudioScreen";
import type { InstructionTemplateListItem } from "../app/academic/knowledge/templates/types";

vi.mock("@school/shared/drafts", () => ({ useDirtyForm: vi.fn() }));

it("opens a Melo preset as an unsaved inactive draft without persisting it", async () => {
  const save = vi.fn(async () => "saved-template-id");
  render(<InstructionTemplateStudioScreen subjects={[]} levelOptions={[]} templates={[]} summary={{ total: 0, active: 0, defaultCount: 0, inactive: 0 }} outputType="lesson_plan" searchQuery="" onOutputTypeChange={vi.fn()} onSearchQueryChange={vi.fn()} onSaveTemplate={save} />);
  expect(screen.getAllByText("Melo Standard Lesson Plan").length).toBeGreaterThan(0);
  const use = screen.getAllByRole("button", { name: "Use Template" });
  fireEvent.click(use[0]);
  expect(screen.getAllByDisplayValue("Melo Standard Lesson Plan").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Commit Changes" })[0]);
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ templateId: null, sourcePresetId: "melo-standard-lesson-plan", isActive: false })));
});

it("reviews each recommended default as an unsaved draft before the next", async () => {
  const save = vi.fn(async () => "saved-id");
  render(<InstructionTemplateStudioScreen subjects={[]} levelOptions={[]} templates={[]} summary={{ total: 0, active: 0, defaultCount: 0, inactive: 0 }} outputType="lesson_plan" searchQuery="" onOutputTypeChange={vi.fn()} onSearchQueryChange={vi.fn()} onSaveTemplate={save} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Set up Melo defaults" })[0]);
  expect(screen.getAllByDisplayValue("Melo Standard Lesson Plan").length).toBeGreaterThan(0);
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Commit Changes" })[0]);
  await waitFor(() => expect(screen.getAllByDisplayValue("Melo Standard Student Note").length).toBeGreaterThan(0));
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getAllByText(/1 more defaults to review/).length).toBeGreaterThan(0);
});

it("returns from the gallery to an unsaved editor and clears the draft on confirmed mobile Back", () => {
  const save = vi.fn(async () => "saved-id");
  render(<InstructionTemplateStudioScreen subjects={[]} levelOptions={[]} templates={[]} summary={{ total: 0, active: 0, defaultCount: 0, inactive: 0 }} outputType="lesson_plan" searchQuery="" onOutputTypeChange={vi.fn()} onSearchQueryChange={vi.fn()} onSaveTemplate={save} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Use Template" })[0]);
  fireEvent.change(screen.getAllByDisplayValue("Melo Standard Lesson Plan")[0], { target: { value: "Unsaved title" } });
  fireEvent.click(screen.getByRole("button", { name: "Choose Starter / Template Gallery" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Return to editor" })[0]);
  expect(screen.getAllByDisplayValue("Unsaved title").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Choose Starter / Template Gallery" }));
  fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
  expect(screen.getAllByDisplayValue("Unsaved title").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
  expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Discard and continue" }));
  expect(screen.queryByDisplayValue("Unsaved title")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Back$/ })).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

it("preserves edits made after save while the saved catalog row arrives", async () => {
  const save = vi.fn(async () => "saved-template-id");
  const props = { subjects: [], levelOptions: [], outputType: "lesson_plan" as const, searchQuery: "", onOutputTypeChange: vi.fn(), onSearchQueryChange: vi.fn(), onSaveTemplate: save };
  const view = render(<InstructionTemplateStudioScreen {...props} templates={[]} summary={{ total: 0, active: 0, defaultCount: 0, inactive: 0 }} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Use Template" })[0]);
  fireEvent.click(screen.getAllByRole("button", { name: "Commit Changes" })[0]);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getAllByDisplayValue("Melo Standard Lesson Plan")[0], { target: { value: "Edited after save" } });

  const saved: InstructionTemplateListItem = {
    _id: "saved-template-id", templateKey: "lesson_plan:school_default", outputType: "lesson_plan",
    title: "Melo Standard Lesson Plan", description: null, templateScope: "school_default", subjectId: null,
    subjectName: null, subjectCode: null, level: null, isSchoolDefault: true,
    requiredSectionIds: ["previous"], sectionDefinitions: [{ id: "previous", label: "Previous Knowledge", order: 0, required: true, minimumWordCount: 40, guidance: null, formatHint: null }],
    sourcePresetId: "melo-standard-lesson-plan", sourcePresetVersion: 1,
    objectiveMinimums: { minimumObjectives: 3, minimumSourceMaterials: 1, minimumSections: 1 },
    searchText: "Melo Standard Lesson Plan", isActive: false, createdAt: 1, updatedAt: 1, createdBy: "user", updatedBy: "user",
    sectionCount: 1, requiredSectionCount: 1, applicabilityLabel: "School default", templateKeyLabel: "School default", resolutionRank: 4,
  };
  view.rerender(<InstructionTemplateStudioScreen {...props} templates={[saved]} summary={{ total: 1, active: 0, defaultCount: 0, inactive: 1 }} />);
  expect(screen.getAllByDisplayValue("Edited after save").length).toBeGreaterThan(0);
});

it("uses a saved snapshot while an edited template is hidden by search", async () => {
  const item: InstructionTemplateListItem = {
    _id: "hidden-template", templateKey: "lesson_plan:school_default", outputType: "lesson_plan",
    title: "Original title", description: null, templateScope: "school_default", subjectId: null,
    subjectName: null, subjectCode: null, level: null, isSchoolDefault: true,
    requiredSectionIds: ["intro"], sectionDefinitions: [{ id: "intro", label: "Introduction", order: 0, required: true, minimumWordCount: 80, guidance: null, formatHint: null }],
    sourcePresetId: null, sourcePresetVersion: null,
    objectiveMinimums: { minimumObjectives: 1, minimumSourceMaterials: 1, minimumSections: 1 },
    searchText: "Original title", isActive: true, createdAt: 1, updatedAt: 1, createdBy: "user", updatedBy: "user",
    sectionCount: 1, requiredSectionCount: 1, applicabilityLabel: "School default", templateKeyLabel: "School default", resolutionRank: 4,
  };
  const save = vi.fn(async () => "hidden-template");
  const props = { subjects: [], levelOptions: [], outputType: "lesson_plan" as const, onOutputTypeChange: vi.fn(), onSearchQueryChange: vi.fn(), onSaveTemplate: save };
  const view = render(<InstructionTemplateStudioScreen {...props} templates={[item]} summary={{ total: 1, active: 1, defaultCount: 1, inactive: 0 }} searchQuery="" />);
  fireEvent.change(screen.getAllByDisplayValue("Original title")[0], { target: { value: "Saved hidden edit" } });
  view.rerender(<InstructionTemplateStudioScreen {...props} templates={[]} summary={{ total: 0, active: 0, defaultCount: 0, inactive: 0 }} searchQuery="hidden" />);
  fireEvent.click(screen.getAllByRole("button", { name: "Commit Changes" })[0]);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(screen.getAllByText("Everything Saved").length).toBeGreaterThan(0);
  fireEvent.change(screen.getAllByDisplayValue("Saved hidden edit")[0], { target: { value: "Unsaved follow-up" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Discard" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Discard and continue" }));
  expect(screen.getAllByDisplayValue("Saved hidden edit").length).toBeGreaterThan(0);
});

it("keeps a filtered selected draft and allows saving an inactive duplicate", async () => {
  const item: InstructionTemplateListItem = {
    _id: "school-template", templateKey: "lesson_plan:school_default", outputType: "lesson_plan",
    title: "School template", description: null, templateScope: "school_default", subjectId: null,
    subjectName: null, subjectCode: null, level: null, isSchoolDefault: true,
    requiredSectionIds: ["intro"], sectionDefinitions: [{ id: "intro", label: "Introduction", order: 0, required: true, minimumWordCount: 80, guidance: null, formatHint: null }],
    sourcePresetId: null, sourcePresetVersion: null,
    objectiveMinimums: { minimumObjectives: 1, minimumSourceMaterials: 1, minimumSections: 1 },
    searchText: "School template", isActive: true, createdAt: 1, updatedAt: 1, createdBy: "user", updatedBy: "user",
    sectionCount: 1, requiredSectionCount: 1, applicabilityLabel: "School default", templateKeyLabel: "School default", resolutionRank: 4,
  };
  const base = { subjects: [], levelOptions: [], summary: { total: 1, active: 1, defaultCount: 1, inactive: 0 }, outputType: "lesson_plan" as const, onOutputTypeChange: vi.fn(), onSearchQueryChange: vi.fn(), onSaveTemplate: vi.fn(async () => "school-template") };
  const view = render(<InstructionTemplateStudioScreen {...base} templates={[item]} searchQuery="" />);
  fireEvent.change(screen.getAllByDisplayValue("School template")[0], { target: { value: "Edited, not saved" } });
  view.rerender(<InstructionTemplateStudioScreen {...base} templates={[]} summary={{ total: 0, active: 0, defaultCount: 0, inactive: 0 }} searchQuery="no matches" />);
  expect(screen.getAllByDisplayValue("Edited, not saved").length).toBeGreaterThan(0);
  expect(screen.getByText(/hidden by the current search/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "New Template" }));
  expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getAllByDisplayValue("Edited, not saved").length).toBeGreaterThan(0);
  view.rerender(<InstructionTemplateStudioScreen {...base} templates={[item]} searchQuery="" />);
  fireEvent.click(screen.getByRole("button", { name: "Duplicate School template" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard and continue" }));
  expect(screen.getAllByDisplayValue("Copy of School template").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);
  expect(base.onSaveTemplate).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Commit Changes" })[0]);
  await waitFor(() => expect(base.onSaveTemplate).toHaveBeenCalledWith(expect.objectContaining({
    templateId: null,
    title: "Copy of School template",
    isActive: false,
  })));
});
