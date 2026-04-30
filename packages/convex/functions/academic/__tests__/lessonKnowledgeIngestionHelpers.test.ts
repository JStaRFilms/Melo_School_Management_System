import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Id, TableNames } from "../../../_generated/dataModel";

import {
  assertKnowledgeMaterialUploadIsSupported,
  assertYouTubeUrl,
  buildKnowledgeMaterialSearchText,
  chunkKnowledgeMaterialPages,
  chunkKnowledgeMaterialText,
  parsePdfPageRanges,
  MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES,
  resolveKnowledgeMaterialDefaults,
  suggestKnowledgeMaterialLabels,
} from "../lessonKnowledgeIngestionHelpers";
import { extractReadableTextFromBuffer } from "../lessonKnowledgePdfExtraction";

function asId<TableName extends TableNames>(value: string): Id<TableName> {
  return value as Id<TableName>;
}

function buildBlankPdfBuffer() {
  const header = "%PDF-1.4\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>\nendobj\n",
    "4 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\n",
  ];

  let cursor = Buffer.byteLength(header, "latin1");
  const offsets = objects.map((object) => {
    const offset = cursor;
    cursor += Buffer.byteLength(object, "latin1");
    return offset;
  });

  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(cursor),
    "%%EOF",
    "",
  ].join("\n");

  return Buffer.from(header + objects.join("") + xref, "latin1");
}

function createGeminiSuccessFetch(text: string) {
  return async () =>
    ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text }],
            },
          },
        ],
      }),
    }) as Response;
}

function createHangingFetch() {
  return () => new Promise<Response>(() => undefined);
}

function createRateLimitedFetch() {
  return async () =>
    ({
      ok: false,
      status: 429,
      json: async () => ({}),
    }) as Response;
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

  it("parses advanced PDF page range selections", () => {
    expect(parsePdfPageRanges("1")).toEqual([1]);
    expect(parsePdfPageRanges("1-5")).toEqual([1, 2, 3, 4, 5]);
    expect(parsePdfPageRanges("1-5,7-8,70-72")).toEqual([1, 2, 3, 4, 5, 7, 8, 70, 71, 72]);
    expect(parsePdfPageRanges(" 1 - 3 , 5, 3 ")).toEqual([1, 2, 3, 5]);

    expect(() => parsePdfPageRanges("0")).toThrowError();
    expect(() => parsePdfPageRanges("8-7")).toThrowError();
    expect(() => parsePdfPageRanges("1,,3")).toThrowError();
    expect(() => parsePdfPageRanges("abc")).toThrowError();
    expect(() => parsePdfPageRanges("1.5")).toThrowError();
  });

  it("builds page-aware chunks with exact source pages", () => {
    const chunks = chunkKnowledgeMaterialPages(
      [
        { pageNumber: 1, text: "Community safety starts with clean homes and roads." },
        { pageNumber: 2, text: "Teachers explain road signs and safe crossing." },
        { pageNumber: 7, text: "Emergency helpers protect the community." },
      ],
      { chunkSize: 80, maxChunks: 4 }
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageStart).toBe(1);
    expect(chunks[0].pageNumbers).toContain(1);
    expect(chunks.some((chunk) => chunk.pageNumbers.includes(7))).toBe(true);
  });

  it("accepts only YouTube urls for link registration", () => {
    expect(assertYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toContain("youtube.com");
    expect(() => assertYouTubeUrl("https://example.com/video")).toThrowError(
      "Only YouTube links can be registered here"
    );
  });

  it("reads a digital PDF with the parser before Gemini fallback", async () => {
    const samplePdf = readFileSync(
      new URL(
        "../../../../../docs/School curriculim example/JSS1 SOCIAL STUDIES SECOND TERM LESSON NOTES.pdf",
        import.meta.url
      )
    );

    const result = await extractReadableTextFromBuffer(samplePdf, {
      contentType: "application/pdf",
      fetchImpl: async () => {
        throw new Error("Gemini fallback should not be called for a readable PDF");
      },
    });

    expect(result.status).toBe("ready");
    expect(result.extractionPath).toBe("parser");
    expect(result.text.length).toBeGreaterThan(1000);
    expect(result.errorMessage).toBeNull();
  });

  it("classifies scanned-like PDFs honestly when Gemini is unavailable", async () => {
    const result = await extractReadableTextFromBuffer(buildBlankPdfBuffer(), {
      contentType: "application/pdf",
      fetchImpl: async () => {
        throw new Error("Gemini fallback should not be called without an API key");
      },
    });

    expect(result.status).toBe("ocr_needed");
    expect(result.extractionPath).toBe("none");
    expect(result.fallbackReason).toBe("scanned_or_problematic");
    expect(result.errorMessage).toContain("Gemini fallback is not configured");
  });

  it("fails without hanging when Gemini fallback never resolves", async () => {
    const startedAt = Date.now();

    const result = await extractReadableTextFromBuffer(buildBlankPdfBuffer(), {
      contentType: "application/pdf",
      geminiApiKey: "test-key",
      fetchImpl: createHangingFetch(),
      geminiTimeoutMs: 25,
    });

    const elapsedMs = Date.now() - startedAt;

    expect(elapsedMs).toBeLessThan(1000);
    expect(result.status).toBe("ocr_needed");
    expect(result.extractionPath).toBe("gemini");
    expect(result.errorMessage).toContain("timed out");
  });

  it("returns a clear OCR-needed status when Gemini fallback is rate-limited", async () => {
    const result = await extractReadableTextFromBuffer(buildBlankPdfBuffer(), {
      contentType: "application/pdf",
      geminiApiKey: "test-key",
      fetchImpl: createRateLimitedFetch(),
    });

    expect(result.status).toBe("ocr_needed");
    expect(result.extractionPath).toBe("none");
    expect(result.fallbackReason).toBe("scanned_or_problematic");
    expect(result.errorMessage).toContain("HTTP 429");
    expect(result.errorMessage).toContain("OCR");
  });
});
