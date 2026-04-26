import { describe, expect, it } from "vitest";
import type { Id, TableNames } from "../../../_generated/dataModel";

import {
  assertKnowledgeSchoolBoundary,
  canCreateKnowledgeMaterialDraft,
  canPromoteKnowledgeMaterial,
  canReadKnowledgeMaterialInStaffSurface,
  canReadKnowledgeMaterialOnPortal,
  canUseKnowledgeMaterialAsLessonSource,
} from "../lessonKnowledgeAccess";
import {
  assertKnowledgeSearchAccess,
  assertKnowledgeSearchQuery,
  getKnowledgeSearchContract,
  normalizeKnowledgeSearchQuery,
} from "../lessonKnowledgeSearch";

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>;
}

const teacher = {
  userId: asId<"users">("user-teacher"),
  schoolId: asId<"schools">("school-a"),
  role: "teacher" as const,
  isSchoolAdmin: false,
};

const admin = {
  userId: asId<"users">("user-admin"),
  schoolId: asId<"schools">("school-a"),
  role: "admin" as const,
  isSchoolAdmin: true,
};

const student = {
  userId: asId<"users">("user-student"),
  schoolId: asId<"schools">("school-a"),
  role: "student" as const,
  isSchoolAdmin: false,
};

const staffSharedMaterial = {
  schoolId: asId<"schools">("school-a"),
  ownerUserId: asId<"users">("user-teacher"),
  visibility: "staff_shared" as const,
  reviewStatus: "approved" as const,
};

const privateOwnerMaterial = {
  schoolId: asId<"schools">("school-a"),
  ownerUserId: asId<"users">("user-teacher"),
  visibility: "private_owner" as const,
  reviewStatus: "draft" as const,
};

const studentApprovedMaterial = {
  schoolId: asId<"schools">("school-a"),
  ownerUserId: asId<"users">("user-teacher"),
  visibility: "student_approved" as const,
  reviewStatus: "approved" as const,
};

const classScopedPendingMaterial = {
  schoolId: asId<"schools">("school-a"),
  ownerUserId: asId<"users">("user-student"),
  visibility: "class_scoped" as const,
  reviewStatus: "pending_review" as const,
};

const readyClassScopedMaterial = {
  ...classScopedPendingMaterial,
  processingStatus: "ready" as const,
  searchStatus: "indexed" as const,
};

const readyPrivateMaterial = {
  ...privateOwnerMaterial,
  reviewStatus: "approved" as const,
  processingStatus: "ready" as const,
  searchStatus: "indexed" as const,
};

describe("lesson knowledge access", () => {
  it("rejects cross-school access at the boundary guard", () => {
    expect(() =>
      assertKnowledgeSchoolBoundary({
        expectedSchoolId: asId<"schools">("school-a"),
        actualSchoolId: asId<"schools">("school-b"),
      })
    ).toThrowError("Cross-school access denied");
  });

  it("allows teachers to view their own private materials but not other teachers' private drafts", () => {
    expect(
      canReadKnowledgeMaterialInStaffSurface(teacher, privateOwnerMaterial)
    ).toBe(true);

    expect(
      canReadKnowledgeMaterialInStaffSurface(
        {
          ...teacher,
          userId: asId<"users">("user-other-teacher"),
        },
        privateOwnerMaterial
      )
    ).toBe(false);
  });

  it("requires assignment-aware class context for class-scoped staff reads and source selection", () => {
    expect(
      canReadKnowledgeMaterialInStaffSurface(teacher, classScopedPendingMaterial)
    ).toBe(false);

    expect(
      canReadKnowledgeMaterialInStaffSurface(teacher, classScopedPendingMaterial, {
        classContextMatches: true,
      })
    ).toBe(true);

    expect(
      canUseKnowledgeMaterialAsLessonSource(teacher, readyClassScopedMaterial)
    ).toBe(false);

    expect(
      canUseKnowledgeMaterialAsLessonSource(teacher, readyClassScopedMaterial, {
        classContextMatches: true,
      })
    ).toBe(true);
  });

  it("keeps student-approved content portal-only for matching students and attached topics", () => {
    expect(
      canReadKnowledgeMaterialOnPortal(student, studentApprovedMaterial, {
        classContextMatches: true,
        topicAttached: true,
      })
    ).toBe(true);

    expect(
      canReadKnowledgeMaterialOnPortal(student, studentApprovedMaterial, {
        classContextMatches: false,
        topicAttached: true,
      })
    ).toBe(false);

    expect(
      canReadKnowledgeMaterialOnPortal(admin, studentApprovedMaterial, {
        classContextMatches: true,
        topicAttached: true,
      })
    ).toBe(false);
  });

  it("allows teachers to approve their own private material and student uploads only with topic and class context", () => {
    expect(
      canPromoteKnowledgeMaterial(teacher, privateOwnerMaterial, {
        nextVisibility: "staff_shared",
        nextReviewStatus: "approved",
      })
    ).toBe(true);

    expect(
      canPromoteKnowledgeMaterial(
        {
          ...teacher,
          userId: asId<"users">("user-other-teacher"),
        },
        {
          ...staffSharedMaterial,
          visibility: "class_scoped",
          reviewStatus: "pending_review",
          ownerUserId: asId<"users">("user-student"),
        },
        {
          nextVisibility: "student_approved",
          nextReviewStatus: "approved",
          classContextMatches: true,
          topicAttached: true,
        }
      )
    ).toBe(true);

    expect(
      canPromoteKnowledgeMaterial(
        teacher,
        {
          ...staffSharedMaterial,
          visibility: "class_scoped",
          reviewStatus: "pending_review",
          ownerUserId: asId<"users">("user-student"),
        },
        {
          nextVisibility: "student_approved",
          nextReviewStatus: "approved",
          classContextMatches: true,
          topicAttached: true,
        }
      )
    ).toBe(true);

    expect(
      canPromoteKnowledgeMaterial(student, studentApprovedMaterial, {
        nextVisibility: "student_approved",
        nextReviewStatus: "approved",
        classContextMatches: true,
        topicAttached: true,
      })
    ).toBe(false);
  });

  it("keeps draft creation and search limited to the right roles", () => {
    expect(
      canCreateKnowledgeMaterialDraft(student, {
        visibility: "class_scoped",
        reviewStatus: "pending_review",
        classContextMatches: true,
      })
    ).toBe(true);

    expect(
      canUseKnowledgeMaterialAsLessonSource(teacher, readyPrivateMaterial)
    ).toBe(true);

    expect(
      canUseKnowledgeMaterialAsLessonSource(
        teacher,
        {
          ...readyPrivateMaterial,
          processingStatus: "queued",
        }
      )
    ).toBe(false);

    expect(() => assertKnowledgeSearchAccess(student)).toThrowError(
      "Knowledge search is restricted to staff"
    );

    expect(assertKnowledgeSearchAccess(admin)).toBeUndefined();
    expect(normalizeKnowledgeSearchQuery("  science   lesson   notes  ")).toBe(
      "science lesson notes"
    );
    expect(() => assertKnowledgeSearchQuery("   ")).toThrowError(
      "Search query is required"
    );
    expect(getKnowledgeSearchContract("knowledgeMaterials")).toMatchObject({
      tableName: "knowledgeMaterials",
      indexName: "search_search_text",
      searchField: "searchText",
    });
  });
});
