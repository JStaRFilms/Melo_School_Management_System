import { ConvexHttpClient } from "convex/browser";
import { generateObject, NoObjectGeneratedError, type GenerateObjectResult } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCbtDraftPrompt,
  buildQuestionBankDraftPrompt,
  cbtDraftSchema,
  createDocumentModel,
  questionBankDraftSchema,
  resolveDocumentModelId,
  type CbtDraft,
  type DocumentOutputType,
  type QuestionBankDraft,
} from "@school/ai";
import { api } from "@school/convex/_generated/api";
import { getUserFacingErrorMessage } from "@school/shared";

import { getToken } from "@/lib/auth-server";

import {
  assessmentDraftModeOptions,
  type AssessmentDraftMode,
  normalizeAssessmentSourceIds,
} from "../../../../planning/question-bank/types";

const MAX_GENERATION_SOURCE_COUNT = 12;
const MAX_SCHEMA_REPAIR_INPUT_CHARS = 24_000;

type DraftObject = QuestionBankDraft | CbtDraft;
type DraftGenerationResult = GenerateObjectResult<DraftObject>;
type GeneratedQuestionBankQuestion = QuestionBankDraft["questions"][number];
type GeneratedCbtSection = CbtDraft["sections"][number];
type GeneratedCbtQuestion = GeneratedCbtSection["questions"][number];

const questionMixSchema = z.object({
  multiple_choice: z.number(),
  short_answer: z.number(),
  essay: z.number(),
  true_false: z.number(),
  fill_in_the_blank: z.number(),
});

const effectiveGenerationSettingsSchema = z.object({
  profileId: z.string().optional(),
  profileName: z.string().optional(),
  questionStyle: z.enum(["balanced", "open_ended_heavy", "mixed_open_ended", "objective_heavy"]),
  totalQuestions: z.number(),
  questionMix: questionMixSchema,
  allowTeacherOverrides: z.boolean(),
  overrideReason: z.string().optional(),
});

const topicPlanningContextSchema = z.object({
  kind: z.literal("topic"),
  classId: z.string().trim().min(1),
  termId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  level: z.string().trim().min(1),
  topicId: z.string().trim().min(1),
});

const examPlanningContextSchema = z.object({
  kind: z.literal("exam_scope"),
  classId: z.string().trim().min(1),
  termId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  level: z.string().trim().min(1),
  scopeKind: z.enum(["full_subject_term", "topic_subset"]),
  topicIds: z.array(z.string().trim().min(1)).optional(),
});

const requestSchema = z.object({
  draftMode: z.enum(["practice_quiz", "class_test", "exam_draft"]),
  sourceIds: z.array(z.string()).max(MAX_GENERATION_SOURCE_COUNT).default([]),
  targetTopicLabel: z.string().trim().max(160).optional(),
  planningContext: z.union([topicPlanningContextSchema, examPlanningContextSchema]).optional(),
  effectiveGenerationSettings: effectiveGenerationSettingsSchema.optional(),
});

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? null;
}

function rateLimitedResponse(args: { retryAfterMs: number; resetAt: number }) {
  const retryAfterSeconds = Math.max(1, Math.ceil(args.retryAfterMs / 1000));
  return NextResponse.json(
    {
      error: "Generation rate limit exceeded. Please try again later.",
      retryAfterMs: args.retryAfterMs,
      resetAt: args.resetAt,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

function buildSourceSelectionSnapshot(args: {
  draftMode: AssessmentDraftMode;
  outputType: DocumentOutputType;
  sourceIds: string[];
  subjectId: string | null;
  level: string | null;
  topicLabel: string | null;
}) {
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

function promptClassForDraftMode(draftMode: AssessmentDraftMode, questionStyle?: string) {
  return `teacher.question-bank.${draftMode}${questionStyle ? `.${questionStyle}` : ""}`;
}

function generationSettingConstraints(settings: z.infer<typeof effectiveGenerationSettingsSchema>) {
  const mix = settings.questionMix;
  const openEndedCount = mix.short_answer + mix.essay;
  const objectiveCount = mix.multiple_choice + mix.true_false + mix.fill_in_the_blank;
  return [
    `Generate exactly ${settings.totalQuestions} questions with this mix: ${mix.multiple_choice} multiple choice, ${mix.true_false} true/false, ${mix.fill_in_the_blank} fill-in-the-blank, ${mix.short_answer} short answer, and ${mix.essay} essay/open-ended.`,
    `Question-style direction: ${settings.questionStyle.replace(/_/g, " ")}.`,
    settings.questionStyle === "open_ended_heavy"
      ? `Favor open-ended reasoning and written responses (${openEndedCount} open-ended vs ${objectiveCount} objective). Do not collapse these into pure CBT/objective output.`
      : settings.questionStyle === "mixed_open_ended"
        ? "Use a mixed format where open-ended prompts are prominent but objective checks still appear where requested."
        : settings.questionStyle === "objective_heavy"
          ? "Favor objective items while preserving any requested short-answer or essay counts."
          : "Keep a balanced blend of objective and open-ended checks.",
  ];
}

function sourcePromptMaterials(workspace: {
  selectedSources: Array<{
    _id: string;
    title: string;
    sourceType: string;
    visibility: string;
    description: string | null;
    topicLabel: string;
  }>;
}) {
  return workspace.selectedSources.map((source) => ({
    id: source._id,
    title: source.title,
    sourceType: source.sourceType,
    visibility: source.visibility,
    description: source.description ?? undefined,
    topicLabel: source.topicLabel,
  }));
}

function defaultQuestionTypeForMode(draftMode: AssessmentDraftMode) {
  return (
    assessmentDraftModeOptions.find((option) => option.value === draftMode)?.defaultQuestionType ??
    "short_answer"
  );
}

function expandQuestionTypePlan(settings: z.infer<typeof effectiveGenerationSettingsSchema>) {
  return Object.entries(settings.questionMix).flatMap(([questionType, count]) =>
    Array.from({ length: Math.max(0, Math.trunc(count)) }, () => questionType)
  ) as Array<keyof z.infer<typeof questionMixSchema>>;
}

function sameGenerationSettingsShape(
  a: z.infer<typeof effectiveGenerationSettingsSchema>,
  b: z.infer<typeof effectiveGenerationSettingsSchema>
) {
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

function normalizeEffectiveGenerationSettings(
  settings: z.infer<typeof effectiveGenerationSettingsSchema>
): z.infer<typeof effectiveGenerationSettingsSchema> {
  const questionMix = {
    multiple_choice: Math.max(0, Math.min(60, Math.trunc(settings.questionMix.multiple_choice))),
    short_answer: Math.max(0, Math.min(60, Math.trunc(settings.questionMix.short_answer))),
    essay: Math.max(0, Math.min(60, Math.trunc(settings.questionMix.essay))),
    true_false: Math.max(0, Math.min(60, Math.trunc(settings.questionMix.true_false))),
    fill_in_the_blank: Math.max(0, Math.min(60, Math.trunc(settings.questionMix.fill_in_the_blank))),
  };
  const totalQuestions = Object.values(questionMix).reduce((sum, value) => sum + value, 0);
  if (totalQuestions < 1) {
    throw new Error("At least one generated question is required.");
  }
  return { ...settings, questionMix, totalQuestions };
}

function resolveEffectiveGenerationSettings(args: {
  requestedSettings: z.infer<typeof effectiveGenerationSettingsSchema>;
  profiles: Array<{
    _id: string;
    name: string;
    questionStyle: z.infer<typeof effectiveGenerationSettingsSchema>["questionStyle"];
    totalQuestions: number;
    questionMix: z.infer<typeof questionMixSchema>;
    allowTeacherOverrides: boolean;
    isDefault: boolean;
    isActive: boolean;
  }>;
}) {
  const normalizedRequested = normalizeEffectiveGenerationSettings(args.requestedSettings);
  const activeProfiles = args.profiles.filter((profile) => profile.isActive);
  const activeDefaultProfile = activeProfiles.find((profile) => profile.isDefault) ?? null;

  if (!normalizedRequested.profileId) {
    if (!activeDefaultProfile) {
      return normalizedRequested;
    }

    const defaultSettings = normalizeEffectiveGenerationSettings({
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

  const profileSettings = normalizeEffectiveGenerationSettings({
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
    overrideReason:
      !sameGenerationSettingsShape(normalizedRequested, profileSettings)
        ? normalizedRequested.overrideReason ?? "teacher_override"
        : undefined,
  };
}

function assertGeneratedQuestionCount(args: {
  expected: number;
  actual: number;
  outputType: DocumentOutputType;
}) {
  if (args.actual !== args.expected) {
    throw new Error(
      `The generated ${args.outputType === "cbt_draft" ? "CBT draft" : "question bank"} returned ${args.actual} questions, but ${args.expected} were requested.`
    );
  }
}

function mapQuestionBankDraft(
  draftMode: AssessmentDraftMode,
  generated: QuestionBankDraft,
  settings: z.infer<typeof effectiveGenerationSettingsSchema>
) {
  const questionTypePlan = expandQuestionTypePlan(settings);
  const defaultQuestionType = defaultQuestionTypeForMode(draftMode);
  return {
    title: generated.title,
    description: generated.blueprint,
    items: generated.questions.map((question: GeneratedQuestionBankQuestion) => ({
      id: `q-${question.number}`,
      itemOrder: question.number - 1,
      questionType: questionTypePlan[question.number - 1] ?? defaultQuestionType,
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
  settings: z.infer<typeof effectiveGenerationSettingsSchema>
) {
  const questionTypePlan = expandQuestionTypePlan(settings);
  const defaultQuestionType = defaultQuestionTypeForMode(draftMode);
  let itemOrder = 0;
  const items = generated.sections.flatMap((section: GeneratedCbtSection, sectionIndex: number) =>
    section.questions.map((question: GeneratedCbtQuestion) => {
      const currentOrder = itemOrder++;
      return {
        id: `s${sectionIndex + 1}-q${question.number}`,
        itemOrder: currentOrder,
        questionType: questionTypePlan[currentOrder] ?? defaultQuestionType,
        difficulty: question.difficulty,
        promptText: `${section.title}: ${question.prompt}`,
        answerText: question.answer,
        explanationText: question.explanation,
        marks: question.marks,
        tags: Array.from(new Set([section.title, ...question.tags])),
      };
    })
  );

  return {
    title: generated.title,
    description: `${generated.examMode} • ${generated.timeLimitMinutes} minutes • ${generated.instructions.join(" ")}`,
    items,
  };
}

function isSchemaMismatchNoObjectError(error: unknown): error is NoObjectGeneratedError & { text: string } {
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

function schemaRepairPrompt(args: { outputType: DocumentOutputType; originalPrompt: string; failedText: string }) {
  return [
    "Repair the failed structured-generation response so it exactly matches the requested JSON schema.",
    "Do not add new questions or change educational intent unless required to satisfy the schema.",
    "Coerce obvious type issues only, such as numeric strings to numbers, missing arrays to arrays, and enum casing to valid values.",
    "Return only the repaired object for the schema. No markdown or commentary.",
    `Output type: ${args.outputType}`,
    "Original generation prompt:",
    args.originalPrompt,
    "Failed response to repair:",
    args.failedText.slice(0, MAX_SCHEMA_REPAIR_INPUT_CHARS),
  ].join("\n\n");
}

async function generateObjectForOutputType(args: {
  outputType: DocumentOutputType;
  model: ReturnType<typeof createDocumentModel>;
  system?: string;
  prompt: string;
}): Promise<DraftGenerationResult> {
  switch (args.outputType) {
    case "question_bank_draft": {
      const result = await generateObject({
        model: args.model,
        schema: questionBankDraftSchema,
        ...(args.system ? { system: args.system } : {}),
        prompt: args.prompt,
      });
      return result as GenerateObjectResult<DraftObject>;
    }
    case "cbt_draft": {
      const result = await generateObject({
        model: args.model,
        schema: cbtDraftSchema,
        ...(args.system ? { system: args.system } : {}),
        prompt: args.prompt,
      });
      return result as GenerateObjectResult<DraftObject>;
    }
    default:
      throw new Error(`Unsupported output type: ${String(args.outputType)}`);
  }
}

async function generateDraftObject(
  outputType: DocumentOutputType,
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: unknown; prompt?: unknown }
): Promise<DraftGenerationResult> {
  const system = typeof prompt.system === "string" ? prompt.system : undefined;
  const promptText = typeof prompt.prompt === "string" ? prompt.prompt : "";

  try {
    return await generateObjectForOutputType({ outputType, model, system, prompt: promptText });
  } catch (error) {
    if (!isSchemaMismatchNoObjectError(error)) {
      throw error;
    }

    return generateObjectForOutputType({
      outputType,
      model,
      system: [
        system,
        "You are repairing a prior AI response for strict JSON schema validation. Return only valid structured data.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      prompt: schemaRepairPrompt({ outputType, originalPrompt: promptText, failedText: error.text }),
    });
  }
}

export async function POST(request: Request) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });
  }

  const parsedBody = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const draftMode = parsedBody.data.draftMode;
  const targetTopicLabel = parsedBody.data.targetTopicLabel || null;
  const requestedGenerationSettings = parsedBody.data.effectiveGenerationSettings;
  const sourceIds = normalizeAssessmentSourceIds(parsedBody.data.sourceIds);
  if (sourceIds.length > MAX_GENERATION_SOURCE_COUNT) {
    return NextResponse.json(
      { error: `Select at most ${MAX_GENERATION_SOURCE_COUNT} source materials for generation.` },
      { status: 400 }
    );
  }
  const outputType: DocumentOutputType = draftMode === "exam_draft" ? "cbt_draft" : "question_bank_draft";
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  try {
    const workspace = await client.query(
      api.functions.academic.lessonKnowledgeAssessmentDrafts.getTeacherAssessmentBankWorkspace,
      {
        draftMode,
        sourceIds: sourceIds as never,
        planningContext: parsedBody.data.planningContext as never,
      }
    );

    if (!workspace.canGenerate) {
      return NextResponse.json(
        {
          error: "Generation is blocked for the current source selection.",
          warnings: workspace.warnings,
        },
        { status: 400 }
      );
    }

    const availableProfiles = await client.query(
      api.functions.academic.lessonKnowledgeAssessmentProfiles.listAssessmentGenerationProfiles,
      { includeInactive: false }
    );

    const rawEffectiveGenerationSettings = requestedGenerationSettings ?? workspace.draft.effectiveGenerationSettings;
    if (!rawEffectiveGenerationSettings) {
      return NextResponse.json({ error: "Assessment generation settings are required." }, { status: 400 });
    }

    const effectiveGenerationSettings = resolveEffectiveGenerationSettings({
      requestedSettings: rawEffectiveGenerationSettings,
      profiles: availableProfiles,
    });

    const promptClass = promptClassForDraftMode(draftMode, effectiveGenerationSettings.questionStyle);
    const effectiveTopicLabel =
      workspace.planningContext?.kind === "topic"
        ? workspace.planningContext.topicTitle ?? targetTopicLabel ?? workspace.sourceContext.topicLabel ?? null
        : targetTopicLabel ?? workspace.sourceContext.topicLabel ?? null;
    const effectiveSubjectId = workspace.planningContext?.subjectId ?? workspace.sourceContext.subjectId;
    const effectiveSubjectName = workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName;
    const effectiveLevel = workspace.planningContext?.level ?? workspace.sourceContext.level;
    const effectivePromptTopic =
      workspace.planningContext?.kind === "exam_scope"
        ? workspace.planningContext.scopeKind === "topic_subset"
          ? workspace.planningContext.topicTitles?.join(", ") || "Selected topic subset"
          : undefined
        : effectiveTopicLabel ?? undefined;

    if (draftMode !== "exam_draft" && !effectiveTopicLabel) {
      return NextResponse.json(
        { error: "Add a target topic before generating from broad planning sources." },
        { status: 400 }
      );
    }

    if (!effectiveSubjectId || !effectiveLevel) {
      return NextResponse.json(
        { error: "The selected sources did not resolve a valid subject and level for generation." },
        { status: 400 }
      );
    }

    const sourceSelectionSnapshot = buildSourceSelectionSnapshot({
      draftMode,
      outputType,
      sourceIds,
      subjectId: effectiveSubjectId ? String(effectiveSubjectId) : null,
      level: effectiveLevel,
      topicLabel: effectiveTopicLabel,
    });

    const rateLimit = await client.mutation(
      api.functions.academic.lessonKnowledgeRateLimits.consumeTeacherAssessmentGenerationLimit,
      {}
    );
    if (!rateLimit.allowed) {
      return rateLimitedResponse({ retryAfterMs: rateLimit.retryAfterMs, resetAt: rateLimit.resetAt });
    }

    await client.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun, {
      outputType,
      promptClass,
      status: "running",
      model: resolveDocumentModelId(outputType),
      provider: "openrouter",
      sourceSelectionSnapshot,
      sourceCount: sourceIds.length,
      effectiveGenerationSettings: effectiveGenerationSettings as never,
      startedAt: Date.now(),
    });

    const model = createDocumentModel(outputType);
    const sourceMaterials = sourcePromptMaterials(workspace);
    const promptContext = {
      schoolName: workspace.schoolName ?? undefined,
      subject: effectiveSubjectName ?? undefined,
      level: effectiveLevel ?? undefined,
      topic: effectivePromptTopic,
      sourceMaterials,
      constraints: [
        ...generationSettingConstraints(effectiveGenerationSettings),
        ...(draftMode === "exam_draft"
          ? [
              "Produce a structured CBT-style draft that can be moderated later.",
              "Keep section labels concise and exam appropriate.",
            ]
          : draftMode === "practice_quiz"
            ? [
                "Make the draft short, supportive, and retrieval focused.",
                "Blend quick recall with a few understanding checks.",
              ]
            : [
                "Balance recall, understanding, and application questions.",
                "Keep the draft classroom-ready and editable by the teacher.",
              ]),
      ],
      revisionNotes: workspace.draft.bankId
        ? `Refresh the existing draft while preserving the teacher's working title: ${workspace.draft.title}`
        : undefined,
    };

    const prompt =
      outputType === "question_bank_draft"
        ? buildQuestionBankDraftPrompt(promptContext)
        : buildCbtDraftPrompt(promptContext);

    const result = await generateDraftObject(outputType, model, prompt);
    const generatedObject = result.object as QuestionBankDraft | CbtDraft;

    const generatedDraft =
      outputType === "question_bank_draft"
        ? mapQuestionBankDraft(draftMode, generatedObject as QuestionBankDraft, effectiveGenerationSettings)
        : mapCbtDraft(draftMode, generatedObject as CbtDraft, effectiveGenerationSettings);

    assertGeneratedQuestionCount({
      expected: effectiveGenerationSettings.totalQuestions,
      actual: generatedDraft.items.length,
      outputType,
    });

    const usage = result.usage as { inputTokens?: number; outputTokens?: number } | undefined;
    const saveResult = await client.mutation(
      api.functions.academic.lessonKnowledgeAssessmentDrafts.saveTeacherAssessmentBankDraft,
      {
        bankId: workspace.draft.bankId ? workspace.draft.bankId : null,
        draftMode,
        title: generatedDraft.title,
        description: generatedDraft.description,
        sourceIds: sourceIds as never,
        sourceSelectionSnapshot,
        effectiveGenerationSettings: effectiveGenerationSettings as never,
        subjectId: effectiveSubjectId,
        level: effectiveLevel,
        topicLabel: effectiveTopicLabel,
        planningContext: parsedBody.data.planningContext as never,
        items: generatedDraft.items.map((item: (typeof generatedDraft.items)[number]) => ({
          questionType: item.questionType,
          difficulty: item.difficulty,
          promptText: item.promptText,
          answerText: item.answerText,
          explanationText: item.explanationText,
          marks: item.marks,
          tags: item.tags,
        })),
      }
    );

    await client.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun, {
      outputType,
      promptClass,
      status: "succeeded",
      model: resolveDocumentModelId(outputType),
      provider: "openrouter",
      targetAssessmentBankId: saveResult.bankId,
      sourceSelectionSnapshot,
      sourceCount: sourceIds.length,
      effectiveGenerationSettings: effectiveGenerationSettings as never,
      tokenPromptCount: usage?.inputTokens,
      tokenCompletionCount: usage?.outputTokens,
      finishedAt: Date.now(),
    });

    return NextResponse.json({ ...saveResult, items: generatedDraft.items });
  } catch (error) {
    const errorMessage = getUserFacingErrorMessage(error, "Assessment draft generation failed.");
    await client
      .mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun, {
        outputType,
        promptClass: promptClassForDraftMode(draftMode, parsedBody.data.effectiveGenerationSettings?.questionStyle),
        status: "failed",
        model: resolveDocumentModelId(outputType),
        provider: "openrouter",
        sourceSelectionSnapshot: buildSourceSelectionSnapshot({
          draftMode,
          outputType,
          sourceIds,
          subjectId: null,
          level: null,
          topicLabel: null,
        }),
        sourceCount: sourceIds.length,
        errorMessage,
        errorCode: error instanceof Error ? error.name : "generation_failed",
        finishedAt: Date.now(),
      })
      .catch(() => undefined);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
