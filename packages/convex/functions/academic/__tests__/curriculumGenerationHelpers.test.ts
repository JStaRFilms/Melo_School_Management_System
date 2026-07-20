import { describe, expect, it } from "vitest";
import {
  buildBoundedCurriculumSourcePages,
  hasMatchingCurriculumEvidence,
  MAX_CURRICULUM_SOURCE_CHARS_TOTAL,
} from "../curriculumHelpers";

describe("bounded curriculum generation evidence", () => {
  it("deduplicates repeated page evidence and caps aggregate source text", () => {
    const repeated = { chunkHash: "same", chunkText: "Repeated source evidence", pageNumbers: [1, 2, 3] };
    const repeatedPages = { chunkHash: "same", chunkText: "Repeated source evidence", pageNumbers: [3, 4, 5] };
    const oversized = Array.from({ length: 20 }, (_, index) => ({ chunkHash: `chunk-${index}`, chunkText: "x".repeat(4_000), pageNumbers: [index + 2] }));
    const pages = buildBoundedCurriculumSourcePages([repeated, repeatedPages, ...oversized]);
    expect(pages.filter((page) => page.chunkHash === "same")).toHaveLength(1);
    expect(pages.find((page) => page.chunkHash === "same")?.pageNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(pages.reduce((total, page) => total + page.text.length, 0)).toBeLessThanOrEqual(MAX_CURRICULUM_SOURCE_CHARS_TOTAL);
    expect(pages.every((page) => page.pageNumbers.every((number) => number > 0) && page.text.length > 0)).toBe(true);
  });

  it("uses a stable chunk id when production ingestion did not store a legacy hash", () => {
    const chunk = {
      _id: "chunk-record-id",
      chunkText: "Fractions compare equal parts using visual models.",
      pageNumbers: [3],
    };
    const pages = buildBoundedCurriculumSourcePages([chunk]);

    expect(pages).toEqual([{
      pageNumbers: [3],
      text: chunk.chunkText,
      chunkHash: "chunk-record-id",
    }]);
    expect(hasMatchingCurriculumEvidence({
      sourcePages: [3],
      sourceChunkHash: "chunk-record-id",
      supportingExcerpt: "compare equal parts using visual models",
      chunks: [chunk],
    })).toBe(true);
  });
});
