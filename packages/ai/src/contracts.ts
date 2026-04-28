import { Output } from "ai";
import { z } from "zod";

export const documentOutputTypes = [
  "lesson_plan",
  "student_note",
  "assignment",
  "question_bank_draft",
  "cbt_draft",
] as const;

export type DocumentOutputType = (typeof documentOutputTypes)[number];

export const documentDifficultyLevels = ["easy", "medium", "hard"] as const;
export type DocumentDifficultyLevel = (typeof documentDifficultyLevels)[number];

const lessonPlanStepSchema = z.object({
  heading: z.string(),
  durationMinutes: z.number().int().positive(),
  teacherMoves: z.array(z.string()).min(1),
  learnerActivities: z.array(z.string()).min(1),
  checkpoint: z.string(),
});

const vocabularyEntrySchema = z.object({
  term: z.string(),
  meaning: z.string(),
});

const assignmentTaskSchema = z.object({
  prompt: z.string(),
  expectedResponse: z.string(),
  marks: z.number().int().positive(),
  difficulty: z.enum(documentDifficultyLevels),
  hints: z.array(z.string()).min(1),
});

const assessmentQuestionSchema = z.object({
  number: z.number().int().positive(),
  prompt: z.string(),
  answer: z.string(),
  explanation: z.string(),
  difficulty: z.enum(documentDifficultyLevels),
  marks: z.number().int().positive(),
  tags: z.array(z.string()).min(1),
});

const cbtSectionSchema = z.object({
  title: z.string(),
  instructions: z.array(z.string()).min(1),
  questions: z.array(assessmentQuestionSchema).min(1),
});

export const lessonPlanDraftSchema = z.object({
  title: z.string(),
  subject: z.string(),
  level: z.string(),
  topic: z.string(),
  summary: z.string(),
  learningObjectives: z.array(z.string()).min(1),
  prerequisites: z.array(z.string()).min(1),
  materials: z.array(z.string()).min(1),
  lessonFlow: z.array(lessonPlanStepSchema).min(1),
  assessment: z.string(),
  homework: z.string(),
  differentiationNotes: z.string(),
  sourceNotes: z.array(z.string()).min(1),
});

export const studentNoteDraftSchema = z.object({
  title: z.string(),
  subject: z.string(),
  level: z.string(),
  topic: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()).min(1),
  vocabulary: z.array(vocabularyEntrySchema).min(1),
  workedExample: z.string(),
  reflectionQuestions: z.array(z.string()).min(1),
  sourceNotes: z.array(z.string()).min(1),
});

export const assignmentDraftSchema = z.object({
  title: z.string(),
  subject: z.string(),
  level: z.string(),
  topic: z.string(),
  instructions: z.string(),
  tasks: z.array(assignmentTaskSchema).min(1),
  submissionChecklist: z.array(z.string()).min(1),
  markingGuidance: z.string(),
  sourceNotes: z.array(z.string()).min(1),
});

export const questionBankDraftSchema = z.object({
  title: z.string(),
  subject: z.string(),
  level: z.string(),
  topic: z.string(),
  blueprint: z.string(),
  questions: z.array(assessmentQuestionSchema).min(1),
  answerKeyNotes: z.string(),
  sourceNotes: z.array(z.string()).min(1),
});

export const cbtDraftSchema = z.object({
  title: z.string(),
  subject: z.string(),
  level: z.string(),
  topic: z.string(),
  examMode: z.string(),
  timeLimitMinutes: z.number().int().positive(),
  instructions: z.array(z.string()).min(1),
  sections: z.array(cbtSectionSchema).min(1),
  answerKeyNotes: z.string(),
  sourceNotes: z.array(z.string()).min(1),
});

export type LessonPlanDraft = z.infer<typeof lessonPlanDraftSchema>;
export type StudentNoteDraft = z.infer<typeof studentNoteDraftSchema>;
export type AssignmentDraft = z.infer<typeof assignmentDraftSchema>;
export type QuestionBankDraft = z.infer<typeof questionBankDraftSchema>;
export const templateBoundSectionDraftSchema = z.object({
  sectionId: z.string(),
  label: z.string(),
  content: z.string(),
});

export const templateBoundInstructionDraftSchema = z.object({
  title: z.string(),
  subject: z.string(),
  level: z.string(),
  topic: z.string(),
  sections: z.array(templateBoundSectionDraftSchema).min(1),
  sourceNotes: z.array(z.string()).min(1),
});

export function createTemplateBoundInstructionDraftSchema(
  templateSections: Array<{ id: string; label: string; required: boolean }>
) {
  const allowedSectionIds = new Set(templateSections.map((section) => section.id));
  const requiredSectionIds = new Set(templateSections.filter((section) => section.required).map((section) => section.id));

  return templateBoundInstructionDraftSchema.superRefine((draft, ctx) => {
    const seenSectionIds = new Set<string>();

    for (const section of draft.sections) {
      if (!allowedSectionIds.has(section.sectionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `Unknown template section id: ${section.sectionId}`,
        });
      }

      if (seenSectionIds.has(section.sectionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `Duplicate template section id: ${section.sectionId}`,
        });
      }
      seenSectionIds.add(section.sectionId);
    }

    for (const sectionId of requiredSectionIds) {
      if (!seenSectionIds.has(sectionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `Missing required template section id: ${sectionId}`,
        });
      }
    }
  });
}

export type CbtDraft = z.infer<typeof cbtDraftSchema>;
export type TemplateBoundInstructionDraft = z.infer<typeof templateBoundInstructionDraftSchema>;

export interface DocumentGenerationContract<OutputShape> {
  readonly kind: DocumentOutputType;
  readonly schema: z.ZodType<OutputShape>;
  readonly output: ReturnType<typeof Output.object<OutputShape>>;
}

function createDocumentOutput<OutputShape>(
  schema: z.ZodType<OutputShape>,
  meta: { name: string; description: string }
) {
  return Output.object({
    schema,
    name: meta.name,
    description: meta.description,
  });
}

export const lessonPlanGenerationContract = {
  kind: "lesson_plan",
  schema: lessonPlanDraftSchema,
  output: createDocumentOutput(lessonPlanDraftSchema, {
    name: "lesson_plan",
    description:
      "Structured teacher-facing lesson plan draft with objectives, lesson flow, assessment, and homework.",
  }),
};

export const studentNoteGenerationContract = {
  kind: "student_note",
  schema: studentNoteDraftSchema,
  output: createDocumentOutput(studentNoteDraftSchema, {
    name: "student_note",
    description:
      "Structured learner-facing note derived from a lesson plan or approved source materials.",
  }),
};

export const assignmentGenerationContract = {
  kind: "assignment",
  schema: assignmentDraftSchema,
  output: createDocumentOutput(assignmentDraftSchema, {
    name: "assignment",
    description:
      "Structured assignment draft with tasks, expected responses, and marking guidance.",
  }),
};

export const questionBankGenerationContract = {
  kind: "question_bank_draft",
  schema: questionBankDraftSchema,
  output: createDocumentOutput(questionBankDraftSchema, {
    name: "question_bank_draft",
    description:
      "Structured question-bank draft with answers, explanations, difficulty, and tags.",
  }),
};

export const cbtGenerationContract = {
  kind: "cbt_draft",
  schema: cbtDraftSchema,
  output: createDocumentOutput(cbtDraftSchema, {
    name: "cbt_draft",
    description:
      "Structured CBT-style draft with sections, questions, and answer key notes.",
  }),
};

export const documentGenerationContracts = {
  lesson_plan: lessonPlanGenerationContract,
  student_note: studentNoteGenerationContract,
  assignment: assignmentGenerationContract,
  question_bank_draft: questionBankGenerationContract,
  cbt_draft: cbtGenerationContract,
} as const;

export type DocumentGenerationContractKey = keyof typeof documentGenerationContracts;

export function getDocumentGenerationContract(
  kind: DocumentOutputType
): (typeof documentGenerationContracts)[DocumentOutputType] {
  return documentGenerationContracts[kind];
}

export function getDocumentGenerationOutput(kind: DocumentOutputType) {
  return getDocumentGenerationContract(kind).output;
}
