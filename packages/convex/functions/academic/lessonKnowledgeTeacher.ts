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
  type KnowledgeActorContext,
} from "./lessonKnowledgeAccess";
import { normalizeKnowledgeSearchQuery } from "./lessonKnowledgeSearch";

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
  labelSuggestions: v.array(v.string()),
  chunkCount: v.number(),
  externalUrl: v.union(v.string(), v.null()),
  indexedAt: v.union(v.number(), v.null()),
  ingestionErrorMessage: v.union(v.string(), v.null()),
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

function isTeacherLibraryVisibleToActor(
  actor: KnowledgeActorContext,
  material: Pick<Doc<"knowledgeMaterials">, "schoolId" | "ownerUserId" | "visibility" | "reviewStatus"> & {
    processingStatus: Doc<"knowledgeMaterials">["processingStatus"];
    searchStatus: Doc<"knowledgeMaterials">["searchStatus"];
  }
) {
  return canReadKnowledgeMaterialInStaffSurface(actor, material);
}

function isTeacherLibrarySelectableSource(
  actor: KnowledgeActorContext,
  material: Pick<Doc<"knowledgeMaterials">, "schoolId" | "ownerUserId" | "visibility" | "reviewStatus"> & {
    processingStatus: Doc<"knowledgeMaterials">["processingStatus"];
    searchStatus: Doc<"knowledgeMaterials">["searchStatus"];
  }
) {
  return canUseKnowledgeMaterialAsLessonSource(actor, material);
}

async function patchTeacherLibraryChunksForState(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    materialId: Id<"knowledgeMaterials">;
    visibility?: Doc<"knowledgeMaterials">["visibility"];
    reviewStatus?: Doc<"knowledgeMaterials">["reviewStatus"];
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

function materialStateSummary(material: Pick<Doc<"knowledgeMaterials">, "title" | "visibility" | "reviewStatus">) {
  return `${material.title} • ${material.visibility} / ${material.reviewStatus}`;
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

  const accessibleRows = rows.filter((material) => {
    if (!isTeacherLibraryVisibleToActor(actor, material)) {
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

    return true;
  });

  const sortedRows = normalizedSearch
    ? accessibleRows
    : [...accessibleRows].sort((a, b) => {
        if (b.updatedAt !== a.updatedAt) {
          return b.updatedAt - a.updatedAt;
        }

        return b.createdAt - a.createdAt;
      });

  const ownerIds = [...new Set(sortedRows.map((material) => String(material.ownerUserId)))];
  const subjectIds = [...new Set(sortedRows.map((material) => String(material.subjectId)))];

  const [owners, subjects] = await Promise.all([
    Promise.all(ownerIds.map((id) => ctx.db.get(id as Id<"users">))),
    Promise.all(subjectIds.map((id) => ctx.db.get(id as Id<"subjects">))),
  ]);

  const ownerMap = new Map<string, Doc<"users"> | null>();
  ownerIds.forEach((id, index) => ownerMap.set(id, owners[index] as Doc<"users"> | null));
  const subjectMap = new Map<string, Doc<"subjects"> | null>();
  subjectIds.forEach((id, index) => subjectMap.set(id, subjects[index] as Doc<"subjects"> | null));

  const materials = sortedRows.slice(0, limit).map((material) => {
    const owner = ownerMap.get(String(material.ownerUserId)) ?? null;
    const subject = subjectMap.get(String(material.subjectId)) ?? null;
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
      labelSuggestions: material.labelSuggestions,
      chunkCount: material.chunkCount,
      externalUrl: material.externalUrl ?? null,
      indexedAt: material.indexedAt,
      ingestionErrorMessage: material.ingestionErrorMessage,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      isOwnedByMe,
      canEdit,
      canPublish,
      canSelectAsSource: isTeacherLibrarySelectableSource(actor, material),
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

export const updateTeacherKnowledgeMaterialDetails = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    subjectId: v.id("subjects"),
    level: v.string(),
    topicLabel: v.string(),
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
    };

    if (description !== undefined) {
      patch.description = description;
    }

    await ctx.db.patch(args.materialId, patch);

    await writeTeacherLibraryAuditEvent(ctx, {
      schoolId,
      actorUserId: userId,
      actorRole: actor.role,
      eventType: "overridden",
      materialId: args.materialId,
      beforeVisibility: material.visibility,
      afterVisibility: material.visibility,
      beforeReviewStatus: material.reviewStatus,
      afterReviewStatus: material.reviewStatus,
      changeSummary: `Re-labeled ${material.title} to ${title}.`,
    });

    return {
      materialId: args.materialId,
      searchText,
      labelSuggestions,
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
