import type { InstructionTemplateDraft, InstructionTemplateOutputType } from "./types";
import { nextLocalId } from "./utils";

export type TemplateFormatHint = "paragraph" | "bullets" | "numbered" | "steps" | "mixed";
export interface InstructionTemplatePreset {
  id: string;
  version: number;
  name: string;
  description: string;
  outputType: InstructionTemplateOutputType;
  category: "Recommended" | "Lesson Plans" | "Student Notes" | "Assignments";
  recommendedFor: string;
  suggestedScope: "school_default";
  sections: ReadonlyArray<{
    key: string;
    label: string;
    required: boolean;
    minWords?: number;
    guidance?: string;
    formatHint?: TemplateFormatHint;
  }>;
  rules: { minimumObjectives: number; minimumSources: number; minimumTotalSections: number };
}

// Published versions are immutable starter definitions, not school templates.
export const INSTRUCTION_TEMPLATE_PRESETS: readonly InstructionTemplatePreset[] = [
  {
    id: "melo-standard-lesson-plan", version: 1, name: "Melo Standard Lesson Plan", outputType: "lesson_plan", category: "Recommended",
    description: "A balanced lesson-plan structure suitable as a general school default. Covers prior knowledge, objectives, lesson introduction, structured teaching, evaluation and follow-up work without forcing a subject-specific format.",
    recommendedFor: "All school levels", suggestedScope: "school_default",
    sections: [
      { key: "previous-knowledge", label: "Previous Knowledge", required: true, minWords: 40, formatHint: "paragraph", guidance: "Describe the knowledge, skills or experiences learners are expected to already possess that directly support the new lesson. Keep this relevant to the topic rather than giving generic statements." },
      { key: "learning-objectives", label: "Learning Objectives", required: true, minWords: 30, formatHint: "bullets", guidance: "State clear and observable learning outcomes. Objectives should describe what learners should be able to demonstrate by the end of the lesson. Avoid vague objectives such as \"understand\" when a more measurable action is possible." },
      { key: "instructional-materials", label: "Instructional Materials", required: false, formatHint: "bullets", guidance: "List teaching aids, equipment, texts, diagrams, manipulatives, media or other materials that meaningfully support this lesson. Do not invent specialised materials unnecessarily." },
      { key: "introduction-set-induction", label: "Introduction / Set Induction", required: true, minWords: 60, formatHint: "paragraph", guidance: "Describe how the teacher should open the lesson, connect it to prior knowledge and gain learner attention. Where appropriate, include an opening question, demonstration, scenario, short activity or relatable example." },
      { key: "lesson-development", label: "Lesson Development", required: true, minWords: 200, formatHint: "steps", guidance: "Teach the topic progressively in logical stages. Include the important explanation/content, teacher actions, learner participation, examples where appropriate, questioning or checks for understanding, and transitions between stages. The depth and complexity must suit the stated class level." },
      { key: "assessment-evaluation", label: "Assessment / Evaluation", required: true, minWords: 60, formatHint: "numbered", guidance: "Provide practical questions or activities the teacher can use to determine whether the lesson objectives were achieved. Assessment should test the actual concepts taught rather than unrelated recall." },
      { key: "summary-conclusion", label: "Summary / Conclusion", required: true, minWords: 40, formatHint: "paragraph", guidance: "Briefly consolidate the major ideas taught in the lesson and show how the teacher closes the lesson." },
      { key: "homework-follow-up", label: "Homework / Follow-up", required: true, minWords: 30, formatHint: "numbered", guidance: "Give appropriate follow-up work related directly to the lesson objectives. Keep the workload and complexity suitable for the class level." },
      { key: "differentiation-learner-support", label: "Differentiation / Learner Support", required: false, formatHint: "bullets", guidance: "Include this section only when useful. Suggest practical adjustments for learners who need more support or additional challenge." },
    ],
    rules: { minimumObjectives: 3, minimumSources: 1, minimumTotalSections: 8 },
  },
  {
    id: "melo-standard-student-note", version: 1, name: "Melo Standard Student Note", outputType: "student_note", category: "Recommended",
    description: "A learner-friendly note with concepts, examples, key points and a self-check.",
    recommendedFor: "All school levels", suggestedScope: "school_default",
    sections: [
      { key: "topic-overview", label: "Topic Overview", required: true, minWords: 60, guidance: "Introduce the topic clearly in learner-friendly language and establish what the learner is about to study." },
      { key: "key-concepts", label: "Key Concepts", required: true, minWords: 150, guidance: "Explain the central ideas accurately and progressively. Use language appropriate to the learner's level." },
      { key: "explanation-and-examples", label: "Explanation and Examples", required: true, minWords: 150, guidance: "Expand the important concepts with concrete examples, worked examples, scenarios or illustrations where appropriate to the subject." },
      { key: "important-points-to-remember", label: "Important Points to Remember", required: true, minWords: 50, formatHint: "bullets" },
      { key: "practice-self-check", label: "Practice / Self-check", required: true, minWords: 70, formatHint: "numbered", guidance: "Give a short set of questions or activities learners can use to test their understanding." },
      { key: "summary", label: "Summary", required: true, minWords: 50 },
    ],
    rules: { minimumObjectives: 1, minimumSources: 1, minimumTotalSections: 6 },
  },
  {
    id: "melo-standard-assignment", version: 1, name: "Melo Standard Assignment", outputType: "assignment", category: "Recommended",
    description: "Topic-aligned practice with clear directions, questions and a private teacher marking guide.",
    recommendedFor: "All school levels", suggestedScope: "school_default",
    sections: [
      { key: "instructions", label: "Instructions", required: true, minWords: 30, guidance: "Give clear directions for completing the assignment, including any response or submission expectations that can reasonably be inferred from the academic context." },
      { key: "questions-tasks", label: "Questions / Tasks", required: true, minWords: 120, formatHint: "numbered", guidance: "Produce clear numbered tasks aligned to the topic and class level. Include a reasonable progression from straightforward recall or understanding toward application where appropriate." },
      { key: "challenge-extension", label: "Challenge / Extension", required: false, guidance: "Add an extension activity only when appropriate for the topic and level." },
      { key: "teacher-marking-guide", label: "Teacher Marking Guide", required: true, minWords: 80, guidance: "Provide expected answers, marking points or assessment guidance for the teacher. Do not mix the marking guide into the learner-facing questions." },
    ],
    rules: { minimumObjectives: 1, minimumSources: 1, minimumTotalSections: 3 },
  },
];

export function createDraftFromPreset(preset: InstructionTemplatePreset): InstructionTemplateDraft {
  return {
    templateId: null, outputType: preset.outputType, title: preset.name, description: preset.description,
    templateScope: preset.suggestedScope, subjectId: null, level: "", isSchoolDefault: true,
    // Review and explicitly activate before this school-owned record participates in resolution.
    isActive: false, sourcePresetId: preset.id, sourcePresetVersion: preset.version,
    objectiveMinimums: {
      minimumObjectives: String(preset.rules.minimumObjectives),
      minimumSourceMaterials: String(preset.rules.minimumSources),
      minimumSections: String(preset.rules.minimumTotalSections),
    },
    sections: preset.sections.map((section) => ({
      key: nextLocalId("template-section"), id: null, label: section.label,
      required: section.required, minimumWordCount: section.minWords === undefined ? "" : String(section.minWords),
      guidance: section.guidance ?? "", formatHint: section.formatHint ?? "",
    })),
  };
}
