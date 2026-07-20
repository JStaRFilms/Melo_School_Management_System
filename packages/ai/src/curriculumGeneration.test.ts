import assert from "node:assert/strict";
import test from "node:test";
import { APICallError, LoadAPIKeyError, NoOutputGeneratedError, RetryError } from "ai";

import { createMockCurriculumExtraction, curriculumExtractionInputSchema, curriculumUnitSchema } from "./curriculum.ts";
import { reconcileCurriculumExtractionEvidence, reconcileCurriculumUnitEvidence } from "./curriculumEvidence.ts";
import { toCurriculumGenerationFailure } from "./curriculumErrors.ts";

const input = {
  subject: "Mathematics",
  level: "JSS 1",
  term: "First Term",
  pages: [{ pageNumbers: [4, 5], text: "Fractions are parts of a whole.", chunkHash: "chunk-4" }],
};

test("validates page-aware source evidence before generation", () => {
  const parsed = curriculumExtractionInputSchema.parse(input);
  assert.equal(parsed.pages[0].chunkHash, "chunk-4");
  assert.deepEqual(parsed.pages[0].pageNumbers, [4, 5]);
});

test("uses the deterministic mock without a model request", async () => {
  const result = createMockCurriculumExtraction(input);
  assert.equal(result.units[0].sourceChunkHash, "chunk-4");
  assert.deepEqual(result.units[0].sourcePages, [4, 5]);
});

test("accepts curriculum units without invented subtopics", () => {
  const unit = createMockCurriculumExtraction(input).units[0];
  assert.deepEqual(curriculumUnitSchema.parse({ ...unit, subtopics: [] }).subtopics, []);
});

test("preserves an actionable source-evidence failure", () => {
  assert.deepEqual(
    toCurriculumGenerationFailure(new Error("No page-aware extracted source text is available")),
    {
      errorCode: "source_evidence_unavailable",
      errorMessage: "No curriculum-ready source text was found. Reprocess the material or choose another indexed source.",
    }
  );
});

test("maps provider authentication failures without exposing the raw response", () => {
  const authFailure = new APICallError({
    message: "User not found.",
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 401,
    responseBody: '{"error":{"message":"User not found."}}',
    isRetryable: false,
  });
  assert.deepEqual(
    toCurriculumGenerationFailure(authFailure),
    {
      errorCode: "provider_authentication_failed",
      errorMessage: "OpenRouter rejected the configured API key. Update OPENROUTER_API_KEY in the active Convex deployment.",
    }
  );
});

test("preserves structured provider failures across a Convex error boundary", () => {
  assert.deepEqual(
    toCurriculumGenerationFailure({ data: { errorCode: "provider_model_unavailable" } }),
    {
      errorCode: "provider_model_unavailable",
      errorMessage: "The configured OpenRouter curriculum model is unavailable. Choose another SCHOOL_AI_CURRICULUM_MODEL.",
    }
  );
});

test("maps a missing provider key and empty structured output", () => {
  assert.equal(
    toCurriculumGenerationFailure(new LoadAPIKeyError({ message: "missing secret" })).errorCode,
    "provider_authentication_failed"
  );
  assert.equal(
    toCurriculumGenerationFailure(new NoOutputGeneratedError()).errorCode,
    "provider_output_invalid"
  );
});

test("unwraps retry errors to preserve provider rate-limit guidance", () => {
  const rateLimit = new APICallError({
    message: "rate limited",
    url: "https://openrouter.ai/api/v1/chat/completions",
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: true,
  });
  const retryError = new RetryError({
    message: "retries exhausted",
    reason: "maxRetriesExceeded",
    errors: [rateLimit],
  });
  assert.equal(toCurriculumGenerationFailure(retryError).errorCode, "provider_rate_limited");
});

test("reconciles a copied excerpt with a model-added ellipsis", () => {
  const unit = {
    ...createMockCurriculumExtraction(input).units[0],
    title: "Fractions",
    subtopics: ["Parts of a whole"],
    learningObjectives: ["Explain fractions"],
  };
  const reconciled = reconcileCurriculumUnitEvidence({
    ...unit,
    sourcePages: [99],
    sourceChunkHash: "mistyped-reference",
    supportingExcerpt: "Fractions are parts of a whole...",
  }, input.pages);
  assert.deepEqual(reconciled, {
    ...unit,
    supportingExcerpt: "Fractions are parts of a whole",
  });
});

test("rejects fabricated or ambiguous curriculum evidence", () => {
  const unit = createMockCurriculumExtraction(input).units[0];
  assert.equal(reconcileCurriculumUnitEvidence({ ...unit, supportingExcerpt: "Invented evidence" }, input.pages), null);
  assert.throws(() => reconcileCurriculumExtractionEvidence([
    { ...unit, sourceChunkHash: "unknown", supportingExcerpt: "Fractions" },
  ], [
    ...input.pages,
    { ...input.pages[0], chunkHash: "chunk-duplicate" },
  ]), /could not be matched/);
});

test("rejects trivial excerpts that cannot prove a curriculum unit", () => {
  const unit = createMockCurriculumExtraction(input).units[0];
  assert.equal(
    reconcileCurriculumUnitEvidence({ ...unit, supportingExcerpt: "the week topic" }, input.pages),
    null
  );
});

test("rejects generic evidence unrelated to the proposed unit", () => {
  const unit = createMockCurriculumExtraction(input).units[0];
  assert.equal(reconcileCurriculumUnitEvidence({
    ...unit,
    title: "Drug Abuse",
    subtopics: ["Harmful substances"],
    learningObjectives: ["Explain health consequences"],
    supportingExcerpt: "Learning objectives include classroom discussion",
  }, [{
    ...input.pages[0],
    text: "Learning objectives include classroom discussion. Fractions are parts of a whole.",
  }]), null);
  assert.equal(reconcileCurriculumUnitEvidence({
    ...unit,
    title: "Drug Abuse",
    subtopics: ["Harmful substances"],
    learningObjectives: ["Explain health consequences"],
    supportingExcerpt: "Students explain fractions using equal parts",
  }, [{
    ...input.pages[0],
    text: "Students explain fractions using equal parts.",
  }]), null);
});

test("maps unmatched generated citations to an actionable validation error", () => {
  assert.equal(
    toCurriculumGenerationFailure(new Error("Generated curriculum evidence could not be matched to the supplied source entries")).errorCode,
    "evidence_citation_invalid"
  );
});
