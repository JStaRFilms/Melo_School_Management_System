import type { CurriculumExtractionInput, CurriculumUnit } from "./curriculum";

type CurriculumSourceEntry = CurriculumExtractionInput["pages"][number];

const GENERIC_EVIDENCE_WORDS = new Set([
  "the", "and", "for", "with", "from", "into", "this", "that",
  "week", "term", "class", "subject", "topic", "learning", "objective",
  "objectives", "include", "includes", "explain", "identify", "describe",
  "understand", "discuss", "define", "state", "students",
]);

export function canonicalizeCurriculumEvidence(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function isMeaningfulCurriculumEvidenceExcerpt(value: string) {
  const canonical = canonicalizeCurriculumEvidence(value);
  const tokens = canonical.match(/[a-z0-9]+/g) ?? [];
  const contentTokens = tokens.filter((token) =>
    token.length >= 3 && !GENERIC_EVIDENCE_WORDS.has(token)
  );
  return canonical.length >= 16 && tokens.length >= 3 && contentTokens.length >= 2;
}

function curriculumEvidenceContentTokens(value: string) {
  return (canonicalizeCurriculumEvidence(value).match(/[a-z0-9]+/g) ?? [])
    .filter((token) => token.length >= 3 && !GENERIC_EVIDENCE_WORDS.has(token));
}

export function hasCurriculumEvidenceSemanticOverlap(
  excerpt: string,
  unit: Pick<CurriculumUnit, "title" | "subtopics" | "learningObjectives">
) {
  const excerptTokens = new Set(curriculumEvidenceContentTokens(excerpt));
  const topicTokens = curriculumEvidenceContentTokens([unit.title, ...unit.subtopics].join(" "));
  if (topicTokens.some((token) => excerptTokens.has(token))) return true;
  const objectiveOverlap = new Set(
    curriculumEvidenceContentTokens(unit.learningObjectives.join(" "))
      .filter((token) => excerptTokens.has(token))
  );
  return objectiveOverlap.size >= 2;
}

function trimModelEllipsis(value: string) {
  return value.trim().replace(/\s*(?:\.{3}|\u2026)\s*$/u, "").trim();
}

function pagesContain(entry: CurriculumSourceEntry, claimedPages: number[]) {
  return claimedPages.every((page) => entry.pageNumbers.includes(page));
}

export function reconcileCurriculumUnitEvidence(
  unit: CurriculumUnit,
  entries: CurriculumSourceEntry[]
): CurriculumUnit | null {
  const supportingExcerpt = trimModelEllipsis(unit.supportingExcerpt);
  const canonicalExcerpt = canonicalizeCurriculumEvidence(supportingExcerpt);
  if (
    !canonicalExcerpt ||
    !isMeaningfulCurriculumEvidenceExcerpt(supportingExcerpt) ||
    !hasCurriculumEvidenceSemanticOverlap(supportingExcerpt, unit)
  ) return null;

  let candidates = entries.filter((entry) =>
    canonicalizeCurriculumEvidence(entry.text).includes(canonicalExcerpt)
  );
  if (candidates.length > 1) {
    const matchingReference = candidates.filter((entry) => entry.chunkHash === unit.sourceChunkHash);
    if (matchingReference.length > 0) candidates = matchingReference;
  }
  if (candidates.length > 1) {
    const matchingPages = candidates.filter((entry) => pagesContain(entry, unit.sourcePages));
    if (matchingPages.length > 0) candidates = matchingPages;
  }
  if (candidates.length !== 1) return null;

  const evidence = candidates[0];
  return {
    ...unit,
    sourcePages: pagesContain(evidence, unit.sourcePages) ? unit.sourcePages : evidence.pageNumbers,
    sourceChunkHash: evidence.chunkHash,
    supportingExcerpt,
  };
}

export function reconcileCurriculumExtractionEvidence(
  units: CurriculumUnit[],
  entries: CurriculumSourceEntry[]
) {
  const reconciled = units.map((unit) => reconcileCurriculumUnitEvidence(unit, entries));
  if (reconciled.some((unit) => unit === null)) {
    throw new Error("Generated curriculum evidence could not be matched to the supplied source entries");
  }
  return reconciled as CurriculumUnit[];
}
