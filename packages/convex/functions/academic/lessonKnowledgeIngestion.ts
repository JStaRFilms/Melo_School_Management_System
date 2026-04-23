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
  assertKnowledgeMaterialIngestionAccess,
  assertKnowledgeMaterialUploadIsSupported,
  assertYouTubeUrl,
  buildMaterialSearchSeed,
  canManageKnowledgeMaterial,
  normalizeKnowledgeMaterialText,
  resolveKnowledgeMaterialDefaults,
  suggestKnowledgeMaterialLabels,
  MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS,
  type KnowledgeMaterialIngestionSnapshot,
  type KnowledgeMaterialIngestionStatus,
  type KnowledgeMaterialUploadIntent,
} from "./lessonKnowledgeIngestionHelpers";

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
  subjectId: Id<"subjects">;
  level: string;
  topicLabel: string;
  topicId?: Id<"knowledgeTopics">;
  storageId?: Id<"_storage">;
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
  sourceType: "file_upload" | "youtube_link";
  title: string;
  description?: string;
  subjectId: Id<"subjects">;
  level: string;
  topicLabel: string;
  topicId?: Id<"knowledgeTopics">;
  externalUrl?: string;
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
    subjectId: args.subjectId,
    level: args.level,
    topicLabel: args.topicLabel,
    ...(args.topicId ? { topicId: args.topicId } : {}),
    ...(args.externalUrl ? { externalUrl: args.externalUrl } : {}),
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
    const topicLabel = normalizeRequiredText(args.topicLabel, "Topic label");
    const description = normalizeOptionalText(args.description);
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";

    if (actorRole !== "teacher" && actorRole !== "admin") {
      throw new ConvexError("Knowledge material ingestion is restricted to staff");
    }

    const record = buildKnowledgeMaterialRecord({
      actorUserId: userId,
      actorRole,
      schoolId,
      sourceType: "file_upload",
      title,
      ...(description ? { description } : {}),
      subjectId: args.subjectId,
      level: normalizeRequiredText(args.level, "Level"),
      topicLabel,
      ...(args.topicId ? { topicId: args.topicId } : {}),
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

    if (material.sourceType !== "file_upload") {
      throw new ConvexError("Only file uploads can be finalized here");
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

    const record = buildKnowledgeMaterialRecord({
      actorUserId: userId,
      actorRole,
      schoolId,
      sourceType: "youtube_link",
      title,
      ...(description ? { description } : {}),
      subjectId: args.subjectId,
      level: normalizeRequiredText(args.level, "Level"),
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

    if (
      material.processingStatus !== "ocr_needed" &&
      material.processingStatus !== "failed" &&
      !isStaleExtracting
    ) {
      throw new ConvexError("This material does not need a retry");
    }

    if (material.ingestionAttemptCount >= MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS) {
      throw new ConvexError("This material has reached the retry limit");
    }

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
        changeSummary: isStaleExtracting
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
      subjectId: material.subjectId,
      level: material.level,
      topicLabel: material.topicLabel,
      ...(material.topicId ? { topicId: material.topicId } : {}),
      ...(material.storageId ? { storageId: material.storageId } : {}),
      ...(storageMeta?.contentType ? { storageContentType: storageMeta.contentType } : {}),
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
      })
    ),
    ingestionErrorMessage: v.union(v.string(), v.null()),
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
