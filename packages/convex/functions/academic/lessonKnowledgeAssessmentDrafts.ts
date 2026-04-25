import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { normalizeHumanName } from "@school/shared/name-format";
import { getAuthenticatedSchoolMembership } from "./auth";
import {
  canUseKnowledgeMaterialAsLessonSource,
  resolveClassScopedKnowledgeMaterialStaffAccess,
  type KnowledgeActorContext,
} from "./lessonKnowledgeAccess";

const MAX_GENERATION_SOURCE_COUNT = 12;

const draftModeValidator = v.union(
  v.literal("practice_quiz"),
  v.literal("class_test"),
  v.literal("exam_draft")
);

const outputTypeValidator = v.union(
  v.literal("question_bank_draft"),
  v.literal("cbt_draft")
);

const knowledgeVisibilityValidator = v.union(
  v.literal("private_owner"),
  v.literal("staff_shared"),
  v.literal("class_scoped"),
  v.literal("student_approved")
);

const knowledgeReviewStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_review"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("archived")
);

const knowledgeProcessingStatusValidator = v.union(
  v.literal("awaiting_upload"),
  v.literal("queued"),
  v.literal("extracting"),
  v.literal("ocr_needed"),
  v.literal("ready"),
  v.literal("failed")
);

const knowledgeSourceTypeValidator = v.union(
  v.literal("file_upload"),
  v.literal("text_entry"),
  v.literal("youtube_link"),
  v.literal("generated_draft"),
  v.literal("student_upload"),
  v.literal("imported_curriculum")
);

const knowledgeOwnerRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("admin"),
  v.literal("student"),
  v.literal("system")
);

const questionDifficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);

const questionTypeValidator = v.union(
  v.literal("multiple_choice"),
  v.literal("short_answer"),
  v.literal("essay"),
  v.literal("true_false"),
  v.literal("fill_in_the_blank")
);

const sourceValidator = v.object({
  _id: v.id("knowledgeMaterials"),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  sourceType: knowledgeSourceTypeValidator,
  visibility: knowledgeVisibilityValidator,
  reviewStatus: knowledgeReviewStatusValidator,
  processingStatus: knowledgeProcessingStatusValidator,
  searchStatus: v.union(
    v.literal("not_indexed"),
    v.literal("indexing"),
    v.literal("indexed"),
    v.literal("failed")
  ),
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

const bankItemValidator = v.object({
  _id: v.id("assessmentBankItems"),
  itemOrder: v.number(),
  questionType: questionTypeValidator,
  difficulty: questionDifficultyValidator,
  promptText: v.string(),
  answerText: v.string(),
  explanationText: v.string(),
  marks: v.union(v.number(), v.null()),
  tags: v.array(v.string()),
});

const bankDraftValidator = v.object({
  bankId: v.union(v.id("assessmentBanks"), v.null()),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  draftMode: draftModeValidator,
  outputType: outputTypeValidator,
  bankStatus: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("archived"),
    v.literal("superseded")
  ),
  visibility: knowledgeVisibilityValidator,
  reviewStatus: knowledgeReviewStatusValidator,
  subjectId: v.union(v.id("subjects"), v.null()),
  subjectName: v.union(v.string(), v.null()),
  subjectCode: v.union(v.string(), v.null()),
  level: v.union(v.string(), v.null()),
  topicLabel: v.union(v.string(), v.null()),
  sourceSelectionSnapshot: v.union(v.string(), v.null()),
  lastSavedAt: v.union(v.number(), v.null()),
  itemCount: v.number(),
});

const workspaceValidator = v.object({
  schoolName: v.union(v.string(), v.null()),
  draftMode: draftModeValidator,
  draftModeLabel: v.string(),
  outputType: outputTypeValidator,
  outputTypeLabel: v.string(),
  sourceIds: v.array(v.id("knowledgeMaterials")),
  selectedSourceCount: v.number(),
  accessibleSourceCount: v.number(),
  missingSourceIds: v.array(v.string()),
  inaccessibleSourceIds: v.array(v.string()),
  warnings: v.array(v.string()),
  sourceContext: sourceContextValidator,
  draft: bankDraftValidator,
  items: v.array(bankItemValidator),
  canGenerate: v.boolean(),
  canAutosave: v.boolean(),
  selectedSources: v.array(sourceValidator),
});

const saveResultValidator = v.object({
  bankId: v.id("assessmentBanks"),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  draftMode: draftModeValidator,
  outputType: outputTypeValidator,
  sourceSelectionSnapshot: v.string(),
  itemCount: v.number(),
  savedAt: v.number(),
});

const aiRunLogValidator = v.object({
  outputType: outputTypeValidator,
  promptClass: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("cancelled")
  ),
  model: v.string(),
  provider: v.string(),
  targetAssessmentBankId: v.optional(v.id("assessmentBanks")),
  sourceSelectionSnapshot: v.string(),
  sourceCount: v.number(),
  tokenPromptCount: v.optional(v.number()),
  tokenCompletionCount: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  finishedAt: v.optional(v.number()),
});

type WorkspaceSource = {
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
};

type AssessmentOutputType = "question_bank_draft" | "cbt_draft";

type WorkspaceBank = Doc<"assessmentBanks"> & {
  draftMode?: Doc<"assessmentBanks">["draftMode"];
  sourceSelectionSnapshot?: Doc<"assessmentBanks">["sourceSelectionSnapshot"];
};

type WorkspaceItem = {
  _id: Id<"assessmentBankItems">;
  itemOrder: number;
  questionType: Doc<"assessmentBankItems">["questionType"];
  difficulty: Doc<"assessmentBankItems">["difficulty"];
  promptText: string;
  answerText: string;
  explanationText: string;
  marks: number | null;
  tags: string[];
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

function outputTypeForDraftMode(
  draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined
): AssessmentOutputType {
  return draftMode === "exam_draft" ? "cbt_draft" : "question_bank_draft";
}

function draftModeLabel(draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined) {
  switch (draftMode) {
    case "practice_quiz":
      return "Practice quiz";
    case "class_test":
      return "Class test";
    case "exam_draft":
      return "Exam draft";
    default:
      return "Assessment draft";
  }
}

function outputTypeLabel(outputType: AssessmentOutputType) {
  return outputType === "cbt_draft" ? "CBT draft" : "Question bank draft";
}

function defaultQuestionType(outputType: AssessmentOutputType) {
  return outputType === "cbt_draft" ? "multiple_choice" : "short_answer";
}

function buildSourceSelectionSnapshot(args: {
  draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined;
  outputType: AssessmentOutputType;
  sourceIds: Array<Id<"knowledgeMaterials">>;
  subjectId: Id<"subjects"> | null;
  level: string | null;
  topicLabel: string | null;
}) {
  return JSON.stringify({
    draftMode: args.draftMode ?? null,
    outputType: args.outputType,
    sourceIds: args.sourceIds.map((sourceId) => String(sourceId)),
    sourceCount: args.sourceIds.length,
    primarySubjectId: args.subjectId ? String(args.subjectId) : null,
    primaryLevel: args.level,
    primaryTopicLabel: args.topicLabel,
  });
}

function parseSourceSelectionSnapshot(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as {
      draftMode?: Doc<"assessmentBanks">["draftMode"] | null;
      outputType?: AssessmentOutputType;
      sourceIds?: string[];
      sourceCount?: number;
      primarySubjectId?: string | null;
      primaryLevel?: string | null;
      primaryTopicLabel?: string | null;
    };

    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function buildSearchText(args: {
  title: string;
  description?: string | null;
  draftModeLabel: string;
  outputTypeLabel: string;
  subjectName?: string | null;
  subjectCode?: string | null;
  level?: string | null;
  topicLabel?: string | null;
  sourceTitles: string[];
  itemTexts: string[];
}) {
  const parts = [
    args.title,
    args.description,
    args.draftModeLabel,
    args.outputTypeLabel,
    args.subjectName,
    args.subjectCode,
    args.level,
    args.topicLabel,
    ...args.sourceTitles,
    ...args.itemTexts,
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

function buildItemSearchText(item: {
  questionType: WorkspaceItem["questionType"];
  difficulty: WorkspaceItem["difficulty"];
  promptText: string;
  answerText: string;
  explanationText: string;
  marks: number | null;
  tags: string[];
}) {
  return buildSearchText({
    title: item.promptText,
    description: item.answerText,
    draftModeLabel: item.questionType,
    outputTypeLabel: item.difficulty,
    sourceTitles: [],
    itemTexts: [
      item.explanationText,
      item.marks !== null ? `Marks: ${item.marks}` : "",
      ...item.tags,
    ],
  });
}

function defaultAssessmentTitle(args: {
  draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined;
  topicLabel: string | null;
}) {
  const label = args.topicLabel?.trim() || "Assessment";
  switch (args.draftMode) {
    case "practice_quiz":
      return `${label} practice quiz`;
    case "class_test":
      return `${label} class test`;
    case "exam_draft":
      return `${label} exam draft`;
    default:
      return `${label} assessment draft`;
  }
}

function defaultAssessmentDescription(args: {
  draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined;
  sourceCount: number;
}) {
  const mode = draftModeLabel(args.draftMode).toLowerCase();
  return args.sourceCount > 0
    ? `Drafted as a ${mode} from ${args.sourceCount} source material${args.sourceCount === 1 ? "" : "s"}.`
    : `Drafted as a ${mode}.`;
}

function normalizeQuestionTags(tags: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = normalizeText(tag);
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
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

  const selectedSources: WorkspaceSource[] = accessibleRows.map((row) => {
    const subject = subjectMap.get(String(row.subjectId));
    return {
      ...row,
      subjectName: subject ? normalizeHumanName(subject.name) : "Unknown subject",
      subjectCode: subject?.code ?? "",
    };
  });

  const sourceContext = selectedSources[0]
    ? {
        subjectId: selectedSources[0].subjectId,
        subjectName: selectedSources[0].subjectName,
        subjectCode: selectedSources[0].subjectCode,
        level: selectedSources[0].level,
        topicLabel: selectedSources[0].topicLabel,
      }
    : null;

  return {
    selectedSources,
    missingSourceIds,
    inaccessibleSourceIds,
    sourceContext,
  };
}

async function fetchAssessmentBankItems(
  ctx: QueryCtx,
  args: { schoolId: Id<"schools">; bankId: Id<"assessmentBanks"> }
): Promise<WorkspaceItem[]> {
  const rows = await ctx.db
    .query("assessmentBankItems")
    .withIndex("by_school_and_bank_and_item_order", (q) =>
      q.eq("schoolId", args.schoolId).eq("bankId", args.bankId)
    )
    .take(200);

  return rows.map((row) => ({
    _id: row._id,
    itemOrder: row.itemOrder,
    questionType: row.questionType,
    difficulty: row.difficulty,
    promptText: row.promptText,
    answerText: row.answerText,
    explanationText: row.explanationText,
    marks: row.marks ?? null,
    tags: row.tags,
  }));
}

async function findMatchingAssessmentBank(args: {
  ctx: QueryCtx | MutationCtx;
  schoolId: Id<"schools">;
  ownerUserId: Id<"users">;
  outputType: AssessmentOutputType;
  draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined;
  sourceSelectionSnapshot: string;
}) {
  const candidateBanks = await args.ctx.db
    .query("assessmentBanks")
    .withIndex("by_school_and_owner_user", (q) =>
      q.eq("schoolId", args.schoolId).eq("ownerUserId", args.ownerUserId)
    )
    .take(100);

  const sameContext = candidateBanks
    .filter((bank) => bank.outputType === args.outputType)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const exactMatch = sameContext.find((bank) => {
    const bankMode = bank.draftMode ?? null;
    const bankSnapshot = bank.sourceSelectionSnapshot ?? null;
    return bankMode === (args.draftMode ?? null) && bankSnapshot === args.sourceSelectionSnapshot;
  });

  return exactMatch ?? null;
}

async function syncAssessmentBankItems(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  bankId: Id<"assessmentBanks">;
  userId: Id<"users">;
  items: Array<{
    questionType: WorkspaceItem["questionType"];
    difficulty: WorkspaceItem["difficulty"];
    promptText: string;
    answerText: string;
    explanationText: string;
    marks: number | null;
    tags: string[];
  }>;
}) {
  while (true) {
    const existing = await args.ctx.db
      .query("assessmentBankItems")
      .withIndex("by_school_and_bank", (q) =>
        q.eq("schoolId", args.schoolId).eq("bankId", args.bankId)
      )
      .take(100);

    if (existing.length === 0) {
      break;
    }

    for (const row of existing) {
      await args.ctx.db.delete(row._id);
    }
  }

  const now = Date.now();
  for (let index = 0; index < args.items.length; index += 1) {
    const item = args.items[index];
    const searchText = buildItemSearchText(item);
    await args.ctx.db.insert("assessmentBankItems", {
      schoolId: args.schoolId,
      bankId: args.bankId,
      itemOrder: index,
      questionType: item.questionType,
      difficulty: item.difficulty,
      promptText: item.promptText,
      answerText: item.answerText,
      explanationText: item.explanationText,
      ...(item.marks !== null ? { marks: item.marks } : {}),
      tags: item.tags,
      visibility: "private_owner",
      reviewStatus: "draft",
      searchStatus: "indexed",
      searchText,
      createdAt: now,
      updatedAt: now,
      createdBy: args.userId,
      updatedBy: args.userId,
    });
  }
}

async function recordAssessmentBankAuditEvent(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  actorUserId: Id<"users">;
  actorRole: KnowledgeActorContext["role"];
  bankId: Id<"assessmentBanks">;
  afterTitle: string;
  bankExists: boolean;
}) {
  await args.ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
    schoolId: args.schoolId,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    eventType: args.bankExists ? "overridden" : "created",
    entityType: "assessmentBank",
    bankId: args.bankId,
    changeSummary: args.bankExists
      ? `Updated assessment draft "${args.afterTitle}".`
      : `Created assessment draft "${args.afterTitle}".`,
  });
}

function outputTypeFromDraftMode(
  draftMode: Doc<"assessmentBanks">["draftMode"] | null | undefined
): AssessmentOutputType {
  return outputTypeForDraftMode(draftMode);
}

export const getTeacherAssessmentBankWorkspace = query({
  args: {
    draftMode: draftModeValidator,
    sourceIds: v.array(v.id("knowledgeMaterials")),
  },
  returns: workspaceValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherWorkspaceAccess(actor);

    const sourceIdStrings = normalizeSourceIds(args.sourceIds.map((sourceId) => String(sourceId)));
    assertGenerationSourceCount(sourceIdStrings);
    const sourceIds = sourceIdStrings.map((sourceId) => sourceId as Id<"knowledgeMaterials">);

    const sourceBundle = await loadSources(ctx, actor, sourceIds);
    const outputType = outputTypeFromDraftMode(args.draftMode);
    const currentSourceContext = sourceBundle.sourceContext ?? null;
    const sourceSelectionSnapshot = buildSourceSelectionSnapshot({
      draftMode: args.draftMode,
      outputType,
      sourceIds,
      subjectId: currentSourceContext?.subjectId ?? null,
      level: currentSourceContext?.level ?? null,
      topicLabel: currentSourceContext?.topicLabel ?? null,
    });
    const matchingBank = await findMatchingAssessmentBank({
      ctx,
      schoolId,
      ownerUserId: userId,
      outputType,
      draftMode: args.draftMode,
      sourceSelectionSnapshot,
    });

    const school = await ctx.db.get(schoolId);
    const schoolName = school ? normalizeHumanName(school.name) : null;
    const matchingSnapshot = parseSourceSelectionSnapshot(
      matchingBank?.sourceSelectionSnapshot ?? null
    );
    const matchingSubject = matchingBank?.subjectId ? await ctx.db.get(matchingBank.subjectId) : null;
    const sourceContext =
      sourceBundle.sourceContext ??
      (matchingBank
        ? {
            subjectId: matchingBank.subjectId,
            subjectName: matchingSubject ? normalizeHumanName(matchingSubject.name) : null,
            subjectCode: matchingSubject?.code ?? null,
            level: matchingBank.level,
            topicLabel: matchingSnapshot?.primaryTopicLabel ?? null,
          }
        : {
            subjectId: null,
            subjectName: null,
            subjectCode: null,
            level: null,
            topicLabel: null,
          });

    const selectedSourceCount = sourceBundle.selectedSources.length;
    const hardSourceIssues =
      sourceBundle.missingSourceIds.length > 0 || sourceBundle.inaccessibleSourceIds.length > 0;
    const sourceIssues: string[] = [];

    if (sourceBundle.missingSourceIds.length > 0) {
      sourceIssues.push(
        `Missing source ids: ${sourceBundle.missingSourceIds.join(", ")}. Generation is blocked until the selection is repaired.`
      );
    }

    if (sourceBundle.inaccessibleSourceIds.length > 0) {
      sourceIssues.push(
        `Some selected sources are no longer accessible: ${sourceBundle.inaccessibleSourceIds.join(", ")}. Generation is blocked until the selection is repaired.`
      );
    }

    if (selectedSourceCount > 1) {
      const subjectKeys = new Set(
        sourceBundle.selectedSources.map((source) => `${String(source.subjectId)}::${source.level.toLowerCase()}`)
      );
      if (subjectKeys.size > 1) {
        sourceIssues.push(
          "The selected sources span more than one subject. The first accessible source is being used for context resolution."
        );
      }

      const levels = new Set(sourceBundle.selectedSources.map((source) => source.level.trim().toLowerCase()));
      if (levels.size > 1) {
        sourceIssues.push(
          "The selected sources span more than one level. The first accessible source is being used for context resolution."
        );
      }
    }

    if (selectedSourceCount === 0 && !matchingBank) {
      sourceIssues.push("Select at least one source material from the teacher library to start a draft.");
    }

    const bank = matchingBank;
    const sourceSelectionSourceIds = bank?.sourceSelectionSnapshot
      ? parseSourceSelectionSnapshot(bank.sourceSelectionSnapshot)?.sourceIds ?? sourceIds.map((sourceId) => String(sourceId))
      : sourceIds.map((sourceId) => String(sourceId));

    const bankSourceIds = sourceSelectionSourceIds.map((sourceId) => sourceId as Id<"knowledgeMaterials">);
    const bankItems = bank ? await fetchAssessmentBankItems(ctx, { schoolId, bankId: bank._id }) : [];

    const draftMode = bank?.draftMode ?? args.draftMode;
    const inferredOutputType = outputTypeFromDraftMode(draftMode);
    const title = bank?.title ?? defaultAssessmentTitle({ draftMode, topicLabel: sourceContext.topicLabel });
    const description = bank?.description ?? defaultAssessmentDescription({
      draftMode,
      sourceCount: selectedSourceCount || bankItems.length,
    });
    const lastSavedAt = bank?.updatedAt ?? null;
    const itemCount = bankItems.length;

    const canAutosave = Boolean(sourceContext.subjectId && sourceContext.level && (selectedSourceCount > 0 || bank));
    const canGenerate = Boolean(
      sourceContext.subjectId &&
        sourceContext.level &&
        selectedSourceCount > 0 &&
        !hardSourceIssues
    );

    return {
      schoolName,
      draftMode,
      draftModeLabel: draftModeLabel(draftMode),
      outputType: inferredOutputType,
      outputTypeLabel: outputTypeLabel(inferredOutputType),
      sourceIds: bankSourceIds,
      selectedSourceCount,
      accessibleSourceCount: selectedSourceCount,
      missingSourceIds: sourceBundle.missingSourceIds,
      inaccessibleSourceIds: sourceBundle.inaccessibleSourceIds,
      warnings: sourceIssues,
      sourceContext,
      draft: {
        bankId: bank?._id ?? null,
        title,
        description,
        draftMode,
        outputType: inferredOutputType,
        bankStatus: bank?.bankStatus ?? "draft",
        visibility: bank?.visibility ?? "private_owner",
        reviewStatus: bank?.reviewStatus ?? "draft",
        subjectId: bank?.subjectId ?? sourceContext.subjectId ?? null,
        subjectName: sourceContext.subjectName,
        subjectCode: sourceContext.subjectCode,
        level: sourceContext.level,
        topicLabel: sourceContext.topicLabel,
        sourceSelectionSnapshot: bank?.sourceSelectionSnapshot ?? sourceSelectionSnapshot,
        lastSavedAt,
        itemCount,
      },
      items: bankItems,
      canGenerate,
      canAutosave,
      selectedSources: sourceBundle.selectedSources,
    };
  },
});

export const saveTeacherAssessmentBankDraft = mutation({
  args: {
    bankId: v.optional(v.union(v.id("assessmentBanks"), v.null())),
    draftMode: draftModeValidator,
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    sourceIds: v.array(v.id("knowledgeMaterials")),
    sourceSelectionSnapshot: v.string(),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.optional(v.union(v.string(), v.null())),
    items: v.array(
      v.object({
        questionType: questionTypeValidator,
        difficulty: questionDifficultyValidator,
        promptText: v.string(),
        answerText: v.string(),
        explanationText: v.string(),
        marks: v.optional(v.union(v.number(), v.null())),
        tags: v.array(v.string()),
      })
    ),
  },
  returns: saveResultValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherWorkspaceAccess(actor);

    const normalizedTitle = normalizeOptionalText(args.title) ?? defaultAssessmentTitle({
      draftMode: args.draftMode,
      topicLabel: normalizeOptionalText(args.topicLabel) ?? null,
    });
    const normalizedDescription = normalizeOptionalText(args.description) ?? null;
    const normalizedLevel = normalizeOptionalText(args.level);
    if (!normalizedLevel) {
      throw new ConvexError("Level is required to save an assessment draft");
    }

    const sourceIdStrings = normalizeSourceIds(args.sourceIds.map((sourceId) => String(sourceId)));
    assertGenerationSourceCount(sourceIdStrings);
    const sourceIds = sourceIdStrings.map((sourceId) => sourceId as Id<"knowledgeMaterials">);
    const sourceDocs = await Promise.all(sourceIds.map((sourceId) => ctx.db.get(sourceId)));
    const sourceTitles = sourceDocs
      .map((source) => source?.title ?? "")
      .map((title) => normalizeOptionalText(title) ?? "")
      .filter((title) => Boolean(title));

    await Promise.all(
      sourceIds.map(async (sourceId) => {
        const source = await ctx.db.get(sourceId);
        if (!source) {
          throw new ConvexError("Source material not found");
        }
        if (source.schoolId !== schoolId) {
          throw new ConvexError("Cross-school access denied");
        }
        const classAccess =
          source.visibility === "class_scoped"
            ? await resolveClassScopedKnowledgeMaterialStaffAccess(ctx, actor, source)
            : null;
        if (
          !canUseKnowledgeMaterialAsLessonSource(actor, source, {
            classContextMatches: classAccess?.classContextMatches,
          })
        ) {
          throw new ConvexError("You cannot use one or more selected sources for this draft");
        }
      })
    );

    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
      throw new ConvexError("Subject not found");
    }

    const outputType = outputTypeFromDraftMode(args.draftMode);
    const draftModeText = draftModeLabel(args.draftMode);
    const outputTypeText = outputTypeLabel(outputType);
    const topicLabel = normalizeOptionalText(args.topicLabel) ?? null;
    const bankSearchText = buildSearchText({
      title: normalizedTitle,
      description: normalizedDescription,
      draftModeLabel: draftModeText,
      outputTypeLabel: outputTypeText,
      subjectName: normalizeHumanName(subject.name),
      subjectCode: subject.code,
      level: normalizedLevel,
      topicLabel,
      sourceTitles,
      itemTexts: args.items.flatMap((item) => [
        item.promptText,
        item.answerText,
        item.explanationText,
        item.tags.join(" "),
      ]),
    });
    const existingBank = args.bankId
      ? await ctx.db.get(args.bankId)
      : await findMatchingAssessmentBank({
          ctx,
          schoolId,
          ownerUserId: userId,
          outputType,
          draftMode: args.draftMode,
          sourceSelectionSnapshot: args.sourceSelectionSnapshot,
        });

    let bankId: Id<"assessmentBanks">;
    const now = Date.now();

    if (existingBank) {
      if (existingBank.schoolId !== schoolId) {
        throw new ConvexError("Cross-school access denied");
      }

      if (existingBank.ownerUserId !== userId && !isSchoolAdmin && role !== "admin") {
        throw new ConvexError("You cannot edit this draft");
      }

      bankId = existingBank._id;
      await ctx.db.patch(bankId, {
        draftMode: args.draftMode,
        sourceSelectionSnapshot: args.sourceSelectionSnapshot,
        bankStatus: "draft",
        title: normalizedTitle,
        ...(normalizedDescription !== null ? { description: normalizedDescription } : {}),
        visibility: "private_owner",
        reviewStatus: "draft",
        subjectId: args.subjectId,
        level: normalizedLevel,
        searchStatus: "indexed",
        searchText: bankSearchText,
        updatedAt: now,
        updatedBy: userId,
      } as never);
    } else {
      bankId = await ctx.db.insert("assessmentBanks", {
        schoolId,
        ownerUserId: userId,
        ownerRole: actor.role === "admin" ? "admin" : "teacher",
        outputType,
        draftMode: args.draftMode,
        sourceSelectionSnapshot: args.sourceSelectionSnapshot,
        bankStatus: "draft",
        title: normalizedTitle,
        ...(normalizedDescription !== null ? { description: normalizedDescription } : {}),
        visibility: "private_owner",
        reviewStatus: "draft",
        subjectId: args.subjectId,
        level: normalizedLevel,
        searchStatus: "indexed",
        searchText: bankSearchText,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      } as never);
    }

    await syncAssessmentBankItems({
      ctx,
      schoolId,
      bankId,
      userId,
      items: args.items.map((item) => ({
        questionType: item.questionType,
        difficulty: item.difficulty,
        promptText: item.promptText,
        answerText: item.answerText,
        explanationText: item.explanationText,
        marks: item.marks ?? null,
        tags: normalizeQuestionTags(item.tags),
      })),
    });

    await recordAssessmentBankAuditEvent({
      ctx,
      schoolId,
      actorUserId: userId,
      actorRole: actor.role,
      bankId,
      afterTitle: normalizedTitle,
      bankExists: Boolean(existingBank),
    });

    return {
      bankId,
      title: normalizedTitle,
      description: normalizedDescription,
      draftMode: args.draftMode,
      outputType,
      sourceSelectionSnapshot: args.sourceSelectionSnapshot,
      itemCount: args.items.length,
      savedAt: now,
    };
  },
});

export const recordTeacherAssessmentBankAiRun = mutation({
  args: aiRunLogValidator,
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherWorkspaceAccess(actor);

    await ctx.db.insert("aiRunLogs", {
      schoolId,
      actorUserId: userId,
      actorRole: actor.role,
      outputType: args.outputType,
      promptClass: args.promptClass,
      status: args.status,
      model: args.model,
      provider: args.provider,
      ...(args.targetAssessmentBankId ? { targetAssessmentBankId: args.targetAssessmentBankId } : {}),
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

    return null;
  },
});
