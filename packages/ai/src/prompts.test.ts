import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLessonPlanPrompt, buildTemplateRepairPrompt } from "./prompts.ts";

const sections = [{ id: "lesson-development", label: "Lesson Development", order: 0, required: true, minimumWordCount: 200, guidance: "Teach progressively; include questioning.", formatHint: "steps" as const }];

test("section guidance and format inform generation and repair prompts", () => {
  const initial = buildLessonPlanPrompt({ templateSections: sections, minimumObjectives: 3, minimumSections: 1 });
  const repair = buildTemplateRepairPrompt({ originalPrompt: "original", previousDraft: {}, validationErrors: ["short"], templateSections: sections, minimumObjectives: 3, minimumSections: 1 });
  assert.match(String(initial.prompt), /Writing guidance: Teach progressively/);
  assert.match(String(initial.prompt), /format: steps/);
  assert.match(String(initial.prompt), /at least 3 distinct list items/);
  assert.match(String(repair.prompt), /guidance: Teach progressively/);
  assert.match(String(repair.prompt), /At least 1 distinct template sections/);
});
