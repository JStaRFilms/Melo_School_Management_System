import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "../../_generated/server";
import { getAuthenticatedSchoolMembership } from "./auth";
import {
  assertActiveKnowledgeSubjectTopicScope,
  assertKnowledgeMaterialIngestionAccess,
  assertKnowledgeMaterialUploadIsSupported,
  assertYouTubeUrl,
  buildMaterialSearchSeed,
  canManageKnowledgeMaterial,
  normalizeKnowledgeMaterialText,
  normalizePdfPageRangeInput,
  parsePdfPageRanges,
  resolveKnowledgeMaterialDefaults,
  suggestKnowledgeMaterialLabels,
  MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS,
  type KnowledgeMaterialIngestionSnapshot,
  type KnowledgeMaterialIngestionStatus,
  type KnowledgeMaterialUploadIntent,
} from "./lessonKnowledgeIngestionHelpers";
import { assertLessonKnowledgeRateLimit } from "./lessonKnowledgeRateLimits";

const MAX_KNOWLEDGE_MATERIAL_STALE_EXTRACTION_MS = 2 * 60 * 1000;

const knowledgeAuditEventTypeValidator = v.union(
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
  v.literal("ocr_requested"),
  v.literal("ocr_started"),
  v.literal("ocr_succeeded"),
  v.literal("ocr_failed"),
  v.literal("ingestion_failed"),
  v.literal("retry_requested")
);

const knowledgeAuditEntityTypeValidator = v.union(
  v.literal("knowledgeTopic"),
  v.literal("knowledgeMaterial"),
  v.literal("knowledgeMaterialClassBinding"),
  v.literal("knowledgeMaterialChunk"),
  v.literal("instructionTemplate"),
  v.literal("instructionArtifact"),
  v.literal("instructionArtifactDocument"),
  v.literal("instructionArtifactRevision"),
  v.literal("instructionArtifactSource"),
  v.literal("assessmentBank"),
  v.literal("assessmentBankItem")
);

const teacherOrAdminRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("admin"),
  v.literal("student"),
  v.literal("system")
);

type StorageMetadata = {
  _id: Id<"_storage">;
  _creationTime: number;
  contentType?: string;
  sha256: string;
  size: number;
};

type MaterialState = {
  _id: Id<"knowledgeMaterials">;
  schoolId: Id<"schools">;
  ownerUserId: Id<"users">;
  ownerRole: "teacher" | "admin" | "student" | "system";
  sourceType:
    | "file_upload"
    | "text_entry"
    | "youtube_link"
    | "generated_draft"
    | "student_upload"
    | "imported_curriculum";
  visibility: "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  title: string;
  description?: string;
  subjectId?: Id<"subjects">;
  level: string;
  topicLabel: string;
  topicId?: Id<"knowledgeTopics">;
  storageId?: Id<"_storage">;
  selectedPageRanges?: string;
  selectedPageNumbers?: number[];
  pdfPageCount?: number;
  sourceFileMode?: "original" | "selected_pages";
  sourcePdfPageCount?: number;
  externalUrl?: string;
  searchStatus: "not_indexed" | "indexing" | "indexed" | "failed";
  searchText: string;
  processingStatus: KnowledgeMaterialIngestionStatus;
  ingestionErrorMessage: string | null;
  ingestionAttemptCount: number;
  labelSuggestions: string[];
  chunkCount: number;
  indexedAt: number | null;
  createdAt: number;
  updatedAt: number;
  createdBy: Id<"users">;
  updatedBy: Id<"users">;
};

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

function assertUploadFinalizationPermission(args: {
  actorUserId: Id<"users">;
  actorRole: string;
  material: MaterialState;
  schoolId: Id<"schools">;
}) {
  if (String(args.material.schoolId) !== String(args.schoolId)) {
    throw new ConvexError("Knowledge material not found");
  }

  if (!canManageKnowledgeMaterial(
    {
      userId: args.actorUserId,
      schoolId: args.schoolId,
      role: args.actorRole as "teacher" | "admin" | "student",
      isSchoolAdmin: args.actorRole === "admin",
    },
    args.material
  )) {
    throw new ConvexError("You cannot manage this material");
  }
}

function buildKnowledgeMaterialRecord(args: {
  actorUserId: Id<"users">;
  actorRole: "teacher" | "admin";
  schoolId: Id<"schools">;
  sourceType: "file_upload" | "youtube_link" | "imported_curriculum";
  title: string;
  description?: string;
  subjectId?: Id<"subjects">;
  level: string;
  topicLabel: string;
  topicId?: Id<"knowledgeTopics">;
  externalUrl?: string;
  selectedPageRanges?: string;
  selectedPageNumbers?: number[];
  uploadIntent?: KnowledgeMaterialUploadIntent;
  defaultsMode?: "actor_default" | "private_first";
}) {
  const defaults = resolveKnowledgeMaterialDefaults({
    actor: {
      userId: args.actorUserId,
      schoolId: args.schoolId,
      role: args.actorRole,
      isSchoolAdmin: args.actorRole === "admin",
    },
    sourceType: args.sourceType,
    uploadIntent: args.uploadIntent,
    defaultsMode: args.defaultsMode,
  });

  const searchText = buildMaterialSearchSeed({
    title: args.title,
    topicLabel: args.topicLabel,
    description: args.description,
    externalUrl: args.externalUrl,
  });

  const labelSuggestions = suggestKnowledgeMaterialLabels({
    title: args.title,
    topicLabel: args.topicLabel,
    description: args.description,
    externalUrl: args.externalUrl,
  });

  return {
    schoolId: args.schoolId,
    ownerUserId: args.actorUserId,
    ownerRole: args.actorRole,
    sourceType: args.sourceType,
    visibility: defaults.visibility,
    reviewStatus: defaults.reviewStatus,
    title: args.title,
    ...(args.description ? { description: args.description } : {}),
    ...(args.subjectId ? { subjectId: args.subjectId } : {}),
    level: args.level,
    topicLabel: args.topicLabel,
    ...(args.topicId ? { topicId: args.topicId } : {}),
    ...(args.externalUrl ? { externalUrl: args.externalUrl } : {}),
    ...(args.selectedPageRanges ? { selectedPageRanges: args.selectedPageRanges } : {}),
    ...(args.selectedPageNumbers?.length ? { selectedPageNumbers: args.selectedPageNumbers } : {}),
    searchStatus: "not_indexed" as const,
    searchText,
    processingStatus: defaults.processingStatus,
    ingestionErrorMessage: null,
    ingestionAttemptCount: 0,
    labelSuggestions,
    chunkCount: 0,
    indexedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: args.actorUserId,
    updatedBy: args.actorUserId,
  };
}

async function deleteExistingMaterialChunks(
  ctx: MutationCtx,
  materialId: Id<"knowledgeMaterials">,
  schoolId: Id<"schools">
) {
  while (true) {
    const chunks = await ctx.db
      .query("knowledgeMaterialChunks")
      .withIndex("by_school_and_material", (q: any) =>
        q.eq("schoolId", schoolId).eq("materialId", materialId)
      )
      .take(100);

    if (chunks.length === 0) {
      return;
    }

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
  }
}

export const recordContentAuditEventInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    actorUserId: v.id("users"),
    actorRole: teacherOrAdminRoleValidator,
    eventType: knowledgeAuditEventTypeValidator,
    entityType: knowledgeAuditEntityTypeValidator,
    materialId: v.optional(v.id("knowledgeMaterials")),
    bindingId: v.optional(v.id("knowledgeMaterialClassBindings")),
    topicId: v.optional(v.id("knowledgeTopics")),
    artifactId: v.optional(v.id("instructionArtifacts")),
    templateId: v.optional(v.id("instructionTemplates")),
    bankId: v.optional(v.id("assessmentBanks")),
    itemId: v.optional(v.id("assessmentBankItems")),
    beforeVisibility: v.optional(
      v.union(
        v.literal("private_owner"),
        v.literal("staff_shared"),
        v.literal("class_scoped"),
        v.literal("student_approved")
      )
    ),
    afterVisibility: v.optional(
      v.union(
        v.literal("private_owner"),
        v.literal("staff_shared"),
        v.literal("class_scoped"),
        v.literal("student_approved")
      )
    ),
    beforeReviewStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending_review"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("archived")
      )
    ),
    afterReviewStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending_review"),
        v.literal("approved"),
        v.literal("rejected"),
        v.literal("archived")
      )
    ),
    beforeTopicId: v.optional(v.union(v.id("knowledgeTopics"), v.null())),
    afterTopicId: v.optional(v.union(v.id("knowledgeTopics"), v.null())),
    changeSummary: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("contentAuditEvents", {
      schoolId: args.schoolId,
      actorUserId: args.actorUserId,
      actorRole: args.actorRole,
      eventType: args.eventType,
      entityType: args.entityType,
      ...(args.materialId ? { materialId: args.materialId } : {}),
      ...(args.bindingId ? { bindingId: args.bindingId } : {}),
      ...(args.topicId ? { topicId: args.topicId } : {}),
      ...(args.artifactId ? { artifactId: args.artifactId } : {}),
      ...(args.templateId ? { templateId: args.templateId } : {}),
      ...(args.bankId ? { bankId: args.bankId } : {}),
      ...(args.itemId ? { itemId: args.itemId } : {}),
      ...(args.beforeVisibility ? { beforeVisibility: args.beforeVisibility } : {}),
      ...(args.afterVisibility ? { afterVisibility: args.afterVisibility } : {}),
      ...(args.beforeReviewStatus ? { beforeReviewStatus: args.beforeReviewStatus } : {}),
      ...(args.afterReviewStatus ? { afterReviewStatus: args.afterReviewStatus } : {}),
      ...(args.beforeTopicId !== undefined ? { beforeTopicId: args.beforeTopicId } : {}),
      ...(args.afterTopicId !== undefined ? { afterTopicId: args.afterTopicId } : {}),
      changeSummary: args.changeSummary,
      createdAt: Date.now(),
    });

    return null;
  },
});

export const requestKnowledgeMaterialUploadUrl = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    subjectId: v.optional(v.union(v.id("subjects"), v.null())),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    sourceType: v.optional(v.union(v.literal("file_upload"), v.literal("imported_curriculum"))),
    uploadIntent: v.optional(
      v.union(v.literal("private_draft"), v.literal("request_review"), v.literal("staff_shared"))
    ),
    defaultsMode: v.optional(v.union(v.literal("actor_default"), v.literal("private_first"))),
    selectedPageRanges: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    uploadUrl: v.string(),
    visibility: v.union(
      v.literal("private_owner"),
      v.literal("staff_shared"),
      v.literal("class_scoped"),
      v.literal("student_approved")
    ),
    reviewStatus: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("archived")
    ),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("ocr_needed"),
      v.literal("ready"),
      v.literal("failed")
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    assertKnowledgeMaterialIngestionAccess({
      userId,
      schoolId,
      role: role as "teacher" | "admin" | "student",
      isSchoolAdmin,
    });

    const title = normalizeRequiredText(args.title, "Title");
    const sourceType = args.sourceType ?? "file_upload";
    const topicLabel = normalizeRequiredText(args.topicLabel, sourceType === "imported_curriculum" ? "Planning reference label" : "Topic label");
    const description = normalizeOptionalText(args.description);
    const level = normalizeRequiredText(args.level, "Level");
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";

    if (actorRole !== "teacher" && actorRole !== "admin") {
      throw new ConvexError("Knowledge material ingestion is restricted to staff");
    }

    if (sourceType !== "imported_curriculum" && !args.subjectId) {
      throw new ConvexError("Subject is required unless this upload is a curriculum or planning reference");
    }

    await assertActiveKnowledgeSubjectTopicScope(ctx, {
      schoolId,
      subjectId: args.subjectId ?? null,
      level,
      topicId: args.topicId ?? null,
    });

    const selectedPageRanges = normalizePdfPageRangeInput(args.selectedPageRanges);
    const selectedPageNumbers = selectedPageRanges ? parsePdfPageRanges(selectedPageRanges) : undefined;

    await assertLessonKnowledgeRateLimit(ctx, {
      action: "knowledge_material_upload_url",
      schoolId,
      actorUserId: userId,
    });

    const record = buildKnowledgeMaterialRecord({
      actorUserId: userId,
      actorRole,
      schoolId,
      sourceType,
      title,
      ...(description ? { description } : {}),
      ...(args.subjectId ? { subjectId: args.subjectId } : {}),
      level,
      topicLabel,
      ...(args.topicId ? { topicId: args.topicId } : {}),
      ...(selectedPageRanges ? { selectedPageRanges } : {}),
      ...(selectedPageNumbers?.length ? { selectedPageNumbers } : {}),
      ...(args.uploadIntent ? { uploadIntent: args.uploadIntent } : {}),
      defaultsMode: args.defaultsMode,
    });

    const now = Date.now();
    const materialId = await ctx.db.insert("knowledgeMaterials", {
      ...record,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId,
      actorUserId: userId,
      actorRole,
      eventType: "created",
      entityType: "knowledgeMaterial",
      materialId,
      changeSummary: "Created a knowledge material shell and issued an upload URL.",
    });

    const uploadUrl = await ctx.storage.generateUploadUrl();

    return {
      materialId,
      uploadUrl,
      visibility: record.visibility,
      reviewStatus: record.reviewStatus,
      processingStatus: record.processingStatus,
    };
  },
});

export const finalizeKnowledgeMaterialUpload = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    storageId: v.id("_storage"),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("ocr_needed"),
      v.literal("ready"),
      v.literal("failed")
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";

    if (actorRole !== "teacher" && actorRole !== "admin") {
      throw new ConvexError("Knowledge material ingestion is restricted to staff");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new ConvexError("Knowledge material not found");
    }

    assertUploadFinalizationPermission({
      actorUserId: userId,
      actorRole,
      material: material as MaterialState,
      schoolId,
    });

    if (material.sourceType !== "file_upload" && material.sourceType !== "imported_curriculum") {
      throw new ConvexError("Only uploaded files can be finalized here");
    }

    if (material.storageId && String(material.storageId) !== String(args.storageId)) {
      throw new ConvexError("This material already points to a different upload");
    }

    const storageMeta = (await ctx.db.system.get(
      "_storage",
      args.storageId
    )) as StorageMetadata | null;

    if (!storageMeta) {
      throw new ConvexError("Uploaded file not found");
    }

    const normalizedContentType = storageMeta.contentType?.toLowerCase() ?? "";
    if (material.selectedPageNumbers?.length && !normalizedContentType.includes("pdf")) {
      throw new ConvexError("Page selection is only available for PDF uploads.");
    }

    const validationError = (() => {
      try {
        assertKnowledgeMaterialUploadIsSupported({
          contentType: storageMeta.contentType,
          size: storageMeta.size,
        });
        return null;
      } catch (error) {
        return error instanceof ConvexError
          ? error.message
          : "Uploaded file is not supported";
      }
    })();

    if (validationError) {
      const failedAt = Date.now();
      await ctx.db.patch(args.materialId, {
        storageId: args.storageId,
        processingStatus: "failed",
        searchStatus: "failed",
        ingestionErrorMessage: validationError,
        updatedAt: failedAt,
        updatedBy: userId,
      });

      await ctx.runMutation(
        internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal,
        {
          schoolId,
          actorUserId: userId,
          actorRole,
          eventType: "ingestion_failed",
          entityType: "knowledgeMaterial",
          materialId: args.materialId,
          changeSummary: validationError,
        }
      );

      throw new ConvexError(validationError);
    }

    const now = Date.now();
    await ctx.db.patch(args.materialId, {
      storageId: args.storageId,
      processingStatus: "queued",
      searchStatus: "not_indexed",
      ingestionErrorMessage: null,
      updatedAt: now,
      updatedBy: userId,
    });

    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.queueKnowledgeMaterialProcessingInternal,
      {
        materialId: args.materialId,
        actorUserId: userId,
        actorRole,
        reason: "upload_finalized",
      }
    );

    return {
      materialId: args.materialId,
      processingStatus: "queued" as const,
    };
  },
});

export const registerKnowledgeMaterialLink = mutation({
  args: {
    title: v.string(),
    externalUrl: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.string(),
    topicId: v.optional(v.id("knowledgeTopics")),
    uploadIntent: v.optional(
      v.union(v.literal("private_draft"), v.literal("request_review"), v.literal("staff_shared"))
    ),
    defaultsMode: v.optional(v.union(v.literal("actor_default"), v.literal("private_first"))),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    visibility: v.union(
      v.literal("private_owner"),
      v.literal("staff_shared"),
      v.literal("class_scoped"),
      v.literal("student_approved")
    ),
    reviewStatus: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("archived")
    ),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("ocr_needed"),
      v.literal("ready"),
      v.literal("failed")
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    assertKnowledgeMaterialIngestionAccess({
      userId,
      schoolId,
      role: role as "teacher" | "admin" | "student",
      isSchoolAdmin,
    });

    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";
    const title = normalizeRequiredText(args.title, "Title");
    const topicLabel = normalizeRequiredText(args.topicLabel, "Topic label");
    const description = normalizeOptionalText(args.description);
    const externalUrl = assertYouTubeUrl(args.externalUrl);
    const level = normalizeRequiredText(args.level, "Level");

    await assertActiveKnowledgeSubjectTopicScope(ctx, {
      schoolId,
      subjectId: args.subjectId,
      level,
      topicId: args.topicId ?? null,
    });

    await assertLessonKnowledgeRateLimit(ctx, {
      action: "knowledge_material_link_registration",
      schoolId,
      actorUserId: userId,
    });

    const record = buildKnowledgeMaterialRecord({
      actorUserId: userId,
      actorRole,
      schoolId,
      sourceType: "youtube_link",
      title,
      ...(description ? { description } : {}),
      subjectId: args.subjectId,
      level,
      topicLabel,
      ...(args.topicId ? { topicId: args.topicId } : {}),
      externalUrl,
      ...(args.uploadIntent ? { uploadIntent: args.uploadIntent } : {}),
      defaultsMode: args.defaultsMode,
    });

    const now = Date.now();
    const materialId = await ctx.db.insert("knowledgeMaterials", {
      ...record,
      externalUrl,
      processingStatus: "queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId,
      actorUserId: userId,
      actorRole,
      eventType: "created",
      entityType: "knowledgeMaterial",
      materialId,
      changeSummary: "Registered a YouTube link for knowledge ingestion.",
    });

    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.queueKnowledgeMaterialProcessingInternal,
      {
        materialId,
        actorUserId: userId,
        actorRole,
        reason: "link_registered",
      }
    );

    return {
      materialId,
      visibility: record.visibility,
      reviewStatus: record.reviewStatus,
      processingStatus: "queued" as const,
    };
  },
});

const browserOcrImageContentTypeValidator = v.union(
  v.literal("image/jpeg"),
  v.literal("image/png"),
  v.literal("image/webp")
);

export const requestKnowledgeMaterialBrowserOcrImageUploadUrls = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    pageNumbers: v.array(v.number()),
    imageContentType: browserOcrImageContentTypeValidator,
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    uploads: v.array(v.object({ pageNumber: v.number(), uploadUrl: v.string() })),
    maxPages: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";
    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }
    if (!canManageKnowledgeMaterial({ userId, schoolId, role: actorRole, isSchoolAdmin: actorRole === "admin" }, material as MaterialState)) {
      throw new ConvexError("You cannot manage this material");
    }
    if (material.processingStatus !== "ocr_needed" && material.processingStatus !== "failed") {
      throw new ConvexError("Browser OCR retry is only available for failed or OCR-needed material");
    }
    const uniquePageNumbers = Array.from(new Set(args.pageNumbers)).sort((a, b) => a - b);
    if (uniquePageNumbers.length === 0) {
      throw new ConvexError("Select at least one page for OCR");
    }
    if (uniquePageNumbers.length > 8) {
      throw new ConvexError("Browser OCR retry supports up to 8 pages at a time");
    }
    if (uniquePageNumbers.some((pageNumber) => !Number.isInteger(pageNumber) || pageNumber < 1)) {
      throw new ConvexError("OCR page numbers must be positive whole numbers");
    }
    if (material.ingestionAttemptCount >= MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS) {
      throw new ConvexError("This material has reached the retry limit");
    }
    await assertLessonKnowledgeRateLimit(ctx, {
      action: "knowledge_material_ingestion_retry",
      schoolId,
      actorUserId: userId,
    });
    const uploads = [];
    for (const pageNumber of uniquePageNumbers) {
      uploads.push({ pageNumber, uploadUrl: await ctx.storage.generateUploadUrl() });
    }
    return { materialId: args.materialId, uploads, maxPages: 8 };
  },
});

export const startKnowledgeMaterialBrowserOcrRetryInternal = internalMutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    actorSubject: v.string(),
    images: v.array(v.object({
      storageId: v.id("_storage"),
      pageNumber: v.number(),
      contentType: browserOcrImageContentTypeValidator,
    })),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    schoolId: v.id("schools"),
    actorUserId: v.id("users"),
    actorRole: teacherOrAdminRoleValidator,
    ownerUserId: v.id("users"),
    ownerRole: teacherOrAdminRoleValidator,
    title: v.string(),
    description: v.union(v.string(), v.null()),
    topicLabel: v.string(),
    visibility: v.union(v.literal("private_owner"), v.literal("staff_shared"), v.literal("class_scoped"), v.literal("student_approved")),
    reviewStatus: v.union(v.literal("draft"), v.literal("pending_review"), v.literal("approved"), v.literal("rejected"), v.literal("archived")),
    processingAttemptCount: v.number(),
    images: v.array(v.object({
      storageId: v.id("_storage"),
      pageNumber: v.number(),
      contentType: browserOcrImageContentTypeValidator,
    })),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_auth", (q) => q.eq("authId", args.actorSubject)).unique();
    if (!user || user.isArchived) {
      throw new ConvexError("Unauthorized");
    }
    const actorRole: "admin" | "teacher" = user.role === "admin" || user.isSchoolAdmin === true ? "admin" : "teacher";
    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== user.schoolId) {
      throw new ConvexError("Knowledge material not found");
    }
    if (!canManageKnowledgeMaterial({ userId: user._id, schoolId: user.schoolId, role: actorRole, isSchoolAdmin: actorRole === "admin" }, material as MaterialState)) {
      throw new ConvexError("You cannot manage this material");
    }
    if (material.processingStatus !== "ocr_needed" && material.processingStatus !== "failed") {
      throw new ConvexError("Browser OCR retry is only available for failed or OCR-needed material");
    }
    if (args.images.length < 1 || args.images.length > 8) {
      throw new ConvexError("Browser OCR retry supports up to 8 pages at a time");
    }
    const seenPages = new Set<number>();
    for (const image of args.images) {
      if (!Number.isInteger(image.pageNumber) || image.pageNumber < 1 || seenPages.has(image.pageNumber)) {
        throw new ConvexError("OCR image pages must be unique positive whole numbers");
      }
      seenPages.add(image.pageNumber);
      const metadata = await ctx.db.system.get("_storage", image.storageId);
      if (!metadata) {
        throw new ConvexError("OCR image upload was not found");
      }
      if (metadata.contentType !== image.contentType) {
        throw new ConvexError("OCR image content type did not match the uploaded file");
      }
      if (!metadata.contentType?.startsWith("image/")) {
        throw new ConvexError("OCR uploads must be image files");
      }
      if (metadata.size > 2_500_000) {
        throw new ConvexError("Each OCR page image must be 2.5 MB or smaller");
      }
    }
    if (material.ingestionAttemptCount >= MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS) {
      throw new ConvexError("This material has reached the retry limit");
    }
    await assertLessonKnowledgeRateLimit(ctx, {
      action: "knowledge_material_ingestion_retry",
      schoolId: user.schoolId,
      actorUserId: user._id,
    });

    const now = Date.now();
    await ctx.db.patch(args.materialId, {
      processingStatus: "extracting",
      searchStatus: "indexing",
      ingestionErrorMessage: null,
      ingestionAttemptCount: material.ingestionAttemptCount + 1,
      updatedAt: now,
      updatedBy: user._id,
    });
    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId: user.schoolId,
      actorUserId: user._id,
      actorRole,
      eventType: "retry_requested",
      entityType: "knowledgeMaterial",
      materialId: args.materialId,
      changeSummary: "Retrying ingestion with browser-prepared OCR page images.",
    });
    return {
      materialId: material._id,
      schoolId: user.schoolId,
      actorUserId: user._id,
      actorRole,
      ownerUserId: material.ownerUserId,
      ownerRole: material.ownerRole,
      title: material.title,
      description: material.description ?? null,
      topicLabel: material.topicLabel,
      visibility: material.visibility,
      reviewStatus: material.reviewStatus,
      processingAttemptCount: material.ingestionAttemptCount + 1,
      images: args.images,
    };
  },
});

export const requestKnowledgeMaterialProviderOcr = mutation({
  args: { materialId: v.id("knowledgeMaterials") },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    jobId: v.id("knowledgeOcrJobs"),
    processingStatus: v.union(v.literal("queued"), v.literal("extracting")),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";
    if (actorRole !== "teacher" && actorRole !== "admin") {
      throw new ConvexError("Knowledge material OCR is restricted to staff");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }
    if (!material.storageId) {
      throw new ConvexError("This material does not have a stored file to OCR");
    }
    if (!canManageKnowledgeMaterial({ userId, schoolId, role: actorRole, isSchoolAdmin: actorRole === "admin" }, material as MaterialState)) {
      throw new ConvexError("You cannot manage this material");
    }
    if (material.processingStatus !== "ocr_needed" && material.processingStatus !== "failed") {
      throw new ConvexError("OCR can only be queued for OCR-needed or failed material");
    }
    if (material.ingestionAttemptCount >= MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS) {
      throw new ConvexError("This material has reached the retry limit");
    }

    const queuedJob = await ctx.db
      .query("knowledgeOcrJobs")
      .withIndex("by_material_and_status", (q) => q.eq("materialId", args.materialId).eq("status", "queued"))
      .unique();
    if (queuedJob) {
      await ctx.db.patch(args.materialId, {
        processingStatus: "queued",
        searchStatus: "not_indexed",
        ingestionErrorMessage: null,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
      return { materialId: args.materialId, jobId: queuedJob._id, processingStatus: "queued" as const };
    }

    const processingJob = await ctx.db
      .query("knowledgeOcrJobs")
      .withIndex("by_material_and_status", (q) => q.eq("materialId", args.materialId).eq("status", "processing"))
      .unique();
    if (processingJob) {
      await ctx.db.patch(args.materialId, {
        processingStatus: "extracting",
        searchStatus: "indexing",
        ingestionErrorMessage: null,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
      return { materialId: args.materialId, jobId: processingJob._id, processingStatus: "extracting" as const };
    }

    await assertLessonKnowledgeRateLimit(ctx, {
      action: "knowledge_material_ocr_retry",
      schoolId,
      actorUserId: userId,
    });

    const now = Date.now();
    const jobId = await ctx.db.insert("knowledgeOcrJobs", {
      schoolId,
      materialId: args.materialId,
      storageId: material.storageId,
      requestedByUserId: userId,
      provider: "openrouter_mistral_ocr",
      status: "queued",
      attempt: material.ingestionAttemptCount + 1,
      maxAttempts: MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS,
      ...(material.selectedPageRanges ? { selectedPageRanges: material.selectedPageRanges } : {}),
      ...(material.selectedPageNumbers?.length ? { selectedPageNumbers: material.selectedPageNumbers } : {}),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.materialId, {
      processingStatus: "queued",
      searchStatus: "not_indexed",
      ingestionErrorMessage: null,
      ingestionAttemptCount: material.ingestionAttemptCount + 1,
      updatedAt: now,
      updatedBy: userId,
    });

    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId,
      actorUserId: userId,
      actorRole,
      eventType: "ocr_requested",
      entityType: "knowledgeMaterial",
      materialId: args.materialId,
      changeSummary: "Queued provider-backed OCR for the stored PDF.",
    });

    await ctx.scheduler.runAfter(0, internal.functions.academic.lessonKnowledgeOcrActions.processKnowledgeMaterialOcrJobInternal, { jobId });
    return { materialId: args.materialId, jobId, processingStatus: "queued" as const };
  },
});

export const startKnowledgeMaterialOcrJobInternal = internalMutation({
  args: { jobId: v.id("knowledgeOcrJobs") },
  returns: v.object({
    jobId: v.id("knowledgeOcrJobs"),
    materialId: v.id("knowledgeMaterials"),
    schoolId: v.id("schools"),
    storageId: v.id("_storage"),
    requestedByUserId: v.id("users"),
    actorRole: teacherOrAdminRoleValidator,
    title: v.string(),
    description: v.union(v.string(), v.null()),
    topicLabel: v.string(),
    selectedPageNumbers: v.optional(v.array(v.number())),
  }),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("OCR job not found");
    if (job.status !== "queued") throw new ConvexError("OCR job is not queued");
    const material = await ctx.db.get(job.materialId);
    if (!material || material.schoolId !== job.schoolId) throw new ConvexError("Knowledge material not found");
    const requester = await ctx.db.get(job.requestedByUserId);
    if (!requester || requester.schoolId !== job.schoolId || requester.isArchived) throw new ConvexError("OCR requester not found");
    const actorRole: "admin" | "teacher" = requester.role === "admin" || requester.isSchoolAdmin === true ? "admin" : "teacher";
    const now = Date.now();
    await ctx.db.patch(args.jobId, { status: "processing", startedAt: now, updatedAt: now });
    await ctx.db.patch(job.materialId, { processingStatus: "extracting", searchStatus: "indexing", updatedAt: now, updatedBy: job.requestedByUserId });
    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId: job.schoolId,
      actorUserId: job.requestedByUserId,
      actorRole,
      eventType: "ocr_started",
      entityType: "knowledgeMaterial",
      materialId: job.materialId,
      changeSummary: "Started provider-backed OCR for the stored PDF.",
    });
    return {
      jobId: job._id,
      materialId: job.materialId,
      schoolId: job.schoolId,
      storageId: job.storageId,
      requestedByUserId: job.requestedByUserId,
      actorRole,
      title: material.title,
      description: material.description ?? null,
      topicLabel: material.topicLabel,
      ...(job.selectedPageNumbers?.length ? { selectedPageNumbers: job.selectedPageNumbers } : {}),
    };
  },
});

export const completeKnowledgeMaterialOcrJobInternal = internalMutation({
  args: {
    jobId: v.id("knowledgeOcrJobs"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    errorCode: v.union(v.string(), v.null()),
    errorMessage: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new ConvexError("OCR job not found");
    if (job.status !== "processing") {
      throw new ConvexError("OCR job is not processing");
    }
    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: args.status,
      completedAt: now,
      updatedAt: now,
      ...(args.errorCode ? { errorCode: args.errorCode } : {}),
      ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
    });
    const requester = await ctx.db.get(job.requestedByUserId);
    const actorRole: "admin" | "teacher" = requester?.role === "admin" || requester?.isSchoolAdmin === true ? "admin" : "teacher";
    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId: job.schoolId,
      actorUserId: job.requestedByUserId,
      actorRole,
      eventType: args.status === "succeeded" ? "ocr_succeeded" : "ocr_failed",
      entityType: "knowledgeMaterial",
      materialId: job.materialId,
      changeSummary: args.status === "succeeded" ? "Provider-backed OCR succeeded." : args.errorMessage ?? "Provider-backed OCR failed.",
    });
    return null;
  },
});

export const retryKnowledgeMaterialIngestion = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    processingStatus: v.union(
      v.literal("awaiting_upload"),
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("ocr_needed"),
      v.literal("ready"),
      v.literal("failed")
    ),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } =
      await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";

    if (actorRole !== "teacher" && actorRole !== "admin") {
      throw new ConvexError("Knowledge material ingestion is restricted to staff");
    }

    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    if (!canManageKnowledgeMaterial(
      {
        userId,
        schoolId,
        role: actorRole,
        isSchoolAdmin: actorRole === "admin",
      },
      material as MaterialState
    )) {
      throw new ConvexError("You cannot manage this material");
    }

    const now = Date.now();
    const isStaleExtracting =
      material.processingStatus === "extracting" &&
      now - material.updatedAt >= MAX_KNOWLEDGE_MATERIAL_STALE_EXTRACTION_MS;
    const needsSelectedPagePdfTrim =
      Boolean(material.selectedPageNumbers?.length) && material.sourceFileMode !== "selected_pages";

    if (
      material.processingStatus !== "ocr_needed" &&
      material.processingStatus !== "failed" &&
      !isStaleExtracting &&
      !needsSelectedPagePdfTrim
    ) {
      throw new ConvexError("This material does not need a retry");
    }

    if (material.ingestionAttemptCount >= MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS) {
      throw new ConvexError("This material has reached the retry limit");
    }

    await assertLessonKnowledgeRateLimit(ctx, {
      action: "knowledge_material_ingestion_retry",
      schoolId,
      actorUserId: userId,
    });

    await ctx.db.patch(args.materialId, {
      processingStatus: "queued",
      searchStatus: "not_indexed",
      ingestionErrorMessage: null,
      updatedAt: now,
      updatedBy: userId,
    });

    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal,
      {
        schoolId,
        actorUserId: userId,
        actorRole,
        eventType: "retry_requested",
        entityType: "knowledgeMaterial",
        materialId: args.materialId,
        changeSummary: needsSelectedPagePdfTrim
          ? "Retrying ingestion to trim the stored PDF to selected pages."
          : isStaleExtracting
            ? "Retrying a stale knowledge material extraction job."
            : "Retrying the knowledge material ingestion pipeline.",
      }
    );

    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.queueKnowledgeMaterialProcessingInternal,
      {
        materialId: args.materialId,
        actorUserId: userId,
        actorRole,
        reason: "retry_requested",
      }
    );

    return {
      materialId: args.materialId,
      processingStatus: "queued" as const,
    };
  },
});

export const queueKnowledgeMaterialProcessingInternal = internalMutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    actorUserId: v.id("users"),
    actorRole: teacherOrAdminRoleValidator,
    reason: v.union(
      v.literal("upload_finalized"),
      v.literal("link_registered"),
      v.literal("retry_requested")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new ConvexError("Knowledge material not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.materialId, {
      processingStatus: "extracting",
      searchStatus: "indexing",
      ingestionErrorMessage: null,
      ingestionAttemptCount: material.ingestionAttemptCount + 1,
      updatedAt: now,
      updatedBy: args.actorUserId,
    });

    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal,
      {
        schoolId: material.schoolId,
        actorUserId: args.actorUserId,
        actorRole: args.actorRole,
        eventType: "ingestion_started",
        entityType: "knowledgeMaterial",
        materialId: args.materialId,
        changeSummary: `Queued knowledge material ingestion after ${args.reason.replace(/_/g, " ")}.`,
      }
    );

    const storageMeta = material.storageId
      ? ((await ctx.db.system.get("_storage", material.storageId)) as StorageMetadata | null)
      : null;

    const snapshot: KnowledgeMaterialIngestionSnapshot = {
      materialId: material._id,
      schoolId: material.schoolId,
      ownerUserId: material.ownerUserId,
      ownerRole: material.ownerRole,
      sourceType: material.sourceType,
      visibility: material.visibility,
      reviewStatus: material.reviewStatus,
      title: material.title,
      ...(material.description ? { description: material.description } : {}),
      ...(material.subjectId ? { subjectId: material.subjectId } : {}),
      level: material.level,
      topicLabel: material.topicLabel,
      ...(material.topicId ? { topicId: material.topicId } : {}),
      ...(material.storageId ? { storageId: material.storageId } : {}),
      ...(storageMeta?.contentType ? { storageContentType: storageMeta.contentType } : {}),
      ...(material.selectedPageRanges ? { selectedPageRanges: material.selectedPageRanges } : {}),
      ...(material.selectedPageNumbers?.length ? { selectedPageNumbers: material.selectedPageNumbers } : {}),
      ...(material.sourceFileMode ? { sourceFileMode: material.sourceFileMode } : {}),
      ...(material.externalUrl ? { externalUrl: material.externalUrl } : {}),
      searchText: material.searchText,
      processingStatus: "extracting",
      processingAttemptCount: material.ingestionAttemptCount + 1,
    };

    await ctx.scheduler.runAfter(
      0,
      internal.functions.academic.lessonKnowledgeIngestionActions.processKnowledgeMaterialIngestionInternal,
      snapshot
    );

    return null;
  },
});

export const replaceKnowledgeMaterialStorageInternal = internalMutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    schoolId: v.id("schools"),
    previousStorageId: v.id("_storage"),
    nextStorageId: v.id("_storage"),
    actorUserId: v.id("users"),
    sourcePdfPageCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== args.schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    await ctx.db.patch(args.materialId, {
      storageId: args.nextStorageId,
      sourceFileMode: "selected_pages",
      sourcePdfPageCount: args.sourcePdfPageCount,
      updatedAt: Date.now(),
      updatedBy: args.actorUserId,
    });

    await ctx.storage.delete(args.previousStorageId);
    return null;
  },
});

export const applyKnowledgeMaterialIngestionResultInternal = internalMutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    actorUserId: v.id("users"),
    actorRole: teacherOrAdminRoleValidator,
    schoolId: v.id("schools"),
    status: v.union(
      v.literal("ready"),
      v.literal("ocr_needed"),
      v.literal("failed")
    ),
    searchText: v.string(),
    labelSuggestions: v.array(v.string()),
    chunks: v.array(
      v.object({
        chunkIndex: v.number(),
        chunkText: v.string(),
        tokenEstimate: v.optional(v.number()),
        pageStart: v.optional(v.number()),
        pageEnd: v.optional(v.number()),
        pageNumbers: v.optional(v.array(v.number())),
      })
    ),
    ingestionErrorMessage: v.union(v.string(), v.null()),
    pdfPageCount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const material = await ctx.db.get(args.materialId);
    if (!material || material.schoolId !== args.schoolId) {
      throw new ConvexError("Knowledge material not found");
    }

    await deleteExistingMaterialChunks(ctx, args.materialId, args.schoolId);

    const now = Date.now();
    if (args.status === "ready") {
      for (const chunk of args.chunks) {
        await ctx.db.insert("knowledgeMaterialChunks", {
          schoolId: args.schoolId,
          materialId: args.materialId,
          ...(material.topicId ? { topicId: material.topicId } : {}),
          chunkIndex: chunk.chunkIndex,
          chunkText: chunk.chunkText,
          searchText: chunk.chunkText,
          visibility: material.visibility,
          reviewStatus: material.reviewStatus,
          searchStatus: "indexed",
          ...(chunk.tokenEstimate !== undefined ? { tokenEstimate: chunk.tokenEstimate } : {}),
          ...(chunk.pageStart !== undefined ? { pageStart: chunk.pageStart } : {}),
          ...(chunk.pageEnd !== undefined ? { pageEnd: chunk.pageEnd } : {}),
          ...(chunk.pageNumbers !== undefined ? { pageNumbers: chunk.pageNumbers } : {}),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.materialId, {
      searchStatus: args.status === "ready" ? "indexed" : "failed",
      processingStatus: args.status,
      searchText: args.searchText,
      labelSuggestions: args.labelSuggestions,
      chunkCount: args.chunks.length,
      indexedAt: args.status === "ready" ? now : null,
      ...(args.pdfPageCount !== undefined ? { pdfPageCount: args.pdfPageCount } : {}),
      ingestionErrorMessage: args.ingestionErrorMessage,
      updatedAt: now,
      updatedBy: args.actorUserId,
    });

    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal,
      {
        schoolId: args.schoolId,
        actorUserId: args.actorUserId,
        actorRole: args.actorRole,
        eventType:
          args.status === "ready"
            ? "extraction_completed"
            : args.status === "ocr_needed"
              ? "ocr_needed"
              : "ingestion_failed",
        entityType: "knowledgeMaterial",
        materialId: args.materialId,
        changeSummary:
          args.status === "ready"
            ? `Indexed ${args.chunks.length} material chunk(s) from the uploaded source.`
            : args.status === "ocr_needed"
              ? args.ingestionErrorMessage ??
                "Native extraction was inadequate and OCR is not enabled in this workflow yet."
              : `Knowledge material ingestion failed: ${args.ingestionErrorMessage ?? "unknown error"}`,
      }
    );

    return null;
  },
});
