import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { normalizeHumanName } from "@school/shared/name-format";
import { buildMaterialSearchSeed, suggestKnowledgeMaterialLabels, normalizeKnowledgeMaterialText, canManageKnowledgeMaterial } from "./lessonKnowledgeIngestionHelpers";
import { getAuthenticatedSchoolMembership, getTeacherAssignableClassIds, getTeacherAssignableSubjectIds } from "./auth";
import {
  canPromoteKnowledgeMaterial,
  canReadKnowledgeMaterialInStaffSurface,
  canUseKnowledgeMaterialAsLessonSource,
  resolveClassScopedKnowledgeMaterialStaffAccess,
  type KnowledgeActorContext,
} from "./lessonKnowledgeAccess";
import { normalizeKnowledgeSearchQuery } from "./lessonKnowledgeSearch";
import {
  knowledgeMaterialOriginalFileAccessValidator,
  knowledgeMaterialSourceProofValidator,
  readKnowledgeMaterialOriginalFileAccess,
  readKnowledgeMaterialSourceProof,
} from "./lessonKnowledgeSourceProof";

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

const lessonLibraryMaterialValidator = v.object({
  _id: v.id("knowledgeMaterials"),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  ownerUserId: v.id("users"),
  ownerName: v.string(),
  ownerRole: knowledgeOwnerRoleValidator,
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
  topicId: v.union(v.id("knowledgeTopics"), v.null()),
  topicTitle: v.union(v.string(), v.null()),
  labelSuggestions: v.array(v.string()),
  chunkCount: v.number(),
  externalUrl: v.union(v.string(), v.null()),
  indexedAt: v.union(v.number(), v.null()),
  ingestionErrorMessage: v.union(v.string(), v.null()),
  selectedPageRanges: v.union(v.string(), v.null()),
  selectedPageNumbers: v.union(v.array(v.number()), v.null()),
  pdfPageCount: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  isOwnedByMe: v.boolean(),
  canEdit: v.boolean(),
  canPublish: v.boolean(),
  canSelectAsSource: v.boolean(),
});

const lessonLibrarySummaryValidator = v.object({
  loaded: v.number(),
  privateOwner: v.number(),
  staffVisible: v.number(),
  readyToSelect: v.number(),
  publishable: v.number(),
  needsAttention: v.number(),
});

const lessonLibrarySubjectValidator = v.object({
  id: v.string(),
  name: v.string(),
  code: v.string(),
});

const lessonLibraryTopicValidator = v.object({
  _id: v.id("knowledgeTopics"),
  title: v.string(),
  subjectId: v.id("subjects"),
  subjectName: v.string(),
  level: v.string(),
  termId: v.id("academicTerms"),
  status: v.union(v.literal("draft"), v.literal("active"), v.literal("retired")),
});

const teacherPlanningWorkItemValidator = v.object({
  topicId: v.id("knowledgeTopics"),
  topicTitle: v.string(),
  topicSummary: v.union(v.string(), v.null()),
  subjectId: v.id("subjects"),
  subjectName: v.string(),
  subjectCode: v.string(),
  level: v.string(),
  termId: v.id("academicTerms"),
  termName: v.string(),
  preferredClassId: v.union(v.id("classes"), v.null()),
  preferredClassName: v.union(v.string(), v.null()),
  sourceCount: v.number(),
  readySourceCount: v.number(),
  lessonCount: v.number(),
  questionBankCount: v.number(),
  latestUpdatedAt: v.number(),
  outputs: v.array(
    v.object({
      kind: v.union(v.literal("lesson"), v.literal("question_bank")),
      id: v.string(),
      title: v.string(),
      outputType: v.union(
        v.literal("lesson_plan"),
        v.literal("student_note"),
        v.literal("assignment"),
        v.literal("question_bank_draft"),
        v.literal("cbt_draft")
      ),
      draftMode: v.union(v.string(), v.null()),
      updatedAt: v.number(),
    })
  ),
});

const lessonVideoSubmissionValidator = lessonLibraryMaterialValidator;

function normalizeOptionalText(value?: string | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? normalizeKnowledgeMaterialText(trimmed) : undefined;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new ConvexError(`${label} is required`);
  }

  return normalized;
}

function normalizeLevelKey(value: string) {
  return value.trim().toLowerCase();
}

function levelMatchesKnowledgeScope(levelA: string, levelB: string) {
  return normalizeLevelKey(levelA) === normalizeLevelKey(levelB);
}

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

function assertTeacherLibraryAccess(actor: KnowledgeActorContext) {
  if (actor.role !== "teacher" && actor.role !== "admin") {
    throw new ConvexError("Teacher library is restricted to staff");
  }
}

async function getTeacherLibraryClassAccessContext(
  ctx: Pick<QueryCtx, "db">,
  actor: KnowledgeActorContext,
  material: Doc<"knowledgeMaterials">
) {
  if (material.visibility !== "class_scoped") {
    return {};
  }

  const classAccess = await resolveClassScopedKnowledgeMaterialStaffAccess(ctx, actor, material);
  return { classContextMatches: classAccess.classContextMatches };
}

function isTeacherLibraryVisibleToActor(
  actor: KnowledgeActorContext,
  material: Pick<Doc<"knowledgeMaterials">, "schoolId" | "ownerUserId" | "visibility" | "reviewStatus"> & {
    processingStatus: Doc<"knowledgeMaterials">["processingStatus"];
    searchStatus: Doc<"knowledgeMaterials">["searchStatus"];
  },
  args?: { classContextMatches?: boolean }
) {
  return canReadKnowledgeMaterialInStaffSurface(actor, material, args);
}

function isTeacherLibrarySelectableSource(
  actor: KnowledgeActorContext,
  material: Pick<Doc<"knowledgeMaterials">, "schoolId" | "ownerUserId" | "visibility" | "reviewStatus"> & {
    processingStatus: Doc<"knowledgeMaterials">["processingStatus"];
    searchStatus: Doc<"knowledgeMaterials">["searchStatus"];
  },
  args?: { classContextMatches?: boolean }
) {
  return canUseKnowledgeMaterialAsLessonSource(actor, material, args);
}

async function patchTeacherLibraryChunksForState(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    materialId: Id<"knowledgeMaterials">;
    visibility?: Doc<"knowledgeMaterials">["visibility"];
    reviewStatus?: Doc<"knowledgeMaterials">["reviewStatus"];
    topicId?: Id<"knowledgeTopics"> | null;
  }
) {
  const chunks = await ctx.db
    .query("knowledgeMaterialChunks")
    .withIndex("by_school_and_material", (q) =>
      q.eq("schoolId", args.schoolId).eq("materialId", args.materialId)
    )
    .take(100);

  const updatedAt = Date.now();
  for (const chunk of chunks) {
    await ctx.db.patch(chunk._id, {
      ...(args.visibility ? { visibility: args.visibility } : {}),
      ...(args.reviewStatus ? { reviewStatus: args.reviewStatus } : {}),
      ...(args.topicId !== undefined && args.topicId !== null ? { topicId: args.topicId } : {}),
      updatedAt,
    });
  }
}

async function writeTeacherLibraryAuditEvent(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorUserId: Id<"users">;
    actorRole: KnowledgeActorContext["role"];
    eventType:
      | "approved"
      | "promoted"
      | "published"
      | "rejected"
      | "archived"
      | "overridden"
      | "topic_attached"
      | "class_bound"
      | "visibility_changed"
      | "created"
      | "ingestion_started"
      | "extraction_completed"
      | "ocr_needed"
      | "ingestion_failed"
      | "retry_requested";
    materialId: Id<"knowledgeMaterials">;
    beforeVisibility?: Doc<"knowledgeMaterials">["visibility"] | null;
    afterVisibility?: Doc<"knowledgeMaterials">["visibility"] | null;
    beforeReviewStatus?: Doc<"knowledgeMaterials">["reviewStatus"] | null;
    afterReviewStatus?: Doc<"knowledgeMaterials">["reviewStatus"] | null;
    changeSummary: string;
  }
) {
  await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
    schoolId: args.schoolId,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    eventType: args.eventType,
    entityType: "knowledgeMaterial",
    materialId: args.materialId,
    ...(args.beforeVisibility !== undefined && args.beforeVisibility !== null ? { beforeVisibility: args.beforeVisibility } : {}),
    ...(args.afterVisibility !== undefined && args.afterVisibility !== null ? { afterVisibility: args.afterVisibility } : {}),
    ...(args.beforeReviewStatus !== undefined && args.beforeReviewStatus !== null ? { beforeReviewStatus: args.beforeReviewStatus } : {}),
    ...(args.afterReviewStatus !== undefined && args.afterReviewStatus !== null ? { afterReviewStatus: args.afterReviewStatus } : {}),
    changeSummary: args.changeSummary,
  });
}

async function writeTeacherTopicAuditEvent(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorUserId: Id<"users">;
    actorRole: KnowledgeActorContext["role"];
    eventType: "created" | "overridden" | "topic_attached" | "approved" | "rejected" | "archived";
    topicId: Id<"knowledgeTopics">;
    beforeTopicId?: Id<"knowledgeTopics"> | null;
    afterTopicId?: Id<"knowledgeTopics"> | null;
    changeSummary: string;
  }
) {
  await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
    schoolId: args.schoolId,
    actorUserId: args.actorUserId,
    actorRole: args.actorRole,
    eventType: args.eventType,
    entityType: "knowledgeTopic",
    topicId: args.topicId,
    ...(args.beforeTopicId !== undefined ? { beforeTopicId: args.beforeTopicId } : {}),
    ...(args.afterTopicId !== undefined ? { afterTopicId: args.afterTopicId } : {}),
    changeSummary: args.changeSummary,
  });
}

function materialStateSummary(material: Pick<Doc<"knowledgeMaterials">, "title" | "visibility" | "reviewStatus">) {
  return `${material.title} • ${material.visibility} / ${material.reviewStatus}`;
}

async function readActiveKnowledgeTerm(ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">, schoolId: Id<"schools">) {
  const activeTerms = await ctx.db
    .query("academicTerms")
    .withIndex("by_school_active", (q) => q.eq("schoolId", schoolId).eq("isActive", true))
    .collect();

  return [...activeTerms].sort((a, b) => b.startDate - a.startDate)[0] ?? null;
}

async function buildUniqueKnowledgeTopicSlug(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  schoolId: Id<"schools">,
  baseLabel: string
) {
  const baseSlug = baseLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "topic";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await ctx.db
      .query("knowledgeTopics")
      .withIndex("by_school_and_slug", (q) => q.eq("schoolId", schoolId).eq("slug", candidate))
      .unique();

    if (!existing) {
      return candidate;
    }
  }

  throw new ConvexError("Could not generate a unique topic slug");
}

async function readTeacherLibraryMaterials(
  ctx: Pick<QueryCtx, "db">,
  actor: KnowledgeActorContext,
  args: {
    searchQuery?: string;
    visibility?: Doc<"knowledgeMaterials">["visibility"] | "all";
    reviewStatus?: Doc<"knowledgeMaterials">["reviewStatus"] | "all";
    sourceType?: Doc<"knowledgeMaterials">["sourceType"] | "all";
    processingStatus?: Doc<"knowledgeMaterials">["processingStatus"] | "all";
    limit?: number;
  }
) {
  const limit = Math.min(Math.max(args.limit ?? 80, 1), 200);
  const rawLimit = Math.min(Math.max(limit * 3, 90), 300);
  const normalizedSearch = normalizeKnowledgeSearchQuery(args.searchQuery ?? "");

  let rows: Doc<"knowledgeMaterials">[] = [];
  if (normalizedSearch) {
    rows = await ctx.db
      .query("knowledgeMaterials")
      .withSearchIndex("search_search_text", (q) => {
        let search = q.search("searchText", normalizedSearch).eq("schoolId", actor.schoolId);

        if (args.visibility && args.visibility !== "all") {
          search = search.eq("visibility", args.visibility);
          if (args.visibility === "private_owner") {
            search = search.eq("ownerUserId", actor.userId);
          }
        }

        if (args.reviewStatus && args.reviewStatus !== "all") {
          search = search.eq("reviewStatus", args.reviewStatus);
        }

        if (args.sourceType && args.sourceType !== "all") {
          search = search.eq("sourceType", args.sourceType);
        }

        if (args.processingStatus && args.processingStatus !== "all") {
          search = search.eq("processingStatus", args.processingStatus);
        }

        return search;
      })
      .take(rawLimit);
  } else {
    rows = await ctx.db
      .query("knowledgeMaterials")
      .withIndex("by_school", (q) => q.eq("schoolId", actor.schoolId))
      .order("desc")
      .take(rawLimit);
  }

  const accessibleRows: Array<{
    material: Doc<"knowledgeMaterials">;
    accessContext: { classContextMatches?: boolean };
  }> = [];

  for (const material of rows) {
    const accessContext = await getTeacherLibraryClassAccessContext(ctx, actor, material);
    if (!isTeacherLibraryVisibleToActor(actor, material, accessContext)) {
      continue;
    }

    if (args.visibility && args.visibility !== "all" && material.visibility !== args.visibility) {
      continue;
    }

    if (args.reviewStatus && args.reviewStatus !== "all" && material.reviewStatus !== args.reviewStatus) {
      continue;
    }

    if (args.sourceType && args.sourceType !== "all" && material.sourceType !== args.sourceType) {
      continue;
    }

    if (args.processingStatus && args.processingStatus !== "all" && material.processingStatus !== args.processingStatus) {
      continue;
    }

    accessibleRows.push({ material, accessContext });
  }

  const sortedRows = normalizedSearch
    ? accessibleRows
    : [...accessibleRows].sort((a, b) => {
        if (b.material.updatedAt !== a.material.updatedAt) {
          return b.material.updatedAt - a.material.updatedAt;
        }

        return b.material.createdAt - a.material.createdAt;
      });

  const ownerIds = [...new Set(sortedRows.map(({ material }) => String(material.ownerUserId)))];
  const subjectIds = [...new Set(sortedRows.map(({ material }) => String(material.subjectId)))];
  const topicIds = [...new Set(sortedRows.map(({ material }) => String(material.topicId ?? "")).filter(Boolean))];

  const [owners, subjects, topics] = await Promise.all([
    Promise.all(ownerIds.map((id) => ctx.db.get(id as Id<"users">))),
    Promise.all(subjectIds.map((id) => ctx.db.get(id as Id<"subjects">))),
    Promise.all(topicIds.map((id) => ctx.db.get(id as Id<"knowledgeTopics">))),
  ]);

  const ownerMap = new Map<string, Doc<"users"> | null>();
  ownerIds.forEach((id, index) => ownerMap.set(id, owners[index] as Doc<"users"> | null));
  const subjectMap = new Map<string, Doc<"subjects"> | null>();
  subjectIds.forEach((id, index) => subjectMap.set(id, subjects[index] as Doc<"subjects"> | null));
  const topicMap = new Map<string, Doc<"knowledgeTopics"> | null>();
  topicIds.forEach((id, index) => topicMap.set(id, topics[index] as Doc<"knowledgeTopics"> | null));

  const materials = sortedRows.slice(0, limit).map(({ material, accessContext }) => {
    const owner = ownerMap.get(String(material.ownerUserId)) ?? null;
    const subject = subjectMap.get(String(material.subjectId)) ?? null;
    const topic = material.topicId ? topicMap.get(String(material.topicId)) ?? null : null;
    const isOwnedByMe = String(material.ownerUserId) === String(actor.userId);
    const canEdit = canManageKnowledgeMaterial(actor, material);
    const canPublish =
      material.visibility === "private_owner" &&
      canPromoteKnowledgeMaterial(actor, material, {
        nextVisibility: "staff_shared",
        nextReviewStatus: "approved",
      }) &&
      material.processingStatus === "ready" &&
      material.searchStatus === "indexed";

    return {
      _id: material._id,
      title: material.title,
      description: material.description ?? null,
      ownerUserId: material.ownerUserId,
      ownerName: owner ? normalizeHumanName(owner.name) : "Unknown owner",
      ownerRole: material.ownerRole,
      sourceType: material.sourceType,
      visibility: material.visibility,
      reviewStatus: material.reviewStatus,
      processingStatus: material.processingStatus,
      searchStatus: material.searchStatus,
      subjectId: material.subjectId,
      subjectName: subject ? normalizeHumanName(subject.name) : "Unknown subject",
      subjectCode: subject?.code ?? "",
      level: material.level,
      topicLabel: material.topicLabel,
      topicId: material.topicId ?? null,
      topicTitle: topic ? topic.title : null,
      labelSuggestions: material.labelSuggestions,
      chunkCount: material.chunkCount,
      externalUrl: material.externalUrl ?? null,
      indexedAt: material.indexedAt,
      ingestionErrorMessage: material.ingestionErrorMessage,
      selectedPageRanges: material.selectedPageRanges ?? null,
      selectedPageNumbers: material.selectedPageNumbers ?? null,
      pdfPageCount: material.pdfPageCount ?? null,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      isOwnedByMe,
      canEdit,
      canPublish,
      canSelectAsSource: isTeacherLibrarySelectableSource(actor, material, accessContext),
    };
  });

  const summary = materials.reduce(
    (acc, material) => {
      acc.loaded += 1;
      if (material.visibility === "private_owner") {
        acc.privateOwner += 1;
      } else {
        acc.staffVisible += 1;
      }
      if (material.canSelectAsSource) {
        acc.readyToSelect += 1;
      }
      if (material.canPublish) {
        acc.publishable += 1;
      }
      if (material.processingStatus !== "ready" || material.searchStatus !== "indexed") {
        acc.needsAttention += 1;
      }
      return acc;
    },
    {
      loaded: 0,
      privateOwner: 0,
      staffVisible: 0,
      readyToSelect: 0,
      publishable: 0,
      needsAttention: 0,
    }
  );

  return {
    summary,
    materials,
  };
}

async function readTeacherLibrarySubjects(ctx: Pick<QueryCtx, "db">, actor: KnowledgeActorContext) {
  if (actor.isSchoolAdmin || actor.role === "admin") {
    const subjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", actor.schoolId))
      .take(300);

    return subjects
      .filter((subject) => !subject.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((subject) => ({
        id: String(subject._id),
        name: normalizeHumanName(subject.name),
        code: subject.code,
      }));
  }

  if (actor.role !== "teacher") {
    throw new ConvexError("Unauthorized");
  }

  const classIds = await getTeacherAssignableClassIds(ctx, actor.userId, actor.schoolId);
  const subjectIds = new Set<string>();
  for (const classId of classIds) {
    const assignableSubjectIds = await getTeacherAssignableSubjectIds(
      ctx,
      actor.userId,
      actor.schoolId,
      classId
    );
    assignableSubjectIds.forEach((subjectId) => subjectIds.add(String(subjectId)));
  }

  const subjectDocs = await Promise.all([...subjectIds].map((subjectId) => ctx.db.get(subjectId as Id<"subjects">)));

  return subjectDocs
    .filter((subject): subject is Doc<"subjects"> => subject !== null && subject.schoolId === actor.schoolId && !subject.isArchived)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((subject) => ({
      id: String(subject._id),
      name: normalizeHumanName(subject.name),
      code: subject.code,
    }));
}

async function readTeacherAssignableLevelLabels(ctx: Pick<QueryCtx, "db">, actor: KnowledgeActorContext) {
  if (actor.isSchoolAdmin || actor.role === "admin") {
    return null;
  }

  if (actor.role !== "teacher") {
    throw new ConvexError("Unauthorized");
  }

  const classIds = await getTeacherAssignableClassIds(ctx, actor.userId, actor.schoolId);
  const classDocs = await Promise.all(classIds.map((classId) => ctx.db.get(classId)));
  const allowedLevels = new Set<string>();

  for (const classDoc of classDocs) {
    if (!classDoc || classDoc.schoolId !== actor.schoolId || classDoc.isArchived) {
      continue;
    }

    for (const candidate of [classDoc.gradeName, classDoc.level, classDoc.name]) {
      const normalized = candidate?.trim();
      if (normalized) {
        allowedLevels.add(normalized.toLowerCase());
      }
    }
  }

  return allowedLevels;
}

async function readTeacherKnowledgeTopics(
  ctx: Pick<QueryCtx, "db">,
  actor: KnowledgeActorContext,
  args: { subjectId?: Id<"subjects">; level?: string; termId?: Id<"academicTerms">; limit?: number }
) {
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 150);
  const levelFilter = args.level ? normalizeRequiredText(args.level, "Level") : undefined;

  const allowedSubjects = await readTeacherLibrarySubjects(ctx, actor);
  const allowedSubjectIds = new Set(allowedSubjects.map((subject) => subject.id));
  const allowedLevels = await readTeacherAssignableLevelLabels(ctx, actor);

  const topics = await ctx.db
    .query("knowledgeTopics")
    .withIndex("by_school_and_status", (q) => q.eq("schoolId", actor.schoolId).eq("status", "active"))
    .take(300);

  const filteredTopics = topics.filter((topic) => {
    if (topic.status !== "active") {
      return false;
    }

    if (args.subjectId && String(topic.subjectId) !== String(args.subjectId)) {
      return false;
    }

    if (levelFilter && !levelMatchesKnowledgeScope(topic.level, levelFilter)) {
      return false;
    }

    if (args.termId && String(topic.termId) !== String(args.termId)) {
      return false;
    }

    if (!(actor.isSchoolAdmin || actor.role === "admin")) {
      if (!allowedSubjectIds.has(String(topic.subjectId))) {
        return false;
      }

      if (allowedLevels && !allowedLevels.has(topic.level.trim().toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  const subjectIds = [...new Set(filteredTopics.map((topic) => String(topic.subjectId)))];
  const subjects = await Promise.all(subjectIds.map((subjectId) => ctx.db.get(subjectId as Id<"subjects">)));
  const subjectMap = new Map<string, Doc<"subjects"> | null>();
  subjectIds.forEach((subjectId, index) => subjectMap.set(subjectId, subjects[index] as Doc<"subjects"> | null));

  return filteredTopics
    .sort((a, b) => {
      if (a.level.localeCompare(b.level) !== 0) {
        return a.level.localeCompare(b.level);
      }

      return a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map((topic) => ({
      _id: topic._id,
      title: topic.title,
      subjectId: topic.subjectId,
      subjectName: subjectMap.get(String(topic.subjectId)) ? normalizeHumanName(subjectMap.get(String(topic.subjectId))!.name) : "Unknown subject",
      level: topic.level,
      termId: topic.termId,
      status: topic.status,
    }));
}

export const listTeacherKnowledgeLibraryMaterials = query({
  args: {
    searchQuery: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("all"), knowledgeVisibilityValidator)),
    reviewStatus: v.optional(v.union(v.literal("all"), knowledgeReviewStatusValidator)),
    sourceType: v.optional(v.union(v.literal("all"), knowledgeSourceTypeValidator)),
    processingStatus: v.optional(v.union(v.literal("all"), knowledgeProcessingStatusValidator)),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    summary: lessonLibrarySummaryValidator,
    materials: v.array(lessonLibraryMaterialValidator),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    return await readTeacherLibraryMaterials(ctx, actor, args);
  },
});

export const listTeacherLibrarySubjects = query({
  args: {},
  returns: v.array(lessonLibrarySubjectValidator),
  handler: async (ctx) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    return await readTeacherLibrarySubjects(ctx, actor);
  },
});

export const listTeacherKnowledgeTopics = query({
  args: {
    subjectId: v.optional(v.id("subjects")),
    level: v.optional(v.string()),
    termId: v.optional(v.id("academicTerms")),
    limit: v.optional(v.number()),
  },
  returns: v.array(lessonLibraryTopicValidator),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    return await readTeacherKnowledgeTopics(ctx, actor, {
      subjectId: args.subjectId,
      level: args.level,
      termId: args.termId,
      limit: args.limit,
    });
  },
});

export const listTeacherPlanningTopicWork = query({
  args: {
    searchQuery: v.optional(v.string()),
    subjectId: v.optional(v.id("subjects")),
    level: v.optional(v.string()),
    termId: v.optional(v.id("academicTerms")),
    limit: v.optional(v.number()),
  },
  returns: v.array(teacherPlanningWorkItemValidator),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({ userId, schoolId, role, isSchoolAdmin });
    assertTeacherLibraryAccess(actor);

    const limit = Math.min(Math.max(args.limit ?? 24, 1), 80);
    const search = normalizeKnowledgeSearchQuery(args.searchQuery ?? "");
    const levelFilter = normalizeOptionalText(args.level);
    const assignableClassIds = actor.isSchoolAdmin || actor.role === "admin"
      ? null
      : new Set((await getTeacherAssignableClassIds(ctx, userId, schoolId)).map(String));
    const assignableSubjectIdsByClass = new Map<string, Set<string>>();

    const classRows = actor.isSchoolAdmin || actor.role === "admin"
      ? await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", schoolId)).collect()
      : await Promise.all([...(assignableClassIds ?? new Set<string>())].map((id) => ctx.db.get(id as Id<"classes">)));
    const classes: Doc<"classes">[] = [];
    for (const classDoc of classRows) {
      if (classDoc && !classDoc.isArchived) {
        classes.push(classDoc);
      }
    }

    for (const classDoc of classes) {
      if (actor.isSchoolAdmin || actor.role === "admin") {
        continue;
      }
      const subjectIds = await getTeacherAssignableSubjectIds(ctx, userId, schoolId, classDoc._id);
      assignableSubjectIdsByClass.set(String(classDoc._id), new Set(subjectIds.map(String)));
    }

    const levelToClass = new Map<string, Doc<"classes">>();
    for (const classDoc of classes) {
      const levelKey = normalizeLevelKey((classDoc.gradeName ?? classDoc.name ?? "").trim());
      if (levelKey && !levelToClass.has(levelKey)) {
        levelToClass.set(levelKey, classDoc);
      }
    }

    const topics = await ctx.db
      .query("knowledgeTopics")
      .withIndex("by_school_and_status", (q) => q.eq("schoolId", schoolId).eq("status", "active"))
      .take(300);

    const filteredTopics = topics.filter((topic) => {
      if (args.subjectId && String(topic.subjectId) !== String(args.subjectId)) return false;
      if (args.termId && String(topic.termId) !== String(args.termId)) return false;
      if (levelFilter && !levelMatchesKnowledgeScope(topic.level, levelFilter)) return false;
      if (search && !normalizeKnowledgeSearchQuery(`${topic.title} ${topic.summary ?? ""}`).includes(search)) return false;

      if (actor.isSchoolAdmin || actor.role === "admin") return true;
      const classForLevel = levelToClass.get(normalizeLevelKey(topic.level));
      if (!classForLevel) return false;
      const subjectsForClass = assignableSubjectIdsByClass.get(String(classForLevel._id));
      return subjectsForClass?.has(String(topic.subjectId)) ?? false;
    });

    const subjectIds = [...new Set(filteredTopics.map((topic) => String(topic.subjectId)))];
    const termIds = [...new Set(filteredTopics.map((topic) => String(topic.termId)))];
    const [subjects, terms] = await Promise.all([
      Promise.all(subjectIds.map((id) => ctx.db.get(id as Id<"subjects">))),
      Promise.all(termIds.map((id) => ctx.db.get(id as Id<"academicTerms">))),
    ]);
    const subjectMap = new Map<string, Doc<"subjects"> | null>();
    subjectIds.forEach((id, index) => subjectMap.set(id, subjects[index] as Doc<"subjects"> | null));
    const termMap = new Map<string, Doc<"academicTerms"> | null>();
    termIds.forEach((id, index) => termMap.set(id, terms[index] as Doc<"academicTerms"> | null));

    const rows = await Promise.all(filteredTopics.map(async (topic) => {
      const [materials, artifacts, banks] = await Promise.all([
        ctx.db.query("knowledgeMaterials").withIndex("by_school_and_topic", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id)).take(80),
        ctx.db.query("instructionArtifacts").withIndex("by_school_and_topic", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id)).take(40),
        ctx.db.query("assessmentBanks").withIndex("by_school_and_topic", (q) => q.eq("schoolId", schoolId).eq("topicId", topic._id)).take(40),
      ]);

      const visibleMaterials: Doc<"knowledgeMaterials">[] = [];
      for (const material of materials) {
        const accessContext = await getTeacherLibraryClassAccessContext(ctx, actor, material);
        if (isTeacherLibraryVisibleToActor(actor, material, accessContext)) {
          visibleMaterials.push(material);
        }
      }

      const visibleArtifacts = artifacts.filter((artifact) =>
        actor.isSchoolAdmin || actor.role === "admin" || String(artifact.ownerUserId) === String(userId) || artifact.visibility !== "private_owner"
      );
      const visibleBanks = banks.filter((bank) =>
        actor.isSchoolAdmin || actor.role === "admin" || String(bank.ownerUserId) === String(userId) || bank.visibility !== "private_owner"
      );

      const subject = subjectMap.get(String(topic.subjectId)) ?? null;
      const term = termMap.get(String(topic.termId)) ?? null;
      const preferredClass = levelToClass.get(normalizeLevelKey(topic.level)) ?? null;
      const latestUpdatedAt = Math.max(
        topic.updatedAt,
        ...visibleMaterials.map((item) => item.updatedAt),
        ...visibleArtifacts.map((item) => item.updatedAt),
        ...visibleBanks.map((item) => item.updatedAt)
      );
      const outputs = [
        ...visibleArtifacts.map((artifact) => ({
          kind: "lesson" as const,
          id: String(artifact._id),
          title: artifact.outputType.replace(/_/g, " "),
          outputType: artifact.outputType,
          draftMode: null,
          updatedAt: artifact.updatedAt,
        })),
        ...visibleBanks.map((bank) => ({
          kind: "question_bank" as const,
          id: String(bank._id),
          title: bank.title,
          outputType: bank.outputType,
          draftMode: bank.draftMode ?? null,
          updatedAt: bank.updatedAt,
        })),
      ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

      return {
        topicId: topic._id,
        topicTitle: topic.title,
        topicSummary: topic.summary ?? null,
        subjectId: topic.subjectId,
        subjectName: subject ? normalizeHumanName(subject.name) : "Unknown subject",
        subjectCode: subject?.code ?? "",
        level: topic.level,
        termId: topic.termId,
        termName: term?.name ?? "Unknown term",
        preferredClassId: preferredClass?._id ?? null,
        preferredClassName: preferredClass?.name ?? null,
        sourceCount: visibleMaterials.length,
        readySourceCount: visibleMaterials.filter((item) => item.processingStatus === "ready" && item.searchStatus === "indexed").length,
        lessonCount: visibleArtifacts.length,
        questionBankCount: visibleBanks.length,
        latestUpdatedAt,
        outputs,
      };
    }));

    return rows
      .sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt)
      .slice(0, limit);
  },
});

export const listTeacherYoutubeSubmissions = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    summary: lessonLibrarySummaryValidator,
    materials: v.array(lessonVideoSubmissionValidator),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    return await readTeacherLibraryMaterials(ctx, actor, {
      sourceType: "youtube_link",
      limit: args.limit,
    });
  },
});

export const getTeacherKnowledgeMaterialSourceProof = query({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    sourceProof: knowledgeMaterialSourceProofValidator,
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    const accessContext = await getTeacherLibraryClassAccessContext(ctx, actor, material);
    if (!isTeacherLibraryVisibleToActor(actor, material, accessContext)) {
      throw new ConvexError("You cannot inspect this material");
    }

    const sourceProof = await readKnowledgeMaterialSourceProof(ctx, {
      schoolId,
      materialId: material._id,
      storageId: material.storageId ?? null,
    });

    return {
      materialId: material._id,
      sourceProof,
    };
  },
});

export const getTeacherKnowledgeMaterialOriginalFileAccess = query({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: knowledgeMaterialOriginalFileAccessValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    const accessContext = await getTeacherLibraryClassAccessContext(ctx, actor, material);
    if (!isTeacherLibraryVisibleToActor(actor, material, accessContext)) {
      throw new ConvexError("You cannot inspect this material");
    }

    return await readKnowledgeMaterialOriginalFileAccess(ctx, {
      storageId: material.storageId ?? null,
    });
  },
});

export const updateTeacherKnowledgeMaterialDetails = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    searchText: v.string(),
    labelSuggestions: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    if (!canManageKnowledgeMaterial(actor, material)) {
      throw new ConvexError("You cannot manage this material");
    }

    if (material.reviewStatus === "archived") {
      throw new ConvexError("Archived materials cannot be edited");
    }

    const accessibleSubjects = await readTeacherLibrarySubjects(ctx, actor);
    if (!accessibleSubjects.some((subject) => subject.id === String(args.subjectId))) {
      throw new ConvexError("You cannot use that subject");
    }

    const title = normalizeRequiredText(args.title, "Title");
    const level = normalizeRequiredText(args.level, "Level");
    const topicLabel = normalizeRequiredText(args.topicLabel, "Topic label");
    const description = normalizeOptionalText(args.description);
    const nextDescription = description !== undefined ? description : material.description ?? undefined;
    const labelSuggestions = suggestKnowledgeMaterialLabels({
      title,
      topicLabel,
      description: nextDescription,
      externalUrl: material.externalUrl,
    });
    const searchText = buildMaterialSearchSeed({
      title,
      topicLabel,
      description: nextDescription,
      externalUrl: material.externalUrl,
      labels: labelSuggestions,
    });
    const allowedLevels = await readTeacherAssignableLevelLabels(ctx, actor);
    if (allowedLevels && !allowedLevels.has(level.trim().toLowerCase())) {
      throw new ConvexError("You cannot use that level");
    }

    let topic: Doc<"knowledgeTopics"> | null = null;
    if (args.topicId) {
      topic = await ctx.db.get(args.topicId);
      if (!topic || topic.schoolId !== schoolId || topic.status !== "active") {
        throw new ConvexError("Knowledge topic not found");
      }

      if (
        String(topic.subjectId) !== String(args.subjectId) ||
        !levelMatchesKnowledgeScope(topic.level, level)
      ) {
        throw new ConvexError("Topic must match the selected subject and level");
      }
    }

    const now = Date.now();

    const patch: Partial<Doc<"knowledgeMaterials">> = {
      title,
      subjectId: args.subjectId,
      level,
      topicLabel,
      searchText,
      labelSuggestions,
      updatedAt: now,
      updatedBy: userId,
      ...(args.topicId ? { topicId: args.topicId } : {}),
    };

    if (description !== undefined) {
      patch.description = description;
    }

    await ctx.db.patch(args.materialId, patch);

    if (args.topicId) {
      await patchTeacherLibraryChunksForState(ctx, {
        schoolId,
        materialId: args.materialId,
        topicId: args.topicId,
      });
    }

    const beforeTopicId = material.topicId ?? null;
    const afterTopicId = args.topicId ?? beforeTopicId;

    await writeTeacherLibraryAuditEvent(ctx, {
      schoolId,
      actorUserId: userId,
      actorRole: actor.role,
      eventType: beforeTopicId !== afterTopicId ? "topic_attached" : "overridden",
      materialId: args.materialId,
      beforeVisibility: material.visibility,
      afterVisibility: material.visibility,
      beforeReviewStatus: material.reviewStatus,
      afterReviewStatus: material.reviewStatus,
      changeSummary:
        beforeTopicId !== afterTopicId
          ? `Attached ${title} to a real topic.`
          : `Re-labeled ${material.title} to ${title}.`,
    });

    return {
      materialId: args.materialId,
      searchText,
      labelSuggestions,
    };
  },
});

export const createTeacherKnowledgeTopic = mutation({
  args: {
    title: v.string(),
    summary: v.optional(v.union(v.string(), v.null())),
    subjectId: v.id("subjects"),
    level: v.string(),
    termId: v.optional(v.id("academicTerms")),
    attachMaterialId: v.optional(v.id("knowledgeMaterials")),
  },
  returns: v.object({
    _id: v.id("knowledgeTopics"),
    title: v.string(),
    subjectId: v.id("subjects"),
    subjectName: v.string(),
    level: v.string(),
    termId: v.id("academicTerms"),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("retired")),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    const title = normalizeRequiredText(args.title, "Topic title");
    const level = normalizeRequiredText(args.level, "Level");
    const summary = normalizeOptionalText(args.summary);
    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
      throw new ConvexError("Subject not found");
    }

    const accessibleSubjects = await readTeacherLibrarySubjects(ctx, actor);
    if (
      !(actor.isSchoolAdmin || actor.role === "admin") &&
      !accessibleSubjects.some((item) => item.id === String(args.subjectId))
    ) {
      throw new ConvexError("You cannot use that subject");
    }

    const allowedLevels = await readTeacherAssignableLevelLabels(ctx, actor);
    if (allowedLevels && !allowedLevels.has(level.trim().toLowerCase())) {
      throw new ConvexError("You cannot use that level");
    }

    const requestedTerm = args.termId ? await ctx.db.get(args.termId) : null;
    if (args.termId && (!requestedTerm || requestedTerm.schoolId !== schoolId)) {
      throw new ConvexError("Academic term not found");
    }

    const activeTerm = await readActiveKnowledgeTerm(ctx, schoolId);
    const effectiveTerm = requestedTerm ?? activeTerm;
    if (!effectiveTerm) {
      throw new ConvexError("Create or activate an academic term before creating topics");
    }

    const siblingTopics = await ctx.db
      .query("knowledgeTopics")
      .withIndex("by_school_and_subject_and_level_and_term", (q) =>
        q.eq("schoolId", schoolId).eq("subjectId", args.subjectId).eq("level", level).eq("termId", effectiveTerm._id)
      )
      .collect();

    const duplicate = siblingTopics.find(
      (topic) => topic.title.trim().toLowerCase() === title.toLowerCase() && topic.status !== "retired"
    );

    let topicId = duplicate?._id ?? null;
    if (!duplicate) {
      const slug = await buildUniqueKnowledgeTopicSlug(ctx, schoolId, `${subject.name}-${level}-${title}`);
      const now = Date.now();
      topicId = await ctx.db.insert("knowledgeTopics", {
        schoolId,
        subjectId: args.subjectId,
        level,
        termId: effectiveTerm._id,
        title,
        slug,
        summary,
        searchText: [title, normalizeHumanName(subject.name), level, summary ?? ""].join(" ").trim(),
        status: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });

      await writeTeacherTopicAuditEvent(ctx, {
        schoolId,
        actorUserId: userId,
        actorRole: actor.role,
        eventType: "created",
        topicId,
        changeSummary: `Created the topic ${title}.`,
      });
    }

    if (args.attachMaterialId && topicId) {
      const material = await ctx.db.get(args.attachMaterialId);
      if (!material || material.schoolId !== schoolId) {
        throw new ConvexError("Knowledge material not found");
      }

      if (!canManageKnowledgeMaterial(actor, material)) {
        throw new ConvexError("You cannot manage this material");
      }

      if (String(material.subjectId) !== String(args.subjectId) || !levelMatchesKnowledgeScope(material.level, level)) {
        throw new ConvexError("The material must match the topic subject and level");
      }

      const beforeTopicId = material.topicId ?? null;
      if (beforeTopicId !== topicId) {
        const now = Date.now();
        await ctx.db.patch(args.attachMaterialId, {
          topicId,
          updatedAt: now,
          updatedBy: userId,
        });
        await patchTeacherLibraryChunksForState(ctx, {
          schoolId,
          materialId: args.attachMaterialId,
          topicId,
        });

        await writeTeacherLibraryAuditEvent(ctx, {
          schoolId,
          actorUserId: userId,
          actorRole: actor.role,
          eventType: "topic_attached",
          materialId: args.attachMaterialId,
          beforeVisibility: material.visibility,
          afterVisibility: material.visibility,
          beforeReviewStatus: material.reviewStatus,
          afterReviewStatus: material.reviewStatus,
          changeSummary: `Attached ${material.title} to the topic ${title}.`,
        });
      }
    }

    return {
      _id: topicId ?? duplicate!._id,
      title: duplicate?.title ?? title,
      subjectId: args.subjectId,
      subjectName: normalizeHumanName(subject.name),
      level: duplicate?.level ?? level,
      termId: duplicate?.termId ?? effectiveTerm._id,
      status: duplicate?.status ?? ("active" as const),
    };
  },
});

export const publishTeacherKnowledgeMaterialToStaff = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actor = buildActorContext({
      userId,
      schoolId,
      role,
      isSchoolAdmin,
    });

    assertTeacherLibraryAccess(actor);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    if (material.visibility !== "private_owner") {
      throw new ConvexError("Only private materials can be published to staff");
    }

    if (!canPromoteKnowledgeMaterial(actor, material, {
      nextVisibility: "staff_shared",
      nextReviewStatus: "approved",
    })) {
      throw new ConvexError("You cannot publish this material");
    }

    if (material.processingStatus !== "ready" || material.searchStatus !== "indexed") {
      throw new ConvexError("The material must finish processing before publishing");
    }

    const now = Date.now();
    await ctx.db.patch(args.materialId, {
      visibility: "staff_shared",
      reviewStatus: "approved",
      updatedAt: now,
      updatedBy: userId,
    });

    await patchTeacherLibraryChunksForState(ctx, {
      schoolId,
      materialId: args.materialId,
      visibility: "staff_shared",
      reviewStatus: "approved",
    });

    await writeTeacherLibraryAuditEvent(ctx, {
      schoolId,
      actorUserId: userId,
      actorRole: actor.role,
      eventType: "published",
      materialId: args.materialId,
      beforeVisibility: material.visibility,
      afterVisibility: "staff_shared",
      beforeReviewStatus: material.reviewStatus,
      afterReviewStatus: "approved",
      changeSummary: `Published ${material.title} to staff sharing.`,
    });

    const visibility = "staff_shared" as const;
    const reviewStatus = "approved" as const;

    return {
      materialId: args.materialId,
      visibility,
      reviewStatus,
    };
  },
});
