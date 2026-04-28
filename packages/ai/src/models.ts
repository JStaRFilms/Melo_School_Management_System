import { createOpenRouter } from "@openrouter/ai-sdk-provider";

import type { DocumentOutputType } from "./contracts";

const defaultLessonPlanModelId = "nvidia/nemotron-3-super-120b-a12b:free";
const defaultStudentNoteModelId = "nvidia/nemotron-3-super-120b-a12b:free";
const defaultAssignmentModelId = "nvidia/nemotron-3-super-120b-a12b:free";
const defaultQuestionBankModelId = "openai/gpt-oss-120b:free";
const defaultCbtModelId = "openai/gpt-oss-120b:free";

const documentModelEnvKeys = {
  lesson_plan: "SCHOOL_AI_LESSON_PLAN_MODEL",
  student_note: "SCHOOL_AI_STUDENT_NOTE_MODEL",
  assignment: "SCHOOL_AI_ASSIGNMENT_MODEL",
  question_bank_draft: "SCHOOL_AI_QUESTION_BANK_MODEL",
  cbt_draft: "SCHOOL_AI_CBT_MODEL",
} as const satisfies Record<DocumentOutputType, string>;

export interface DocumentAiConfig {
  readonly apiKey?: string;
  readonly headers?: Record<string, string>;
  readonly extraBody?: Record<string, unknown>;
  readonly modelOverrides?: Partial<Record<DocumentOutputType, string>>;
}

export interface DocumentModelDefinition {
  readonly kind: DocumentOutputType;
  readonly label: string;
  readonly defaultModelId: string;
  readonly envKey: (typeof documentModelEnvKeys)[DocumentOutputType];
}

export const documentModelRegistry = {
  lesson_plan: {
    kind: "lesson_plan",
    label: "Lesson plan generation",
    defaultModelId: defaultLessonPlanModelId,
    envKey: documentModelEnvKeys.lesson_plan,
  },
  student_note: {
    kind: "student_note",
    label: "Student note generation",
    defaultModelId: defaultStudentNoteModelId,
    envKey: documentModelEnvKeys.student_note,
  },
  assignment: {
    kind: "assignment",
    label: "Assignment generation",
    defaultModelId: defaultAssignmentModelId,
    envKey: documentModelEnvKeys.assignment,
  },
  question_bank_draft: {
    kind: "question_bank_draft",
    label: "Question bank draft generation",
    defaultModelId: defaultQuestionBankModelId,
    envKey: documentModelEnvKeys.question_bank_draft,
  },
  cbt_draft: {
    kind: "cbt_draft",
    label: "CBT draft generation",
    defaultModelId: defaultCbtModelId,
    envKey: documentModelEnvKeys.cbt_draft,
  },
} as const satisfies Record<DocumentOutputType, DocumentModelDefinition>;

function readEnvModelOverride(kind: DocumentOutputType) {
  const envKey = documentModelRegistry[kind].envKey;
  const value = process.env[envKey];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveDocumentModelId(
  kind: DocumentOutputType,
  config: DocumentAiConfig = {}
): string {
  return (
    config.modelOverrides?.[kind] ??
    readEnvModelOverride(kind) ??
    documentModelRegistry[kind].defaultModelId
  );
}

function buildDefaultHeaders() {
  const headers: Record<string, string> = {};

  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  }

  if (process.env.OPENROUTER_APP_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE;
  }

  return headers;
}

export function createDocumentAiProvider(config: DocumentAiConfig = {}) {
  return createOpenRouter({
    apiKey: config.apiKey ?? process.env.OPENROUTER_API_KEY,
    headers: {
      ...buildDefaultHeaders(),
      ...config.headers,
    },
    extraBody: config.extraBody,
  });
}

export function createDocumentModel(
  kind: DocumentOutputType,
  config: DocumentAiConfig = {}
) {
  const provider = createDocumentAiProvider(config);
  return provider.chat(resolveDocumentModelId(kind, config));
}

export const documentModelDefaults = {
  lesson_plan: resolveDocumentModelId("lesson_plan"),
  student_note: resolveDocumentModelId("student_note"),
  assignment: resolveDocumentModelId("assignment"),
  question_bank_draft: resolveDocumentModelId("question_bank_draft"),
  cbt_draft: resolveDocumentModelId("cbt_draft"),
} as const;
