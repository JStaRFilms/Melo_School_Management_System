import assert from "node:assert/strict";
import test from "node:test";

import { createMockCurriculumExtraction, curriculumExtractionInputSchema } from "./curriculum.ts";

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
