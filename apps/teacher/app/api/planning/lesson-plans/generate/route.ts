import { ConvexHttpClient } from "convex/browser";
import { APICallError, generateObject, NoObjectGeneratedError, type GenerateObjectResult } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAssignmentPrompt,
  buildLessonPlanPrompt,
  buildStudentNotePrompt,
  buildTemplateRepairPrompt,
  createDocumentModel,
  resolveDocumentModelId,
  templateBoundInstructionDraftSchema,
  getDocumentGenerationRetryDelayMs,
  normalizeDocumentGenerationFailure,
  shouldRetryDocumentGeneration,
  type DocumentOutputType,
  type TemplateBoundInstructionDraft,
} from "@school/ai";
import { api } from "@school/convex/_generated/api";
import { getToken } from "@/lib/auth-server";

const MAX_GENERATION_SOURCE_COUNT = 12;
const MAX_TEMPLATE_REPAIR_ATTEMPTS = 1;
const MAX_PROVIDER_RETRY_ATTEMPTS = 1;
const MAX_FAILED_RESPONSE_REPAIR_CHARS = 8000;

type TemplateGenerationResult = GenerateObjectResult<TemplateBoundInstructionDraft>;

class TemplateDraftValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join(" "));
    this.name = "TemplateDraftValidationError";
    this.issues = issues;
  }
}

type ResolvedTemplateSection = {
  id: string;
  label: string;
  order: number;
  required: boolean;
  minimumWordCount: number | null;
};

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

function isNoObjectGeneratedError(error: unknown): error is NoObjectGeneratedError & { text?: string } {
  return NoObjectGeneratedError.isInstance(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generationFailureMessage(error: unknown, args: { outputType: DocumentOutputType; modelId: string }) {
  const failure = normalizeDocumentGenerationFailure(error);
  const target = `${args.outputType.replaceAll("_", " ")} model (${args.modelId})`;

  if (APICallError.isInstance(error)) {
    const status = error.statusCode ? ` Status ${error.statusCode}.` : "";
    return `The AI provider rejected or failed the ${target} request.${status} This can happen when a free model is temporarily unavailable or does not reliably support structured JSON output. Try again or switch this document type to a more stable model.`;
  }

  switch (failure.kind) {
    case "rate_limit":
      return `The AI provider is rate-limiting the ${target} right now. Please wait a moment and try again.`;
    case "timeout":
    case "transient_provider":
      return `The AI provider returned a temporary error for the ${target}. Please try again, or switch models if it keeps happening.`;
    case "invalid_output":
      return `The ${target} returned output that could not be shaped into the school template. Please try again.`;
    case "configuration":
      return `The ${target} request was rejected by the provider. Check the configured model for this document type, or try another model.`;
    default:
      return failure.message || "Generation failed.";
  }
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

function sectionWordCount(content: string) {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeGeneratedTemplateDraft(
  draft: TemplateBoundInstructionDraft,
  templateSections: ResolvedTemplateSection[]
): TemplateBoundInstructionDraft {
  if (templateSections.length === 0) {
    throw new Error("A resolved template is required before rendering generated instruction artifacts.");
  }

  const issues: string[] = [];
  const allowedSectionIds = new Set(templateSections.map((section) => section.id));
  const unknownIds = draft.sections.map((section) => section.sectionId).filter((sectionId) => !allowedSectionIds.has(sectionId));
  if (unknownIds.length > 0) {
    issues.push(`Generated draft used unknown template section ids: ${[...new Set(unknownIds)].join(", ")}.`);
  }

  const sectionsById = new Map(draft.sections.map((section) => [section.sectionId, section]));
  const duplicateIds = draft.sections
    .map((section) => section.sectionId)
    .filter((sectionId, index, sectionIds) => sectionIds.indexOf(sectionId) !== index);

  if (duplicateIds.length > 0) {
    issues.push(`Generated draft repeated template section ids: ${[...new Set(duplicateIds)].join(", ")}.`);
  }

  const normalizedSections = templateSections.map((templateSection) => {
    const generatedSection = sectionsById.get(templateSection.id);
    if (!generatedSection) {
      if (!templateSection.required) {
        return {
          sectionId: templateSection.id,
          label: templateSection.label,
          content: "",
        };
      }
      issues.push(`Generated draft omitted required template section: ${templateSection.label}.`);
      return {
        sectionId: templateSection.id,
        label: templateSection.label,
        content: "",
      };
    }

    const content = generatedSection.content.trim();
    if (templateSection.required && !content) {
      issues.push(`Generated draft left required template section empty: ${templateSection.label}.`);
    }

    if (content && templateSection.minimumWordCount && sectionWordCount(content) < templateSection.minimumWordCount) {
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
    sections: normalizedSections,
    sourceNotes: draft.sourceNotes.map((note) => note.trim()).filter(Boolean),
  };
}

function renderGeneratedMarkdown(draft: TemplateBoundInstructionDraft): string {
  const metadata = [`**Subject:** ${draft.subject}`, `**Level:** ${draft.level}`, `**Topic:** ${draft.topic}`];

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
  model: ReturnType<typeof createDocumentModel>,
  prompt: { system?: unknown; prompt?: unknown }
): Promise<TemplateGenerationResult> {
  const system = typeof prompt.system === "string" ? prompt.system : undefined;
  const promptText = typeof prompt.prompt === "string" ? prompt.prompt : "";

  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await generateObject({
        model,
        schema: templateBoundInstructionDraftSchema,
        ...(system ? { system } : {}),
        prompt: promptText,
      });
    } catch (error) {
      const failure = normalizeDocumentGenerationFailure(error);
      const shouldRetryProvider =
        attempt < MAX_PROVIDER_RETRY_ATTEMPTS &&
        shouldRetryDocumentGeneration(failure) &&
        (failure.kind === "rate_limit" || failure.kind === "timeout" || failure.kind === "transient_provider");

      if (!shouldRetryProvider) {
        throw error;
      }

      await sleep(getDocumentGenerationRetryDelayMs(failure, attempt + 1));
    }
  }

  throw new Error("Generation failed after provider retry.");
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

    if (!workspace.template) {
      return NextResponse.json(
        { error: "No active template resolved for this lesson-planning context. Ask an admin to set a template first." },
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

    const modelId = resolveDocumentModelId(outputType);

    await client.mutation(api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun, {
      outputType,
      promptClass,
      status: "running",
      model: modelId,
      provider: "openrouter",
      sourceSelectionSnapshot,
      sourceCount: sourceIds.length,
      startedAt: Date.now(),
    });

    const model = createDocumentModel(outputType);
    const sourceMaterials = sourcePromptMaterials(workspace);
    const templateSections = workspace.template.sectionDefinitions
      .slice()
      .sort((a: ResolvedTemplateSection, b: ResolvedTemplateSection) => a.order - b.order);

    const promptContext = {
      schoolName: workspace.schoolName ?? undefined,
      subject: effectiveSubjectName ?? undefined,
      level: effectiveLevel ?? undefined,
      topic: effectiveTopicLabel ?? undefined,
      templateName: workspace.template.title,
      templateSections,
      sourceMaterials,
      constraints: [
        `Use at least ${workspace.template.objectiveMinimums.minimumSourceMaterials} source materials.`,
        `Cover the required sections in this exact order: ${templateSections.map((section) => section.label).join(", ")}.`,
        "Do not replace the resolved template with a generic lesson-plan, student-note, or assignment outline.",
      ],
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

    let result: TemplateGenerationResult;
    let generatedObject: TemplateBoundInstructionDraft;
    let repaired = false;
    let validationIssues: string[] = [];

    try {
      result = await generateDraftObject(model, prompt);
    } catch (generationError) {
      if (!isNoObjectGeneratedError(generationError) || MAX_TEMPLATE_REPAIR_ATTEMPTS < 1) {
        throw generationError;
      }

      validationIssues = [
        "The model returned text that was not parseable as the required JSON object.",
        "Return only a complete JSON object with title, subject, level, topic, sections, and sourceNotes.",
      ];
      repaired = true;
      const repairPrompt = buildTemplateRepairPrompt({
        originalPrompt: typeof prompt.prompt === "string" ? prompt.prompt : "",
        previousDraft: (generationError.text ?? generationError.message).slice(0, MAX_FAILED_RESPONSE_REPAIR_CHARS),
        validationErrors: validationIssues,
        templateSections,
      });
      result = await generateDraftObject(model, repairPrompt);
    }

    try {
      generatedObject = normalizeGeneratedTemplateDraft(result.object, templateSections);
    } catch (validationError) {
      if (!(validationError instanceof TemplateDraftValidationError) || MAX_TEMPLATE_REPAIR_ATTEMPTS < 1 || repaired) {
        throw validationError;
      }

      validationIssues = validationError.issues;
      repaired = true;
      const repairPrompt = buildTemplateRepairPrompt({
        originalPrompt: typeof prompt.prompt === "string" ? prompt.prompt : "",
        previousDraft: result.object,
        validationErrors: validationIssues,
        templateSections,
      });
      result = await generateDraftObject(model, repairPrompt);
      generatedObject = normalizeGeneratedTemplateDraft(result.object, templateSections);
    }

    const documentState = renderGeneratedMarkdown(generatedObject);
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
      model: modelId,
      provider: "openrouter",
      targetArtifactId: saveResult.artifactId,
      sourceSelectionSnapshot,
      sourceCount: sourceIds.length,
      tokenPromptCount: usage?.inputTokens,
      tokenCompletionCount: usage?.outputTokens,
      finishedAt: Date.now(),
    });

    return NextResponse.json({
      ...saveResult,
      generationMeta: {
        attempts: repaired ? 2 : 1,
        repaired,
        validationIssues,
      },
    });
  } catch (error) {
    const failedModelId = resolveDocumentModelId(outputType);
    const errorMessage = generationFailureMessage(error, { outputType, modelId: failedModelId });
    await client
      .mutation(api.functions.academic.lessonKnowledgeLessonPlans.recordTeacherLessonPlanAiRun, {
        outputType,
        promptClass: promptClassForOutputType(outputType),
        status: "failed",
        model: failedModelId,
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
