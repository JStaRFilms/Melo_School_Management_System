import { ConvexHttpClient } from "convex/browser";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAssignmentPrompt,
  buildLessonPlanPrompt,
  buildStudentNotePrompt,
  createDocumentModel,
  lessonPlanDraftSchema,
  studentNoteDraftSchema,
  assignmentDraftSchema,
  resolveDocumentModelId,
  type AssignmentDraft,
  type DocumentOutputType,
  type LessonPlanDraft,
  type StudentNoteDraft,
} from "@school/ai";
import { api } from "@school/convex/_generated/api";
import { getUserFacingErrorMessage } from "@school/shared";

import { getToken } from "@/lib/auth-server";

const MAX_GENERATION_SOURCE_COUNT = 12;

type LessonPlanObjective = string;
type LessonPlanPrerequisite = string;
type LessonPlanMaterial = string;
type LessonPlanTeacherMove = string;
type LessonPlanLearnerActivity = string;
type LessonPlanSourceNote = string;
type LessonPlanKeyPoint = string;
type LessonPlanReflectionQuestion = string;
type LessonPlanSubmissionChecklistItem = string;
type LessonPlanHint = string;
type LessonPlanVocabularyEntry = StudentNoteDraft["vocabulary"][number];
type LessonPlanFlowStep = LessonPlanDraft["lessonFlow"][number];
type AssignmentTask = AssignmentDraft["tasks"][number];

const topicPlanningContextSchema = z.object({
  kind: z.literal("topic"),
  classId: z.string().trim().min(1),
  termId: z.string().trim().min(1),
  subjectId: z.string().trim().min(1),
  level: z.string().trim().min(1),
  topicId: z.string().trim().min(1),
});

const requestSchema = z.object({
  outputType: z.enum(["lesson_plan", "student_note", "assignment"]),
  sourceIds: z.array(z.string()).max(MAX_GENERATION_SOURCE_COUNT).default([]),
  targetTopicLabel: z.string().trim().max(160).optional(),
  planningContext: topicPlanningContextSchema.optional(),
});

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? null;
}

function markdownToPlainText(markdown: string) {
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

function normalizeSourceIds(sourceIds: string[]) {
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
  outputType: DocumentOutputType;
  sourceIds: string[];
  subjectId: string | null;
  level: string | null;
  topicLabel: string | null;
  templateId: string | null;
  templateResolutionPath: string | null;
}) {
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

function renderLessonPlanMarkdown(draft: LessonPlanDraft) {
  return [
    `# ${draft.title}`,
    "",
    `**Subject:** ${draft.subject}`,
    `**Level:** ${draft.level}`,
    `**Topic:** ${draft.topic}`,
    "",
    "## Summary",
    draft.summary,
    "",
    "## Learning objectives",
    ...draft.learningObjectives.map((objective: LessonPlanObjective) => `- ${objective}`),
    "",
    "## Prerequisites",
    ...draft.prerequisites.map((item: LessonPlanPrerequisite) => `- ${item}`),
    "",
    "## Materials",
    ...draft.materials.map((item: LessonPlanMaterial) => `- ${item}`),
    "",
    "## Lesson flow",
    ...draft.lessonFlow.flatMap((step: LessonPlanFlowStep, index: number) => [
      `### ${index + 1}. ${step.heading} (${step.durationMinutes} min)`,
      "**Teacher moves**",
      ...step.teacherMoves.map((move: LessonPlanTeacherMove) => `- ${move}`),
      "",
      "**Learner activities**",
      ...step.learnerActivities.map((activity: LessonPlanLearnerActivity) => `- ${activity}`),
      "",
      `**Checkpoint:** ${step.checkpoint}`,
      "",
    ]),
    "## Assessment",
    draft.assessment,
    "",
    "## Homework",
    draft.homework,
    "",
    "## Differentiation notes",
    draft.differentiationNotes,
    "",
    "## Source notes",
    ...draft.sourceNotes.map((note: LessonPlanSourceNote) => `- ${note}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function renderStudentNoteMarkdown(draft: StudentNoteDraft) {
  return [
    `# ${draft.title}`,
    "",
    `**Subject:** ${draft.subject}`,
    `**Level:** ${draft.level}`,
    `**Topic:** ${draft.topic}`,
    "",
    "## Summary",
    draft.summary,
    "",
    "## Key points",
    ...draft.keyPoints.map((item: LessonPlanKeyPoint) => `- ${item}`),
    "",
    "## Vocabulary",
    ...draft.vocabulary.flatMap((entry: LessonPlanVocabularyEntry) => [`- **${entry.term}:** ${entry.meaning}`]),
    "",
    "## Worked example",
    draft.workedExample,
    "",
    "## Reflection questions",
    ...draft.reflectionQuestions.map((question: LessonPlanReflectionQuestion) => `- ${question}`),
    "",
    "## Source notes",
    ...draft.sourceNotes.map((note: LessonPlanSourceNote) => `- ${note}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function renderAssignmentMarkdown(draft: AssignmentDraft) {
  return [
    `# ${draft.title}`,
    "",
    `**Subject:** ${draft.subject}`,
    `**Level:** ${draft.level}`,
    `**Topic:** ${draft.topic}`,
    "",
    "## Instructions",
    draft.instructions,
    "",
    "## Tasks",
    ...draft.tasks.flatMap((task: AssignmentTask, index: number) => [
      `### Task ${index + 1} (${task.marks} marks, ${task.difficulty})`,
      task.prompt,
      "",
      `**Expected response:** ${task.expectedResponse}`,
      "",
      "**Hints**",
      ...task.hints.map((hint: LessonPlanHint) => `- ${hint}`),
      "",
    ]),
    "## Submission checklist",
    ...draft.submissionChecklist.map((item: LessonPlanSubmissionChecklistItem) => `- [ ] ${item}`),
    "",
    "## Marking guidance",
    draft.markingGuidance,
    "",
    "## Source notes",
    ...draft.sourceNotes.map((note: LessonPlanSourceNote) => `- ${note}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function renderGeneratedMarkdown(outputType: DocumentOutputType, draft: unknown): string {
  switch (outputType) {
    case "lesson_plan":
      return renderLessonPlanMarkdown(draft as LessonPlanDraft);
    case "student_note":
      return renderStudentNoteMarkdown(draft as StudentNoteDraft);
    case "assignment":
      return renderAssignmentMarkdown(draft as AssignmentDraft);
    default:
      throw new Error(`Unsupported output type: ${String(outputType)}`);
  }
}

function promptClassForOutputType(outputType: DocumentOutputType): string {
  switch (outputType) {
    case "lesson_plan":
      return "teacher.lesson-plan.generation";
    case "student_note":
      return "teacher.student-note.generation";
    case "assignment":
      return "teacher.assignment.generation";
    default:
      throw new Error(`Unsupported output type: ${String(outputType)}`);
  }
}

async function generateDraftObject(
  outputType: DocumentOutputType,
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: unknown; prompt?: unknown }
) {
  const system = typeof prompt.system === "string" ? prompt.system : undefined;
  const promptText = typeof prompt.prompt === "string" ? prompt.prompt : "";

  switch (outputType) {
    case "lesson_plan":
      return generateObject({
        model,
        schema: lessonPlanDraftSchema,
        ...(system ? { system } : {}),
        prompt: promptText,
      });
    case "student_note":
      return generateObject({
        model,
        schema: studentNoteDraftSchema,
        ...(system ? { system } : {}),
        prompt: promptText,
      });
    case "assignment":
      return generateObject({
        model,
        schema: assignmentDraftSchema,
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

  const { outputType } = parsedBody.data;
  const targetTopicLabel = parsedBody.data.targetTopicLabel || null;
  const sourceIds = normalizeSourceIds(parsedBody.data.sourceIds);
  if (sourceIds.length > MAX_GENERATION_SOURCE_COUNT) {
    return NextResponse.json(
      { error: `Select at most ${MAX_GENERATION_SOURCE_COUNT} source materials for generation.` },
      { status: 400 }
    );
  }
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  try {
    const workspace = await client.query(
      api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace,
      {
        outputType,
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

    const promptClass = promptClassForOutputType(outputType);
    const effectiveTopicLabel =
      workspace.planningContext?.topicTitle ?? targetTopicLabel ?? workspace.sourceContext.topicLabel ?? null;
    const effectiveSubjectId = workspace.planningContext?.subjectId ?? workspace.sourceContext.subjectId;
    const effectiveSubjectName = workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName;
    const effectiveLevel = workspace.planningContext?.level ?? workspace.sourceContext.level;

    if (!effectiveTopicLabel) {
      return NextResponse.json(
        { error: "Add a target topic before generating from broad planning sources." },
        { status: 400 }
      );
    }
    const sourceSelectionSnapshot = buildSourceSelectionSnapshot({
      outputType,
      sourceIds,
      subjectId: effectiveSubjectId ? String(effectiveSubjectId) : null,
      level: effectiveLevel,
      topicLabel: effectiveTopicLabel,
      templateId: workspace.template?._id ? String(workspace.template._id) : null,
      templateResolutionPath: workspace.template?.resolutionPath ?? null,
    });

    if (!effectiveSubjectId || !effectiveLevel) {
      return NextResponse.json(
        { error: "The selected sources did not resolve a valid subject and level for generation." },
        { status: 400 }
      );
    }

    const rateLimit = await client.mutation(
      api.functions.academic.lessonKnowledgeRateLimits.consumeTeacherLessonPlanGenerationLimit,
      {}
    );
    if (!rateLimit.allowed) {
      return rateLimitedResponse({ retryAfterMs: rateLimit.retryAfterMs, resetAt: rateLimit.resetAt });
    }

    await client.mutation(api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun, {
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
      subject: effectiveSubjectName ?? undefined,
      level: effectiveLevel ?? undefined,
      topic: effectiveTopicLabel ?? undefined,
      templateName: workspace.template?.title ?? undefined,
      sourceMaterials,
      constraints: workspace.template
        ? [
            `Use at least ${workspace.template.objectiveMinimums.minimumSourceMaterials} source materials.`,
            `Cover the required sections in this order: ${workspace.template.sectionDefinitions
              .map((section: { label: string }) => section.label)
              .join(", ")}.`,
          ]
        : ["Use the selected source materials only.", "Keep the draft editable and concise."],
      revisionNotes: workspace.draft.title && workspace.draft.title !== workspace.template?.title
        ? `Refresh the current draft while preserving the teacher's working title: ${workspace.draft.title}`
        : undefined,
    };

    const prompt =
      outputType === "lesson_plan"
        ? buildLessonPlanPrompt(promptContext)
        : outputType === "student_note"
          ? buildStudentNotePrompt(promptContext)
          : buildAssignmentPrompt(promptContext);

    const result = await generateDraftObject(outputType, model, prompt);
    const generatedObject = result.object as LessonPlanDraft | StudentNoteDraft | AssignmentDraft;

    const documentState = renderGeneratedMarkdown(outputType, generatedObject);
    const plainText = markdownToPlainText(documentState);

    const usage = result.usage as { inputTokens?: number; outputTokens?: number } | undefined;

    const saveResult = await client.mutation(
      api.functions.academic.lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft,
      {
        artifactId: workspace.draft.artifactId ? workspace.draft.artifactId : null,
        outputType,
        title: generatedObject.title,
        documentState,
        plainText,
        sourceIds: sourceIds as never,
        subjectId: effectiveSubjectId,
        level: effectiveLevel,
        topicLabel: effectiveTopicLabel,
        planningContext: parsedBody.data.planningContext as never,
        revisionKind: "generated",
      }
    );

    await client.mutation(api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun, {
      outputType,
      promptClass,
      status: "succeeded",
      model: resolveDocumentModelId(outputType),
      provider: "openrouter",
      targetArtifactId: saveResult.artifactId,
      sourceSelectionSnapshot,
      sourceCount: sourceIds.length,
      tokenPromptCount: usage?.inputTokens,
      tokenCompletionCount: usage?.outputTokens,
      finishedAt: Date.now(),
    });

    return NextResponse.json(saveResult);
  } catch (error) {
    const errorMessage = getUserFacingErrorMessage(error, "Lesson-plan generation failed.");
    await client
      .mutation(api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun, {
        outputType,
        promptClass: promptClassForOutputType(outputType),
        status: "failed",
        model: resolveDocumentModelId(outputType),
        provider: "openrouter",
        sourceSelectionSnapshot: buildSourceSelectionSnapshot({
          outputType,
          sourceIds,
          subjectId: null,
          level: null,
          topicLabel: null,
          templateId: null,
          templateResolutionPath: null,
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
