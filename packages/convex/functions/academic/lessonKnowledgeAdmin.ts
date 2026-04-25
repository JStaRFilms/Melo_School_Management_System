import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { normalizeHumanName, normalizePersonName, formatClassDisplayName } from "@school/shared/name-format";
import { buildMaterialSearchSeed, suggestKnowledgeMaterialLabels } from "./lessonKnowledgeIngestionHelpers";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
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

const knowledgeBindingPurposeValidator = v.union(
  v.literal("review_queue"),
  v.literal("supplemental_upload"),
  v.literal("topic_attachment")
);

const knowledgeBindingStatusValidator = v.union(
  v.literal("active"),
  v.literal("revoked")
);

const contentAuditEventTypeValidator = v.union(
  v.literal("approved"),
  v.literal("promoted"),
  v.literal("published"),
  v.literal("rejected"),
  v.literal("archived"),
  v.literal("overridden"),
  v.literal("topic_attached"),
  v.literal("class_bound"),
  v.literal("visibility_changed"),
  v.literal("created"),
  v.literal("ingestion_started"),
  v.literal("extraction_completed"),
  v.literal("ocr_needed"),
  v.literal("ingestion_failed"),
  v.literal("retry_requested")
);

type KnowledgeVisibility = "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
type KnowledgeReviewStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";
type KnowledgeProcessingStatus = "awaiting_upload" | "queued" | "extracting" | "ocr_needed" | "ready" | "failed";
type KnowledgeSourceType = "file_upload" | "text_entry" | "youtube_link" | "generated_draft" | "student_upload" | "imported_curriculum";
type KnowledgeOwnerRole = "teacher" | "admin" | "student" | "system";

type KnowledgeMaterialDoc = Doc<"knowledgeMaterials">;
type UserDoc = Doc<"users">;
type SubjectDoc = Doc<"subjects">;
type ClassDoc = Doc<"classes">;
type KnowledgeTopicDoc = Doc<"knowledgeTopics">;

type KnowledgeLibraryFilterArgs = {
  searchQuery?: string;
  visibility?: KnowledgeVisibility | "all";
  reviewStatus?: KnowledgeReviewStatus | "all";
  sourceType?: KnowledgeSourceType | "all";
  processingStatus?: KnowledgeProcessingStatus | "all";
  ownerRole?: KnowledgeOwnerRole | "all";
  subjectId?: Id<"subjects"> | "all";
  level?: string | "all";
  limit?: number;
};

type ContentAuditEventType =
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

type ContentAuditEntityType =
  | "knowledgeTopic"
  | "knowledgeMaterial"
  | "knowledgeMaterialClassBinding"
  | "knowledgeMaterialChunk"
  | "instructionTemplate"
  | "instructionArtifact"
  | "instructionArtifactDocument"
  | "instructionArtifactRevision"
  | "instructionArtifactSource"
  | "assessmentBank"
  | "assessmentBankItem";

type KnowledgeLibraryListItem = {
  _id: Id<"knowledgeMaterials">;
  title: string;
  description: string | null;
  ownerUserId: Id<"users">;
  ownerName: string;
  ownerRole: KnowledgeOwnerRole;
  sourceType: KnowledgeSourceType;
  visibility: KnowledgeVisibility;
  reviewStatus: KnowledgeReviewStatus;
  processingStatus: KnowledgeProcessingStatus;
  searchStatus: KnowledgeMaterialDoc["searchStatus"];
  subjectId: Id<"subjects">;
  subjectName: string;
  level: string;
  topicLabel: string;
  topicId: Id<"knowledgeTopics"> | null;
  labelSuggestions: string[];
  chunkCount: number;
  externalUrl: string | null;
  indexedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type KnowledgeLibraryTopicItem = {
  _id: Id<"knowledgeTopics">;
  title: string;
  subjectId: Id<"subjects">;
  subjectName: string;
  level: string;
  termId: Id<"academicTerms">;
  status: KnowledgeTopicDoc["status"];
};

type KnowledgeLibraryDetailResponse = {
  material: KnowledgeLibraryListItem & {
    schoolId: Id<"schools">;
    storageId: Id<"_storage"> | null;
    createdBy: Id<"users">;
    updatedBy: Id<"users">;
    searchText: string;
    ownerEmail: string | null;
    subjectCode: string | null;
    sourceProof: {
      originalFileState: "available" | "missing" | "orphaned";
      originalFileUrl: string | null;
      originalFileContentType: string | null;
      originalFileSize: number | null;
      originalFileNotice: string | null;
      extractedTextPreview: string | null;
      extractedTextChunkCount: number;
    };
  };
  storage: {
    _id: Id<"_storage">;
    contentType: string | null;
    sha256: string;
    size: number;
  } | null;
  classBindings: Array<{
    _id: Id<"knowledgeMaterialClassBindings">;
    classId: Id<"classes">;
    className: string;
    bindingPurpose: "review_queue" | "supplemental_upload" | "topic_attachment";
    bindingStatus: "active" | "revoked";
    updatedAt: number;
  }>;
  auditEvents: Array<{
    _id: Id<"contentAuditEvents">;
    eventType: ContentAuditEventType;
    changeSummary: string;
    createdAt: number;
    actorUserId: Id<"users">;
    actorName: string;
    actorRole: KnowledgeOwnerRole;
    beforeVisibility: KnowledgeVisibility | null;
    afterVisibility: KnowledgeVisibility | null;
    beforeReviewStatus: KnowledgeReviewStatus | null;
    afterReviewStatus: KnowledgeReviewStatus | null;
    beforeTopicId: Id<"knowledgeTopics"> | null;
    afterTopicId: Id<"knowledgeTopics"> | null;
  }>;
};

function normalizeOptionalText(value?: string | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ") : undefined;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new ConvexError(`${label} is required`);
  }

  return normalized;
}

function mapKnowledgeMaterialListItem(args: {
  material: KnowledgeMaterialDoc;
  owner: UserDoc | null;
  subject: SubjectDoc | null;
}): KnowledgeLibraryListItem {
  return {
    _id: args.material._id,
    title: args.material.title,
    description: args.material.description ?? null,
    ownerUserId: args.material.ownerUserId,
    ownerName: args.owner ? normalizePersonName(args.owner.name) : "Unknown owner",
    ownerRole: args.material.ownerRole,
    sourceType: args.material.sourceType,
    visibility: args.material.visibility,
    reviewStatus: args.material.reviewStatus,
    processingStatus: args.material.processingStatus,
    searchStatus: args.material.searchStatus,
    subjectId: args.material.subjectId,
    subjectName: args.subject ? normalizeHumanName(args.subject.name) : "Unknown subject",
    level: args.material.level,
    topicLabel: args.material.topicLabel,
    topicId: args.material.topicId ?? null,
    labelSuggestions: args.material.labelSuggestions,
    chunkCount: args.material.chunkCount,
    externalUrl: args.material.externalUrl ?? null,
    indexedAt: args.material.indexedAt,
    createdAt: args.material.createdAt,
    updatedAt: args.material.updatedAt,
  };
}

async function readMaterialList(
  ctx: QueryCtx,
  schoolId: Id<"schools">,
  args: KnowledgeLibraryFilterArgs
): Promise<KnowledgeLibraryListItem[]> {
  const limit = Math.min(Math.max(args.limit ?? 150, 1), 300);
  const normalizedSearch = normalizeKnowledgeSearchQuery(args.searchQuery ?? "");

  let rows: KnowledgeMaterialDoc[] = [];
  if (normalizedSearch) {
    const queryBuilder = ctx.db.query("knowledgeMaterials").withSearchIndex(
      "search_search_text",
      (q) => {
        let search = q.search("searchText", normalizedSearch).eq("schoolId", schoolId);
        if (args.visibility && args.visibility !== "all") {
          search = search.eq("visibility", args.visibility);
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
        if (args.ownerRole && args.ownerRole !== "all") {
          search = search.eq("ownerRole", args.ownerRole);
        }
        if (args.subjectId && args.subjectId !== "all") {
          search = search.eq("subjectId", args.subjectId);
        }
        if (args.level && args.level !== "all") {
          search = search.eq("level", args.level);
        }
        return search;
      }
    );

    rows = await queryBuilder.take(limit);
  } else {
    rows = await ctx.db
      .query("knowledgeMaterials")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .order("desc")
      .take(limit);
  }

  const filteredRows = rows.filter((material) => {
    if (material.schoolId !== schoolId) {
      return false;
    }

    if (args.visibility && args.visibility !== "all" && material.visibility !== args.visibility) {
      return false;
    }

    if (args.reviewStatus && args.reviewStatus !== "all" && material.reviewStatus !== args.reviewStatus) {
      return false;
    }

    if (args.sourceType && args.sourceType !== "all" && material.sourceType !== args.sourceType) {
      return false;
    }

    if (args.processingStatus && args.processingStatus !== "all" && material.processingStatus !== args.processingStatus) {
      return false;
    }

    if (args.ownerRole && args.ownerRole !== "all" && material.ownerRole !== args.ownerRole) {
      return false;
    }

    if (args.subjectId && args.subjectId !== "all" && String(material.subjectId) !== String(args.subjectId)) {
      return false;
    }

    if (args.level && args.level !== "all" && material.level !== args.level) {
      return false;
    }

    return true;
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return b.createdAt - a.createdAt;
  });

  const ownerIds = [...new Set(sortedRows.map((material) => String(material.ownerUserId)))];
  const subjectIds = [...new Set(sortedRows.map((material) => String(material.subjectId)))];

  const [owners, subjects] = await Promise.all([
    Promise.all(ownerIds.map((id) => ctx.db.get(id as Id<"users">))),
    Promise.all(subjectIds.map((id) => ctx.db.get(id as Id<"subjects">))),
  ]);

  const ownerMap = new Map<string, UserDoc | null>();
  ownerIds.forEach((id, index) => ownerMap.set(id, owners[index] as UserDoc | null));
  const subjectMap = new Map<string, SubjectDoc | null>();
  subjectIds.forEach((id, index) => subjectMap.set(id, subjects[index] as SubjectDoc | null));

  return sortedRows.map((material) =>
    mapKnowledgeMaterialListItem({
      material,
      owner: ownerMap.get(String(material.ownerUserId)) ?? null,
      subject: subjectMap.get(String(material.subjectId)) ?? null,
    })
  );
}

async function patchMaterialChunksForState(
  ctx: MutationCtx,
  materialId: Id<"knowledgeMaterials">,
  schoolId: Id<"schools">,
  patch: Partial<Pick<KnowledgeMaterialDoc, "visibility" | "reviewStatus" | "topicId">>
) {
  const chunks = await ctx.db
    .query("knowledgeMaterialChunks")
    .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", materialId))
    .take(100);

  const updatedAt = Date.now();
  for (const chunk of chunks) {
    await ctx.db.patch(chunk._id, {
      ...(patch.visibility ? { visibility: patch.visibility } : {}),
      ...(patch.reviewStatus ? { reviewStatus: patch.reviewStatus } : {}),
      ...(patch.topicId !== undefined ? { topicId: patch.topicId } : {}),
      updatedAt,
    });
  }
}

async function writeMaterialAuditEvent(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorUserId: Id<"users">;
    actorRole: KnowledgeOwnerRole;
    eventType: ContentAuditEventType;
    entityType: ContentAuditEntityType;
    materialId: Id<"knowledgeMaterials">;
    beforeVisibility?: KnowledgeVisibility | null;
    afterVisibility?: KnowledgeVisibility | null;
    beforeReviewStatus?: KnowledgeReviewStatus | null;
    afterReviewStatus?: KnowledgeReviewStatus | null;
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
    entityType: args.entityType,
    materialId: args.materialId,
    ...(args.beforeVisibility !== undefined && args.beforeVisibility !== null ? { beforeVisibility: args.beforeVisibility } : {}),
    ...(args.afterVisibility !== undefined && args.afterVisibility !== null ? { afterVisibility: args.afterVisibility } : {}),
    ...(args.beforeReviewStatus !== undefined && args.beforeReviewStatus !== null ? { beforeReviewStatus: args.beforeReviewStatus } : {}),
    ...(args.afterReviewStatus !== undefined && args.afterReviewStatus !== null ? { afterReviewStatus: args.afterReviewStatus } : {}),
    ...(args.beforeTopicId !== undefined && args.beforeTopicId !== null ? { beforeTopicId: args.beforeTopicId } : {}),
    ...(args.afterTopicId !== undefined && args.afterTopicId !== null ? { afterTopicId: args.afterTopicId } : {}),
    changeSummary: args.changeSummary,
  });
}

function materialStateSummary(material: KnowledgeMaterialDoc) {
  return `${material.title} • ${material.visibility} / ${material.reviewStatus}`;
}

function slugifyKnowledgeTopic(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "topic";
}

function normalizeLevelKey(value: string) {
  return value.trim().toLowerCase();
}

function classMatchesKnowledgeLevel(classDoc: ClassDoc, level: string) {
  const target = normalizeLevelKey(level);
  const candidates = [classDoc.gradeName, classDoc.level, classDoc.name]
    .map((entry) => entry?.trim().toLowerCase())
    .filter((entry): entry is string => Boolean(entry));

  return candidates.includes(target);
}

async function buildUniqueKnowledgeTopicSlug(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  schoolId: Id<"schools">,
  baseLabel: string
) {
  const baseSlug = slugifyKnowledgeTopic(baseLabel);

  for (let attempt = 0; attempt < 200; attempt += 1) {
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

async function syncMaterialTopicAttachmentBindings(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorUserId: Id<"users">;
    materialId: Id<"knowledgeMaterials">;
    level: string;
    topicId: Id<"knowledgeTopics"> | null;
  }
) {
  const bindings = await ctx.db
    .query("knowledgeMaterialClassBindings")
    .withIndex("by_school_and_material", (q) =>
      q.eq("schoolId", args.schoolId).eq("materialId", args.materialId)
    )
    .collect();

  const topicBindings = bindings.filter((binding) => binding.bindingPurpose === "topic_attachment");

  if (!args.topicId) {
    const revokedAt = Date.now();
    for (const binding of topicBindings) {
      if (binding.bindingStatus !== "revoked") {
        await ctx.db.patch(binding._id, {
          bindingStatus: "revoked",
          updatedAt: revokedAt,
          updatedBy: args.actorUserId,
        });
      }
    }
    return;
  }

  const schoolClasses = await ctx.db
    .query("classes")
    .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
    .collect();

  const targetClassIds = new Set(
    schoolClasses
      .filter((classDoc) => !classDoc.isArchived && classMatchesKnowledgeLevel(classDoc, args.level))
      .map((classDoc) => String(classDoc._id))
  );

  const now = Date.now();

  for (const binding of topicBindings) {
    const shouldStayActive = targetClassIds.has(String(binding.classId));
    const nextStatus = shouldStayActive ? "active" : "revoked";

    if (binding.bindingStatus !== nextStatus) {
      await ctx.db.patch(binding._id, {
        bindingStatus: nextStatus,
        updatedAt: now,
        updatedBy: args.actorUserId,
      });
    }
  }

  for (const classId of targetClassIds) {
    const existing = topicBindings.find((binding) => String(binding.classId) === classId);
    if (existing) {
      continue;
    }

    await ctx.db.insert("knowledgeMaterialClassBindings", {
      schoolId: args.schoolId,
      materialId: args.materialId,
      classId: classId as Id<"classes">,
      bindingPurpose: "topic_attachment",
      bindingStatus: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: args.actorUserId,
      updatedBy: args.actorUserId,
    });
  }
}

export const createAdminKnowledgeTopic = mutation({
  args: {
    title: v.string(),
    summary: v.optional(v.union(v.string(), v.null())),
    subjectId: v.id("subjects"),
    level: v.string(),
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
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const title = normalizeRequiredText(args.title, "Topic title");
    const level = normalizeRequiredText(args.level, "Level");
    const summary = normalizeOptionalText(args.summary);
    const subject = await ctx.db.get(args.subjectId);
    if (!subject || subject.schoolId !== schoolId || subject.isArchived) {
      throw new ConvexError("Subject not found");
    }

    const activeTerms = await ctx.db
      .query("academicTerms")
      .withIndex("by_school_active", (q) => q.eq("schoolId", schoolId).eq("isActive", true))
      .collect();
    const activeTerm = [...activeTerms].sort((a, b) => b.startDate - a.startDate)[0] ?? null;
    if (!activeTerm) {
      throw new ConvexError("Create or activate an academic term before creating portal topics");
    }

    const siblingTopics = await ctx.db
      .query("knowledgeTopics")
      .withIndex("by_school_and_subject_and_level_and_term", (q) =>
        q.eq("schoolId", schoolId).eq("subjectId", args.subjectId).eq("level", level).eq("termId", activeTerm._id)
      )
      .collect();

    const duplicate = siblingTopics.find(
      (topic) => topic.title.trim().toLowerCase() === title.toLowerCase() && topic.status !== "retired"
    );
    if (duplicate) {
      return {
        _id: duplicate._id,
        title: duplicate.title,
        subjectId: duplicate.subjectId,
        subjectName: normalizeHumanName(subject.name),
        level: duplicate.level,
        termId: duplicate.termId,
        status: duplicate.status,
      };
    }

    const slug = await buildUniqueKnowledgeTopicSlug(ctx, schoolId, `${subject.name}-${level}-${title}`);
    const now = Date.now();
    const topicId = await ctx.db.insert("knowledgeTopics", {
      schoolId,
      subjectId: args.subjectId,
      level,
      termId: activeTerm._id,
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

    return {
      _id: topicId,
      title,
      subjectId: args.subjectId,
      subjectName: normalizeHumanName(subject.name),
      level,
      termId: activeTerm._id,
      status: "active" as const,
    };
  },
});

export const listAdminKnowledgeTopics = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("knowledgeTopics"),
      title: v.string(),
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      level: v.string(),
      termId: v.id("academicTerms"),
      status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived"), v.literal("retired")),
    })
  ),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const limit = Math.min(Math.max(args.limit ?? 200, 1), 300);
    const topics = await ctx.db
      .query("knowledgeTopics")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .take(limit);

    const subjectIds = [...new Set(topics.map((topic) => String(topic.subjectId)))];
    const subjects = await Promise.all(subjectIds.map((subjectId) => ctx.db.get(subjectId as Id<"subjects">)));
    const subjectMap = new Map<string, SubjectDoc | null>();
    subjectIds.forEach((subjectId, index) => subjectMap.set(subjectId, subjects[index] as SubjectDoc | null));

    return topics.map((topic) => ({
      _id: topic._id,
      title: topic.title,
      subjectId: topic.subjectId,
      subjectName: subjectMap.get(String(topic.subjectId)) ? normalizeHumanName(subjectMap.get(String(topic.subjectId))!.name) : "Unknown subject",
      level: topic.level,
      termId: topic.termId,
      status: topic.status,
    }));
  },
});

export const listAdminKnowledgeMaterials = query({
  args: {
    searchQuery: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("all"), knowledgeVisibilityValidator)),
    reviewStatus: v.optional(v.union(v.literal("all"), knowledgeReviewStatusValidator)),
    sourceType: v.optional(v.union(v.literal("all"), knowledgeSourceTypeValidator)),
    processingStatus: v.optional(v.union(v.literal("all"), knowledgeProcessingStatusValidator)),
    ownerRole: v.optional(v.union(v.literal("all"), knowledgeOwnerRoleValidator)),
    subjectId: v.optional(v.union(v.literal("all"), v.id("subjects"))),
    level: v.optional(v.union(v.literal("all"), v.string())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    summary: v.object({
      loaded: v.number(),
      approved: v.number(),
      pendingReview: v.number(),
      archived: v.number(),
      studentApproved: v.number(),
      needsAttention: v.number(),
    }),
    materials: v.array(
      v.object({
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
        level: v.string(),
        topicLabel: v.string(),
        topicId: v.union(v.id("knowledgeTopics"), v.null()),
        labelSuggestions: v.array(v.string()),
        chunkCount: v.number(),
        externalUrl: v.union(v.string(), v.null()),
        indexedAt: v.union(v.number(), v.null()),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const materials = await readMaterialList(ctx, schoolId, args);
    const summary = materials.reduce(
      (acc, material) => {
        acc.loaded += 1;
        if (material.reviewStatus === "approved") acc.approved += 1;
        if (material.reviewStatus === "pending_review") acc.pendingReview += 1;
        if (material.reviewStatus === "archived") acc.archived += 1;
        if (material.visibility === "student_approved") acc.studentApproved += 1;
        if (material.processingStatus !== "ready" || material.searchStatus !== "indexed") {
          acc.needsAttention += 1;
        }
        return acc;
      },
      {
        loaded: 0,
        approved: 0,
        pendingReview: 0,
        archived: 0,
        studentApproved: 0,
        needsAttention: 0,
      }
    );

    return {
      summary,
      materials,
    };
  },
});

export const getAdminKnowledgeMaterial = query({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: v.object({
    material: v.object({
      _id: v.id("knowledgeMaterials"),
      title: v.string(),
      description: v.union(v.string(), v.null()),
      ownerUserId: v.id("users"),
      ownerName: v.string(),
      ownerEmail: v.union(v.string(), v.null()),
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
      schoolId: v.id("schools"),
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      subjectCode: v.union(v.string(), v.null()),
      level: v.string(),
      topicLabel: v.string(),
      topicId: v.union(v.id("knowledgeTopics"), v.null()),
      labelSuggestions: v.array(v.string()),
      chunkCount: v.number(),
      externalUrl: v.union(v.string(), v.null()),
      indexedAt: v.union(v.number(), v.null()),
      storageId: v.union(v.id("_storage"), v.null()),
      searchText: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      createdBy: v.id("users"),
      updatedBy: v.id("users"),
      sourceProof: knowledgeMaterialSourceProofValidator,
    }),
    storage: v.union(
      v.object({
        _id: v.id("_storage"),
        contentType: v.union(v.string(), v.null()),
        sha256: v.string(),
        size: v.number(),
      }),
      v.null()
    ),
    classBindings: v.array(
      v.object({
        _id: v.id("knowledgeMaterialClassBindings"),
        classId: v.id("classes"),
        className: v.string(),
        bindingPurpose: knowledgeBindingPurposeValidator,
        bindingStatus: knowledgeBindingStatusValidator,
        updatedAt: v.number(),
      })
    ),
    auditEvents: v.array(
      v.object({
        _id: v.id("contentAuditEvents"),
        eventType: contentAuditEventTypeValidator,
        changeSummary: v.string(),
        createdAt: v.number(),
        actorUserId: v.id("users"),
        actorName: v.string(),
        actorRole: knowledgeOwnerRoleValidator,
        beforeVisibility: v.union(v.literal("private_owner"), v.literal("staff_shared"), v.literal("class_scoped"), v.literal("student_approved"), v.null()),
        afterVisibility: v.union(v.literal("private_owner"), v.literal("staff_shared"), v.literal("class_scoped"), v.literal("student_approved"), v.null()),
        beforeReviewStatus: v.union(v.literal("draft"), v.literal("pending_review"), v.literal("approved"), v.literal("rejected"), v.literal("archived"), v.null()),
        afterReviewStatus: v.union(v.literal("draft"), v.literal("pending_review"), v.literal("approved"), v.literal("rejected"), v.literal("archived"), v.null()),
        beforeTopicId: v.union(v.id("knowledgeTopics"), v.null()),
        afterTopicId: v.union(v.id("knowledgeTopics"), v.null()),
      })
    ),
  }),
  handler: async (ctx, args): Promise<KnowledgeLibraryDetailResponse> => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    const sourceProofPromise = readKnowledgeMaterialSourceProof(ctx, {
      schoolId,
      materialId: material._id,
      storageId: material.storageId ?? null,
    });

    const [owner, subject, storageMeta, classBindings, auditEvents, sourceProof] = await Promise.all([
      ctx.db.get(material.ownerUserId),
      ctx.db.get(material.subjectId),
      material.storageId ? ctx.db.system.get("_storage", material.storageId) : Promise.resolve(null),
      ctx.db
        .query("knowledgeMaterialClassBindings")
        .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", material._id))
        .take(25),
      ctx.db
        .query("contentAuditEvents")
        .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", material._id))
        .take(20),
      sourceProofPromise,
    ]);

    const bindingClassIds = [...new Set(classBindings.map((binding) => String(binding.classId)))];
    const classes = await Promise.all(bindingClassIds.map((classId) => ctx.db.get(classId as Id<"classes">)));
    const classMap = new Map<string, ClassDoc | null>();
    bindingClassIds.forEach((classId, index) => classMap.set(classId, classes[index] as ClassDoc | null));

    const actorIds = [...new Set(auditEvents.map((event) => String(event.actorUserId)))];
    const auditActors = await Promise.all(actorIds.map((actorId) => ctx.db.get(actorId as Id<"users">)));
    const actorMap = new Map<string, UserDoc | null>();
    actorIds.forEach((actorId, index) => actorMap.set(actorId, auditActors[index] as UserDoc | null));

    const detail: KnowledgeLibraryDetailResponse = {
      material: {
        ...mapKnowledgeMaterialListItem({
          material,
          owner: owner as UserDoc | null,
          subject: subject as SubjectDoc | null,
        }),
        schoolId: material.schoolId,
        storageId: material.storageId ?? null,
        createdBy: material.createdBy,
        updatedBy: material.updatedBy,
        searchText: material.searchText,
        ownerEmail: owner ? owner.email ?? null : null,
        subjectCode: subject ? subject.code ?? null : null,
        sourceProof,
      },
      storage: storageMeta
        ? {
            _id: storageMeta._id,
            contentType: storageMeta.contentType ?? null,
            sha256: storageMeta.sha256,
            size: storageMeta.size,
          }
        : null,
      classBindings: classBindings.map((binding) => ({
        _id: binding._id,
        classId: binding.classId,
        className: classMap.get(String(binding.classId))
          ? formatClassDisplayName({
              gradeName: classMap.get(String(binding.classId))?.gradeName,
              classLabel: classMap.get(String(binding.classId))?.classLabel,
              name: classMap.get(String(binding.classId))?.name,
            })
          : String(binding.classId),
        bindingPurpose: binding.bindingPurpose,
        bindingStatus: binding.bindingStatus,
        updatedAt: binding.updatedAt,
      })),
      auditEvents: auditEvents
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((event) => ({
          _id: event._id,
          eventType: event.eventType,
          changeSummary: event.changeSummary,
          createdAt: event.createdAt,
          actorUserId: event.actorUserId,
          actorName: actorMap.get(String(event.actorUserId))
            ? normalizePersonName(actorMap.get(String(event.actorUserId))!.name)
            : "Unknown actor",
          actorRole: event.actorRole,
          beforeVisibility: event.beforeVisibility ?? null,
          afterVisibility: event.afterVisibility ?? null,
          beforeReviewStatus: event.beforeReviewStatus ?? null,
          afterReviewStatus: event.afterReviewStatus ?? null,
          beforeTopicId: event.beforeTopicId ?? null,
          afterTopicId: event.afterTopicId ?? null,
        })),
    };

    return detail;
  },
});

export const getAdminKnowledgeMaterialOriginalFileAccess = query({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: knowledgeMaterialOriginalFileAccessValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    return await readKnowledgeMaterialOriginalFileAccess(ctx, {
      storageId: material.storageId ?? null,
    });
  },
});

export const updateAdminKnowledgeMaterialDetails = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.union(v.id("knowledgeTopics"), v.null())),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    searchText: v.string(),
    labelSuggestions: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" ? "admin" : "teacher";
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
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
    const now = Date.now();

    const patch: Partial<KnowledgeMaterialDoc> = {
      title,
      subjectId: args.subjectId,
      level,
      topicLabel,
      searchText,
      labelSuggestions,
      updatedAt: now,
      updatedBy: userId,
    };

    if (description !== undefined) {
      patch.description = description;
    }

    if (args.topicId !== undefined) {
      if (args.topicId === null) {
        throw new ConvexError("Clearing topic attachment is not supported here");
      }
      patch.topicId = args.topicId;
    }

    await ctx.db.patch(args.materialId, patch);

    const nextTopicId = args.topicId === undefined ? material.topicId ?? null : args.topicId;

    if (args.topicId !== undefined) {
      await patchMaterialChunksForState(ctx, args.materialId, schoolId, {
        topicId: args.topicId,
      });
    }

    if (nextTopicId) {
      await syncMaterialTopicAttachmentBindings(ctx, {
        schoolId,
        actorUserId: userId,
        materialId: args.materialId,
        level,
        topicId: nextTopicId,
      });
    }

    const beforeTopicId = material.topicId ?? null;
    const afterTopicId = args.topicId === undefined ? beforeTopicId : args.topicId;

    await writeMaterialAuditEvent(ctx, {
      schoolId,
      actorUserId: userId,
      actorRole,
      eventType: beforeTopicId !== afterTopicId ? "topic_attached" : "overridden",
      entityType: "knowledgeMaterial",
      materialId: args.materialId,
      beforeTopicId,
      afterTopicId,
      changeSummary: beforeTopicId !== afterTopicId
        ? `Updated the topic attachment for ${title}.`
        : `Re-labeled ${material.title} to ${title}.`,
    });

    return {
      materialId: args.materialId,
      searchText,
      labelSuggestions,
    };
  },
});

export const updateAdminKnowledgeMaterialState = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    visibility: v.optional(knowledgeVisibilityValidator),
    reviewStatus: v.optional(knowledgeReviewStatusValidator),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    visibility: knowledgeVisibilityValidator,
    reviewStatus: knowledgeReviewStatusValidator,
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } = await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" ? "admin" : "teacher";
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    if (!args.visibility && !args.reviewStatus) {
      throw new ConvexError("No state change requested");
    }

    const nextVisibility = args.visibility ?? material.visibility;
    const nextReviewStatus = args.reviewStatus ?? material.reviewStatus;

    if (nextVisibility === "student_approved" && !material.topicId) {
      throw new ConvexError("Student-approved visibility requires an attached topic");
    }

    if (
      material.topicId &&
      nextVisibility === "student_approved" &&
      nextReviewStatus === "approved"
    ) {
      await syncMaterialTopicAttachmentBindings(ctx, {
        schoolId,
        actorUserId: userId,
        materialId: args.materialId,
        level: material.level,
        topicId: material.topicId,
      });
    }

    const now = Date.now();
    await ctx.db.patch(args.materialId, {
      ...(args.visibility ? { visibility: args.visibility } : {}),
      ...(args.reviewStatus ? { reviewStatus: args.reviewStatus } : {}),
      updatedAt: now,
      updatedBy: userId,
    });

    if (args.visibility || args.reviewStatus) {
      await patchMaterialChunksForState(ctx, args.materialId, schoolId, {
        ...(args.visibility ? { visibility: args.visibility } : {}),
        ...(args.reviewStatus ? { reviewStatus: args.reviewStatus } : {}),
      });
    }

    const eventType =
      args.reviewStatus === "archived"
        ? "archived"
        : args.reviewStatus === "approved"
          ? "approved"
          : args.reviewStatus === "rejected"
            ? "rejected"
            : args.visibility
              ? "visibility_changed"
              : "overridden";

    await writeMaterialAuditEvent(ctx, {
      schoolId,
      actorUserId: userId,
      actorRole,
      eventType,
      entityType: "knowledgeMaterial",
      materialId: args.materialId,
      beforeVisibility: material.visibility,
      afterVisibility: nextVisibility,
      beforeReviewStatus: material.reviewStatus,
      afterReviewStatus: nextReviewStatus,
      beforeTopicId: material.topicId ?? null,
      afterTopicId: material.topicId ?? null,
      changeSummary: `Changed ${material.title} from ${materialStateSummary(material)} to ${nextVisibility} / ${nextReviewStatus}.`,
    });

    return {
      materialId: args.materialId,
      visibility: nextVisibility,
      reviewStatus: nextReviewStatus,
    };
  },
});
