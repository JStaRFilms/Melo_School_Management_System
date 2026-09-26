import { describe, expect, it } from "vitest";
import { INSTRUCTION_TEMPLATE_PRESETS, createDraftFromPreset } from "../app/academic/knowledge/templates/presets";
import { validateInstructionTemplateDraft } from "../app/academic/knowledge/templates/utils";

describe("Melo starter templates", () => {
  it("has the exact versioned standard outlines and rules", () => {
    expect(INSTRUCTION_TEMPLATE_PRESETS.map(({ id, version, sections, rules }) => ({ id, version, labels: sections.map((section) => section.label), rules }))).toEqual([
      { id: "melo-standard-lesson-plan", version: 1, labels: ["Previous Knowledge", "Learning Objectives", "Instructional Materials", "Introduction / Set Induction", "Lesson Development", "Assessment / Evaluation", "Summary / Conclusion", "Homework / Follow-up", "Differentiation / Learner Support"], rules: { minimumObjectives: 3, minimumSources: 1, minimumTotalSections: 8 } },
      { id: "melo-standard-student-note", version: 1, labels: ["Topic Overview", "Key Concepts", "Explanation and Examples", "Important Points to Remember", "Practice / Self-check", "Summary"], rules: { minimumObjectives: 1, minimumSources: 1, minimumTotalSections: 6 } },
      { id: "melo-standard-assignment", version: 1, labels: ["Instructions", "Questions / Tasks", "Challenge / Extension", "Teacher Marking Guide"], rules: { minimumObjectives: 1, minimumSources: 1, minimumTotalSections: 3 } },
    ]);
  });
  it.each(INSTRUCTION_TEMPLATE_PRESETS)("turns $id into a new inactive, editable draft", (preset) => {
    const first = createDraftFromPreset(preset);
    const second = createDraftFromPreset(preset);
    expect(first.templateId).toBeNull();
    expect(first.isActive).toBe(false);
    expect(first.templateScope).toBe("school_default");
    expect(first.sourcePresetVersion).toBe(1);
    expect(first.sections.map((section) => section.key)).not.toEqual(second.sections.map((section) => section.key));
    expect(validateInstructionTemplateDraft(first, [])).toBeNull();
  });
});
