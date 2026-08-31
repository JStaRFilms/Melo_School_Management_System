"use node";

import { ConvexError, v } from "convex/values";
import { generateObject, NoObjectGeneratedError, type GenerateObjectResult } from "ai";
import {
  buildAssignmentPrompt,
  buildCbtDraftPrompt,
  buildLessonPlanPrompt,
  buildQuestionBankDraftPrompt,
  buildStudentNotePrompt,
  buildTemplateRepairPrompt,
  cbtDraftSchema,
  createDocumentModel,
  documentDifficultyLevels,
  questionBankDraftSchema,
  resolveDocumentModelId,
  resolveDocumentProviderName,
  templateBoundInstructionDraftSchema,
  type CbtDraft,
  type DocumentOutputType,
  type DocumentPromptContext,
  type DocumentSourceMaterialSummary,
  type DocumentTemplateSectionSummary,
  type QuestionBankDraft,
  type RelatedInstructionArtifactSummary,
  type TemplateBoundInstructionDraft,
} from "@school/ai";
import { api } from "../../_generated/api";
import { action, type ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

const MAX_GENERATION_SOURCE_COUNT = 12;
const MAX_PROVIDER_RETRY_ATTEMPTS = 1;
const MAX_TEMPLATE_REPAIR_ATTEMPTS = 1;
const MAX_FAILED_RESPONSE_REPAIR_CHARS = 8000;
const MAX_SCHEMA_REPAIR_INPUT_CHARS = 24_000;

type AssessmentDraftMode = "practice_quiz" | "class_test" | "exam_draft";
type AssessmentOutputType = Extract<DocumentOutputType, "question_bank_draft" | "cbt_draft">;
type LessonPlanOutputType = Extract<DocumentOutputType, "lesson_plan" | "student_note" | "assignment">;
type AssessmentQuestionType =
  | "multiple_choice"
  | "short_answer"
  | "essay"
  | "true_false"
  | "fill_in_the_blank";
type QuestionDifficulty = (typeof documentDifficultyLevels)[number];
type QuestionStyle = "balanced" | "open_ended_heavy" | "mixed_open_ended" | "objective_heavy";
type QuestionTypeKey = keyof QuestionMix;

interface QuestionMix {
  multiple_choice: number;
  short_answer: number;
  essay: number;
  true_false: number;
  fill_in_the_blank: number;
}

interface EffectiveGenerationSettings {
  profileId?: Id<"assessmentGenerationProfiles"> | null;
  profileName?: string;
  questionStyle: QuestionStyle;
  totalQuestions: number;
  questionMix: QuestionMix;
  allowTeacherOverrides: boolean;
  overrideReason?: string;
}

interface TopicPlanningContextArgs {
  kind: "topic";
  classId: Id<"classes">;
  termId: Id<"academicTerms">;
  subjectId: Id<"subjects">;
  level: string;
  topicId: Id<"knowledgeTopics">;
}

interface ExamPlanningContextArgs {
  kind: "exam_scope";
  classId: Id<"classes">;
  termId: Id<"academicTerms">;
  subjectId: Id<"subjects">;
  level: string;
  scopeKind: "full_subject_term" | "topic_subset";
  topicIds?: Array<Id<"knowledgeTopics">>;
}

const lessonPlanOutputTypeValidator = v.union(
  v.literal("lesson_plan"),
  v.literal("student_note"),
  v.literal("assignment")
);

const draftModeValidator = v.union(
  v.literal("practice_quiz"),
  v.literal("class_test"),
  v.literal("exam_draft")
);

const questionStyleValidator = v.union(
  v.literal("balanced"),
  v.literal("open_ended_heavy"),
  v.literal("mixed_open_ended"),
  v.literal("objective_heavy")
);

const questionMixValidator = v.object({
  multiple_choice: v.number(),
  short_answer: v.number(),
  essay: v.number(),
  true_false: v.number(),
  fill_in_the_blank: v.number(),
});

const effectiveGenerationSettingsValidator = v.object({
  profileId: v.optional(v.union(v.id("assessmentGenerationProfiles"), v.null())),
  profileName: v.optional(v.string()),
  questionStyle: questionStyleValidator,
  totalQuestions: v.number(),
  questionMix: questionMixValidator,
  allowTeacherOverrides: v.boolean(),
  overrideReason: v.optional(v.string()),
});

const topicPlanningContextValidator = v.object({
  kind: v.literal("topic"),
  classId: v.id("classes"),
  termId: v.id("academicTerms"),
  subjectId: v.id("subjects"),
  level: v.string(),
  topicId: v.id("knowledgeTopics"),
});

const examPlanningContextValidator = v.object({
  kind: v.literal("exam_scope"),
  classId: v.id("classes"),
  termId: v.id("academicTerms"),
  subjectId: v.id("subjects"),
  level: v.string(),
  scopeKind: v.union(v.literal("full_subject_term"), v.literal("topic_subset")),
  topicIds: v.optional(v.array(v.id("knowledgeTopics"))),
});

const planningContextValidator = v.optional(
  v.union(topicPlanningContextValidator, examPlanningContextValidator)
);

const lessonPlanGenerationResultValidator = v.object({
  artifactId: v.string(),
  documentId: v.string(),
  revisionId: v.string(),
  revisionNumber: v.number(),
  title: v.string(),
  documentState: v.string(),
  plainText: v.string(),
  outputType: lessonPlanOutputTypeValidator,
  sourceIds: v.array(v.string()),
  sourceSelectionSnapshot: v.string(),
  templateId: v.union(v.string(), v.null()),
  templateResolutionPath: v.union(v.string(), v.null()),
  savedAt: v.number(),
  generationMeta: v.object({
    attempts: v.number(),
    repaired: v.boolean(),
    validationIssues: v.array(v.string()),
    sourceExcerptWarnings: v.array(v.string()),
    aiRunLogId: v.string(),
  }),
});

const assessmentBankItemResultValidator = v.object({
  id: v.string(),
  itemOrder: v.number(),
  questionType: v.union(
    v.literal("multiple_choice"),
    v.literal("short_answer"),
    v.literal("essay"),
    v.literal("true_false"),
    v.literal("fill_in_the_blank")
  ),
  difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
  promptText: v.string(),
  answerText: v.string(),
  explanationText: v.string(),
  marks: v.union(v.number(), v.null()),
  tags: v.array(v.string()),
});

const assessmentBankGenerationResultValidator = v.object({
  bankId: v.string(),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  draftMode: draftModeValidator,
  outputType: v.union(v.literal("question_bank_draft"), v.literal("cbt_draft")),
  sourceSelectionSnapshot: v.string(),
  itemCount: v.number(),
  savedAt: v.number(),
  effectiveGenerationSettings: effectiveGenerationSettingsValidator,
  items: v.array(assessmentBankItemResultValidator),
  generationMeta: v.object({
    attempts: v.number(),
    repaired: v.boolean(),
    validationIssues: v.array(v.string()),
    aiRunLogId: v.string(),
  }),
});

type LessonPlanGenerationResultShape = {
  artifactId: string;
  documentId: string;
  revisionId: string;
  revisionNumber: number;
  title: string;
  documentState: string;
  plainText: string;
  outputType: LessonPlanOutputType;
  sourceIds: string[];
  sourceSelectionSnapshot: string;
  templateId: string | null;
  templateResolutionPath: string | null;
  savedAt: number;
  generationMeta: {
    attempts: number;
    repaired: boolean;
    validationIssues: string[];
    sourceExcerptWarnings: string[];
    aiRunLogId: string;
  };
};

type AssessmentBankGenerationResultShape = {
  bankId: string;
  title: string;
  description: string | null;
  draftMode: AssessmentDraftMode;
  outputType: AssessmentOutputType;
  sourceSelectionSnapshot: string;
  itemCount: number;
  savedAt: number;
  effectiveGenerationSettings: EffectiveGenerationSettings;
  items: Array<{
    id: string;
    itemOrder: number;
    questionType: AssessmentQuestionType;
    difficulty: QuestionDifficulty;
    promptText: string;
    answerText: string;
    explanationText: string;
    marks: number;
    tags: string[];
  }>;
  generationMeta: {
    attempts: number;
    repaired: boolean;
    validationIssues: string[];
    aiRunLogId: string;
  };
};

type SourceExcerptSummary = {
  materialId: Id<"knowledgeMaterials">;
  title: string;
  sourceType: string;
  topicLabel: string;
  excerptText: string;
  chunkCountIncluded: number;
  tokenEstimate: number;
};

type SourceExcerptBundle = {
  excerpts: SourceExcerptSummary[];
  omittedSourceIds: string[];
  warnings: string[];
  totalTokenEstimate: number;
};

type ResolvedTemplateSection = DocumentTemplateSectionSummary & {
  minimumWordCount: number | null;
};

type ResolvedTemplate = {
  _id: Id<"instructionTemplates">;
  title: string;
  objectiveMinimums: { minimumSourceMaterials: number };
  sectionDefinitions: ResolvedTemplateSection[];
  resolutionPath: string | null;
} | null;

type RelatedInstructionArtifactRecord = {
  artifactId: Id<"instructionArtifacts">;
  outputType: LessonPlanOutputType;
  title: string;
  plainText: string;
  updatedAt: number | null;
};

type TopicPlanningContextRecord = TopicPlanningContextArgs & {
  topicTitle: string;
  className: string;
  termName: string;
  subjectName: string;
  subjectCode: string;
  planningContextKey: string;
  compatibilityMode: boolean;
};

type ExamPlanningContextRecord = ExamPlanningContextArgs & {
  className: string;
  termName: string;
  subjectName: string;
  subjectCode: string;
  topicTitles: string[];
  planningContextKey: string;
  compatibilityMode: boolean;
};

type LessonPlanWorkspace = {
  schoolName: string | null;
  sourceContext: {
    subjectId: Id<"subjects"> | null;
    subjectName: string | null;
    subjectCode: string | null;
    level: string | null;
    topicLabel: string | null;
  };
  planningContext: TopicPlanningContextRecord | null;
  template: ResolvedTemplate;
  warnings: string[];
  canGenerate: boolean;
  canAutosave: boolean;
  draft: {
    artifactId: Id<"instructionArtifacts"> | null;
  };
  selectedSources: Array<{
    _id: string;
    title: string;
    sourceType: string;
    visibility: string;
    description: string | null;
    topicLabel: string;
  }>;
  relatedInstructionArtifacts: RelatedInstructionArtifactRecord[];
};

type AssessmentWorkspace = {
  schoolName: string | null;
  sourceContext: {
    subjectId: Id<"subjects"> | null;
    subjectName: string | null;
    subjectCode: string | null;
    level: string | null;
    topicLabel: string | null;
  };
  planningContext: TopicPlanningContextRecord | ExamPlanningContextRecord | null;
  warnings: string[];
  canGenerate: boolean;
  canAutosave: boolean;
  draft: {
    bankId: Id<"assessmentBanks"> | null;
    title: string;
    description: string | null;
    sourceSelectionSnapshot: string | null;
    effectiveGenerationSettings: EffectiveGenerationSettings | null;
  };
  selectedSources: Array<{
    _id: string;
    title: string;
    sourceType: string;
    visibility: string;
    description: string | null;
    topicLabel: string;
  }>;
  profiles: Array<{
    _id: Id<"assessmentGenerationProfiles">;
    name: string;
    questionStyle: QuestionStyle;
    totalQuestions: number;
    questionMix: QuestionMix;
    allowTeacherOverrides: boolean;
    isDefault: boolean;
    isActive: boolean;
  }>;
};

type LessonPlanSaveResult = {
  artifactId: Id<"instructionArtifacts">;
  documentId: Id<"instructionArtifactDocuments">;
  revisionId: Id<"instructionArtifactRevisions">;
  revisionNumber: number;
  title: string;
  documentState: string;
  plainText: string;
  outputType: LessonPlanOutputType;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  sourceSelectionSnapshot: string;
  templateId: Id<"instructionTemplates"> | null;
  templateResolutionPath: string | null;
  savedAt: number;
};

type AssessmentSaveResult = {
  bankId: Id<"assessmentBanks">;
  title: string;
  description: string | null;
  draftMode: AssessmentDraftMode;
  outputType: AssessmentOutputType;
  sourceSelectionSnapshot: string;
  itemCount: number;
  savedAt: number;
  effectiveGenerationSettings: {
    profileId?: Id<"assessmentGenerationProfiles"> | null;
    profileName?: string;
    questionStyle: QuestionStyle;
    totalQuestions: number;
    questionMix: QuestionMix;
    allowTeacherOverrides: boolean;
    overrideReason?: string;
  };
};

type RateLimitResult = {
  allowed: boolean;
  resetAt: number;
  retryAfterMs: number;
};

function normalizeSourceIds(sourceIds: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const sourceId of sourceIds) {
    const trimmed = sourceId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*\|\s*/gm, "")
    .replace(/\s*\|\s*$/gm, "")
    .replace(/^\s*[-=]{3,}\s*$/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/!\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[\*_`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionWordCount(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeGeneratedTitle(title: string, fallbackTopic: string): string {
  const normalized = title.trim().replace(/^[:\-\s]+|[:\-\s]+$/g, "");
  return normalized.length >= 3 ? normalized : fallbackTopic;
}

class TemplateDraftValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join(" "));
    this.name = "TemplateDraftValidationError";
    this.issues = issues;
  }
}

function normalizeGeneratedTemplateDraft(
  draft: TemplateBoundInstructionDraft,
  templateSections: ResolvedTemplateSection[],
  fallbackTopic: string
): TemplateBoundInstructionDraft {
  if (templateSections.length === 0) {
    throw new Error(
      "A resolved template is required before rendering generated instruction artifacts."
    );
  }

  const issues: string[] = [];
  const allowedSectionIds = new Set(templateSections.map((section) => section.id));
  const unknownIds = draft.sections
    .map((section) => section.sectionId)
    .filter((sectionId) => !allowedSectionIds.has(sectionId));
  if (unknownIds.length > 0) {
    issues.push(
      `Generated draft used unknown template section ids: ${[...new Set(unknownIds)].join(", ")}.`
    );
  }

  const sectionsById = new Map(draft.sections.map((section) => [section.sectionId, section]));
  const duplicateIds = draft.sections
    .map((section) => section.sectionId)
    .filter((sectionId, index, sectionIds) => sectionIds.indexOf(sectionId) !== index);

  if (duplicateIds.length > 0) {
    issues.push(
      `Generated draft repeated template section ids: ${[...new Set(duplicateIds)].join(", ")}.`
    );
  }

  const normalizedSections = templateSections.map((templateSection) => {
    const generatedSection = sectionsById.get(templateSection.id);
    if (!generatedSection) {
      if (!templateSection.required) {
        return { sectionId: templateSection.id, label: templateSection.label, content: "" };
      }
      issues.push(
        `Generated draft omitted required template section: ${templateSection.label}.`
      );
      return { sectionId: templateSection.id, label: templateSection.label, content: "" };
    }

    const content = generatedSection.content.trim();
    if (templateSection.required && !content) {
      issues.push(
        `Generated draft left required template section empty: ${templateSection.label}.`
      );
    }

    if (
      content &&
      templateSection.minimumWordCount &&
      sectionWordCount(content) < templateSection.minimumWordCount
    ) {
      issues.push(
        `Generated draft section "${templateSection.label}" is below the minimum word count of ${templateSection.minimumWordCount}.`
      );
    }

    return {
      sectionId: templateSection.id,
      label: templateSection.label,
      content,
    };
  });

  if (issues.length > 0) {
    throw new TemplateDraftValidationError(issues);
  }

  return {
    ...draft,
    title: normalizeGeneratedTitle(draft.title, fallbackTopic),
    sections: normalizedSections,
    sourceNotes: draft.sourceNotes.map((note) => note.trim()).filter(Boolean),
  };
}

function renderGeneratedMarkdown(draft: TemplateBoundInstructionDraft): string {
  const metadata = [
    `**Subject:** ${draft.subject}`,
    `**Level:** ${draft.level}`,
    `**Topic:** ${draft.topic}`,
  ];

  return [
    `# ${draft.title}`,
    "",
    ...metadata,
    "",
    ...draft.sections.flatMap((section) => [`## ${section.label}`, section.content, ""]),
    "## Source notes",
    ...draft.sourceNotes.map((note) => `- ${note}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function promptClassForOutputType(outputType: LessonPlanOutputType): string {
  switch (outputType) {
    case "lesson_plan":
      return "teacher.lesson-plan.generation";
    case "student_note":
      return "teacher.student-note.generation";
    case "assignment":
      return "teacher.assignment.generation";
  }
}

function promptClassForDraftMode(
  draftMode: AssessmentDraftMode,
  questionStyle?: string
): string {
  return `teacher.question-bank.${draftMode}${questionStyle ? `.${questionStyle}` : ""}`;
}

function sourcePromptMaterialsFromLessonPlan(
  workspace: LessonPlanWorkspace,
  excerpts: SourceExcerptSummary[]
): DocumentSourceMaterialSummary[] {
  const excerptByMaterialId = new Map(
    excerpts.map((excerpt) => [String(excerpt.materialId), excerpt.excerptText])
  );
  return workspace.selectedSources.map((source) => ({
    id: source._id,
    title: source.title,
    sourceType: source.sourceType,
    visibility: source.visibility,
    description: source.description ?? undefined,
    topicLabel: source.topicLabel,
    excerpt: excerptByMaterialId.get(String(source._id)),
  }));
}

function sourcePromptMaterialsFromAssessment(
  workspace: AssessmentWorkspace
): DocumentSourceMaterialSummary[] {
  return workspace.selectedSources.map((source) => ({
    id: source._id,
    title: source.title,
    sourceType: source.sourceType,
    visibility: source.visibility,
    description: source.description ?? undefined,
    topicLabel: source.topicLabel,
  }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Indirection wrapper around `generateObject` to avoid a TypeScript "Type
// instantiation is excessively deep" error. The `ai` v6 SDK has deeply
// overloaded call signatures, and the Zod schemas we pass contain recursive
// refinements that blow past TS's recursion limit when the call is inlined
// with literal-typed arguments. Hiding the call behind a generic helper
// gives TS a single, opaque target to type-check against.
//
// The schema is accepted as `unknown` and then cast at the call site; this
// preserves type safety on the caller side (each `generateObject` invocation
// still receives a specific, statically-known Zod contract) while preventing
// TS from recursing into the AI SDK's overloaded signatures here.
async function callGenerateObject(
  model: ReturnType<typeof createDocumentModel>,
  schema: unknown,
  system: string | undefined,
  prompt: string
): Promise<unknown> {
  return await generateObject({
    model,
    schema: schema as Parameters<typeof generateObject>[0] extends infer T
      ? T extends { schema?: infer S }
        ? S
        : never
      : never,
    ...(system ? { system } : {}),
    prompt,
  });
}

function isSchemaMismatchNoObjectError(
  error: unknown
): error is NoObjectGeneratedError & { text: string } {
  if (!NoObjectGeneratedError.isInstance(error)) {
    return false;
  }
  const candidate = error as NoObjectGeneratedError & { text?: unknown };
  return (
    candidate.message.includes("response did not match schema") &&
    typeof candidate.text === "string" &&
    candidate.text.trim().length > 0
  );
}

function getRetryDelayMs(
  attempt: number,
  kind: "rate_limit" | "transient_provider"
): number {
  const base = kind === "rate_limit" ? 2_000 : 1_000;
  return Math.min(30_000, base * 2 ** Math.max(0, attempt - 1));
}

function providerStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const value = (error as { statusCode?: unknown }).statusCode;
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function getConvexFriendlyErrorMessage(
  error: unknown,
  args: { outputType: DocumentOutputType; modelId: string }
): string {
  const message = error instanceof Error ? error.message : String(error);
  const target = `${args.outputType.replaceAll("_", " ")} model (${args.modelId})`;

  const statusCode = providerStatusCode(error);
  if (typeof statusCode === "number") {
    if (statusCode === 429) {
      return `The AI provider is rate-limiting the ${target} right now. Please wait a moment and try again.`;
    }
    if (statusCode >= 500) {
      return `The AI provider returned a temporary error for the ${target}. Please try again, or switch models if it keeps happening.`;
    }
    if (statusCode === 401 || statusCode === 403) {
      return `The AI provider rejected the ${target} request for authentication. Check the configured OPENROUTER_API_KEY.`;
    }
    if (statusCode === 404) {
      return `The ${target} is unavailable on the provider. Choose a different model.`;
    }
    return `The AI provider rejected the ${target} request (status ${statusCode}). Try a different model.`;
  }

  if (
    NoObjectGeneratedError.isInstance(error) ||
    (error instanceof Error && error.name === "TypeValidationError")
  ) {
    return `The ${target} returned output that could not be shaped into the school template. Please try again.`;
  }

  return message || "Generation failed.";
}

async function generateTemplateObject(
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: string; prompt?: string }
): Promise<GenerateObjectResult<TemplateBoundInstructionDraft>> {
  const system = prompt.system;
  const promptText = prompt.prompt ?? "";

  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await callGenerateObject(
        model,
        templateBoundInstructionDraftSchema,
        system,
        promptText
      );
      return result as GenerateObjectResult<TemplateBoundInstructionDraft>;
    } catch (error) {
      const statusCode = providerStatusCode(error);
      const retryable = statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500);
      if (attempt < MAX_PROVIDER_RETRY_ATTEMPTS && retryable) {
        const kind: "rate_limit" | "transient_provider" =
          statusCode === 429 ? "rate_limit" : "transient_provider";
        await sleep(getRetryDelayMs(attempt + 1, kind));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Generation failed after provider retry.");
}

async function generateAssessmentObject(
  outputType: AssessmentOutputType,
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: string; prompt?: string }
): Promise<GenerateObjectResult<QuestionBankDraft | CbtDraft>> {
  const system = prompt.system;
  const promptText = prompt.prompt ?? "";
  const schema = outputType === "question_bank_draft" ? questionBankDraftSchema : cbtDraftSchema;

  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await callGenerateObject(model, schema, system, promptText);
      return result as GenerateObjectResult<QuestionBankDraft | CbtDraft>;
    } catch (error) {
      const statusCode = providerStatusCode(error);
      const retryable = statusCode === 429 || (typeof statusCode === "number" && statusCode >= 500);
      if (attempt < MAX_PROVIDER_RETRY_ATTEMPTS && retryable) {
        const kind: "rate_limit" | "transient_provider" =
          statusCode === 429 ? "rate_limit" : "transient_provider";
        await sleep(getRetryDelayMs(attempt + 1, kind));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Generation failed after provider retry.");
}

async function generateAssessmentObjectWithRepair(
  outputType: AssessmentOutputType,
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: string; prompt?: string }
): Promise<GenerateObjectResult<QuestionBankDraft | CbtDraft>> {
  try {
    return await generateAssessmentObject(outputType, model, prompt);
  } catch (error) {
    if (!isSchemaMismatchNoObjectError(error)) {
      throw error;
    }
    const repairSystem = [
      prompt.system,
      "You are repairing a prior AI response for strict JSON schema validation. Return only valid structured data.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const repairPrompt = [
      "Repair the failed structured-generation response so it exactly matches the requested JSON schema.",
      "Do not add new questions or change educational intent unless required to satisfy the schema.",
      "Coerce obvious type issues only, such as numeric strings to numbers, missing arrays to arrays, and enum casing to valid values.",
      "Return only the repaired object for the schema. No markdown or commentary.",
      `Output type: ${outputType}`,
      "",
      "Original generation prompt:",
      typeof prompt.prompt === "string" ? prompt.prompt : "",
      "",
      "Failed response to repair:",
      error.text.slice(0, MAX_SCHEMA_REPAIR_INPUT_CHARS),
    ].join("\n\n");
    return await generateAssessmentObject(outputType, model, {
      system: repairSystem,
      prompt: repairPrompt,
    });
  }
}

function normalizeMix(mix: QuestionMix): QuestionMix {
  return {
    multiple_choice: Math.max(0, Math.min(60, Math.trunc(mix.multiple_choice))),
    short_answer: Math.max(0, Math.min(60, Math.trunc(mix.short_answer))),
    essay: Math.max(0, Math.min(60, Math.trunc(mix.essay))),
    true_false: Math.max(0, Math.min(60, Math.trunc(mix.true_false))),
    fill_in_the_blank: Math.max(0, Math.min(60, Math.trunc(mix.fill_in_the_blank))),
  };
}

function normalizeSettingsForAction(
  settings: EffectiveGenerationSettings
): EffectiveGenerationSettings {
  const questionMix = normalizeMix(settings.questionMix);
  const totalQuestions = Object.values(questionMix).reduce((sum, value) => sum + value, 0);
  if (totalQuestions < 1) {
    throw new Error("At least one generated question is required.");
  }
  return { ...settings, questionMix, totalQuestions };
}

function sameGenerationSettingsShape(
  a: EffectiveGenerationSettings,
  b: EffectiveGenerationSettings
): boolean {
  return (
    a.questionStyle === b.questionStyle &&
    a.totalQuestions === b.totalQuestions &&
    a.questionMix.multiple_choice === b.questionMix.multiple_choice &&
    a.questionMix.short_answer === b.questionMix.short_answer &&
    a.questionMix.essay === b.questionMix.essay &&
    a.questionMix.true_false === b.questionMix.true_false &&
    a.questionMix.fill_in_the_blank === b.questionMix.fill_in_the_blank
  );
}

function resolveEffectiveGenerationSettingsForAction(args: {
  requested: EffectiveGenerationSettings;
  profiles: AssessmentWorkspace["profiles"];
}): EffectiveGenerationSettings {
  const normalizedRequested = normalizeSettingsForAction(args.requested);
  const activeProfiles = args.profiles.filter((profile) => profile.isActive);
  const activeDefaultProfile = activeProfiles.find((profile) => profile.isDefault) ?? null;

  if (!normalizedRequested.profileId) {
    if (!activeDefaultProfile) {
      return normalizedRequested;
    }

    const defaultSettings = normalizeSettingsForAction({
      profileId: activeDefaultProfile._id,
      profileName: activeDefaultProfile.name,
      questionStyle: activeDefaultProfile.questionStyle,
      totalQuestions: activeDefaultProfile.totalQuestions,
      questionMix: activeDefaultProfile.questionMix,
      allowTeacherOverrides: activeDefaultProfile.allowTeacherOverrides,
    });

    if (!activeDefaultProfile.allowTeacherOverrides) {
      return defaultSettings;
    }

    if (sameGenerationSettingsShape(normalizedRequested, defaultSettings)) {
      return defaultSettings;
    }

    return {
      ...normalizedRequested,
      overrideReason: normalizedRequested.overrideReason ?? "teacher_override",
    };
  }

  const profile = activeProfiles.find((item) => item._id === normalizedRequested.profileId);
  if (!profile) {
    throw new Error("Assessment generation profile not found.");
  }

  const profileSettings = normalizeSettingsForAction({
    profileId: profile._id,
    profileName: profile.name,
    questionStyle: profile.questionStyle,
    totalQuestions: profile.totalQuestions,
    questionMix: profile.questionMix,
    allowTeacherOverrides: profile.allowTeacherOverrides,
  });

  if (!profile.allowTeacherOverrides) {
    return profileSettings;
  }

  return {
    ...normalizedRequested,
    profileId: profile._id,
    profileName: profile.name,
    allowTeacherOverrides: profile.allowTeacherOverrides,
    overrideReason: !sameGenerationSettingsShape(normalizedRequested, profileSettings)
      ? normalizedRequested.overrideReason ?? "teacher_override"
      : undefined,
  };
}

function expandQuestionTypePlan(settings: EffectiveGenerationSettings): QuestionTypeKey[] {
  const plan: QuestionTypeKey[] = [];
  const mix = settings.questionMix;
  for (const questionType of [
    "multiple_choice",
    "true_false",
    "fill_in_the_blank",
    "short_answer",
    "essay",
  ] as const) {
    const count = Math.max(0, Math.trunc(mix[questionType]));
    for (let i = 0; i < count; i += 1) {
      plan.push(questionType);
    }
  }
  return plan;
}

function defaultQuestionTypeForMode(draftMode: AssessmentDraftMode): AssessmentQuestionType {
  if (draftMode === "exam_draft") {
    return "multiple_choice";
  }
  return "short_answer";
}

function assertGeneratedQuestionCount(args: {
  expected: number;
  actual: number;
  outputType: AssessmentOutputType;
}): void {
  if (args.actual !== args.expected) {
    const kind = args.outputType === "cbt_draft" ? "CBT draft" : "question bank";
    throw new Error(
      `The generated ${kind} returned ${args.actual} question${args.actual === 1 ? "" : "s"}, but ${args.expected} were requested.`
    );
  }
}

function mapQuestionBankDraft(
  draftMode: AssessmentDraftMode,
  generated: QuestionBankDraft,
  settings: EffectiveGenerationSettings
): {
  title: string;
  description: string | null;
  items: Array<{
    id: string;
    itemOrder: number;
    questionType: AssessmentQuestionType;
    difficulty: QuestionDifficulty;
    promptText: string;
    answerText: string;
    explanationText: string;
    marks: number;
    tags: string[];
  }>;
} {
  const questionTypePlan = expandQuestionTypePlan(settings);
  const defaultQuestionType = defaultQuestionTypeForMode(draftMode);
  return {
    title: generated.title,
    description: generated.blueprint,
    items: generated.questions.map((question, index) => ({
      id: `q-${question.number}`,
      itemOrder: question.number - 1,
      questionType: questionTypePlan[index] ?? defaultQuestionType,
      difficulty: question.difficulty,
      promptText: question.prompt,
      answerText: question.answer,
      explanationText: question.explanation,
      marks: question.marks,
      tags: question.tags,
    })),
  };
}

function mapCbtDraft(
  draftMode: AssessmentDraftMode,
  generated: CbtDraft,
  settings: EffectiveGenerationSettings
): {
  title: string;
  description: string | null;
  items: Array<{
    id: string;
    itemOrder: number;
    questionType: AssessmentQuestionType;
    difficulty: QuestionDifficulty;
    promptText: string;
    answerText: string;
    explanationText: string;
    marks: number;
    tags: string[];
  }>;
} {
  const questionTypePlan = expandQuestionTypePlan(settings);
  const defaultQuestionType = defaultQuestionTypeForMode(draftMode);
  const items: Array<{
    id: string;
    itemOrder: number;
    questionType: AssessmentQuestionType;
    difficulty: QuestionDifficulty;
    promptText: string;
    answerText: string;
    explanationText: string;
    marks: number;
    tags: string[];
  }> = [];
  let itemOrder = 0;
  generated.sections.forEach((section, sectionIndex) => {
    section.questions.forEach((question) => {
      const currentOrder = itemOrder;
      itemOrder += 1;
      items.push({
        id: `s${sectionIndex + 1}-q${question.number}`,
        itemOrder: currentOrder,
        questionType: questionTypePlan[currentOrder] ?? defaultQuestionType,
        difficulty: question.difficulty,
        promptText: `${section.title}: ${question.prompt}`,
        answerText: question.answer,
        explanationText: question.explanation,
        marks: question.marks,
        tags: Array.from(new Set([section.title, ...question.tags])),
      });
    });
  });
  return {
    title: generated.title,
    description: `${generated.examMode} • ${generated.timeLimitMinutes} minutes • ${generated.instructions.join(" ")}`,
    items,
  };
}

function generationSettingConstraints(settings: EffectiveGenerationSettings): string[] {
  const mix = settings.questionMix;
  const openEndedCount = mix.short_answer + mix.essay;
  const objectiveCount = mix.multiple_choice + mix.true_false + mix.fill_in_the_blank;
  const base: string[] = [
    `Generate exactly ${settings.totalQuestions} questions with this mix: ${mix.multiple_choice} multiple choice, ${mix.true_false} true/false, ${mix.fill_in_the_blank} fill-in-the-blank, ${mix.short_answer} short answer, and ${mix.essay} essay/open-ended.`,
    `Question-style direction: ${settings.questionStyle.replace(/_/g, " ")}.`,
  ];
  switch (settings.questionStyle) {
    case "open_ended_heavy":
      base.push(
        `Favor open-ended reasoning and written responses (${openEndedCount} open-ended vs ${objectiveCount} objective). Do not collapse these into pure CBT/objective output.`
      );
      break;
    case "mixed_open_ended":
      base.push(
        "Use a mixed format where open-ended prompts are prominent but objective checks still appear where requested."
      );
      break;
    case "objective_heavy":
      base.push(
        "Favor objective items while preserving any requested short-answer or essay counts."
      );
      break;
    default:
      base.push("Keep a balanced blend of objective and open-ended checks.");
  }
  return base;
}

function buildLessonPlanSourceSelectionSnapshot(args: {
  outputType: LessonPlanOutputType;
  sourceIds: ReadonlyArray<string>;
  subjectId: string | null;
  level: string | null;
  topicLabel: string | null;
  templateId: string | null;
  templateResolutionPath: string | null;
}): string {
  return JSON.stringify({
    outputType: args.outputType,
    sourceIds: args.sourceIds,
    sourceCount: args.sourceIds.length,
    primarySubjectId: args.subjectId,
    primaryLevel: args.level,
    primaryTopicLabel: args.topicLabel,
    templateId: args.templateId,
    templateResolutionPath: args.templateResolutionPath,
  });
}

function buildAssessmentSourceSelectionSnapshot(args: {
  draftMode: AssessmentDraftMode;
  outputType: AssessmentOutputType;
  sourceIds: ReadonlyArray<string>;
  subjectId: string | null;
  level: string | null;
  topicLabel: string | null;
}): string {
  return JSON.stringify({
    draftMode: args.draftMode,
    outputType: args.outputType,
    sourceIds: args.sourceIds,
    sourceCount: args.sourceIds.length,
    primarySubjectId: args.subjectId,
    primaryLevel: args.level,
    primaryTopicLabel: args.topicLabel,
  });
}

function assertStaffGenerationAccess(role: string, isSchoolAdmin: boolean): void {
  if (role !== "teacher" && role !== "admin" && !isSchoolAdmin) {
    throw new ConvexError("Teacher generation is restricted to staff");
  }
}

function buildPromptForLessonPlanOutputType(
  outputType: LessonPlanOutputType,
  context: DocumentPromptContext
): { system: string; prompt: string } {
  const prompt =
    outputType === "lesson_plan"
      ? buildLessonPlanPrompt(context)
      : outputType === "student_note"
        ? buildStudentNotePrompt(context)
        : buildAssignmentPrompt(context);
  return narrowPrompt(prompt);
}

function buildPromptForAssessmentOutputType(
  outputType: AssessmentOutputType,
  context: DocumentPromptContext
): { system: string; prompt: string } {
  const prompt =
    outputType === "question_bank_draft"
      ? buildQuestionBankDraftPrompt(context)
      : buildCbtDraftPrompt(context);
  return narrowPrompt(prompt);
}

function narrowPrompt(prompt: {
  system?: unknown;
  prompt?: unknown;
}): { system: string; prompt: string } {
  const system = typeof prompt.system === "string" ? prompt.system : "";
  const userPrompt = typeof prompt.prompt === "string" ? prompt.prompt : "";
  return { system, prompt: userPrompt };
}

function narrowRepairPrompt(prompt: {
  system?: unknown;
  prompt?: unknown;
}): { system: string; prompt: string } {
  return narrowPrompt(prompt);
}

function buildRelatedArtifactsSummary(
  artifacts: RelatedInstructionArtifactRecord[]
): RelatedInstructionArtifactSummary[] {
  return artifacts.map((artifact) => ({
    outputType: artifact.outputType,
    title: artifact.title,
    plainText: artifact.plainText,
    updatedAt: artifact.updatedAt,
  }));
}

function normalizeLessonPlanSnapshotTopicLabel(args: {
  workspace: LessonPlanWorkspace;
  targetTopicLabel: string | null;
}): string | null {
  if (args.workspace.planningContext?.topicTitle) {
    return args.workspace.planningContext.topicTitle;
  }
  if (args.targetTopicLabel) {
    return args.targetTopicLabel;
  }
  return args.workspace.sourceContext.topicLabel;
}

function normalizeAssessmentSnapshotTopicLabel(args: {
  workspace: AssessmentWorkspace;
  targetTopicLabel: string | null;
}): string | null {
  const planningContext = args.workspace.planningContext;
  if (planningContext?.kind === "topic") {
    return (
      planningContext.topicTitle ??
      args.targetTopicLabel ??
      args.workspace.sourceContext.topicLabel
    );
  }
  return args.targetTopicLabel ?? args.workspace.sourceContext.topicLabel;
}

function assessmentPromptTopicLabel(args: {
  workspace: AssessmentWorkspace;
  fallbackTopicLabel: string | null;
}): string | undefined {
  const planningContext = args.workspace.planningContext;
  if (planningContext?.kind === "exam_scope") {
    if (planningContext.scopeKind === "topic_subset") {
      return planningContext.topicTitles.length > 0
        ? planningContext.topicTitles.join(", ")
        : "Selected topic subset";
    }
    return undefined;
  }
  return args.fallbackTopicLabel ?? undefined;
}

function lessonPlanSubjectId(workspace: LessonPlanWorkspace): Id<"subjects"> | null {
  return workspace.planningContext?.subjectId ?? workspace.sourceContext.subjectId;
}

function assessmentSubjectId(workspace: AssessmentWorkspace): Id<"subjects"> | null {
  return workspace.planningContext?.subjectId ?? workspace.sourceContext.subjectId;
}

function lessonPlanLevel(workspace: LessonPlanWorkspace): string | null {
  return workspace.planningContext?.level ?? workspace.sourceContext.level;
}

function assessmentLevel(workspace: AssessmentWorkspace): string | null {
  return workspace.planningContext?.level ?? workspace.sourceContext.level;
}

function lessonPlanSubjectName(workspace: LessonPlanWorkspace): string | null {
  return workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName;
}

function assessmentSubjectName(workspace: AssessmentWorkspace): string | null {
  return workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName;
}

async function requireStaffGenerationContext(ctx: ActionCtx) {
  const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, {});
  if (!viewer) {
    throw new ConvexError("Unauthorized");
  }
  assertStaffGenerationAccess(viewer.role, viewer.isSchoolAdmin);
  return {
    userId: viewer.appUserId as Id<"users">,
    schoolId: viewer.schoolId as Id<"schools">,
    role: viewer.role,
    isSchoolAdmin: viewer.isSchoolAdmin,
  };
}

function ensureAiRunLogId(value: Id<"aiRunLogs"> | null): Id<"aiRunLogs"> {
  if (!value) {
    throw new ConvexError("AI run log was not created");
  }
  return value;
}

function enforceRateLimit(result: RateLimitResult): void {
  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    throw new ConvexError(
      `Rate limit exceeded. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`
    );
  }
}

export const generateTeacherLessonPlanDraft = action({
  args: {
    outputType: lessonPlanOutputTypeValidator,
    sourceIds: v.array(v.id("knowledgeMaterials")),
    targetTopicLabel: v.optional(v.string()),
    planningContext: planningContextValidator,
  },
  returns: lessonPlanGenerationResultValidator,
  handler: async (ctx, args): Promise<LessonPlanGenerationResultShape> => {
    await requireStaffGenerationContext(ctx);

    const requestedSourceIds = normalizeSourceIds(args.sourceIds.map((id) => String(id)));
    if (requestedSourceIds.length > MAX_GENERATION_SOURCE_COUNT) {
      throw new ConvexError(
        `Select at most ${MAX_GENERATION_SOURCE_COUNT} source materials for generation.`
      );
    }

    const workspace = (await ctx.runQuery(
      api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace,
      {
        outputType: args.outputType,
        sourceIds: requestedSourceIds as Array<Id<"knowledgeMaterials">>,
        planningContext:
          args.planningContext?.kind === "topic" ? args.planningContext : undefined,
      }
    )) as LessonPlanWorkspace;

    if (!workspace.canGenerate) {
      throw new ConvexError(
        workspace.warnings[0] ?? "Generation is blocked for the current source selection."
      );
    }

    const effectiveTopicLabel = normalizeLessonPlanSnapshotTopicLabel({
      workspace,
      targetTopicLabel: args.targetTopicLabel?.trim() || null,
    });

    if (!effectiveTopicLabel) {
      throw new ConvexError(
        "Add a target topic before generating from broad planning sources."
      );
    }

    const effectiveSubjectId = lessonPlanSubjectId(workspace);
    const effectiveSubjectName = lessonPlanSubjectName(workspace);
    const effectiveLevel = lessonPlanLevel(workspace);

    if (!effectiveSubjectId || !effectiveLevel) {
      throw new ConvexError(
        "The selected sources did not resolve a valid subject and level for generation."
      );
    }

    if (!workspace.template) {
      throw new ConvexError(
        "No active template resolved for this lesson-planning context. Ask an admin to set a template first."
      );
    }

    const sourceExcerptBundle = (await ctx.runQuery(
      api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionSourceExcerpts,
      {
        outputType: args.outputType,
        sourceIds: requestedSourceIds as Array<Id<"knowledgeMaterials">>,
        planningContext:
          args.planningContext?.kind === "topic" ? args.planningContext : undefined,
        targetTopicLabel: effectiveTopicLabel,
      }
    )) as SourceExcerptBundle;

    if (sourceExcerptBundle.excerpts.length === 0) {
      throw new ConvexError(
        sourceExcerptBundle.warnings[0] ??
          "No usable source text was found for the selected materials. Re-upload or reprocess the materials, then try again."
      );
    }

    const rateLimit = (await ctx.runMutation(
      api.functions.academic.lessonKnowledgeRateLimits.consumeTeacherLessonPlanGenerationLimit,
      {}
    )) as RateLimitResult;
    enforceRateLimit(rateLimit);

    const modelId = resolveDocumentModelId(args.outputType);
    const providerName = resolveDocumentProviderName();
    const promptClass = promptClassForOutputType(args.outputType);

    const sourceSelectionSnapshot = buildLessonPlanSourceSelectionSnapshot({
      outputType: args.outputType,
      sourceIds: requestedSourceIds,
      subjectId: effectiveSubjectId ? String(effectiveSubjectId) : null,
      level: effectiveLevel,
      topicLabel: effectiveTopicLabel,
      templateId: workspace.template._id ? String(workspace.template._id) : null,
      templateResolutionPath: workspace.template.resolutionPath ?? null,
    });

    const startedAt = Date.now();

    const runningLogId = ensureAiRunLogId(
      (await ctx.runMutation(
        api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun,
        {
          outputType: args.outputType,
          promptClass,
          status: "running",
          model: modelId,
          provider: providerName,
          sourceSelectionSnapshot,
          sourceCount: requestedSourceIds.length,
          startedAt,
        }
      )) as Id<"aiRunLogs"> | null
    );

    try {
      const model = createDocumentModel(args.outputType);
      const sourceMaterials = sourcePromptMaterialsFromLessonPlan(workspace, sourceExcerptBundle.excerpts);
      const templateSections: ResolvedTemplateSection[] = workspace.template
        ? workspace.template.sectionDefinitions
            .slice()
            .sort((a, b) => a.order - b.order)
        : [];

      const revisionNotes =
        workspace.draft.artifactId && workspace.template?.title
          ? `Refresh the current draft while preserving the teacher's working title.`
          : undefined;

      const promptContext: DocumentPromptContext = {
        schoolName: workspace.schoolName ?? undefined,
        subject: effectiveSubjectName ?? undefined,
        level: effectiveLevel ?? undefined,
        topic: effectiveTopicLabel ?? undefined,
        templateName: workspace.template?.title,
        templateSections,
        sourceMaterials,
        relatedInstructionArtifacts: buildRelatedArtifactsSummary(workspace.relatedInstructionArtifacts),
        constraints: [
          `Use at least ${workspace.template?.objectiveMinimums.minimumSourceMaterials ?? 1} source materials.`,
          `Cover the required sections in this exact order: ${templateSections.map((section) => section.label).join(", ")}.`,
          "Do not replace the resolved template with a generic lesson-plan, student-note, or assignment outline.",
          args.outputType === "student_note"
            ? "If a related lesson plan draft is available, use it to enrich the student note with the teacher's planned objectives, explanations, examples, and classroom emphasis."
            : args.outputType === "assignment"
              ? "If related lesson-plan or student-note drafts are available, align the assignment with their objectives, explanations, examples, evaluation points, and classroom activities."
              : "Use the resolved lesson-planning context and selected source materials as the grounding basis.",
        ],
        ...(revisionNotes ? { revisionNotes } : {}),
      };

      const basePrompt = buildPromptForLessonPlanOutputType(args.outputType, promptContext);

      let result: GenerateObjectResult<TemplateBoundInstructionDraft>;
      let repaired = false;
      let validationIssues: string[] = [];

      try {
        result = await generateTemplateObject(model, basePrompt);
      } catch (generationError) {
        if (!NoObjectGeneratedError.isInstance(generationError) || MAX_TEMPLATE_REPAIR_ATTEMPTS < 1) {
          throw generationError;
        }
        const failed = generationError as NoObjectGeneratedError & { text?: string };
        validationIssues = [
          "The model returned text that was not parseable as the required JSON object.",
          "Return only a complete JSON object with title, subject, level, topic, sections, and sourceNotes.",
        ];
        repaired = true;
        const repairPrompt = buildTemplateRepairPrompt({
          originalPrompt: basePrompt.prompt ?? "",
          previousDraft: (failed.text ?? failed.message).slice(0, MAX_FAILED_RESPONSE_REPAIR_CHARS),
          validationErrors: validationIssues,
          templateSections,
        });
        result = await generateTemplateObject(model, narrowRepairPrompt(repairPrompt));
      }

      let generatedObject: TemplateBoundInstructionDraft;
      try {
        generatedObject = normalizeGeneratedTemplateDraft(
          result.object,
          templateSections,
          effectiveTopicLabel
        );
      } catch (validationError) {
        if (
          !(validationError instanceof TemplateDraftValidationError) ||
          MAX_TEMPLATE_REPAIR_ATTEMPTS < 1 ||
          repaired
        ) {
          throw validationError;
        }
        validationIssues = validationError.issues;
        repaired = true;
        const repairPrompt = buildTemplateRepairPrompt({
          originalPrompt: basePrompt.prompt ?? "",
          previousDraft: result.object,
          validationErrors: validationIssues,
          templateSections,
        });
        result = await generateTemplateObject(model, narrowRepairPrompt(repairPrompt));
        generatedObject = normalizeGeneratedTemplateDraft(
          result.object,
          templateSections,
          effectiveTopicLabel
        );
      }

      const documentState = renderGeneratedMarkdown(generatedObject);
      const plainText = markdownToPlainText(documentState);
      const usage = result.usage as { inputTokens?: number; outputTokens?: number } | undefined;

      const saveResult = (await ctx.runMutation(
        api.functions.academic.lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft,
        {
          artifactId: workspace.draft.artifactId ?? null,
          outputType: args.outputType,
          title: generatedObject.title,
          documentState,
          plainText,
          sourceIds: requestedSourceIds as Array<Id<"knowledgeMaterials">>,
          subjectId: effectiveSubjectId,
          level: effectiveLevel,
          topicLabel: effectiveTopicLabel,
          planningContext:
            args.planningContext?.kind === "topic" ? args.planningContext : undefined,
          revisionKind: "generated",
        }
      )) as LessonPlanSaveResult;

      const finishedAt = Date.now();

      await ctx.runMutation(
        api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun,
        {
          outputType: args.outputType,
          promptClass,
          status: "succeeded",
          model: modelId,
          provider: providerName,
          targetArtifactId: saveResult.artifactId,
          sourceSelectionSnapshot,
          sourceCount: requestedSourceIds.length,
          tokenPromptCount: usage?.inputTokens,
          tokenCompletionCount: usage?.outputTokens,
          finishedAt,
        }
      );

      return {
        artifactId: String(saveResult.artifactId),
        documentId: String(saveResult.documentId),
        revisionId: String(saveResult.revisionId),
        revisionNumber: saveResult.revisionNumber,
        title: saveResult.title,
        documentState: saveResult.documentState,
        plainText: saveResult.plainText,
        outputType: saveResult.outputType,
        sourceIds: saveResult.sourceIds.map((id) => String(id)),
        sourceSelectionSnapshot: saveResult.sourceSelectionSnapshot,
        templateId: saveResult.templateId ? String(saveResult.templateId) : null,
        templateResolutionPath: saveResult.templateResolutionPath,
        savedAt: saveResult.savedAt,
        generationMeta: {
          attempts: repaired ? 2 : 1,
          repaired,
          validationIssues,
          sourceExcerptWarnings: sourceExcerptBundle.warnings,
          aiRunLogId: String(runningLogId),
        },
      };
    } catch (error) {
      const finishedAt = Date.now();
      const failureMessage = getConvexFriendlyErrorMessage(error, {
        outputType: args.outputType,
        modelId,
      });

      try {
        await ctx.runMutation(
          api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun,
          {
            outputType: args.outputType,
            promptClass,
            status: "failed",
            model: modelId,
            provider: providerName,
            sourceSelectionSnapshot: buildLessonPlanSourceSelectionSnapshot({
              outputType: args.outputType,
              sourceIds: requestedSourceIds,
              subjectId: null,
              level: null,
              topicLabel: null,
              templateId: null,
              templateResolutionPath: null,
            }),
            sourceCount: requestedSourceIds.length,
            errorMessage: failureMessage,
            errorCode: error instanceof Error ? error.name : "generation_failed",
            finishedAt,
          }
        );
      } catch (secondaryErr) {
        console.error("[documentGeneration] Failed to record AI run failure:", secondaryErr);
      }

      throw new ConvexError(failureMessage);
    }
  },
});

export const generateTeacherAssessmentDraft = action({
  args: {
    draftMode: draftModeValidator,
    sourceIds: v.array(v.id("knowledgeMaterials")),
    targetTopicLabel: v.optional(v.string()),
    planningContext: planningContextValidator,
    effectiveGenerationSettings: v.optional(effectiveGenerationSettingsValidator),
  },
  returns: assessmentBankGenerationResultValidator,
  handler: async (ctx, args): Promise<AssessmentBankGenerationResultShape> => {
    await requireStaffGenerationContext(ctx);

    const requestedSourceIds = normalizeSourceIds(args.sourceIds.map((id) => String(id)));
    if (requestedSourceIds.length > MAX_GENERATION_SOURCE_COUNT) {
      throw new ConvexError(
        `Select at most ${MAX_GENERATION_SOURCE_COUNT} source materials for generation.`
      );
    }

    const outputType: AssessmentOutputType =
      args.draftMode === "exam_draft" ? "cbt_draft" : "question_bank_draft";

    const workspace = (await ctx.runQuery(
      api.functions.academic.lessonKnowledgeAssessmentDrafts.getTeacherAssessmentBankWorkspace,
      {
        draftMode: args.draftMode,
        sourceIds: requestedSourceIds as Array<Id<"knowledgeMaterials">>,
        planningContext:
          args.planningContext?.kind === "topic" || args.planningContext?.kind === "exam_scope"
            ? args.planningContext
            : undefined,
      }
    )) as AssessmentWorkspace;

    if (!workspace.canGenerate) {
      throw new ConvexError(
        workspace.warnings[0] ?? "Generation is blocked for the current source selection."
      );
    }

    const requestedSettings =
      args.effectiveGenerationSettings ?? workspace.draft.effectiveGenerationSettings;
    if (!requestedSettings) {
      throw new ConvexError("Assessment generation settings are required.");
    }

    const effectiveGenerationSettings = resolveEffectiveGenerationSettingsForAction({
      requested: requestedSettings,
      profiles: workspace.profiles,
    });

    const effectiveTopicLabel = normalizeAssessmentSnapshotTopicLabel({
      workspace,
      targetTopicLabel: args.targetTopicLabel?.trim() || null,
    });

    if (args.draftMode !== "exam_draft" && !effectiveTopicLabel) {
      throw new ConvexError(
        "Add a target topic before generating from broad planning sources."
      );
    }

    const effectiveSubjectId = assessmentSubjectId(workspace);
    const effectiveSubjectName = assessmentSubjectName(workspace);
    const effectiveLevel = assessmentLevel(workspace);

    if (!effectiveSubjectId || !effectiveLevel) {
      throw new ConvexError(
        "The selected sources did not resolve a valid subject and level for generation."
      );
    }

    const effectivePromptTopic = assessmentPromptTopicLabel({
      workspace,
      fallbackTopicLabel: effectiveTopicLabel,
    });

    const sourceSelectionSnapshot = buildAssessmentSourceSelectionSnapshot({
      draftMode: args.draftMode,
      outputType,
      sourceIds: requestedSourceIds,
      subjectId: effectiveSubjectId ? String(effectiveSubjectId) : null,
      level: effectiveLevel,
      topicLabel: effectiveTopicLabel,
    });

    const rateLimit = (await ctx.runMutation(
      api.functions.academic.lessonKnowledgeRateLimits.consumeTeacherAssessmentGenerationLimit,
      {}
    )) as RateLimitResult;
    enforceRateLimit(rateLimit);

    const modelId = resolveDocumentModelId(outputType);
    const providerName = resolveDocumentProviderName();
    const promptClass = promptClassForDraftMode(
      args.draftMode,
      effectiveGenerationSettings.questionStyle
    );

    const startedAt = Date.now();

    const mutationGenerationSettings = {
      ...(effectiveGenerationSettings.profileId
        ? { profileId: effectiveGenerationSettings.profileId }
        : {}),
      ...(effectiveGenerationSettings.profileName
        ? { profileName: effectiveGenerationSettings.profileName }
        : {}),
      questionStyle: effectiveGenerationSettings.questionStyle,
      totalQuestions: effectiveGenerationSettings.totalQuestions,
      questionMix: effectiveGenerationSettings.questionMix,
      allowTeacherOverrides: effectiveGenerationSettings.allowTeacherOverrides,
      ...(effectiveGenerationSettings.overrideReason
        ? { overrideReason: effectiveGenerationSettings.overrideReason }
        : {}),
    };

    const runningLogId = ensureAiRunLogId(
      (await ctx.runMutation(
        api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun,
        {
          outputType,
          promptClass,
          status: "running",
          model: modelId,
          provider: providerName,
          sourceSelectionSnapshot,
          sourceCount: requestedSourceIds.length,
          effectiveGenerationSettings: mutationGenerationSettings,
          startedAt,
        }
      )) as Id<"aiRunLogs"> | null
    );

    try {
      const model = createDocumentModel(outputType);
      const sourceMaterials = sourcePromptMaterialsFromAssessment(workspace);

      const revisionNotes = workspace.draft.bankId
        ? `Refresh the existing draft while preserving the teacher's working title: ${workspace.draft.title}`
        : undefined;

      const promptContext: DocumentPromptContext = {
        schoolName: workspace.schoolName ?? undefined,
        subject: effectiveSubjectName ?? undefined,
        level: effectiveLevel ?? undefined,
        topic: effectivePromptTopic,
        sourceMaterials,
        constraints: [
          ...generationSettingConstraints(effectiveGenerationSettings),
          ...(args.draftMode === "exam_draft"
            ? [
                "Produce a structured CBT-style draft that can be moderated later.",
                "Keep section labels concise and exam appropriate.",
              ]
            : args.draftMode === "practice_quiz"
              ? [
                  "Make the draft short, supportive, and retrieval focused.",
                  "Blend quick recall with a few understanding checks.",
                ]
              : [
                  "Balance recall, understanding, and application questions.",
                  "Keep the draft classroom-ready and editable by the teacher.",
                ]),
        ],
        ...(revisionNotes ? { revisionNotes } : {}),
      };

      const basePrompt = buildPromptForAssessmentOutputType(outputType, promptContext);

      const result = await generateAssessmentObjectWithRepair(outputType, model, basePrompt);
      const generatedObject = result.object as QuestionBankDraft | CbtDraft;

      const generatedDraft =
        outputType === "question_bank_draft"
          ? mapQuestionBankDraft(
              args.draftMode,
              generatedObject as QuestionBankDraft,
              effectiveGenerationSettings
            )
          : mapCbtDraft(
              args.draftMode,
              generatedObject as CbtDraft,
              effectiveGenerationSettings
            );

      assertGeneratedQuestionCount({
        expected: effectiveGenerationSettings.totalQuestions,
        actual: generatedDraft.items.length,
        outputType,
      });

      const usage = result.usage as { inputTokens?: number; outputTokens?: number } | undefined;

      const saveResult = (await ctx.runMutation(
        api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft,
        {
          bankId: workspace.draft.bankId ?? null,
          draftMode: args.draftMode,
          title: generatedDraft.title,
          description: generatedDraft.description,
          sourceIds: requestedSourceIds as Array<Id<"knowledgeMaterials">>,
          sourceSelectionSnapshot,
          effectiveGenerationSettings: mutationGenerationSettings,
          subjectId: effectiveSubjectId,
          level: effectiveLevel,
          topicLabel: effectiveTopicLabel,
          planningContext:
            args.planningContext?.kind === "topic" || args.planningContext?.kind === "exam_scope"
              ? args.planningContext
              : undefined,
          items: generatedDraft.items.map((item) => ({
            questionType: item.questionType,
            difficulty: item.difficulty,
            promptText: item.promptText,
            answerText: item.answerText,
            explanationText: item.explanationText,
            marks: item.marks,
            tags: item.tags,
          })),
        }
      )) as AssessmentSaveResult;

      const finishedAt = Date.now();

      await ctx.runMutation(
        api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun,
        {
          outputType,
          promptClass,
          status: "succeeded",
          model: modelId,
          provider: providerName,
          targetAssessmentBankId: saveResult.bankId,
          sourceSelectionSnapshot,
          sourceCount: requestedSourceIds.length,
          effectiveGenerationSettings: mutationGenerationSettings,
          tokenPromptCount: usage?.inputTokens,
          tokenCompletionCount: usage?.outputTokens,
          finishedAt,
        }
      );

      return {
        bankId: String(saveResult.bankId),
        title: saveResult.title,
        description: saveResult.description,
        draftMode: saveResult.draftMode,
        outputType: saveResult.outputType,
        sourceSelectionSnapshot: saveResult.sourceSelectionSnapshot,
        itemCount: saveResult.itemCount,
        savedAt: saveResult.savedAt,
        effectiveGenerationSettings: saveResult.effectiveGenerationSettings,
        items: generatedDraft.items.map((item) => ({
          id: item.id,
          itemOrder: item.itemOrder,
          questionType: item.questionType,
          difficulty: item.difficulty,
          promptText: item.promptText,
          answerText: item.answerText,
          explanationText: item.explanationText,
          marks: item.marks,
          tags: item.tags,
        })),
        generationMeta: {
          attempts: 1,
          repaired: false,
          validationIssues: [],
          aiRunLogId: String(runningLogId),
        },
      };
    } catch (error) {
      const finishedAt = Date.now();
      const errorMessage =
        error instanceof Error ? error.message : "Assessment draft generation failed.";

      try {
        await ctx.runMutation(
          api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun,
          {
            outputType,
            promptClass: promptClassForDraftMode(
              args.draftMode,
              args.effectiveGenerationSettings?.questionStyle
            ),
            status: "failed",
            model: modelId,
            provider: providerName,
            sourceSelectionSnapshot: buildAssessmentSourceSelectionSnapshot({
              draftMode: args.draftMode,
              outputType,
              sourceIds: requestedSourceIds,
              subjectId: null,
              level: null,
              topicLabel: null,
            }),
            sourceCount: requestedSourceIds.length,
            errorMessage,
            errorCode: error instanceof Error ? error.name : "generation_failed",
            finishedAt,
          }
        );
      } catch (secondaryErr) {
        console.error("[documentGeneration] Failed to record AI run failure:", secondaryErr);
      }

      throw new ConvexError(errorMessage);
    }
  },
});
