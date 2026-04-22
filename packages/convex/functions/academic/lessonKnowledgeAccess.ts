import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";

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
  material: KnowledgeMaterialSourceScope
): boolean {
  return (
    canReadKnowledgeMaterialInStaffSurface(actor, material) &&
    material.reviewStatus !== "archived" &&
    material.processingStatus === "ready" &&
    material.searchStatus === "indexed"
  );
}
