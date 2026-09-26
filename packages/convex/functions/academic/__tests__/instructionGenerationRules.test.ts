import { describe, expect, it } from "vitest";
import { assertUsableExcerptMinimum, countDistinctObjectives, findObjectiveSection, renderTemplateBoundMarkdown, validateGenerationMinimums } from "../instructionGenerationRules";
import { instructionTemplateResolutionKeys, normalizeInstructionTemplateSections, selectInstructionTemplateBucket } from "../lessonKnowledgeTemplatesHelpers";
import type { Id } from "../../../_generated/dataModel";

const draft = {
  title: "Lesson", subject: "Math", level: "JSS 1", topic: "Fractions", sourceNotes: ["Curriculum"],
  sections: [{ sectionId: "objectives", label: "Learning Objectives", content: "- Identify fractions\n- Add fractions\n- Compare fractions" }],
};
const sections = [
  { id: "objectives", label: "Learning Objectives", required: true },
  { id: "optional", label: "Instructional Materials", required: false },
];

describe("instruction generation minimums", () => {
  it("counts distinct bullet and numbered objectives, not repeated prose", () => {
    expect(countDistinctObjectives("- Identify fractions\n1. Add fractions\n- Identify fractions\nA sentence about objectives")).toBe(2);
    expect(validateGenerationMinimums(draft, sections, { minimumObjectives: 3, minimumSections: 1 })).toEqual([]);
    expect(validateGenerationMinimums(draft, sections, { minimumObjectives: 4, minimumSections: 2 })).toHaveLength(2);
  });
  it("only enforces objective counts when the template has an objective-bearing section", () => {
    expect(findObjectiveSection(sections)?.label).toBe("Learning Objectives");
    const studentNoteSections = [{ id: "overview", label: "Topic Overview", required: true }];
    const note = { ...draft, sections: [{ sectionId: "overview", label: "Topic Overview", content: "An introduction with no objective list." }] };
    expect(findObjectiveSection(studentNoteSections)).toBeUndefined();
    expect(validateGenerationMinimums(note, studentNoteSections, { minimumObjectives: 1, minimumSections: 1 })).toEqual([]);
    expect(validateGenerationMinimums(draft, sections, { minimumObjectives: 4, minimumSections: 1 })).toEqual([
      "Generated draft has 3 distinct listed objectives; the template requires 4.",
    ]);
  });
  it("counts only filled template sections and omits empty optional headings", () => {
    const withEmptyOptional = { ...draft, sections: [...draft.sections, { sectionId: "optional", label: "Instructional Materials", content: "" }] };
    expect(validateGenerationMinimums(withEmptyOptional, sections, { minimumObjectives: 3, minimumSections: 2 })).toHaveLength(1);
    expect(renderTemplateBoundMarkdown(withEmptyOptional)).not.toContain("## Instructional Materials");
    expect(renderTemplateBoundMarkdown(withEmptyOptional)).toContain("## Learning Objectives");
  });
  it("counts only distinct excerpt-bearing sources, including when configured minimum is zero", () => {
    const excerpts = [{ materialId: "one", excerptText: "indexed" }, { materialId: "one", excerptText: "duplicate" }, { materialId: "two", excerptText: " " }];
    expect(() => assertUsableExcerptMinimum(excerpts, 2)).toThrow(/found 1/);
    expect(() => assertUsableExcerptMinimum([], 0)).toThrow(/requires 1/);
    expect(() => assertUsableExcerptMinimum(excerpts, 1)).not.toThrow();
  });
});

describe("template section normalization", () => {
  it("preserves guidance and format without adding them to generated content", () => {
    const normalized = normalizeInstructionTemplateSections({ outputType: "lesson_plan", sections: [
      { label: "Learning Objectives", required: true, minimumWordCount: 30, guidance: "  Make objectives observable.  ", formatHint: "bullets" },
      { label: "Optional", required: false, minimumWordCount: null, guidance: null, formatHint: null },
    ] });
    expect(normalized.sectionDefinitions[0]).toMatchObject({ guidance: "Make objectives observable.", formatHint: "bullets" });
    expect(normalized.sectionDefinitions[1]).not.toHaveProperty("guidance");
  });
});

describe("template fallback keys", () => {
  it("orders exact scopes and never uses another level's subject-and-level key as fallback", () => {
    const keys = instructionTemplateResolutionKeys({ outputType: "lesson_plan", subjectId: "math" as Id<"subjects">, level: " JSS  1 " });
    expect(keys.map((bucket) => bucket.scope)).toEqual(["subject_and_level", "subject_only", "level_only", "school_default"]);
    expect(keys.map((bucket) => bucket.key)).toEqual(["lesson_plan:subject_and_level:math:jss 1", "lesson_plan:subject_only:math", "lesson_plan:level_only:jss 1", "lesson_plan:school_default"]);
    const records = [
      { templateKey: "lesson_plan:subject_and_level:math:jss 2", templateScope: "subject_and_level", outputType: "lesson_plan", isActive: true, updatedAt: 2, title: "Wrong level" },
      { templateKey: "lesson_plan:subject_and_level:english:jss 1", templateScope: "subject_and_level", outputType: "lesson_plan", isActive: true, updatedAt: 3, title: "Wrong subject" },
      { templateKey: "lesson_plan:subject_only:math", templateScope: "subject_only", outputType: "lesson_plan", isActive: true, updatedAt: 1, title: "Correct subject fallback" },
    ];
    expect(selectInstructionTemplateBucket(records, keys[0], "lesson_plan")).toBeNull();
    expect(selectInstructionTemplateBucket(records, keys[1], "lesson_plan")?.title).toBe("Correct subject fallback");
    expect(selectInstructionTemplateBucket(records, keys[2], "lesson_plan")).toBeNull();
  });
});
