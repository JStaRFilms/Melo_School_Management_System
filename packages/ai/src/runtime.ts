import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export const curriculumRuntimeModes = ["mock", "openrouter"] as const;
export type CurriculumRuntimeMode = (typeof curriculumRuntimeModes)[number];

const defaultModels: Record<CurriculumRuntimeMode, string> = {
  mock: "mock/curriculum-fixture-v1",
  openrouter: "openai/gpt-5-mini",
};

export interface CurriculumAiRuntime {
  readonly mode: CurriculumRuntimeMode;
  readonly provider: CurriculumRuntimeMode;
  readonly modelId: string;
  readonly model: LanguageModel | null;
}

export interface ResolveCurriculumAiRuntimeOptions {
  readonly mode?: CurriculumRuntimeMode;
  readonly modelId?: string;
  readonly apiKey?: string;
  readonly environment?: string;
}

function readRuntimeMode(value: string | undefined): CurriculumRuntimeMode {
  if (!value) return "openrouter";
  if ((curriculumRuntimeModes as readonly string[]).includes(value)) {
    return value as CurriculumRuntimeMode;
  }
  throw new Error(`Unsupported curriculum AI runtime: ${value}`);
}

function readModelId(mode: CurriculumRuntimeMode, modelId: string | undefined) {
  const resolved = modelId?.trim() || process.env.SCHOOL_AI_CURRICULUM_MODEL?.trim();
  return resolved || defaultModels[mode];
}

function createOpenRouterModel(modelId: string, apiKey?: string): LanguageModel {
  return createOpenRouter({ apiKey: apiKey ?? process.env.OPENROUTER_API_KEY }).chat(modelId);
}

/** Resolves curriculum generation separately from the existing document-generation runtime. */
export function resolveCurriculumAiRuntime(
  options: ResolveCurriculumAiRuntimeOptions = {}
): CurriculumAiRuntime {
  const mode = options.mode ?? readRuntimeMode(process.env.SCHOOL_AI_CURRICULUM_RUNTIME?.trim());
  const environment = options.environment ?? process.env.NODE_ENV;

  if (mode === "mock") {
    if (environment === "production") {
      throw new Error("The mock curriculum AI runtime cannot be used in production.");
    }
    return { mode, provider: mode, modelId: readModelId(mode, options.modelId), model: null };
  }

  const modelId = readModelId(mode, options.modelId);
  return {
    mode,
    provider: mode,
    modelId,
    model: createOpenRouterModel(modelId, options.apiKey),
  };
}
