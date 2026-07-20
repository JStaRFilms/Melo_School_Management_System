import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { toCurriculumGenerationFailure } from "@school/ai";
import {
  buildBoundedCurriculumSourcePages,
  detectCurriculumTermMismatch,
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
      title: "Fractions",
      subtopics: ["Equal parts"],
      learningObjectives: ["Compare fractions"],
      sourcePages: [3],
      sourceChunkHash: "chunk-record-id",
      supportingExcerpt: "compare equal parts using visual models",
      chunks: [chunk],
    })).toBe(true);
  });

  it("preserves safe provider failures through a real ConvexError boundary", () => {
    const failure = {
      errorCode: "source_context_mismatch",
      errorMessage: "The source appears to cover Second Term, but Third Term was selected.",
    };
    expect(toCurriculumGenerationFailure(new ConvexError(failure))).toEqual(failure);
  });

  it("detects a strong numbered-term mismatch without guessing from one mention", () => {
    expect(detectCurriculumTermMismatch(
      "Third Term",
      "JSS 1 SECOND TERM SCHEME OF WORK\nWeek 1. Revision and assessment.",
    )).toEqual({ requestedTerm: "Third Term", detectedTerm: "Second Term" });
    expect(detectCurriculumTermMismatch(
      "Third Term",
      "Third Term work includes one review of Second Term topics.",
    )).toBeNull();
    expect(detectCurriculumTermMismatch(
      "Third Term",
      "Revision of Second Term work. Review the Second Term examination.",
    )).toBeNull();
    expect(detectCurriculumTermMismatch(
      "Third Term",
      "JSS 1 THIRD TERM WORK. Week 1 revises the Second Term lesson notes.",
    )).toBeNull();
  });

  it("rejects trivial excerpts even when the words occur in the source", () => {
    expect(hasMatchingCurriculumEvidence({
      title: "Fractions",
      subtopics: ["Equal parts"],
      learningObjectives: ["Compare fractions"],
      sourcePages: [3],
      sourceChunkHash: "chunk-record-id",
      supportingExcerpt: "the week topic",
      chunks: [{
        _id: "chunk-record-id",
        chunkText: "The week topic introduces fractions and equal parts.",
        pageNumbers: [3],
      }],
    })).toBe(false);
    expect(hasMatchingCurriculumEvidence({
      title: "Drug Abuse",
      subtopics: ["Harmful substances"],
      learningObjectives: ["Explain health consequences"],
      sourcePages: [3],
      sourceChunkHash: "chunk-record-id",
      supportingExcerpt: "Learning objectives include classroom discussion",
      chunks: [{
        _id: "chunk-record-id",
        chunkText: "Learning objectives include classroom discussion.",
        pageNumbers: [3],
      }],
    })).toBe(false);
  });
});
