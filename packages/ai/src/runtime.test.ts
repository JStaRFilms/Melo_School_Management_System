import assert from "node:assert/strict";
import test from "node:test";

import { createMockCurriculumExtraction } from "./curriculum.ts";
import { resolveCurriculumAiRuntime } from "./runtime.ts";

test("returns mock metadata and a deterministic validated fixture", () => {
  const runtime = resolveCurriculumAiRuntime({ mode: "mock", environment: "test" });
  const extraction = createMockCurriculumExtraction({
    subject: "Mathematics",
    level: "JSS 1",
    term: "Term 1",
    pages: [{ pageNumbers: [3], text: "Fractions are parts of a whole.", chunkHash: "chunk-3" }],
  });

  assert.deepEqual(runtime, { mode: "mock", provider: "mock", modelId: "mock/curriculum-fixture-v1", model: null });
  assert.deepEqual(extraction.units[0].sourcePages, [3]);
  assert.equal(extraction.units[0].sourceChunkHash, "chunk-3");
});

test("routes a configured GPT model through OpenRouter without making a provider request", () => {
  const runtime = resolveCurriculumAiRuntime({
    mode: "openrouter",
    modelId: "openai/gpt-5-mini",
    apiKey: "test",
  });

  assert.equal(runtime.provider, "openrouter");
  assert.equal(runtime.modelId, "openai/gpt-5-mini");
  assert.ok(runtime.model);
});

test("blocks the mock runtime in production", () => {
  assert.throws(
    () => resolveCurriculumAiRuntime({ mode: "mock", environment: "production" }),
    /cannot be used in production/i
  );
});
