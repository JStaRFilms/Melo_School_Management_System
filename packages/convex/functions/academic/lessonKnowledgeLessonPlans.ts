import { ConvexError, v } from "convex/values";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { buildTopicPlanningContextKey } from "@school/shared/planning-context";
import { normalizeHumanName } from "@school/shared/name-format";
import { getAuthenticatedSchoolMembership } from "./auth";
import {
  canUseKnowledgeMaterialAsLessonSource,
  resolveClassScopedKnowledgeMaterialStaffAccess,
  type KnowledgeActorContext,
} from "./lessonKnowledgeAccess";
import {
  getInstructionTemplateApplicabilityLabel,
  getInstructionTemplateScopeRank,
  sortInstructionTemplates,
  type InstructionTemplateScope,
  type SupportedInstructionTemplateOutputType,
} from "./lessonKnowledgeTemplatesHelpers";

const MAX_GENERATION_SOURCE_COUNT = 12;

const outputTypeValidator = v.union(
  v.literal("lesson_plan"),
  v.literal("student_note"),
  v.literal("assignment")
);

const revisionKindValidator = v.union(
  v.literal("generated"),
  v.literal("manual_save"),
  v.literal("approval_snapshot"),
  v.literal("publish_snapshot"),
  v.literal("archive_snapshot"),
  v.literal("source_refresh")
);

const visibilityValidator = v.union(
  v.literal("private_owner"),
  v.literal("staff_shared"),
  v.literal("class_scoped"),
  v.literal("student_approved")
);

const reviewStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("archived")
);

const processingStatusValidator = v.union(
  v.literal("awaiting_upload"),
  v.literal("queued"),
  v.literal("extracting"),
  v.literal("ocr_needed"),
  v.literal("ready"),
  v.literal("failed")
);

const searchStatusValidator = v.union(
  v.literal("not_indexed"),
  v.literal("indexing"),
  v.literal("indexed"),
  v.literal("failed")
);

const sourceTypeValidator = v.union(
  v.literal("file_upload"),
  v.literal("text_entry"),
  v.literal("youtube_link"),
  v.literal("generated_draft"),
  v.literal("student_upload"),
  v.literal("imported_curriculum")
);

const sourceValidator = v.object({
  _id: v.id("knowledgeMaterials"),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  sourceType: sourceTypeValidator,
  visibility: visibilityValidator,
  reviewStatus: reviewStatusValidator,
  processingStatus: processingStatusValidator,
  searchStatus: searchStatusValidator,
  subjectId: v.id("subjects"),
  subjectName: v.string(),
  subjectCode: v.string(),
  level: v.string(),
  topicLabel: v.string(),
  canUseAsLessonSource: v.boolean(),
});

const sourceContextValidator = v.object({
  subjectId: v.union(v.id("subjects"), v.null()),
  subjectName: v.union(v.string(), v.null()),
  subjectCode: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  topicLabel: v.union(v.string(), v.null()),
});

const topicPlanningContextValidator = v.object({
  kind: v.literal("topic"),
  classId: v.id("classes"),
  termId: v.id("academicTerms"),
  subjectId: v.id("subjects"),
  level: v.string(),
  topicId: v.id("knowledgeTopics"),
});

const topicPlanningContextSummaryValidator = v.object({
  kind: v.literal("topic"),
  classId: v.id("classes"),
  className: v.string(),
  termId: v.id("academicTerms"),
  termName: v.string(),
  subjectId: v.id("subjects"),
  subjectName: v.string(),
  subjectCode: v.string(),
  level: v.string(),
  topicId: v.id("knowledgeTopics"),
  topicTitle: v.string(),
  planningContextKey: v.string(),
  compatibilityMode: v.boolean(),
});

const templateSectionValidator = v.object({
  id: v.string(),
  label: v.string(),
  order: v.number(),
  required: v.boolean(),
  minimumWordCount: v.union(v.number(), v.null()),
});

const objectiveMinimumsValidator = v.object({
  minimumObjectives: v.number(),
  minimumSourceMaterials: v.number(),
  minimumSections: v.number(),
});

const templateValidator = v.union(
  v.null(),
  v.object({
    _id: v.id("instructionTemplates"),
    outputType: outputTypeValidator,
    title: v.string(),
    description: v.union(v.string(), v.null()),
    templateScope: v.union(
      v.literal("subject_and_level"),
      v.literal("subject_only"),
      v.literal("level_only"),
      v.literal("school_default")
    ),
    subjectId: v.union(v.id("subjects"), v.null()),
    subjectName: v.union(v.string(), v.null()),
    subjectCode: v.union(v.string(), v.null()),
    level: v.union(v.string(), v.null()),
    isSchoolDefault: v.boolean(),
    requiredSectionIds: v.array(v.string()),
    sectionDefinitions: v.array(templateSectionValidator),
    objectiveMinimums: objectiveMinimumsValidator,
    resolutionPath: v.string(),
    applicabilityLabel: v.string(),
    templateKey: v.string(),
    resolutionRank: v.number(),
  })
);

const revisionValidator = v.object({
  _id: v.id("instructionArtifactRevisions"),
  revisionNumber: v.number(),
  revisionKind: revisionKindValidator,
  createdAt: v.number(),
  title: v.string(),
  snippet: v.string(),
});

const draftValidator = v.object({
  artifactId: v.union(v.id("instructionArtifacts"), v.null()),
  documentId: v.union(v.id("instructionArtifactDocuments"), v.null()),
  revisionId: v.union(v.id("instructionArtifactRevisions"), v.null()),
  revisionNumber: v.number(),
  title: v.string(),
  documentState: v.string(),
  plainText: v.string(),
  outputType: outputTypeValidator,
  templateId: v.union(v.id("instructionTemplates"), v.null()),
  templateResolutionPath: v.union(v.string(), v.null()),
  sourceSelectionSnapshot: v.union(v.string(), v.null()),
  lastSavedAt: v.union(v.number(), v.null()),
});

const workspaceValidator = v.object({
  schoolName: v.union(v.string(), v.null()),
  outputType: outputTypeValidator,
  outputTypeLabel: v.string(),
  sourceIds: v.array(v.id("knowledgeMaterials")),
  selectedSourceCount: v.number(),
  accessibleSourceCount: v.number(),
  missingSourceIds: v.array(v.string()),
  inaccessibleSourceIds: v.array(v.string()),
  warnings: v.array(v.string()),
  sourceContext: sourceContextValidator,
  planningContext: v.union(topicPlanningContextSummaryValidator, v.null()),
  template: templateValidator,
  draft: draftValidator,
  revisions: v.array(revisionValidator),
  canGenerate: v.boolean(),
  canAutosave: v.boolean(),
  selectedSources: v.array(sourceValidator),
});

const saveResultValidator = v.object({
  artifactId: v.id("instructionArtifacts"),
  documentId: v.id("instructionArtifactDocuments"),
  revisionId: v.id("instructionArtifactRevisions"),
  revisionNumber: v.number(),
  title: v.string(),
  documentState: v.string(),
  plainText: v.string(),
  outputType: outputTypeValidator,
  sourceIds: v.array(v.id("knowledgeMaterials")),
  sourceSelectionSnapshot: v.string(),
  templateId: v.union(v.id("instructionTemplates"), v.null()),
  templateResolutionPath: v.union(v.string(), v.null()),
  savedAt: v.number(),
});

const aiRunLogValidator = v.object({
  outputType: outputTypeValidator,
  promptClass: v.string(),
  status: v.union(v.literal("queued"), v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("cancelled")),
  model: v.string(),
  provider: v.string(),
  targetArtifactId: v.optional(v.id("instructionArtifacts")),
  sourceSelectionSnapshot: v.string(),
  sourceCount: v.number(),
  tokenPromptCount: v.optional(v.number()),
  tokenCompletionCount: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
});

type WorkspaceOutputType = SupportedInstructionTemplateOutputType;
type WorkspaceRevisionKind = Doc<"instructionArtifactRevisions">["revisionKind"];
type WorkspaceDraft = {
  artifactId: Id<"instructionArtifacts"> | null;
  documentId: Id<"instructionArtifactDocuments"> | null;
  revisionId: Id<"instructionArtifactRevisions"> | null;
  revisionNumber: number;
  title: string;
  documentState: string;
  plainText: string;
  outputType: WorkspaceOutputType;
  templateId: Id<"instructionTemplates"> | null;
  templateResolutionPath: string | null;
  sourceSelectionSnapshot: string | null;
  lastSavedAt: number | null;
};

type WorkspaceRevision = {
  _id: Id<"instructionArtifactRevisions">;
  revisionNumber: number;
  revisionKind: WorkspaceRevisionKind;
  createdAt: number;
  title: string;
  snippet: string;
};

type TopicPlanningContextArgs = {
  kind: "topic";
  classId: Id<"classes">;
  termId: Id<"academicTerms">;
  subjectId: Id<"subjects">;
  level: string;
  topicId: Id<"knowledgeTopics">;
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

function buildActorContext(args: {
  userId: Id<"users">;
  schoolId: Id<"schools">;
  role: string;
  isSchoolAdmin: boolean;
}): KnowledgeActorContext {
  return {
    userId: args.userId,
    schoolId: args.schoolId,
    role: args.role === "admin" ? "admin" : args.role === "teacher" ? "teacher" : "student",
    isSchoolAdmin: args.isSchoolAdmin,
  };
}

function assertTeacherWorkspaceAccess(actor: KnowledgeActorContext) {
  if (actor.role !== "teacher" && actor.role !== "admin") {
    throw new ConvexError("Teacher workspace is restricted to staff");
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function levelMatchesKnowledgeScope(levelA: string, levelB: string) {
  return normalizeText(levelA).toLowerCase() === normalizeText(levelB).toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized ? normalized : undefined;
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

function assertGenerationSourceCount(sourceIds: string[]) {
  if (sourceIds.length > MAX_GENERATION_SOURCE_COUNT) {
    throw new ConvexError(`Select at most ${MAX_GENERATION_SOURCE_COUNT} source materials for generation.`);
  }
}

function outputTypeLabel(outputType: SupportedInstructionTemplateOutputType) {
  switch (outputType) {
    case "lesson_plan":
      return "Lesson plan";
    case "student_note":
      return "Student note";
    case "assignment":
      return "Assignment";
  }
}

function defaultTitle(outputType: SupportedInstructionTemplateOutputType) {
  switch (outputType) {
    case "lesson_plan":
      return "Lesson plan draft";
    case "student_note":
      return "Student note draft";
    case "assignment":
      return "Assignment draft";
  }
}

function sameSourceSet(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  const normalizedA = [...a].map((value) => value.trim()).sort();
  const normalizedB = [...b].map((value) => value.trim()).sort();

  return normalizedA.every((value, index) => value === normalizedB[index]);
}

function extractTitleFromMarkdown(markdown: string, fallbackTitle: string) {
  const match = /^#\s+(.+)$/m.exec(markdown);
  if (match?.[1]) {
    return normalizeText(match[1]);
  }

  return fallbackTitle;
}

function applyTitleToMarkdown(title: string, markdown: string, fallbackTitle: string) {
  const normalizedTitle = normalizeOptionalText(title) ?? fallbackTitle;
  const trimmed = markdown.trim();
  if (trimmed.startsWith("# ")) {
    return trimmed.replace(/^#\s+.+$/m, `# ${normalizedTitle}`);
  }

  return `# ${normalizedTitle}\n\n${trimmed}`;
}

function parseSourceSelectionSnapshot(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      version?: number;
      planningContextKind?: "topic" | "legacy_source_set" | null;
      planningContextKey?: string | null;
      sourceIds?: string[];
      primarySubjectId?: string | null;
      primaryLevel?: string | null;
      primaryTopicLabel?: string | null;
      templateId?: string | null;
      templateResolutionPath?: string | null;
      subjectId?: string | null;
      classId?: string | null;
      termId?: string | null;
      topicId?: string | null;
      topicLabel?: string | null;
      outputType?: WorkspaceOutputType;
      compatibility?: {
        isLegacy?: boolean;
        requiresContextConfirmation?: boolean;
      } | null;
    };
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
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

function snippetFromMarkdown(markdown: string) {
  const normalized = markdownToPlainText(markdown).replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function buildSearchText(args: {
  title: string;
  plainText: string;
  subjectName?: string | null;
  subjectCode?: string | null;
  level?: string | null;
  topicLabel?: string | null;
  templateTitle?: string | null;
  sourceTitles: string[];
}) {
  const parts = [
    args.title,
    args.subjectName,
    args.subjectCode,
    args.level,
    args.topicLabel,
    args.templateTitle,
    ...args.sourceTitles,
    args.plainText,
  ].filter((part): part is string => Boolean(part));

  const seen = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const normalized = normalizeText(part);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueParts.push(normalized);
  }

  const searchText = uniqueParts.join(" ");
  return searchText.length > 6000 ? searchText.slice(0, 6000) : searchText;
}

function buildSourceSelectionSnapshot(args: {
  outputType: SupportedInstructionTemplateOutputType;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  subjectId: Id<"subjects">;
  level: string;
  topicLabel: string | null;
  templateId: Id<"instructionTemplates"> | null;
  templateResolutionPath: string | null;
  planningContext?: TopicPlanningContextRecord | null;
}) {
  return JSON.stringify({
    version: args.planningContext ? 2 : 1,
    planningContextKind: args.planningContext ? "topic" : "legacy_source_set",
    planningContextKey: args.planningContext?.planningContextKey ?? null,
    outputType: args.outputType,
    sourceIds: args.sourceIds.map((sourceId) => String(sourceId)),
    sourceCount: args.sourceIds.length,
    primarySubjectId: String(args.subjectId),
    primaryLevel: args.level,
    primaryTopicLabel: args.topicLabel,
    templateId: args.templateId ? String(args.templateId) : null,
    templateResolutionPath: args.templateResolutionPath,
    subjectId: String(args.subjectId),
    classId: args.planningContext?.classId ?? null,
    termId: args.planningContext?.termId ?? null,
    topicId: args.planningContext?.topicId ?? null,
    topicLabel: args.topicLabel,
    compatibility: {
      isLegacy: !args.planningContext,
      requiresContextConfirmation: false,
    },
  });
}

function buildScaffoldMarkdown(args: {
  outputType: SupportedInstructionTemplateOutputType;
  title: string;
  subjectName: string | null;
  level: string | null;
  topicLabel: string | null;
  sourceTitles: string[];
  templateTitle: string | null;
  sectionLabels?: string[];
}) {
  const sectionLabels =
    args.sectionLabels && args.sectionLabels.length > 0
      ? args.sectionLabels
      : args.outputType === "lesson_plan"
        ? ["Overview", "Learning objectives", "Lesson flow", "Assessment", "Homework", "Source notes"]
        : args.outputType === "student_note"
          ? [
              "Summary",
              "Key points",
              "Vocabulary",
              "Worked example",
              "Reflection questions",
              "Source notes",
            ]
          : [
              "Instructions",
              "Tasks",
              "Submission checklist",
              "Marking guidance",
              "Source notes",
            ];

  const sourceList = args.sourceTitles.length
    ? args.sourceTitles.map((sourceTitle) => `- ${sourceTitle}`).join("\n")
    : "- Add at least one source material in the teacher library before generating.";

  const sectionBodies = sectionLabels.map((sectionLabel) => `## ${sectionLabel}\n`).join("\n");

  return normalizeText(
    [
      `# ${args.title}`,
      "",
      `**Subject:** ${args.subjectName ?? "Unknown subject"}`,
      `**Level:** ${args.level ?? "Unknown level"}`,
      args.topicLabel ? `**Topic:** ${args.topicLabel}` : undefined,
      args.templateTitle ? `**Template:** ${args.templateTitle}` : undefined,
      "",
      sectionBodies,
      "",
      "## Source notes",
      sourceList,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

async function fetchSubjectsById(ctx: QueryCtx, subjectIds: Array<Id<"subjects">>) {
  if (subjectIds.length === 0) {
    return new Map<string, Doc<"subjects">>();
  }

  const rows = await Promise.all(subjectIds.map((subjectId) => ctx.db.get(subjectId)));
  const subjectMap = new Map<string, Doc<"subjects">>();

  rows.forEach((row) => {
    if (row) {
      subjectMap.set(String(row._id), row);
    }
  });

  return subjectMap;
}

async function loadSources(
  ctx: QueryCtx,
  actor: KnowledgeActorContext,
  sourceIds: Array<Id<"knowledgeMaterials">>
) {
  const requestedRows = await Promise.all(sourceIds.map((sourceId) => ctx.db.get(sourceId)));
  const accessibleRows: Array<{
    _id: Id<"knowledgeMaterials">;
    title: string;
    description: string | null;
    sourceType: Doc<"knowledgeMaterials">["sourceType"];
    visibility: Doc<"knowledgeMaterials">["visibility"];
    reviewStatus: Doc<"knowledgeMaterials">["reviewStatus"];
    processingStatus: Doc<"knowledgeMaterials">["processingStatus"];
    searchStatus: Doc<"knowledgeMaterials">["searchStatus"];
    subjectId: Id<"subjects">;
    subjectName: string;
    subjectCode: string;
    level: string;
    topicLabel: string;
    canUseAsLessonSource: boolean;
  }> = [];
  const missingSourceIds: string[] = [];
  const inaccessibleSourceIds: string[] = [];
  const subjectIds = new Set<string>();

  for (let index = 0; index < requestedRows.length; index += 1) {
    const row = requestedRows[index];
    const requestedId = sourceIds[index];
    if (!row) {
      missingSourceIds.push(String(requestedId));
      continue;
    }

    if (row.schoolId !== actor.schoolId) {
      inaccessibleSourceIds.push(String(requestedId));
      continue;
    }

    const classAccess =
      row.visibility === "class_scoped"
        ? await resolveClassScopedKnowledgeMaterialStaffAccess(ctx, actor, row)
        : null;

    if (
      !canUseKnowledgeMaterialAsLessonSource(actor, row, {
        classContextMatches: classAccess?.classContextMatches,
      })
    ) {
      inaccessibleSourceIds.push(String(requestedId));
      continue;
    }

    accessibleRows.push({
      _id: row._id,
      title: row.title,
      description: row.description ?? null,
      sourceType: row.sourceType,
      visibility: row.visibility,
      reviewStatus: row.reviewStatus,
      processingStatus: row.processingStatus,
      searchStatus: row.searchStatus,
      subjectId: row.subjectId,
      subjectName: "",
      subjectCode: "",
      level: row.level,
      topicLabel: row.topicLabel,
      canUseAsLessonSource: true,
    });
    subjectIds.add(String(row.subjectId));
  }

  const subjectMap = await fetchSubjectsById(ctx, [...subjectIds].map((id) => id as Id<"subjects">));

  const selectedSources = accessibleRows.map((row) => {
    const subject = subjectMap.get(String(row.subjectId));
    return {
      ...row,
      subjectName: subject ? normalizeHumanName(subject.name) : "Unknown subject",
      subjectCode: subject?.code ?? "",
    };
  });

  const contextSource = selectedSources.find((source) => source.sourceType !== "imported_curriculum") ?? selectedSources[0] ?? null;
  const topicSource = selectedSources.find((source) => source.sourceType !== "imported_curriculum") ?? null;
  const sourceContext = contextSource
    ? {
        subjectId: contextSource.subjectId,
        subjectName: contextSource.subjectName,
        subjectCode: contextSource.subjectCode,
        level: contextSource.level,
        topicLabel: topicSource?.topicLabel ?? null,
      }
    : null;

  return {
    selectedSources,
    missingSourceIds,
    inaccessibleSourceIds,
    sourceContext,
  };
}

async function resolveTopicPlanningContext(
  ctx: QueryCtx | MutationCtx,
  schoolId: Id<"schools">,
  input: TopicPlanningContextArgs,
  outputType: SupportedInstructionTemplateOutputType
): Promise<TopicPlanningContextRecord> {
  const [topic, classDoc, term, subject] = await Promise.all([
    ctx.db.get(input.topicId),
    ctx.db.get(input.classId),
    ctx.db.get(input.termId),
    ctx.db.get(input.subjectId),
  ]);

  if (!topic || topic.schoolId !== schoolId || topic.status === "retired") {
    throw new ConvexError("Topic not found");
  }
  if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
    throw new ConvexError("Class not found");
  }
  if (!term || term.schoolId !== schoolId) {
    throw new ConvexError("Academic term not found");
  }
  if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
    throw new ConvexError("Subject not found");
  }

  if (
    String(topic.subjectId) !== String(input.subjectId) ||
    !levelMatchesKnowledgeScope(topic.level, input.level) ||
    String(topic.termId) !== String(input.termId)
  ) {
    throw new ConvexError("Topic context does not match the selected subject, level, and term");
  }

  return {
    kind: "topic",
    classId: input.classId,
    className: classDoc.name,
    termId: input.termId,
    termName: normalizeHumanName(term.name),
    subjectId: input.subjectId,
    subjectName: normalizeHumanName(subject.name),
    subjectCode: subject.code,
    level: topic.level,
    topicId: input.topicId,
    topicTitle: topic.title,
    planningContextKey: buildTopicPlanningContextKey({
      classId: String(input.classId),
      termId: String(input.termId),
      subjectId: String(input.subjectId),
      level: topic.level,
      topicId: String(input.topicId),
      outputType,
    }),
    compatibilityMode: false,
  };
}

async function loadCurrentArtifactBundle(
  ctx: QueryCtx,
  args: {
    schoolId: Id<"schools">;
    ownerUserId: Id<"users">;
    outputType: SupportedInstructionTemplateOutputType;
    sourceIds: Array<Id<"knowledgeMaterials">>;
    planningContext?: TopicPlanningContextRecord | null;
  }
) {
  const candidateArtifacts = await ctx.db
    .query("instructionArtifacts")
    .withIndex("by_school_and_owner_user", (q) =>
      q.eq("schoolId", args.schoolId).eq("ownerUserId", args.ownerUserId)
    )
    .take(100);

  for (const artifact of candidateArtifacts) {
    if (artifact.outputType !== args.outputType) {
      continue;
    }

    const sourceRows = await ctx.db
      .query("instructionArtifactSources")
      .withIndex("by_school_and_artifact", (q) =>
        q.eq("schoolId", args.schoolId).eq("artifactId", artifact._id)
      )
      .take(100);

    const revisions = await ctx.db
      .query("instructionArtifactRevisions")
      .withIndex("by_school_and_artifact", (q) =>
        q.eq("schoolId", args.schoolId).eq("artifactId", artifact._id)
      )
      .order("desc")
      .take(10);
    const sourceSnapshot = parseSourceSelectionSnapshot(revisions[0]?.sourceSelectionSnapshot ?? null);

    if (args.planningContext) {
      if (sourceSnapshot?.planningContextKey !== args.planningContext.planningContextKey) {
        continue;
      }
    } else {
      const artifactSourceIds = sourceRows.map((row) => String(row.materialId));
      const requestedSourceIds = args.sourceIds.map((id) => String(id));
      if (!sameSourceSet(artifactSourceIds, requestedSourceIds)) {
        continue;
      }
    }

    const document = artifact.currentDocumentId ? await ctx.db.get(artifact.currentDocumentId) : null;

    return {
      artifact,
      document,
      revisions,
      sourceIds: sourceRows.map((row) => row.materialId),
      sourceSnapshot,
    };
  }

  return null;
}

async function resolveWorkspaceTemplate(args: {
  ctx: QueryCtx | MutationCtx;
  schoolId: Id<"schools">;
  outputType: SupportedInstructionTemplateOutputType;
  subjectId: Id<"subjects"> | null;
  level: string | null;
  fallbackTemplateId?: Id<"instructionTemplates"> | null;
}) {
  const { ctx, schoolId, outputType, subjectId, level, fallbackTemplateId } = args;
  let candidate: Doc<"instructionTemplates"> | null = null;
  let resolutionPath: string | null = null;

  if (subjectId && level) {
    const exactRows = await ctx.db
      .query("instructionTemplates")
      .withIndex("by_school_and_output_type_and_subject_and_level", (q) =>
        q.eq("schoolId", schoolId)
          .eq("outputType", outputType)
          .eq("subjectId", subjectId)
          .eq("level", level)
      )
      .take(20);
    candidate = exactRows.filter((row) => row.isActive).sort((a, b) => sortInstructionTemplates(a, b))[0] ?? null;
    if (candidate) {
      resolutionPath = "subject + level";
    }
  }

  if (!candidate && subjectId) {
    const subjectRows = await ctx.db
      .query("instructionTemplates")
      .withIndex("by_school_and_output_type_and_subject", (q) =>
        q.eq("schoolId", schoolId).eq("outputType", outputType).eq("subjectId", subjectId)
      )
      .take(20);
    candidate = subjectRows.filter((row) => row.isActive).sort((a, b) => sortInstructionTemplates(a, b))[0] ?? null;
    if (candidate) {
      resolutionPath = "subject only";
    }
  }

  if (!candidate && level) {
    const levelRows = await ctx.db
      .query("instructionTemplates")
      .withIndex("by_school_and_output_type_and_level", (q) =>
        q.eq("schoolId", schoolId).eq("outputType", outputType).eq("level", level)
      )
      .take(20);
    candidate = levelRows.filter((row) => row.isActive).sort((a, b) => sortInstructionTemplates(a, b))[0] ?? null;
    if (candidate) {
      resolutionPath = "level only";
    }
  }

  if (!candidate) {
    const defaultRows = await ctx.db
      .query("instructionTemplates")
      .withIndex("by_school_and_output_type_and_is_school_default", (q) =>
        q.eq("schoolId", schoolId).eq("outputType", outputType).eq("isSchoolDefault", true)
      )
      .take(20);
    candidate = defaultRows.filter((row) => row.isActive).sort((a, b) => sortInstructionTemplates(a, b))[0] ?? null;
    if (candidate) {
      resolutionPath = "school default";
    }
  }

  if (!candidate && fallbackTemplateId) {
    const fallback = await ctx.db.get(fallbackTemplateId);
    if (fallback && fallback.schoolId === schoolId && fallback.outputType === outputType) {
      candidate = fallback;
      resolutionPath = "saved draft template";
    }
  }

  if (!candidate || !resolutionPath) {
    return null;
  }

  const subject = candidate.subjectId ? await ctx.db.get(candidate.subjectId) : null;
  return {
    _id: candidate._id,
    outputType: candidate.outputType as SupportedInstructionTemplateOutputType,
    title: candidate.title,
    description: candidate.description ?? null,
    templateScope: candidate.templateScope as InstructionTemplateScope,
    subjectId: candidate.subjectId ?? null,
    subjectName: subject ? normalizeHumanName(subject.name) : null,
    subjectCode: subject?.code ?? null,
    level: candidate.level ?? null,
    isSchoolDefault: candidate.isSchoolDefault,
    requiredSectionIds: candidate.requiredSectionIds,
    sectionDefinitions: candidate.sectionDefinitions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        id: section.id,
        label: section.label,
        order: section.order,
        required: section.required,
        minimumWordCount: section.minimumWordCount ?? null,
      })),
    objectiveMinimums: candidate.objectiveMinimums,
    resolutionPath,
    applicabilityLabel: getInstructionTemplateApplicabilityLabel({
      templateScope: candidate.templateScope as InstructionTemplateScope,
      subjectName: subject ? normalizeHumanName(subject.name) : null,
      subjectCode: subject?.code ?? null,
      level: candidate.level ?? null,
    }),
    templateKey: candidate.templateKey,
    resolutionRank: getInstructionTemplateScopeRank(candidate.templateScope as InstructionTemplateScope),
  };
}

async function upsertArtifactDocument(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  userId: Id<"users">;
  artifactId: Id<"instructionArtifacts">;
  existingDocumentId: Id<"instructionArtifactDocuments"> | null;
  outputType: SupportedInstructionTemplateOutputType;
  title: string;
  documentState: string;
  plainText: string;
  subjectId: Id<"subjects">;
  level: string;
  templateId: Id<"instructionTemplates"> | null;
  templateResolutionPath: string | null;
  sourceSelectionSnapshot: string;
  sourceTitles: string[];
  topicLabel: string | null;
  topicId?: Id<"knowledgeTopics"> | null;
}) {
  const now = Date.now();
  const subject = await args.ctx.db.get(args.subjectId);
  const searchText = buildSearchText({
    title: args.title,
    plainText: args.plainText,
    subjectName: subject ? normalizeHumanName(subject.name) : null,
    subjectCode: subject?.code ?? null,
    level: args.level,
    topicLabel: args.topicLabel,
    templateTitle: null,
    sourceTitles: args.sourceTitles,
  });

  const documentRecord = {
    schoolId: args.schoolId,
    artifactId: args.artifactId,
    documentFormat: "markdown" as const,
    documentState: args.documentState,
    plainText: args.plainText,
    searchText,
    visibility: "private_owner" as const,
    reviewStatus: "draft" as const,
    outputType: args.outputType,
    ...(args.topicId ? { topicId: args.topicId } : {}),
    searchStatus: "indexed" as const,
    createdAt: now,
    updatedAt: now,
    createdBy: args.userId,
    updatedBy: args.userId,
  };

  let documentId: Id<"instructionArtifactDocuments">;
  if (args.existingDocumentId) {
    await args.ctx.db.replace(args.existingDocumentId, documentRecord as never);
    documentId = args.existingDocumentId;
  } else {
    documentId = await args.ctx.db.insert("instructionArtifactDocuments", documentRecord as never);
  }

  await args.ctx.db.patch(args.artifactId, {
    subjectId: args.subjectId,
    level: args.level,
    ...(args.topicId ? { topicId: args.topicId } : {}),
    templateId: args.templateId ?? undefined,
    templateResolutionPath: args.templateResolutionPath ?? undefined,
    currentDocumentId: documentId,
    searchStatus: "indexed",
    searchText,
    updatedAt: now,
    updatedBy: args.userId,
  } as never);

  return { documentId, savedAt: now };
}

async function createRevision(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  userId: Id<"users">;
  artifactId: Id<"instructionArtifacts">;
  outputType: SupportedInstructionTemplateOutputType;
  title: string;
  documentState: string;
  plainText: string;
  templateId: Id<"instructionTemplates"> | null;
  templateResolutionPath: string | null;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  sourceSelectionSnapshot: string;
  revisionKind: WorkspaceRevisionKind;
}) {
  const latestRevision = await args.ctx.db
    .query("instructionArtifactRevisions")
    .withIndex("by_school_and_artifact", (q) =>
      q.eq("schoolId", args.schoolId).eq("artifactId", args.artifactId)
    )
    .order("desc")
    .take(1);
  const nextRevisionNumber = (latestRevision[0]?.revisionNumber ?? 0) + 1;
  const now = Date.now();
  const revisionId = await args.ctx.db.insert("instructionArtifactRevisions", {
    schoolId: args.schoolId,
    artifactId: args.artifactId,
    revisionNumber: nextRevisionNumber,
    revisionKind: args.revisionKind,
    documentFormat: "markdown",
    documentState: args.documentState,
    plainText: args.plainText,
    searchText: buildSearchText({
      title: args.title,
      plainText: args.plainText,
      sourceTitles: [],
    }),
    visibility: "private_owner",
    reviewStatus: "draft",
    outputType: args.outputType,
    templateId: args.templateId ?? undefined,
    templateResolutionPath: args.templateResolutionPath ?? undefined,
    sourceSelectionSnapshot: args.sourceSelectionSnapshot,
    sourceCount: args.sourceIds.length,
    createdAt: now,
    createdBy: args.userId,
  });

  await args.ctx.db.patch(args.artifactId, {
    currentRevisionId: revisionId,
    updatedAt: now,
    updatedBy: args.userId,
  } as never);

  return { revisionId, revisionNumber: nextRevisionNumber, savedAt: now };
}

async function recordAiRun(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  userId: Id<"users">;
  actorRole: KnowledgeActorContext["role"];
  outputType: SupportedInstructionTemplateOutputType;
  promptClass: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  model: string;
  provider: string;
  targetArtifactId?: Id<"instructionArtifacts">;
  sourceSelectionSnapshot: string;
  sourceCount: number;
  tokenPromptCount?: number;
  tokenCompletionCount?: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: number;
  finishedAt?: number;
}) {
  await args.ctx.db.insert("aiRunLogs", {
    schoolId: args.schoolId,
    actorUserId: args.userId,
    actorRole: args.actorRole,
    outputType: args.outputType,
    promptClass: args.promptClass,
    status: args.status,
    model: args.model,
    provider: args.provider,
    ...(args.targetArtifactId ? { targetArtifactId: args.targetArtifactId } : {}),
    sourceSelectionSnapshot: args.sourceSelectionSnapshot,
    sourceCount: args.sourceCount,
    ...(args.tokenPromptCount !== undefined ? { tokenPromptCount: args.tokenPromptCount } : {}),
    ...(args.tokenCompletionCount !== undefined ? { tokenCompletionCount: args.tokenCompletionCount } : {}),
    ...(args.errorCode ? { errorCode: args.errorCode } : {}),
    ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
    ...(args.startedAt ? { startedAt: args.startedAt } : {}),
    ...(args.finishedAt ? { finishedAt: args.finishedAt } : {}),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

async function syncArtifactSources(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  artifactId: Id<"instructionArtifacts">;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  userId: Id<"users">;
}) {
  const existing = await args.ctx.db
    .query("instructionArtifactSources")
    .withIndex("by_school_and_artifact", (q) =>
      q.eq("schoolId", args.schoolId).eq("artifactId", args.artifactId)
    )
    .take(100);

  const existingIds = existing.map((row) => String(row.materialId));
  const nextIds = args.sourceIds.map((sourceId) => String(sourceId));

  if (sameSourceSet(existingIds, nextIds)) {
    return;
  }

  for (const row of existing) {
    await args.ctx.db.delete(row._id);
  }

  const now = Date.now();
  for (let index = 0; index < args.sourceIds.length; index += 1) {
    await args.ctx.db.insert("instructionArtifactSources", {
      schoolId: args.schoolId,
      artifactId: args.artifactId,
      materialId: args.sourceIds[index],
      sourceOrder: index,
      createdAt: now,
      updatedAt: now,
      createdBy: args.userId,
      updatedBy: args.userId,
    });
  }
}

async function findMatchingArtifact(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  ownerUserId: Id<"users">;
  outputType: SupportedInstructionTemplateOutputType;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  planningContext?: TopicPlanningContextRecord | null;
}) {
  const candidateArtifacts = await args.ctx.db
    .query("instructionArtifacts")
    .withIndex("by_school_and_owner_user", (q) =>
      q.eq("schoolId", args.schoolId).eq("ownerUserId", args.ownerUserId)
    )
    .take(100);

  for (const artifact of candidateArtifacts) {
    if (artifact.outputType !== args.outputType) {
      continue;
    }

    const revisions = await args.ctx.db
      .query("instructionArtifactRevisions")
      .withIndex("by_school_and_artifact", (q) =>
        q.eq("schoolId", args.schoolId).eq("artifactId", artifact._id)
      )
      .order("desc")
      .take(1);
    const sourceSnapshot = parseSourceSelectionSnapshot(revisions[0]?.sourceSelectionSnapshot ?? null);

    if (args.planningContext) {
      if (sourceSnapshot?.planningContextKey === args.planningContext.planningContextKey) {
        return artifact;
      }
      continue;
    }

    const sourceRows = await args.ctx.db
      .query("instructionArtifactSources")
      .withIndex("by_school_and_artifact", (q) =>
        q.eq("schoolId", args.schoolId).eq("artifactId", artifact._id)
      )
      .take(100);
    const artifactSourceIds = sourceRows.map((row) => String(row.materialId));
    const requestedSourceIds = args.sourceIds.map((id) => String(id));

    if (sameSourceSet(artifactSourceIds, requestedSourceIds)) {
      return artifact;
    }
  }

  return null;
}

export const getTeacherInstructionWorkspace = query({
  args: {
    outputType: outputTypeValidator,
    sourceIds: v.array(v.id("knowledgeMaterials")),
    planningContext: v.optional(topicPlanningContextValidator),
  },
  returns: workspaceValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherWorkspaceAccess(actor);

    const sourceIdStrings = normalizeSourceIds(args.sourceIds.map((sourceId) => String(sourceId)));
    assertGenerationSourceCount(sourceIdStrings);
    const requestedSourceIds = sourceIdStrings.map((sourceId) => sourceId as Id<"knowledgeMaterials">);
    const planningContext = args.planningContext
      ? await resolveTopicPlanningContext(ctx, schoolId, args.planningContext, args.outputType)
      : null;

    const currentArtifactBundle = await loadCurrentArtifactBundle(ctx, {
      schoolId,
      ownerUserId: userId,
      outputType: args.outputType,
      sourceIds: requestedSourceIds,
      planningContext,
    });
    const effectiveSourceIds =
      requestedSourceIds.length > 0 ? requestedSourceIds : currentArtifactBundle?.sourceIds ?? [];
    const sourceBundle = await loadSources(ctx, actor, effectiveSourceIds);

    const school = await ctx.db.get(schoolId);
    const schoolName = school ? normalizeHumanName(school.name) : null;
    const currentArtifact = currentArtifactBundle?.artifact ?? null;
    const currentRevision = currentArtifactBundle?.revisions[0] ?? null;
    const sourceContext = planningContext
      ? {
          subjectId: planningContext.subjectId,
          subjectName: planningContext.subjectName,
          subjectCode: planningContext.subjectCode,
          level: planningContext.level,
          topicLabel: planningContext.topicTitle,
        }
      : sourceBundle.sourceContext ??
        (currentArtifact
          ? {
              subjectId: currentArtifact.subjectId,
              subjectName: null,
              subjectCode: null,
              level: currentArtifact.level,
              topicLabel: currentArtifactBundle?.sourceSnapshot?.primaryTopicLabel ?? null,
            }
          : {
              subjectId: null,
              subjectName: null,
              subjectCode: null,
              level: null,
              topicLabel: null,
            });

    const template = await resolveWorkspaceTemplate({
      ctx,
      schoolId,
      outputType: args.outputType,
      subjectId: sourceContext.subjectId,
      level: sourceContext.level,
      fallbackTemplateId: currentArtifact?.templateId ?? null,
    });

    const warnings: string[] = [];
    const sourceCount = sourceBundle.selectedSources.length;
    const hardSourceIssues = sourceBundle.missingSourceIds.length > 0 || sourceBundle.inaccessibleSourceIds.length > 0;

    if (sourceBundle.missingSourceIds.length > 0) {
      warnings.push(
        `Missing source ids: ${sourceBundle.missingSourceIds.join(", ")}. The draft can still be edited, but generation is blocked until the selection is repaired.`
      );
    }

    if (sourceBundle.inaccessibleSourceIds.length > 0) {
      warnings.push(
        `Some selected sources are no longer accessible: ${sourceBundle.inaccessibleSourceIds.join(", ")}. Generation is blocked until the selection is repaired.`
      );
    }

    if (sourceBundle.selectedSources.length > 1) {
      const subjectKeys = new Set(
        sourceBundle.selectedSources.map((source) => `${String(source.subjectId)}::${source.level.toLowerCase()}`)
      );
      if (subjectKeys.size > 1) {
        warnings.push(
          "The selected sources span more than one subject. The first accessible source is being used for template resolution."
        );
      }

      const levels = new Set(sourceBundle.selectedSources.map((source) => source.level.trim().toLowerCase()));
      if (levels.size > 1) {
        warnings.push(
          "The selected sources span more than one level. The first accessible source is being used for template resolution."
        );
      }
    }

    if (!template) {
      warnings.push(
        "No active template resolved for the current context. Generation is blocked until an admin adds a matching template or school default."
      );
    }

    if (sourceCount === 0 && !currentArtifact && !planningContext) {
      warnings.push("Select at least one source material from the teacher library to start a draft.");
    }

    const minimumSourceMaterials = template?.objectiveMinimums.minimumSourceMaterials ?? 1;
    if (sourceCount > 0 && sourceCount < minimumSourceMaterials) {
      warnings.push(
        `This template expects at least ${minimumSourceMaterials} source material${minimumSourceMaterials === 1 ? "" : "s"}.`
      );
    }

    const scaffoldTitle = currentArtifactBundle?.document
      ? extractTitleFromMarkdown(currentArtifactBundle.document.documentState, template?.title ?? defaultTitle(args.outputType))
      : template?.title ?? defaultTitle(args.outputType);
    const scaffoldDocumentState = currentArtifactBundle?.document?.documentState
      ? currentArtifactBundle.document.documentState
      : buildScaffoldMarkdown({
          outputType: args.outputType,
          title: scaffoldTitle,
          subjectName: sourceContext.subjectName,
          level: sourceContext.level,
          topicLabel: sourceContext.topicLabel,
          sourceTitles: sourceBundle.selectedSources.map((source) => source.title),
          templateTitle: template?.title ?? null,
          sectionLabels: template?.sectionDefinitions.map((section) => section.label),
        });
    const scaffoldPlainText = currentArtifactBundle?.document?.plainText
      ? currentArtifactBundle.document.plainText
      : markdownToPlainText(scaffoldDocumentState);

    const draft: WorkspaceDraft = {
      artifactId: currentArtifact?._id ?? null,
      documentId: currentArtifactBundle?.document?._id ?? null,
      revisionId: currentRevision?._id ?? null,
      revisionNumber: currentRevision?.revisionNumber ?? 0,
      title: scaffoldTitle,
      documentState: scaffoldDocumentState,
      plainText: scaffoldPlainText,
      outputType: args.outputType,
      templateId: currentArtifact?.templateId ?? template?._id ?? null,
      templateResolutionPath: currentArtifact?.templateResolutionPath ?? template?.resolutionPath ?? null,
      sourceSelectionSnapshot: currentRevision?.sourceSelectionSnapshot ?? null,
      lastSavedAt: currentArtifact?.updatedAt ?? null,
    };

    const canAutosave = Boolean(
      sourceContext.subjectId && sourceContext.level && (sourceCount > 0 || currentArtifact || planningContext)
    );
    const canGenerate = Boolean(
      template &&
        !hardSourceIssues &&
        sourceCount >= minimumSourceMaterials &&
        sourceContext.subjectId &&
        sourceContext.level
    );

    return {
      schoolName,
      outputType: args.outputType,
      outputTypeLabel: outputTypeLabel(args.outputType),
      sourceIds: effectiveSourceIds,
      selectedSourceCount: sourceCount,
      accessibleSourceCount: sourceCount,
      missingSourceIds: sourceBundle.missingSourceIds,
      inaccessibleSourceIds: sourceBundle.inaccessibleSourceIds,
      warnings,
      sourceContext,
      planningContext,
      template,
      draft,
      revisions: (currentArtifactBundle?.revisions ?? []).map((revision) => ({
        _id: revision._id,
        revisionNumber: revision.revisionNumber,
        revisionKind: revision.revisionKind,
        createdAt: revision.createdAt,
        title: extractTitleFromMarkdown(revision.documentState, scaffoldTitle),
        snippet: snippetFromMarkdown(revision.documentState),
      })),
      canGenerate,
      canAutosave,
      selectedSources: sourceBundle.selectedSources,
    };
  },
});

export const saveTeacherInstructionArtifactDraft = mutation({
  args: {
    artifactId: v.optional(v.union(v.id("instructionArtifacts"), v.null())),
    outputType: outputTypeValidator,
    title: v.string(),
    documentState: v.string(),
    plainText: v.string(),
    sourceIds: v.array(v.id("knowledgeMaterials")),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.optional(v.union(v.string(), v.null())),
    planningContext: v.optional(topicPlanningContextValidator),
    revisionKind: revisionKindValidator,
  },
  returns: saveResultValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherWorkspaceAccess(actor);
    const sourceIdStrings = normalizeSourceIds(args.sourceIds.map((sourceId) => String(sourceId)));
    assertGenerationSourceCount(sourceIdStrings);
    const sourceIds = sourceIdStrings.map((sourceId) => sourceId as Id<"knowledgeMaterials">);
    const sourceDocs = await ensureSelectableLessonSources(ctx, { actor, sourceIds });

    const normalizedTitle = normalizeOptionalText(args.title) ?? defaultTitle(args.outputType);
    const normalizedLevel = normalizeOptionalText(args.level);
    if (!normalizedLevel) {
      throw new ConvexError("Level is required to save a lesson workspace draft");
    }

    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
      throw new ConvexError("Subject not found");
    }

    const planningContext = args.planningContext
      ? await resolveTopicPlanningContext(ctx, schoolId, args.planningContext, args.outputType)
      : null;
    if (
      planningContext &&
      (String(planningContext.subjectId) !== String(args.subjectId) ||
        !levelMatchesKnowledgeScope(planningContext.level, normalizedLevel))
    ) {
      throw new ConvexError("Planning context does not match the lesson workspace subject and level");
    }

    const existingArtifact = args.artifactId
      ? await ctx.db.get(args.artifactId)
      : await findMatchingArtifact({
          ctx,
          schoolId,
          ownerUserId: userId,
          outputType: args.outputType,
          sourceIds,
          planningContext,
        });

    let artifactId: Id<"instructionArtifacts">;
    let existingDocumentId: Id<"instructionArtifactDocuments"> | null = null;

    if (existingArtifact) {
      if (existingArtifact.schoolId !== schoolId) {
        throw new ConvexError("Cross-school access denied");
      }

      if (existingArtifact.ownerUserId !== userId && !isSchoolAdmin && role !== "admin") {
        throw new ConvexError("You cannot edit this draft");
      }

      artifactId = existingArtifact._id;
      existingDocumentId = existingArtifact.currentDocumentId ?? null;
    } else {
      artifactId = await ctx.db.insert("instructionArtifacts", {
        schoolId,
        ownerUserId: userId,
        ownerRole: actor.role === "admin" ? "admin" : "teacher",
        outputType: args.outputType,
        artifactStatus: "draft",
        visibility: "private_owner",
        reviewStatus: "draft",
        subjectId: args.subjectId,
        level: normalizedLevel,
        ...(planningContext ? { topicId: planningContext.topicId } : {}),
        searchStatus: "not_indexed",
        searchText: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: userId,
        updatedBy: userId,
      });
    }

    const template = await resolveWorkspaceTemplate({
      ctx,
      schoolId,
      outputType: args.outputType,
      subjectId: args.subjectId,
      level: normalizedLevel,
      fallbackTemplateId: existingArtifact?.templateId ?? null,
    });

    const sourceTitles = sourceDocs
      .map((source) => normalizeOptionalText(source.title) ?? "")
      .filter((title) => Boolean(title));
    const sourceSelectionSnapshot = buildSourceSelectionSnapshot({
      outputType: args.outputType,
      sourceIds,
      subjectId: args.subjectId,
      level: normalizedLevel,
      topicLabel: planningContext?.topicTitle ?? normalizeOptionalText(args.topicLabel) ?? null,
      templateId: template?._id ?? existingArtifact?.templateId ?? null,
      templateResolutionPath: template?.resolutionPath ?? existingArtifact?.templateResolutionPath ?? null,
      planningContext,
    });

    const searchText = buildSearchText({
      title: normalizedTitle,
      plainText: args.plainText,
      subjectName: normalizeHumanName(subject.name),
      subjectCode: subject.code,
      level: normalizedLevel,
      topicLabel: planningContext?.topicTitle ?? normalizeOptionalText(args.topicLabel) ?? null,
      templateTitle: template?.title ?? null,
      sourceTitles,
    });

    const titleAppliedDocumentState = applyTitleToMarkdown(
      normalizedTitle,
      args.documentState,
      normalizedTitle
    );
    const titleAppliedPlainText = markdownToPlainText(titleAppliedDocumentState);

    const documentResult = await upsertArtifactDocument({
      ctx,
      schoolId,
      userId,
      artifactId,
      existingDocumentId,
      outputType: args.outputType,
      title: normalizedTitle,
      documentState: titleAppliedDocumentState,
      plainText: titleAppliedPlainText,
      subjectId: args.subjectId,
      level: normalizedLevel,
      templateId: template?._id ?? existingArtifact?.templateId ?? null,
      templateResolutionPath: template?.resolutionPath ?? existingArtifact?.templateResolutionPath ?? null,
      sourceSelectionSnapshot,
      sourceTitles,
      topicLabel: planningContext?.topicTitle ?? normalizeOptionalText(args.topicLabel) ?? null,
      topicId: planningContext?.topicId ?? null,
    });

    const revisionResult = await createRevision({
      ctx,
      schoolId,
      userId,
      artifactId,
      outputType: args.outputType,
      title: normalizedTitle,
      documentState: titleAppliedDocumentState,
      plainText: titleAppliedPlainText,
      templateId: template?._id ?? existingArtifact?.templateId ?? null,
      templateResolutionPath: template?.resolutionPath ?? existingArtifact?.templateResolutionPath ?? null,
      sourceIds,
      sourceSelectionSnapshot,
      revisionKind: args.revisionKind,
    });

    if (sourceIds.length > 0) {
      await syncArtifactSources({
        ctx,
        schoolId,
        artifactId,
        sourceIds,
        userId,
      });
    }

    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId,
      actorUserId: userId,
      actorRole: actor.role,
      eventType: existingArtifact ? "overridden" : "created",
      entityType: "instructionArtifactRevision",
      artifactId,
      changeSummary: `${existingArtifact ? "Updated" : "Created"} ${outputTypeLabel(args.outputType).toLowerCase()} draft \"${normalizedTitle}\" using ${sourceIds.length} source${sourceIds.length === 1 ? "" : "s"}.`,
    });

    return {
      artifactId,
      documentId: documentResult.documentId,
      revisionId: revisionResult.revisionId,
      revisionNumber: revisionResult.revisionNumber,
      title: normalizedTitle,
      documentState: titleAppliedDocumentState,
      plainText: titleAppliedPlainText,
      outputType: args.outputType,
      sourceIds,
      sourceSelectionSnapshot,
      templateId: template?._id ?? existingArtifact?.templateId ?? null,
      templateResolutionPath: template?.resolutionPath ?? existingArtifact?.templateResolutionPath ?? null,
      savedAt: revisionResult.savedAt,
    };
  },
});

export const recordTeacherLessonPlanAiRun = mutation({
  args: aiRunLogValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherWorkspaceAccess(actor);

    await recordAiRun({
      ctx,
      schoolId,
      userId,
      actorRole: actor.role,
      outputType: args.outputType,
      promptClass: args.promptClass,
      status: args.status,
      model: args.model,
      provider: args.provider,
      ...(args.targetArtifactId ? { targetArtifactId: args.targetArtifactId } : {}),
      sourceSelectionSnapshot: args.sourceSelectionSnapshot,
      sourceCount: args.sourceCount,
      ...(args.tokenPromptCount !== undefined ? { tokenPromptCount: args.tokenPromptCount } : {}),
      ...(args.tokenCompletionCount !== undefined ? { tokenCompletionCount: args.tokenCompletionCount } : {}),
      ...(args.errorCode ? { errorCode: args.errorCode } : {}),
      ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
      ...(args.startedAt ? { startedAt: args.startedAt } : {}),
      ...(args.finishedAt ? { finishedAt: args.finishedAt } : {}),
    });

    return null;
  },
});

async function ensureSelectableLessonSources(
  ctx: MutationCtx,
  args: { actor: KnowledgeActorContext; sourceIds: Array<Id<"knowledgeMaterials">> }
): Promise<Array<Doc<"knowledgeMaterials">>> {
  const sources: Array<Doc<"knowledgeMaterials">> = [];

  for (const sourceId of args.sourceIds) {
    const source = await ctx.db.get(sourceId);
    if (!source) {
      throw new ConvexError("Source material not found");
    }

    if (source.schoolId !== args.actor.schoolId) {
      throw new ConvexError("Cross-school access denied");
    }

    const classAccess = source.visibility === "class_scoped"
      ? await resolveClassScopedKnowledgeMaterialStaffAccess(ctx, args.actor, source)
      : null;

    if (
      !canUseKnowledgeMaterialAsLessonSource(args.actor, source, {
        classContextMatches: classAccess?.classContextMatches,
      })
    ) {
      throw new ConvexError("You cannot use one or more selected sources for this draft");
    }

    sources.push(source);
  }

  return sources;
}
