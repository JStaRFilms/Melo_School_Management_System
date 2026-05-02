import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { getTeacherAssignableSubjectIds } from "./auth";

export type KnowledgeActorRole = "student" | "teacher" | "admin";

export type KnowledgeVisibility =
  | "private_owner"
  | "staff_shared"
  | "class_scoped"
  | "student_approved";

export type KnowledgeReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";

export type KnowledgeActorContext = {
  userId: Id<"users">;
  schoolId: Id<"schools">;
  role: KnowledgeActorRole;
  isSchoolAdmin: boolean;
};

export type KnowledgeMaterialScope = {
  schoolId: Id<"schools">;
  ownerUserId: Id<"users">;
  visibility: KnowledgeVisibility;
  reviewStatus: KnowledgeReviewStatus;
};

export type KnowledgeMaterialBindingPurpose =
  | "review_queue"
  | "supplemental_upload"
  | "topic_attachment";

export type KnowledgeClassScopedMaterialScope = KnowledgeMaterialScope & {
  _id: Id<"knowledgeMaterials">;
  subjectId?: Id<"subjects">;
};

export type KnowledgeClassScopedStaffAccess = {
  classContextMatches: boolean;
  activeClassIds: Array<Id<"classes">>;
  matchedClassIds: Array<Id<"classes">>;
};

type KnowledgeDbCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export type KnowledgeMaterialTransitionScope = KnowledgeMaterialScope & {
  classContextMatches?: boolean;
  topicAttached?: boolean;
};

export type KnowledgeMaterialSourceScope = KnowledgeMaterialScope & {
  searchStatus: "not_indexed" | "indexing" | "indexed" | "failed";
  processingStatus:
    | "awaiting_upload"
    | "queued"
    | "extracting"
    | "ocr_needed"
    | "ready"
    | "failed";
};

export function assertKnowledgeSchoolBoundary(args: {
  expectedSchoolId: Id<"schools">;
  actualSchoolId: Id<"schools">;
}) {
  if (String(args.expectedSchoolId) !== String(args.actualSchoolId)) {
    throw new ConvexError("Cross-school access denied");
  }
}

export function canReadKnowledgeMaterialInStaffSurface(
  actor: KnowledgeActorContext,
  material: KnowledgeMaterialScope,
  args?: {
    classContextMatches?: boolean;
  }
): boolean {
  if (String(actor.schoolId) !== String(material.schoolId)) {
    return false;
  }

  if (actor.isSchoolAdmin || actor.role === "admin") {
    return true;
  }

  if (material.visibility === "private_owner") {
    return String(material.ownerUserId) === String(actor.userId);
  }

  if (material.visibility === "staff_shared") {
    return actor.role === "teacher";
  }

  if (material.visibility === "class_scoped") {
    return actor.role === "teacher" && args?.classContextMatches === true;
  }

  if (material.visibility === "student_approved") {
    return actor.role === "teacher";
  }

  return false;
}

export function canReadKnowledgeMaterialOnPortal(
  actor: KnowledgeActorContext,
  material: KnowledgeMaterialScope,
  args: {
    classContextMatches: boolean;
    topicAttached: boolean;
  }
): boolean {
  if (String(actor.schoolId) !== String(material.schoolId)) {
    return false;
  }

  if (actor.role !== "student") {
    return false;
  }

  if (material.visibility !== "student_approved") {
    return false;
  }

  if (material.reviewStatus !== "approved") {
    return false;
  }

  return args.classContextMatches === true && args.topicAttached === true;
}

export function canCreateKnowledgeMaterialDraft(
  actor: KnowledgeActorContext,
  args: {
    visibility: KnowledgeVisibility;
    reviewStatus: KnowledgeReviewStatus;
    classContextMatches?: boolean;
  }
): boolean {
  if (actor.isSchoolAdmin || actor.role === "admin") {
    return true;
  }

  if (actor.role === "teacher") {
    if (args.visibility === "private_owner") {
      return args.reviewStatus === "draft" || args.reviewStatus === "pending_review";
    }

    if (args.visibility === "staff_shared") {
      return args.reviewStatus === "approved" || args.reviewStatus === "pending_review";
    }

    if (args.visibility === "class_scoped") {
      return args.reviewStatus === "pending_review" && args.classContextMatches === true;
    }

    return false;
  }

  if (actor.role === "student") {
    return (
      args.visibility === "class_scoped" &&
      args.reviewStatus === "pending_review" &&
      args.classContextMatches === true
    );
  }

  return false;
}

export function canPromoteKnowledgeMaterial(
  actor: KnowledgeActorContext,
  material: KnowledgeMaterialScope,
  args: {
    nextVisibility: KnowledgeVisibility;
    nextReviewStatus: KnowledgeReviewStatus;
    classContextMatches?: boolean;
    topicAttached?: boolean;
  }
): boolean {
  if (String(actor.schoolId) !== String(material.schoolId)) {
    return false;
  }

  if (actor.isSchoolAdmin || actor.role === "admin") {
    return true;
  }

  if (actor.role === "teacher") {
    if (
      material.visibility === "private_owner" &&
      String(material.ownerUserId) === String(actor.userId) &&
      (material.reviewStatus === "draft" ||
        material.reviewStatus === "pending_review") &&
      args.nextVisibility === "staff_shared" &&
      args.nextReviewStatus === "approved"
    ) {
      return true;
    }

    if (
      material.visibility === "class_scoped" &&
      material.reviewStatus === "pending_review" &&
      args.nextVisibility === "student_approved" &&
      args.nextReviewStatus === "approved" &&
      args.classContextMatches === true &&
      args.topicAttached === true
    ) {
      return true;
    }
  }

  return false;
}

export function canUseKnowledgeMaterialAsLessonSource(
  actor: KnowledgeActorContext,
  material: KnowledgeMaterialSourceScope,
  args?: {
    classContextMatches?: boolean;
  }
): boolean {
  return (
    canReadKnowledgeMaterialInStaffSurface(actor, material, args) &&
    material.reviewStatus !== "archived" &&
    material.processingStatus === "ready" &&
    material.searchStatus === "indexed"
  );
}

export async function resolveClassScopedKnowledgeMaterialStaffAccess(
  ctx: KnowledgeDbCtx,
  actor: KnowledgeActorContext,
  material: KnowledgeClassScopedMaterialScope,
  args?: {
    requiredBindingPurposes?: KnowledgeMaterialBindingPurpose[];
  }
): Promise<KnowledgeClassScopedStaffAccess> {
  if (String(actor.schoolId) !== String(material.schoolId)) {
    return { classContextMatches: false, activeClassIds: [], matchedClassIds: [] };
  }

  if (material.visibility !== "class_scoped") {
    return { classContextMatches: true, activeClassIds: [], matchedClassIds: [] };
  }

  if (actor.role !== "teacher" && actor.role !== "admin" && !actor.isSchoolAdmin) {
    return { classContextMatches: false, activeClassIds: [], matchedClassIds: [] };
  }

  const requiredPurposes = args?.requiredBindingPurposes ?? [];
  const requiredPurposeSet = new Set(requiredPurposes);
  const activeBindings: Array<Doc<"knowledgeMaterialClassBindings">> = [];

  for await (const binding of ctx.db
    .query("knowledgeMaterialClassBindings")
    .withIndex("by_school_and_material", (q) =>
      q.eq("schoolId", actor.schoolId).eq("materialId", material._id)
    )) {
    if (
      binding.bindingStatus === "active" &&
      (requiredPurposeSet.size === 0 || requiredPurposeSet.has(binding.bindingPurpose))
    ) {
      activeBindings.push(binding);
    }
  }

  const activeClassIds = [...new Set(activeBindings.map((binding) => binding.classId))];

  const purposeByClassId = new Map<string, Set<KnowledgeMaterialBindingPurpose>>();
  for (const binding of activeBindings) {
    const classKey = String(binding.classId);
    const purposes = purposeByClassId.get(classKey) ?? new Set<KnowledgeMaterialBindingPurpose>();
    purposes.add(binding.bindingPurpose);
    purposeByClassId.set(classKey, purposes);
  }

  const candidateClassIds = activeClassIds.filter((classId) => {
    if (requiredPurposes.length === 0) {
      return true;
    }

    const purposes = purposeByClassId.get(String(classId));
    return Boolean(purposes && requiredPurposes.every((purpose) => purposes.has(purpose)));
  });

  const validClassIds: Array<Id<"classes">> = [];
  for (const classId of candidateClassIds) {
    const classDoc = (await ctx.db.get(classId)) as Doc<"classes"> | null;
    if (classDoc && String(classDoc.schoolId) === String(actor.schoolId) && !classDoc.isArchived) {
      validClassIds.push(classId);
    }
  }

  if (actor.isSchoolAdmin || actor.role === "admin") {
    return {
      classContextMatches: validClassIds.length > 0,
      activeClassIds,
      matchedClassIds: validClassIds,
    };
  }

  const matchedClassIds: Array<Id<"classes">> = [];
  for (const classId of validClassIds) {
    const subjectIds = await getTeacherAssignableSubjectIds(
      ctx,
      actor.userId,
      actor.schoolId,
      classId
    );
    if (
      material.subjectId === undefined ||
      subjectIds.some((subjectId) => String(subjectId) === String(material.subjectId))
    ) {
      matchedClassIds.push(classId);
    }
  }

  return {
    classContextMatches: matchedClassIds.length > 0,
    activeClassIds,
    matchedClassIds,
  };
}
