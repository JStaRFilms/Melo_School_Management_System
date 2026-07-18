import { generateText } from "ai";

import {
  createMockCurriculumExtraction,
  curriculumExtractionContract,
  curriculumExtractionInputSchema,
  type CurriculumExtraction,
  type CurriculumExtractionInput,
} from "./curriculum";
import { resolveCurriculumAiRuntime, type ResolveCurriculumAiRuntimeOptions } from "./runtime";

export const CURRICULUM_EXTRACTION_PROMPT_CLASS = "curriculum-extraction:v1";

export function buildCurriculumExtractionPrompt(rawInput: CurriculumExtractionInput) {
  const input = curriculumExtractionInputSchema.parse(rawInput);
  return {
    system: "You extract proposed weekly curriculum units from approved school source entries. Return only grounded units. Every unit must cite a supplied chunk hash, only page numbers listed in that entry's pageNumbers, and a short verbatim supporting excerpt from that chunk. Do not create topics or claim anything was taught.",
    prompt: JSON.stringify({
      task: "Propose editable weekly curriculum units for administrator review.",
      subject: input.subject,
      level: input.level,
      term: input.term,
      sourcePages: input.pages,
    }),
  };
}

export interface GenerateCurriculumExtractionOptions {
  readonly input: CurriculumExtractionInput;
  readonly runtime?: ResolveCurriculumAiRuntimeOptions;
}

export function toCurriculumGenerationFailure(error: unknown) {
  return {
    errorCode: error instanceof Error && error.name ? error.name.slice(0, 80) : "generation_failed",
    errorMessage: "Curriculum proposal generation failed.",
  };
}

export async function generateCurriculumExtraction(
  options: GenerateCurriculumExtractionOptions
): Promise<{ extraction: CurriculumExtraction; inputTokens?: number; outputTokens?: number }> {
  const input = curriculumExtractionInputSchema.parse(options.input);
  const runtime = resolveCurriculumAiRuntime(options.runtime);

  if (runtime.mode === "mock") {
    return { extraction: createMockCurriculumExtraction(input) };
  }

  const prompt = buildCurriculumExtractionPrompt(input);
  const result = await generateText({
    model: runtime.model!,
    output: curriculumExtractionContract.output,
    system: prompt.system,
    prompt: prompt.prompt,
  });

  return {
    extraction: result.output,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  };
}
