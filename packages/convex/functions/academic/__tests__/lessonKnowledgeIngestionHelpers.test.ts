import { describe, expect, it } from "vitest";
import type { Id, TableNames } from "../../../_generated/dataModel";

import {
  assertKnowledgeMaterialUploadIsSupported,
  assertYouTubeUrl,
  buildKnowledgeMaterialSearchText,
  chunkKnowledgeMaterialText,
  MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES,
  resolveKnowledgeMaterialDefaults,
  suggestKnowledgeMaterialLabels,
} from "../lessonKnowledgeIngestionHelpers";

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>;
}

describe("lessonKnowledgeIngestionHelpers", () => {
  it("keeps teacher uploads private by default", () => {
    expect(
      resolveKnowledgeMaterialDefaults({
        actor: {
          userId: asId<"users">("teacher-1"),
          schoolId: asId<"schools">("school-1"),
          role: "teacher",
          isSchoolAdmin: false,
        },
        sourceType: "file_upload",
      })
    ).toEqual({
      visibility: "private_owner",
      reviewStatus: "draft",
      processingStatus: "awaiting_upload",
    });
  });

  it("lets staff request a private review queue without auto-publishing", () => {
    expect(
      resolveKnowledgeMaterialDefaults({
        actor: {
          userId: asId<"users">("teacher-1"),
          schoolId: asId<"schools">("school-1"),
          role: "teacher",
          isSchoolAdmin: false,
        },
        sourceType: "file_upload",
        uploadIntent: "request_review",
      })
    ).toEqual({
      visibility: "private_owner",
      reviewStatus: "pending_review",
      processingStatus: "awaiting_upload",
    });
  });

  it("lets admins explicitly start a file as staff shared", () => {
    expect(
      resolveKnowledgeMaterialDefaults({
        actor: {
          userId: asId<"users">("admin-1"),
          schoolId: asId<"schools">("school-1"),
          role: "admin",
          isSchoolAdmin: true,
        },
        sourceType: "file_upload",
        uploadIntent: "staff_shared",
      })
    ).toEqual({
      visibility: "staff_shared",
      reviewStatus: "approved",
      processingStatus: "awaiting_upload",
    });
  });

  it("blocks non-admins from choosing the staff-shared upload intent", () => {
    expect(() =>
      resolveKnowledgeMaterialDefaults({
        actor: {
          userId: asId<"users">("teacher-1"),
          schoolId: asId<"schools">("school-1"),
          role: "teacher",
          isSchoolAdmin: false,
        },
        sourceType: "file_upload",
        uploadIntent: "staff_shared",
      })
    ).toThrowError("Only admins can start a material as staff shared");
  });

  it("rejects unsupported upload sizes and content types", () => {
    expect(() =>
      assertKnowledgeMaterialUploadIsSupported({
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1024,
      })
    ).toThrowError("Only PDF and text-based uploads are supported in the planning library right now.");

    expect(() =>
      assertKnowledgeMaterialUploadIsSupported({
        contentType: "application/pdf",
        size: MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES + 1,
      })
    ).toThrowError("Uploaded file is too large for the planning library. Keep uploads at or below 12 MB.");
  });

  it("normalizes and bounds search text", () => {
    expect(
      buildKnowledgeMaterialSearchText([
        "  Social   Studies  ",
        "  Community  Safety ",
        "Social Studies",
      ])
    ).toBe("Social Studies Community Safety");
  });

  it("builds bounded chunks and label suggestions from source text", () => {
    const chunks = chunkKnowledgeMaterialText(
      "Safety in the community requires careful planning and consistent practice by teachers and students during every lesson period.",
      { chunkSize: 40, maxChunks: 3 }
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThanOrEqual(3);

    const labels = suggestKnowledgeMaterialLabels({
      title: "Community Safety Lesson Notes",
      topicLabel: "Community Safety",
      description: "Road safety, home safety, and school safety measures.",
    });

    expect(labels[0]).toBe("Community Safety");
    expect(labels).toContain("Road");
  });

  it("accepts only YouTube urls for link registration", () => {
    expect(assertYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toContain(
      "youtube.com"
    );
    expect(() => assertYouTubeUrl("https://example.com/video")).toThrowError(
      "Only YouTube links can be registered here"
    );
  });
});
