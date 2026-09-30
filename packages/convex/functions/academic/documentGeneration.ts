"use node";

import { ConvexError, v } from "convex/values";
import { createHash } from "node:crypto";
import { generateObject, NoObjectGeneratedError, zodSchema, type Schema } from "ai";
import {
  buildAssignmentPrompt,
  buildCbtDraftPrompt,
  buildLessonPlanPrompt,
  buildQuestionBankDraftPrompt,
  buildStudentNotePrompt,
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
import { api, internal } from "../../_generated/api";
import { action, type ActionCtx } from "../../_generated/server";
import { assertUsableExcerptMinimum, findObjectiveSection, renderTemplateBoundMarkdown, validateGenerationMinimums } from "./instructionGenerationRules";
import { TEACHER_PLANNING_CAPABILITIES } from "./rbac";
import type { Id } from "../../_generated/dataModel";

const MAX_GENERATION_SOURCE_COUNT = 12;
const LESSON_OUTPUT_CAP = 2048;
const MAX_ASSESSMENT_OUTPUT_CAP = 16_384;
// Reviewed single-call JSON allowance per item: prompt, answer, explanation,
// difficulty, marks, tags and schema framing. This is not a token measurement.
const ASSESSMENT_ITEM_OUTPUT_CAP = {
  multiple_choice: 320,
  short_answer: 384,
  essay: 512,
  true_false: 224,
  fill_in_the_blank: 256,
} as const;

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
  objectiveMinimums: { minimumObjectives: number; minimumSourceMaterials: number; minimumSections: number };
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
    revisionNumber: number;
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
    draftRevision: number | null;
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
  fallbackTopic: string,
  minimums: { minimumObjectives: number; minimumSections: number }
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

  issues.push(...validateGenerationMinimums(draft, templateSections, minimums));
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
  prompt: string,
  outputCap: number
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
    maxOutputTokens: outputCap,
    maxRetries: 0,
  });
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
  if (Object.values(settings.questionMix).some(value => !Number.isFinite(value))) throw new ConvexError("Question mix must contain finite counts.");
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
  const viewer = await ctx.runQuery(api.functions.auth.getViewerContext, { capabilities: [...TEACHER_PLANNING_CAPABILITIES] });
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

function enforceRateLimit(result: RateLimitResult): void {
  if (!result.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
    throw new ConvexError(
      `Rate limit exceeded. Try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}.`
    );
  }
}

// One provider call per confirmed attempt. A failed schema/template check still settles its
// measured tokens. Repair requires a new quote; no automatic provider replay is permitted.
const lessonArgs = v.object({
  outputType: lessonPlanOutputTypeValidator,
  sourceIds: v.array(v.id("knowledgeMaterials")),
  targetTopicLabel: v.optional(v.string()),
  planningContext: planningContextValidator,
});
const assessmentArgs = v.object({
  draftMode: draftModeValidator,
  sourceIds: v.array(v.id("knowledgeMaterials")),
  targetTopicLabel: v.optional(v.string()),
  planningContext: planningContextValidator,
  effectiveGenerationSettings: v.optional(effectiveGenerationSettingsValidator),
});
type LessonArgs = typeof lessonArgs.type;
type AssessmentArgs = typeof assessmentArgs.type;
type PreparedLesson = {
  kind: "lesson"; args: LessonArgs; workspace: LessonPlanWorkspace; excerpts: SourceExcerptBundle; outputCap: number;
  sourceIds: Array<Id<"knowledgeMaterials">>; subjectId: Id<"subjects">; level: string; topic: string;
  prompt: { system: string; prompt: string }; modelId: string; digest: string; minimumUnits: number;
};
type PreparedAssessment = {
  kind: "assessment"; args: AssessmentArgs; workspace: AssessmentWorkspace; settings: EffectiveGenerationSettings; outputCap: number;
  sourceIds: Array<Id<"knowledgeMaterials">>; subjectId: Id<"subjects">; level: string; topic: string | null;
  outputType: AssessmentOutputType; prompt: { system: string; prompt: string }; modelId: string; digest: string; minimumUnits: number;
};
function assessmentOutputCap(settings: EffectiveGenerationSettings, outputType: AssessmentOutputType): number {
  const base = outputType === "cbt_draft" ? 1024 : 768;
  const cap = (Object.entries(ASSESSMENT_ITEM_OUTPUT_CAP) as Array<[QuestionTypeKey, number]>)
    .reduce((sum, [type, units]) => sum + settings.questionMix[type] * units, base);
  if (!Number.isSafeInteger(cap) || cap > MAX_ASSESSMENT_OUTPUT_CAP) {
    throw new ConvexError("This assessment is too large for one reviewed AI call. Reduce the question mix, especially essays, or generate smaller drafts. Manual assessment editing remains available.");
  }
  return cap;
}
function schemaForOutput(outputType: DocumentOutputType): Schema<unknown> {
  // Keep Zod's recursive types opaque here; the same converter runs at quote and dispatch.
  const raw: unknown = outputType === "lesson_plan" || outputType === "student_note" || outputType === "assignment"
    ? templateBoundInstructionDraftSchema : outputType === "cbt_draft" ? cbtDraftSchema : questionBankDraftSchema;
  return zodSchema<unknown>(raw as Parameters<typeof zodSchema<unknown>>[0]);
}
async function boundRequest(kind: string, args: LessonArgs | AssessmentArgs, outputType: DocumentOutputType, modelId: string, outputCap: number, prompt: { system: string; prompt: string }, context: unknown) {
  // Use the SDK's own schema serialization for the quote and the provider call.
  const schema = JSON.stringify(await schemaForOutput(outputType).jsonSchema);
  const knownBytes = Buffer.byteLength(prompt.system, "utf8") + Buffer.byteLength(prompt.prompt, "utf8") + Buffer.byteLength(schema, "utf8");
  if (knownBytes > 16_000) throw new ConvexError("Prepared AI request exceeds the reviewed size limit. Select fewer sources.");
  const request = JSON.stringify({ policy: "school-document-single-call-v3", kind, args, modelId, outputCap, prompt, schema, context });
  // 16 units per serialized input byte is a conservative reviewed hold, plus
  // the bound output cap and 2048 for SDK/provider framing. OpenRouter can add
  // unseen tokens: this is NOT a guaranteed token maximum. Full verified
  // overage is recorded and blocks new quotes pending Platform review.
  return { digest: createHash("sha256").update(request).digest("hex"), minimumUnits: knownBytes * 16 + outputCap + 2048 };
}
function checkedSources(sourceIds: Array<Id<"knowledgeMaterials">>) {
  const normalized = normalizeSourceIds(sourceIds.map(String)) as Array<Id<"knowledgeMaterials">>;
  if (!normalized.length || normalized.length > MAX_GENERATION_SOURCE_COUNT) throw new ConvexError("Select 1 to 12 source materials for generation.");
  return normalized;
}
async function prepareLesson(ctx: ActionCtx, args: LessonArgs): Promise<PreparedLesson> {
  await requireStaffGenerationContext(ctx);
  const sourceIds = checkedSources(args.sourceIds);
  args = { ...args, sourceIds };
  const planningContext = args.planningContext?.kind === "topic" ? args.planningContext : undefined;
  const workspace = await ctx.runQuery(api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace,
    { outputType: args.outputType, sourceIds, planningContext }) as LessonPlanWorkspace;
  if (!workspace.canGenerate) throw new ConvexError(workspace.warnings[0] ?? "Generation blocked for the selected sources.");
  const topic = normalizeLessonPlanSnapshotTopicLabel({ workspace, targetTopicLabel: args.targetTopicLabel?.trim() || null });
  const subjectId = lessonPlanSubjectId(workspace);
  const level = lessonPlanLevel(workspace);
  if (!topic || !subjectId || !level || !workspace.template) throw new ConvexError("Select a subject, level, topic and active template before generation.");
  const excerpts = await ctx.runQuery(api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionSourceExcerpts,
    { outputType: args.outputType, sourceIds, planningContext, targetTopicLabel: topic }) as SourceExcerptBundle;
  assertUsableExcerptMinimum(excerpts.excerpts, workspace.template.objectiveMinimums.minimumSourceMaterials);
  const sections = workspace.template.sectionDefinitions.slice().sort((a, b) => a.order - b.order);
  const context: DocumentPromptContext = {
    schoolName: workspace.schoolName ?? undefined, subject: lessonPlanSubjectName(workspace) ?? undefined,
    level, topic, templateName: workspace.template.title, templateSections: sections,
    minimumObjectives: findObjectiveSection(sections) ? workspace.template.objectiveMinimums.minimumObjectives : undefined,
    minimumSections: workspace.template.objectiveMinimums.minimumSections,
    sourceMaterials: sourcePromptMaterialsFromLessonPlan(workspace, excerpts.excerpts),
    relatedInstructionArtifacts: buildRelatedArtifactsSummary(workspace.relatedInstructionArtifacts),
    constraints: [
      `Use at least ${workspace.template.objectiveMinimums.minimumSourceMaterials} source materials.`,
      `Cover the required sections in this exact order: ${sections.map(section => section.label).join(", ")}.`,
      "Do not replace the resolved template with a generic outline.",
      args.outputType === "student_note" ? "Use a related lesson plan to enrich the student note when available."
        : args.outputType === "assignment" ? "Align with related plans and notes when available."
        : "Ground the work in the selected sources and planning context.",
    ],
    ...(workspace.draft.artifactId && workspace.template.title ? { revisionNotes: "Refresh the current draft while preserving the teacher's working title." } : {}),
  };
  const prompt = buildPromptForLessonPlanOutputType(args.outputType, context);
  const modelId = resolveDocumentModelId(args.outputType);
  const outputCap = LESSON_OUTPUT_CAP;
  const bound = await boundRequest("lesson", args, args.outputType, modelId, outputCap, prompt, { workspace, excerpts });
  return { kind: "lesson", args, workspace, excerpts, sourceIds, subjectId, level, topic, prompt, modelId, outputCap, ...bound };
}
async function prepareAssessment(ctx: ActionCtx, args: AssessmentArgs): Promise<PreparedAssessment> {
  await requireStaffGenerationContext(ctx);
  const sourceIds = checkedSources(args.sourceIds);
  args = { ...args, sourceIds };
  const outputType: AssessmentOutputType = args.draftMode === "exam_draft" ? "cbt_draft" : "question_bank_draft";
  const workspace = await ctx.runQuery(api.functions.academic.lessonKnowledgeAssessmentDrafts.getTeacherAssessmentBankWorkspace,
    { draftMode: args.draftMode, sourceIds, planningContext: args.planningContext }) as AssessmentWorkspace;
  if (!workspace.canGenerate) throw new ConvexError(workspace.warnings[0] ?? "Generation blocked for the selected sources.");
  const requested = args.effectiveGenerationSettings ?? workspace.draft.effectiveGenerationSettings;
  if (!requested) throw new ConvexError("Assessment generation settings are required.");
  const settings = resolveEffectiveGenerationSettingsForAction({ requested, profiles: workspace.profiles });
  const outputCap = assessmentOutputCap(settings, outputType);
  const topic = normalizeAssessmentSnapshotTopicLabel({ workspace, targetTopicLabel: args.targetTopicLabel?.trim() || null });
  if (args.draftMode !== "exam_draft" && !topic) throw new ConvexError("Add a target topic before generation.");
  const subjectId = assessmentSubjectId(workspace);
  const level = assessmentLevel(workspace);
  if (!subjectId || !level) throw new ConvexError("Selected sources need a subject and level.");
  const context: DocumentPromptContext = {
    schoolName: workspace.schoolName ?? undefined, subject: assessmentSubjectName(workspace) ?? undefined,
    level, topic: assessmentPromptTopicLabel({ workspace, fallbackTopicLabel: topic }),
    sourceMaterials: sourcePromptMaterialsFromAssessment(workspace),
    constraints: [ ...generationSettingConstraints(settings),
      ...(args.draftMode === "exam_draft" ? ["Produce a structured CBT draft for moderation.", "Keep section labels concise."]
        : args.draftMode === "practice_quiz" ? ["Use supportive retrieval questions."]
          : ["Balance recall, understanding and application. Keep the draft editable."]) ],
    ...(workspace.draft.bankId ? { revisionNotes: `Refresh the existing draft while preserving the teacher's working title: ${workspace.draft.title}` } : {}),
  };
  const prompt = buildPromptForAssessmentOutputType(outputType, context);
  const modelId = resolveDocumentModelId(outputType);
  const bound = await boundRequest("assessment", args, outputType, modelId, outputCap, prompt, { workspace, settings });
  return { kind: "assessment", args, workspace, settings, sourceIds, subjectId, level, topic, outputType, prompt, modelId, outputCap, ...bound };
}
async function quotePrepared(ctx: ActionCtx, prepared: PreparedLesson | PreparedAssessment, key: string): Promise<{ attemptId: Id<"usageOperationAttempts">; estimate: number; modelProfile: string; expiresAt: number; status: string; availableUnits: number; remainingAfterHold: number }> {
  const viewer = await requireStaffGenerationContext(ctx);
  return await ctx.runMutation(internal.functions.academic.aiSpend.quote, {
    schoolId: viewer.schoolId, task: prepared.kind === "lesson" ? "teacher_lesson_plan" : "teacher_assessment",
    digest: prepared.digest, modelId: prepared.modelId, minimumUnits: prepared.minimumUnits,
    idempotencyKey: key,
    requestArgs: JSON.stringify({ kind: prepared.kind, args: prepared.args }),
  });
}
export const quoteTeacherLessonPlanDraft = action({
  args: { ...lessonArgs.fields, idempotencyKey: v.string() },
  handler: async (ctx, { idempotencyKey, ...args }) => quotePrepared(ctx, await prepareLesson(ctx, args), idempotencyKey),
});
export const quoteTeacherAssessmentDraft = action({
  args: { ...assessmentArgs.fields, idempotencyKey: v.string() },
  handler: async (ctx, { idempotencyKey, ...args }) => quotePrepared(ctx, await prepareAssessment(ctx, args), idempotencyKey),
});
function measured(result: unknown, attemptId: Id<"usageOperationAttempts">): { inputTokens: number; outputTokens: number; evidence: string } {
  const response = result as { usage?: { inputTokens?: number; outputTokens?: number }; response?: { id?: string } };
  const inputTokens = response.usage?.inputTokens;
  const outputTokens = response.usage?.outputTokens;
  if (!Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens) || inputTokens! < 0 || outputTokens! < 0 || !Number.isSafeInteger(inputTokens! + outputTokens!)) {
    throw new ConvexError("Provider usage is incomplete; hold requires Platform reconciliation.");
  }
  const id = response.response?.id;
  return { inputTokens: inputTokens!, outputTokens: outputTokens!, evidence: id && /^[a-zA-Z0-9:_./-]{1,150}$/.test(id) ? `provider:${id}:attempt:${attemptId}:call-1` : `attempt:${attemptId}:call-1:usage-without-response-id` };
}
function sdkFailureUsage(error: unknown, attemptId: Id<"usageOperationAttempts">) {
  // Only AI SDK's branded NoObjectGeneratedError carries usage from a completed
  // response. A generic status/error object, including 429 and 5xx, is not evidence.
  if (!NoObjectGeneratedError.isInstance(error) || !error.usage) return undefined;
  try {
    const usage = measured(error, attemptId);
    return { ...usage, evidence: `sdk:no-object:${usage.evidence}` };
  } catch {
    return undefined;
  }
}
async function runBound(ctx: ActionCtx, attemptId: Id<"usageOperationAttempts">, kind: "lesson" | "assessment"): Promise<unknown> {
  const row = await ctx.runQuery(internal.functions.academic.aiSpend.load, { attemptId }) as { requestArgs: string; digest: string; modelId: string; status: string; estimate: number };
  if (row.status !== "reserved") throw new ConvexError("Attempt is not awaiting dispatch. Check its status; never replay a claimed call.");
  // The persisted JSON contains identifiers/settings only. Re-read every source, template,
  // related artifact and effective profile before claiming; changed inputs fail closed.
  let bound: PreparedLesson | PreparedAssessment;
  try {
    const request = JSON.parse(row.requestArgs) as { kind: string; args: LessonArgs | AssessmentArgs };
    if (request.kind !== kind) throw new ConvexError("Output type changed; request a new quote.");
    bound = kind === "lesson" ? await prepareLesson(ctx, request.args as LessonArgs) : await prepareAssessment(ctx, request.args as AssessmentArgs);
    if (row.digest !== bound.digest || row.modelId !== bound.modelId || row.estimate < bound.minimumUnits) throw new ConvexError("Sources, template, settings or model changed. Cancel and request a new quote.");
  } catch (error) {
    // A preparation failure cannot have reached the provider. A cancelled hold is safe.
    await ctx.runMutation(api.functions.academic.aiSpend.cancel, { attemptId });
    throw error;
  }
  const claim = await ctx.runMutation(internal.functions.academic.aiSpend.claim, { attemptId, digest: bound.digest, modelId: bound.modelId });
  // A denied rate check cancels the still-reserved attempt and releases its
  // hold in the same transaction. A duplicate claim never debits the bucket.
  if (!claim.claimed) enforceRateLimit({ allowed: false, retryAfterMs: claim.retryAfterMs, resetAt: claim.resetAt });
  let usage: ReturnType<typeof measured> | undefined;
  let outcome: "succeeded" | "failed" = "failed";
  let generation: unknown;
  try {
    const result = await callGenerateObject(createDocumentModel(bound.kind === "lesson" ? bound.args.outputType : bound.outputType),
      schemaForOutput(bound.kind === "lesson" ? bound.args.outputType : bound.outputType),
      bound.prompt.system, bound.prompt.prompt, bound.outputCap);
    usage = measured(result, attemptId); // Capture before validating object or saving a draft.
    generation = (result as { object: unknown }).object;
    if (kind === "lesson") {
      const lesson = bound as PreparedLesson;
      normalizeGeneratedTemplateDraft(generation as TemplateBoundInstructionDraft,
        lesson.workspace.template!.sectionDefinitions.slice().sort((a, b) => a.order - b.order), lesson.topic,
        lesson.workspace.template!.objectiveMinimums);
    } else {
      const assessment = bound as PreparedAssessment;
      const draft = assessment.outputType === "cbt_draft"
        ? mapCbtDraft(assessment.args.draftMode, generation as CbtDraft, assessment.settings)
        : mapQuestionBankDraft(assessment.args.draftMode, generation as QuestionBankDraft, assessment.settings);
      assertGeneratedQuestionCount({ expected: assessment.settings.totalQuestions, actual: draft.items.length, outputType: assessment.outputType });
    }
    outcome = "succeeded";
  } catch (error) {
    // A schema failure with complete SDK response usage is measured failed work.
    // Other errors, including status codes with unverified usage, stay held.
    usage ??= sdkFailureUsage(error, attemptId);
    if (!usage) {
      await ctx.runMutation(internal.functions.academic.aiSpend.uncertain, { attemptId });
      throw new ConvexError("AI provider outcome is uncertain. No retry will run; Platform must reconcile usage.");
    }
    try {
      await ctx.runMutation(internal.functions.academic.aiSpend.settle, { attemptId, ...usage, outcome: "failed" });
    } catch {
      await ctx.runMutation(internal.functions.academic.aiSpend.uncertain, { attemptId });
      throw new ConvexError("Measured AI use could not settle. Platform must reconcile the hold.");
    }
    throw new ConvexError(getConvexFriendlyErrorMessage(error, { outputType: bound.kind === "lesson" ? bound.args.outputType : bound.outputType, modelId: bound.modelId }));
  }
  if (!usage) throw new ConvexError("Usage unavailable");
  // Stage generated content outside the accounting ledger before settling. If the action
  // stops after this write, recovery saves the same object without another provider call.
  const payload = JSON.stringify({ kind: bound.kind, args: bound.args, generation,
    sourceIds: bound.sourceIds, subjectId: bound.subjectId, level: bound.level, topic: bound.topic,
    ...(bound.kind === "lesson" ? {
      artifactId: bound.workspace.draft.artifactId, revisionNumber: bound.workspace.draft.revisionNumber,
      sections: bound.workspace.template!.sectionDefinitions, minimums: bound.workspace.template!.objectiveMinimums,
      excerptWarnings: bound.excerpts.warnings,
    } : {
      bankId: bound.workspace.draft.bankId, expectedBankRevision: bound.workspace.draft.draftRevision,
      settings: bound.settings, outputType: bound.outputType,
    }),
  });
  try {
    await ctx.runMutation(internal.functions.academic.aiSpend.stage, { attemptId, payload, ...usage });
  } catch {
    // Do not log the raw staging exception: it may contain generated content.
    // Even if the reconciliation transition fails, the claimed hold remains.
    let markedForReview = true;
    try {
      await ctx.runMutation(internal.functions.academic.aiSpend.uncertain, { attemptId });
    } catch {
      markedForReview = false;
    }
    throw new ConvexError(markedForReview
      ? "Measured provider result could not be staged. Platform must reconcile this held attempt."
      : "Measured provider result could not be staged or marked for review. The hold remains. Check attempt status and contact Platform.");
  }
  return await finishStaged(ctx, attemptId);
}

type StagedResult = {
  kind: "lesson" | "assessment";
  args: LessonArgs & AssessmentArgs;
  generation: TemplateBoundInstructionDraft & QuestionBankDraft & CbtDraft;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  subjectId: Id<"subjects">; level: string; topic: string | null;
  artifactId?: Id<"instructionArtifacts"> | null; revisionNumber?: number;
  sections?: ResolvedTemplateSection[];
  minimums?: { minimumObjectives: number; minimumSourceMaterials: number; minimumSections: number };
  excerptWarnings?: string[];
  bankId?: Id<"assessmentBanks"> | null;
  expectedBankRevision?: number | null;
  settings?: EffectiveGenerationSettings;
  outputType?: AssessmentOutputType;
};
async function finishStaged(ctx: ActionCtx, attemptId: Id<"usageOperationAttempts">): Promise<unknown> {
  const row = await ctx.runQuery(internal.functions.academic.aiSpend.staged, { attemptId }) as {
    payload: string; inputTokens: number; outputTokens: number; evidence: string; status: string; resultId: string | null;
  };
  if (row.resultId) return { resultId: row.resultId, status: "settled" };
  if (row.status === "dispatch_started" || row.status === "needs_reconciliation") {
    try {
      await ctx.runMutation(internal.functions.academic.aiSpend.settle, { attemptId, inputTokens: row.inputTokens,
        outputTokens: row.outputTokens, evidence: row.evidence, outcome: "succeeded" });
    } catch (error) {
      await ctx.runMutation(internal.functions.academic.aiSpend.uncertain, { attemptId });
      throw new ConvexError("Measured usage could not settle. Platform must reconcile the hold.");
    }
  } else if (row.status !== "settled") throw new ConvexError("Attempt cannot save this result");
  const data = JSON.parse(row.payload) as StagedResult;
  const aiRunLogId = await ctx.runQuery(internal.functions.academic.aiSpend.runLogId, { attemptId }) as Id<"aiRunLogs"> | null;
  if (data.kind === "lesson") {
    if (!data.sections || !data.minimums || !data.topic || data.revisionNumber === undefined) throw new ConvexError("Staged lesson result invalid");
    const object = normalizeGeneratedTemplateDraft(data.generation, data.sections.slice().sort((a, b) => a.order - b.order), data.topic, data.minimums);
    const documentState = renderTemplateBoundMarkdown(object);
    const saved = await ctx.runMutation(internal.functions.academic.lessonKnowledgeLessonPlans.saveGeneratedInstructionArtifactDraft, {
      attemptId, artifactId: data.artifactId ?? null, expectedRevisionNumber: data.revisionNumber,
      outputType: data.args.outputType, title: object.title, documentState, plainText: markdownToPlainText(documentState),
      sourceIds: data.sourceIds, subjectId: data.subjectId, level: data.level, topicLabel: data.topic,
      planningContext: data.args.planningContext?.kind === "topic" ? data.args.planningContext : undefined, revisionKind: "generated" as const,
    });
    return { ...saved, artifactId: String(saved.artifactId), documentId: String(saved.documentId), revisionId: String(saved.revisionId),
      sourceIds: saved.sourceIds.map(String), templateId: saved.templateId ? String(saved.templateId) : null,
      generationMeta: { attempts: 1, repaired: false, validationIssues: [], sourceExcerptWarnings: data.excerptWarnings ?? [], aiRunLogId: String(aiRunLogId ?? "") } };
  }
  // null is the intentional baseline for a new bank; an absent or malformed
  // revision is not. Keep staged content if validation fails.
  const revision = data.expectedBankRevision;
  if (data.kind !== "assessment" || !data.settings || !data.outputType || revision === undefined ||
    (revision !== null && (!Number.isSafeInteger(revision) || revision < 0)) ||
    (data.bankId ? revision === null : revision !== null)) throw new ConvexError("Staged assessment result invalid");
  const draft = data.outputType === "cbt_draft"
    ? mapCbtDraft(data.args.draftMode, data.generation, data.settings)
    : mapQuestionBankDraft(data.args.draftMode, data.generation, data.settings);
  const snapshot = buildAssessmentSourceSelectionSnapshot({ draftMode: data.args.draftMode, outputType: data.outputType,
    sourceIds: data.sourceIds.map(String), subjectId: String(data.subjectId), level: data.level, topicLabel: data.topic });
  const saved = await ctx.runMutation(internal.functions.academic.lessonKnowledgeAssessmentDrafts.saveGeneratedAssessmentBankDraft, {
    attemptId, bankId: data.bankId ?? null, expectedBankRevision: revision as number | null,
    draftMode: data.args.draftMode, title: draft.title, description: draft.description,
    sourceIds: data.sourceIds, sourceSelectionSnapshot: snapshot, subjectId: data.subjectId, level: data.level, topicLabel: data.topic,
    planningContext: data.args.planningContext,
    effectiveGenerationSettings: { ...data.settings, profileId: data.settings.profileId ?? undefined },
    items: draft.items.map(item => ({ questionType: item.questionType, difficulty: item.difficulty, promptText: item.promptText,
      answerText: item.answerText, explanationText: item.explanationText, marks: item.marks, tags: item.tags })),
  });
  return { ...saved, bankId: String(saved.bankId), items: draft.items,
    generationMeta: { attempts: 1, repaired: false, validationIssues: [], aiRunLogId: String(aiRunLogId ?? "") } };
}
export const recoverTeacherGenerationDraft = action({
  args: { attemptId: v.id("usageOperationAttempts") },
  handler: async (ctx, { attemptId }): Promise<unknown> => finishStaged(ctx, attemptId),
});
export const generateTeacherLessonPlanDraft = action({
  args: { attemptId: v.id("usageOperationAttempts") },
  handler: async (ctx, { attemptId }): Promise<unknown> => runBound(ctx, attemptId, "lesson"),
});
export const generateTeacherAssessmentDraft = action({
  args: { attemptId: v.id("usageOperationAttempts") },
  handler: async (ctx, { attemptId }): Promise<unknown> => runBound(ctx, attemptId, "assessment"),
});
