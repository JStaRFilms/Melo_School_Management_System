import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { query, mutation } from "../../_generated/server";
import { getAuthenticatedSchoolMembership } from "./auth";
import {
  canCreateKnowledgeMaterialDraft,
  canPromoteKnowledgeMaterial,
  canReadKnowledgeMaterialOnPortal,
  assertKnowledgeSchoolBoundary,
  type KnowledgeActorContext,
} from "./lessonKnowledgeAccess";
import { assertKnowledgeMaterialUploadIsSupported } from "./lessonKnowledgeIngestionHelpers";
import {
  knowledgeMaterialOriginalFileAccessValidator,
  knowledgeMaterialSourceProofValidator,
  readKnowledgeMaterialOriginalFileAccess,
  readKnowledgeMaterialSourceProof,
} from "./lessonKnowledgeSourceProof";

const portalTopicValidator = v.object({
  _id: v.id("knowledgeTopics"),
  title: v.string(),
  summary: v.union(v.string(), v.null()),
  subjectId: v.id("subjects"),
  level: v.string(),
  status: v.union(v.literal("draft"), v.literal("active"), v.literal("retired")),
});

const portalTopicApprovedMaterialValidator = v.object({
  _id: v.id("knowledgeMaterials"),
  title: v.string(),
  description: v.union(v.string(), v.null()),
  sourceType: v.union(
    v.literal("file_upload"),
    v.literal("text_entry"),
    v.literal("youtube_link"),
    v.literal("generated_resource"),
    v.literal("student_upload")
  ),
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
  externalUrl: v.union(v.string(), v.null()),
  topicId: v.union(v.id("knowledgeTopics"), v.null()),
  classId: v.union(v.id("classes"), v.null()),
  sourceProof: knowledgeMaterialSourceProofValidator,
});

const portalTopicPageDataValidator = v.object({
  topic: portalTopicValidator,
  classId: v.id("classes"),
  className: v.string(),
  canUploadSupplemental: v.boolean(),
  approvedMaterials: v.array(portalTopicApprovedMaterialValidator),
});

const portalTopicListItemValidator = v.object({
  _id: v.id("knowledgeTopics"),
  title: v.string(),
  summary: v.union(v.string(), v.null()),
  subjectId: v.id("subjects"),
  subjectName: v.string(),
  level: v.string(),
  status: v.union(v.literal("draft"), v.literal("active"), v.literal("retired")),
});

const portalTopicIndexDataValidator = v.object({
  classId: v.id("classes"),
  className: v.string(),
  topics: v.array(portalTopicListItemValidator),
});

const portalSupplementalUploadUrlValidator = v.object({
  materialId: v.id("knowledgeMaterials"),
  uploadUrl: v.string(),
});

const portalSupplementalFinalizeValidator = v.object({
  materialId: v.id("knowledgeMaterials"),
  processingStatus: v.union(
    v.literal("awaiting_upload"),
    v.literal("queued"),
    v.literal("extracting"),
    v.literal("ocr_needed"),
    v.literal("ready"),
    v.literal("failed")
  ),
});

async function getStudentPortalContext(ctx: Parameters<typeof getAuthenticatedSchoolMembership>[0]) {
  const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
  if (role !== "student") {
    throw new ConvexError("Portal topic pages are available to students only");
  }
  const user = await ctx.db.get(userId) as Doc<"users"> | null;
  if (!user || user.schoolId !== schoolId) {
    throw new ConvexError("Student account not found");
  }
  const studentRows = await ctx.db
    .query("students")
    .withIndex("by_school", (q: any) => q.eq("schoolId", schoolId))
    .collect();
  const student = studentRows.find(
    (entry: Doc<"students">) => !entry.isArchived && String(entry.userId) === String(userId)
  ) ?? null;
  if (!student || student.isArchived) {
    throw new ConvexError("Student record not found");
  }
  return { userId, schoolId, role, isSchoolAdmin, student };
}


export const getPortalTopicIndexData = query({
  args: {},
  returns: portalTopicIndexDataValidator,
  handler: async (ctx) => {
    const { schoolId, student } = await getStudentPortalContext(ctx);
    const classDoc = (await ctx.db.get(student.classId)) as Doc<"classes"> | null;
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }

    const studentLevel = (classDoc.gradeName ?? classDoc.name).trim().toLowerCase();
    const topics = await ctx.db
      .query("knowledgeTopics")
      .withIndex("by_school_and_status", (q) => q.eq("schoolId", schoolId).eq("status", "active"))
      .collect();

    const visibleTopics = topics
      .filter((topic) => topic.level.trim().toLowerCase() === studentLevel)
      .sort((a, b) => a.title.localeCompare(b.title));

    const subjectIds = Array.from(new Set(visibleTopics.map((topic) => String(topic.subjectId))));
    const subjects = await Promise.all(
      subjectIds.map((subjectId) => ctx.db.get(subjectId as Id<"subjects">))
    );
    const subjectNameById = new Map<string, string>();
    for (const subject of subjects) {
      if (subject && subject.schoolId === schoolId && !subject.isArchived) {
        subjectNameById.set(String(subject._id), subject.name);
      }
    }

    return {
      classId: student.classId,
      className: classDoc.name,
      topics: visibleTopics.map((topic) => ({
        _id: topic._id,
        title: topic.title,
        summary: topic.summary ?? null,
        subjectId: topic.subjectId,
        subjectName: subjectNameById.get(String(topic.subjectId)) ?? "Subject",
        level: topic.level,
        status: topic.status,
      })),
    };
  },
});

export const getPortalTopicPageData = query({
  args: { topicId: v.id("knowledgeTopics") },
  returns: portalTopicPageDataValidator,
  handler: async (ctx, args) => {
    const { schoolId, student } = await getStudentPortalContext(ctx);
    const topic = (await ctx.db.get(args.topicId)) as Doc<"knowledgeTopics"> | null;
    if (!topic || topic.schoolId !== schoolId || topic.status !== "active") {
      throw new ConvexError("Topic not found");
    }
    const classDoc = (await ctx.db.get(student.classId)) as Doc<"classes"> | null;
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }
    const materials = await ctx.db
      .query("knowledgeMaterials")
      .withIndex("by_school_and_topic", (q) => q.eq("schoolId", schoolId).eq("topicId", args.topicId))
      .take(50);
    const classEligibleMaterials: Array<Doc<"knowledgeMaterials"> & { classEligible: boolean }> = [];
    for (const material of materials) {
      const bindings = await ctx.db
        .query("knowledgeMaterialClassBindings")
        .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", material._id))
        .take(20);
      classEligibleMaterials.push({
        ...(material as Doc<"knowledgeMaterials">),
        classEligible: bindings.some(
          (binding) =>
            binding.classId === student.classId &&
            binding.bindingPurpose === "topic_attachment" &&
            binding.bindingStatus === "active"
        ),
      });
    }
    const studentLevel = (classDoc.gradeName ?? classDoc.name).trim().toLowerCase();
    const topicLevel = topic.level.trim().toLowerCase();
    const classEligible = studentLevel === topicLevel;
    const approvedMaterials = await Promise.all(
      classEligibleMaterials
        .filter((material) =>
          canReadKnowledgeMaterialOnPortal(
            { userId: student.userId, schoolId, role: "student", isSchoolAdmin: false },
            material,
            { classContextMatches: material.classEligible, topicAttached: true }
          )
        )
        .map(async (material) => {
          const sourceType:
            | "file_upload"
            | "text_entry"
            | "youtube_link"
            | "student_upload"
            | "generated_resource" =
            material.sourceType === "generated_draft"
              ? "generated_resource"
              : material.sourceType === "file_upload" ||
                  material.sourceType === "text_entry" ||
                  material.sourceType === "youtube_link" ||
                  material.sourceType === "student_upload"
                ? material.sourceType
                : "text_entry";

          const sourceProof = await readKnowledgeMaterialSourceProof(ctx, {
            schoolId,
            materialId: material._id,
            storageId: material.storageId ?? null,
            previewChunkCount: 2,
            previewCharLimit: 320,
          });

          return {
            _id: material._id,
            title: material.title,
            description: material.description ?? null,
            sourceType,
            visibility: material.visibility,
            reviewStatus: material.reviewStatus,
            externalUrl: material.externalUrl ?? null,
            topicId: material.topicId ?? null,
            classId: student.classId,
            sourceProof,
          };
        })
    );
    return {
      topic: {
        _id: topic._id,
        title: topic.title,
        summary: topic.summary ?? null,
        subjectId: topic.subjectId,
        level: topic.level,
        status: topic.status,
      },
      classId: student.classId,
      className: classDoc.name,
      canUploadSupplemental: classEligible,
      approvedMaterials,
    };
  },
});

export const getPortalKnowledgeMaterialOriginalFileAccess = query({
  args: {
    materialId: v.id("knowledgeMaterials"),
  },
  returns: knowledgeMaterialOriginalFileAccessValidator,
  handler: async (ctx, args) => {
    const { schoolId, student } = await getStudentPortalContext(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new ConvexError("Knowledge material not found");
    }

    assertKnowledgeSchoolBoundary({ expectedSchoolId: schoolId, actualSchoolId: material.schoolId });

    const bindings = await ctx.db
      .query("knowledgeMaterialClassBindings")
      .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", material._id))
      .collect();

    const classEligible = bindings.some(
      (binding) =>
        binding.classId === student.classId &&
        binding.bindingPurpose === "topic_attachment" &&
        binding.bindingStatus === "active"
    );

    if (
      !canReadKnowledgeMaterialOnPortal(
        { userId: student.userId, schoolId, role: "student", isSchoolAdmin: false },
        material,
        { classContextMatches: classEligible, topicAttached: Boolean(material.topicId) }
      )
    ) {
      throw new ConvexError("You cannot open this file");
    }

    return await readKnowledgeMaterialOriginalFileAccess(ctx, {
      storageId: material.storageId ?? null,
    });
  },
});

export const requestPortalSupplementalUploadUrl = mutation({
  args: {
    topicId: v.id("knowledgeTopics"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    fileContentType: v.string(),
    fileSize: v.number(),
  },
  returns: portalSupplementalUploadUrlValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, student } = await getStudentPortalContext(ctx);
    const topic = (await ctx.db.get(args.topicId)) as Doc<"knowledgeTopics"> | null;
    if (!topic || topic.schoolId !== schoolId) throw new ConvexError("Topic not found");
    const classDoc = (await ctx.db.get(student.classId)) as Doc<"classes"> | null;
    if (!classDoc || classDoc.schoolId !== schoolId || classDoc.isArchived) {
      throw new ConvexError("Class not found");
    }
    const studentLevel = (classDoc.gradeName ?? classDoc.name).trim().toLowerCase();
    const topicLevel = topic.level.trim().toLowerCase();
    if (studentLevel !== topicLevel) {
      throw new ConvexError("This topic is not open for uploads from your class");
    }
    const title = args.title.trim();
    if (!title) throw new ConvexError("Title is required");
    assertKnowledgeMaterialUploadIsSupported({
      contentType: args.fileContentType,
      size: args.fileSize,
    });
    const actor: KnowledgeActorContext = { userId, schoolId, role: "student", isSchoolAdmin: false };
    if (!canCreateKnowledgeMaterialDraft(actor, { visibility: "class_scoped", reviewStatus: "pending_review", classContextMatches: true })) {
      throw new ConvexError("Supplemental uploads are not available");
    }
    const now = Date.now();
    const materialId = await ctx.db.insert("knowledgeMaterials", {
      schoolId,
      ownerUserId: userId,
      ownerRole: "student",
      sourceType: "student_upload",
      visibility: "class_scoped",
      reviewStatus: "pending_review",
      title,
      description: args.description ?? undefined,
      subjectId: topic.subjectId,
      level: topic.level,
      topicLabel: topic.title,
      topicId: topic._id,
      searchStatus: "not_indexed",
      searchText: title,
      processingStatus: "awaiting_upload",
      ingestionErrorMessage: null,
      ingestionAttemptCount: 0,
      labelSuggestions: [],
      chunkCount: 0,
      indexedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    });
    await ctx.db.insert("knowledgeMaterialClassBindings", {
      schoolId,
      materialId,
      classId: student.classId,
      bindingPurpose: "supplemental_upload",
      bindingStatus: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    });
    await ctx.db.insert("knowledgeMaterialClassBindings", {
      schoolId,
      materialId,
      classId: student.classId,
      bindingPurpose: "topic_attachment",
      bindingStatus: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    });
    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId,
      actorUserId: userId,
      actorRole: "student",
      eventType: "created",
      entityType: "knowledgeMaterial",
      materialId,
      changeSummary: "Created a class-scoped supplemental upload shell from the portal topic page.",
    });
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { materialId, uploadUrl };
  },
});

export const finalizePortalSupplementalUpload = mutation({
  args: {
    materialId: v.id("knowledgeMaterials"),
    storageId: v.id("_storage"),
  },
  returns: portalSupplementalFinalizeValidator,
  handler: async (ctx, args) => {
    const { userId, schoolId, student } = await getStudentPortalContext(ctx);
    const material = await ctx.db.get(args.materialId);
    if (!material) {
      throw new ConvexError("Knowledge material not found");
    }

    assertKnowledgeSchoolBoundary({ expectedSchoolId: schoolId, actualSchoolId: material.schoolId });

    if (material.ownerUserId !== userId || material.ownerRole !== "student" || material.sourceType !== "student_upload") {
      throw new ConvexError("You cannot finalize this upload");
    }

    if (!material.topicId) {
      throw new ConvexError("Supplemental upload topic context is missing");
    }

    const bindings = await ctx.db
      .query("knowledgeMaterialClassBindings")
      .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", args.materialId))
      .collect();

    if (!bindings.some((binding) => binding.classId === student.classId && binding.bindingPurpose === "supplemental_upload" && binding.bindingStatus === "active")) {
      throw new ConvexError("Supplemental upload class binding is missing");
    }

    if (!bindings.some((binding) => binding.classId === student.classId && binding.bindingPurpose === "topic_attachment" && binding.bindingStatus === "active")) {
      throw new ConvexError("Supplemental upload topic attachment is missing");
    }

    const storageMeta = await ctx.db.system.get("_storage", args.storageId);
    if (!storageMeta) {
      throw new ConvexError("Uploaded file not found");
    }

    try {
      assertKnowledgeMaterialUploadIsSupported({
        contentType: storageMeta.contentType,
        size: storageMeta.size,
      });
    } catch (error) {
      const message = error instanceof ConvexError ? error.message : "Uploaded file is not supported";
      const failedAt = Date.now();
      await ctx.db.patch(args.materialId, {
        storageId: args.storageId,
        visibility: "private_owner",
        reviewStatus: "draft",
        processingStatus: "failed",
        searchStatus: "failed",
        ingestionErrorMessage: message,
        updatedAt: failedAt,
        updatedBy: userId,
      });
      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
        schoolId,
        actorUserId: userId,
        actorRole: "student",
        eventType: "ingestion_failed",
        entityType: "knowledgeMaterial",
        materialId: args.materialId,
        changeSummary: message,
      });
      throw new ConvexError(message);
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
        actorRole: "student",
        reason: "upload_finalized",
      }
    );

    return {
      materialId: args.materialId,
      processingStatus: "queued" as const,
    };
  },
});

export const promotePortalStudentUpload = mutation({
  args: { materialId: v.id("knowledgeMaterials") },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    visibility: v.literal("student_approved"),
    reviewStatus: v.literal("approved"),
  }),
  handler: async (ctx, args) => {
    const { userId, schoolId, role, isSchoolAdmin } = await getAuthenticatedSchoolMembership(ctx);
    const actorRole = role === "admin" || isSchoolAdmin ? "admin" : "teacher";
    if (actorRole !== "teacher" && actorRole !== "admin") throw new ConvexError("Only teachers can promote uploads");
    const material = await ctx.db.get(args.materialId);
    if (!material) throw new ConvexError("Knowledge material not found");
    assertKnowledgeSchoolBoundary({ expectedSchoolId: schoolId, actualSchoolId: material.schoolId });
    const bindings = await ctx.db
      .query("knowledgeMaterialClassBindings")
      .withIndex("by_school_and_material", (q) => q.eq("schoolId", schoolId).eq("materialId", args.materialId))
      .take(20);
    const classBinding = bindings.find((binding) => binding.bindingPurpose === "supplemental_upload" && binding.bindingStatus === "active");
    const topicBinding = bindings.find((binding) => binding.bindingPurpose === "topic_attachment" && binding.bindingStatus === "active");
    if (!classBinding || !topicBinding || !material.topicId) {
      throw new ConvexError("Topic attachment and class scope are required before promotion");
    }
    const classContextMatches = Boolean(classBinding);
    if (!canPromoteKnowledgeMaterial(
      { userId, schoolId, role: actorRole, isSchoolAdmin },
      material,
      { nextVisibility: "student_approved", nextReviewStatus: "approved", classContextMatches, topicAttached: true }
    )) {
      throw new ConvexError("Not allowed to promote this material");
    }
    await ctx.db.patch(args.materialId, { visibility: "student_approved", reviewStatus: "approved", updatedAt: Date.now() });
    await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.recordContentAuditEventInternal, {
      schoolId,
      actorUserId: userId,
      actorRole,
      eventType: "promoted",
      entityType: "knowledgeMaterial",
      materialId: args.materialId,
      changeSummary: "Promoted a class-scoped supplemental upload to student-approved topic content.",
    });
    return { materialId: args.materialId, visibility: "student_approved" as const, reviewStatus: "approved" as const };
  },
});
