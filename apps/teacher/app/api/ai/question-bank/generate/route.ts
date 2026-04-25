import { ConvexHttpClient } from "convex/browser";
import { generateObject } from "ai";
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

const requestSchema = z.object({
  draftMode: z.enum(["practice_quiz", "class_test", "exam_draft"]),
  sourceIds: z.array(z.string()).default([]),
});

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? null;
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

function promptClassForDraftMode(draftMode: AssessmentDraftMode) {
  return `teacher.question-bank.${draftMode}`;
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

function mapQuestionBankDraft(
  draftMode: AssessmentDraftMode,
  generated: QuestionBankDraft
) {
  const defaultQuestionType = defaultQuestionTypeForMode(draftMode);
  return {
    title: generated.title,
    description: generated.blueprint,
    items: generated.questions.map((question) => ({
      id: `q-${question.number}`,
      itemOrder: question.number - 1,
      questionType: defaultQuestionType,
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
  generated: CbtDraft
) {
  const defaultQuestionType = defaultQuestionTypeForMode(draftMode);
  let itemOrder = 0;
  const items = generated.sections.flatMap((section, sectionIndex) =>
    section.questions.map((question) => ({
      id: `s${sectionIndex + 1}-q${question.number}`,
      itemOrder: itemOrder++,
      questionType: defaultQuestionType,
      difficulty: question.difficulty,
      promptText: `${section.title}: ${question.prompt}`,
      answerText: question.answer,
      explanationText: question.explanation,
      marks: question.marks,
      tags: Array.from(new Set([section.title, ...question.tags])),
    }))
  );

  return {
    title: generated.title,
    description: `${generated.examMode} • ${generated.timeLimitMinutes} minutes • ${generated.instructions.join(" ")}`,
    items,
  };
}

async function generateDraftObject(
  outputType: DocumentOutputType,
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: unknown; prompt?: unknown }
) {
  const system = typeof prompt.system === "string" ? prompt.system : undefined;
  const promptText = typeof prompt.prompt === "string" ? prompt.prompt : "";

  switch (outputType) {
    case "question_bank_draft":
      return generateObject({
        model,
        schema: questionBankDraftSchema,
        ...(system ? { system } : {}),
        prompt: promptText,
      });
    case "cbt_draft":
      return generateObject({
        model,
        schema: cbtDraftSchema,
        ...(system ? { system } : {}),
        prompt: promptText,
      });
    default:
      throw new Error(`Unsupported output type: ${String(outputType)}`);
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
  const sourceIds = normalizeAssessmentSourceIds(parsedBody.data.sourceIds);
  const outputType: DocumentOutputType = draftMode === "exam_draft" ? "cbt_draft" : "question_bank_draft";
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  try {
    const workspace = await client.query(
      api.functions.academic.lessonKnowledgeAssessmentDrafts.getTeacherAssessmentBankWorkspace,
      {
        draftMode,
        sourceIds: sourceIds as never,
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

    const promptClass = promptClassForDraftMode(draftMode);
    const sourceSelectionSnapshot = buildSourceSelectionSnapshot({
      draftMode,
      outputType,
      sourceIds,
      subjectId: workspace.sourceContext.subjectId ? String(workspace.sourceContext.subjectId) : null,
      level: workspace.sourceContext.level,
      topicLabel: workspace.sourceContext.topicLabel,
    });

    await client.mutation(api.functions.academic.lessonKnowledgeAssessmentDrafts.recordTeacherAssessmentBankAiRun, {
      outputType,
      promptClass,
      status: "running",
      model: resolveDocumentModelId(outputType),
      provider: "openrouter",
      sourceSelectionSnapshot,
      sourceCount: sourceIds.length,
      startedAt: Date.now(),
    });

    const model = createDocumentModel(outputType);
    const sourceMaterials = sourcePromptMaterials(workspace);
    const promptContext = {
      schoolName: workspace.schoolName ?? undefined,
      subject: workspace.sourceContext.subjectName ?? undefined,
      level: workspace.sourceContext.level ?? undefined,
      topic: workspace.sourceContext.topicLabel ?? undefined,
      sourceMaterials,
      constraints:
        draftMode === "exam_draft"
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
        ? mapQuestionBankDraft(draftMode, generatedObject as QuestionBankDraft)
        : mapCbtDraft(draftMode, generatedObject as CbtDraft);

    if (!workspace.sourceContext.subjectId || !workspace.sourceContext.level) {
      return NextResponse.json(
        { error: "The selected sources did not resolve a valid subject and level for generation." },
        { status: 400 }
      );
    }

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
        subjectId: workspace.sourceContext.subjectId,
        level: workspace.sourceContext.level,
        topicLabel: workspace.sourceContext.topicLabel ?? null,
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
        promptClass: promptClassForDraftMode(draftMode),
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
