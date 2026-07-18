import { Output } from "ai";
import { z } from "zod";

const curriculumPageSchema = z.object({
  pageNumbers: z.array(z.number().int().positive()).min(1).refine((pages) => new Set(pages).size === pages.length),
  text: z.string().trim().min(1),
  chunkHash: z.string().trim().min(1),
});

export const curriculumExtractionInputSchema = z.object({
  subject: z.string().trim().min(1),
  level: z.string().trim().min(1),
  term: z.string().trim().min(1),
  pages: z.array(curriculumPageSchema).min(1),
});

export const curriculumUnitSchema = z.object({
  weekNumber: z.number().int().positive().nullable(),
  title: z.string().trim().min(1),
  subtopics: z.array(z.string().trim().min(1)).min(1),
  learningObjectives: z.array(z.string().trim().min(1)).min(1),
  suggestedDuration: z.string().trim().min(1).nullable(),
  sourcePages: z.array(z.number().int().positive()).min(1),
  sourceChunkHash: z.string().trim().min(1),
  supportingExcerpt: z.string().trim().min(1).max(2_000),
  confidence: z.number().min(0).max(1),
});

export const curriculumExtractionSchema = z.object({
  units: z.array(curriculumUnitSchema).min(1),
});

export type CurriculumExtractionInput = z.infer<typeof curriculumExtractionInputSchema>;
export type CurriculumUnit = z.infer<typeof curriculumUnitSchema>;
export type CurriculumExtraction = z.infer<typeof curriculumExtractionSchema>;

export const curriculumExtractionContract = {
  schema: curriculumExtractionSchema,
  output: Output.object({
    schema: curriculumExtractionSchema,
    name: "curriculum_extraction",
    description: "Weekly curriculum units grounded in page-aware school source material.",
  }),
} as const;

/** A deterministic fixture for UI and integration tests; it never calls a model provider. */
export function createMockCurriculumExtraction(
  rawInput: CurriculumExtractionInput
): CurriculumExtraction {
  const input = curriculumExtractionInputSchema.parse(rawInput);
  const source = input.pages[0];
  const excerpt = source.text.slice(0, 500).trim();

  return curriculumExtractionSchema.parse({
    units: [
      {
        weekNumber: 1,
        title: `${input.subject}: ${input.level} foundation`,
        subtopics: ["Introduction", "Key vocabulary"],
        learningObjectives: [
          `Explain the introductory ${input.subject} ideas for ${input.level}.`,
          "Use key vocabulary from the approved curriculum source.",
        ],
        suggestedDuration: "1 week",
        sourcePages: source.pageNumbers,
        sourceChunkHash: source.chunkHash,
        supportingExcerpt: excerpt,
        confidence: 0.8,
      },
    ],
  });
}
