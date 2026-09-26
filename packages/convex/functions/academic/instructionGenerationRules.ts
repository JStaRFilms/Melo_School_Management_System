import type { TemplateBoundInstructionDraft } from "@school/ai";

export interface GenerationSectionRule {
  id: string;
  label: string;
  required: boolean;
  minimumWordCount?: number | null;
}

export function findObjectiveSection<T extends { label: string }>(sections: readonly T[]): T | undefined {
  return sections.find((section) => /^(?:learning |lesson )?objectives?$|^learning outcomes?$/i.test(section.label.trim()));
}

export function countDistinctObjectives(content: string): number {
  const objectives = content.split(/\r?\n/)
    .map((line) => line.trim().match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
  return new Set(objectives.map((item) => item.toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " "))).size;
}

export function validateGenerationMinimums(
  draft: TemplateBoundInstructionDraft,
  templateSections: GenerationSectionRule[],
  minimums: { minimumObjectives: number; minimumSections: number }
): string[] {
  const issues: string[] = [];
  const byId = new Map(draft.sections.map((section) => [section.sectionId, section.content.trim()]));
  const filled = templateSections.filter((section) => Boolean(byId.get(section.id))).length;
  if (filled < minimums.minimumSections) {
    issues.push(`Generated draft has ${filled} filled sections; the template requires ${minimums.minimumSections}.`);
  }
  // Objectives can only be counted reliably when the template explicitly names a section for them.
  const objectiveSection = findObjectiveSection(templateSections);
  if (objectiveSection) {
    const count = countDistinctObjectives(byId.get(objectiveSection.id) ?? "");
    if (count < minimums.minimumObjectives) {
      issues.push(`Generated draft has ${count} distinct listed objectives; the template requires ${minimums.minimumObjectives}.`);
    }
  }
  return issues;
}

export function getPerSourceExcerptCharacterLimit(
  selectedSourceCount: number,
  totalCharacterLimit: number,
  perSourceCharacterLimit: number
): number {
  if (selectedSourceCount <= 0) return perSourceCharacterLimit;
  return Math.max(1, Math.min(perSourceCharacterLimit, Math.floor(totalCharacterLimit / selectedSourceCount)));
}

export function countUsableExcerptSources(excerpts: ReadonlyArray<{ materialId: string; excerptText: string }>): number {
  return new Set(excerpts.filter((excerpt) => excerpt.excerptText.trim()).map((excerpt) => excerpt.materialId)).size;
}

export function assertUsableExcerptMinimum(
  excerpts: ReadonlyArray<{ materialId: string; excerptText: string }>,
  configuredMinimum: number
): void {
  const required = Math.max(1, configuredMinimum);
  const actual = countUsableExcerptSources(excerpts);
  if (actual < required) {
    throw new Error(`This template requires ${required} source${required === 1 ? "" : "s"} with usable excerpts; found ${actual}. Reprocess or choose more source materials.`);
  }
}

export function renderTemplateBoundMarkdown(draft: TemplateBoundInstructionDraft): string {
  const metadata = [`**Subject:** ${draft.subject}`, `**Level:** ${draft.level}`, `**Topic:** ${draft.topic}`];
  return [
    `# ${draft.title}`, "", ...metadata, "",
    ...draft.sections.filter((section) => section.content.trim()).flatMap((section) => [`## ${section.label}`, section.content, ""]),
    "## Source notes", ...draft.sourceNotes.map((note) => `- ${note}`),
  ].filter(Boolean).join("\n").trim();
}
