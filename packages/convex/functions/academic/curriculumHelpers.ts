import { ConvexError } from "convex/values";
import {
  canonicalizeCurriculumEvidence,
  hasCurriculumEvidenceSemanticOverlap,
  isMeaningfulCurriculumEvidenceExcerpt,
} from "@school/ai";

export const MAX_CURRICULUM_UNITS_PER_IMPORT = 60;
export const MAX_CURRICULUM_SOURCE_PAGES = 20;
export const MAX_CURRICULUM_EXCERPT_LENGTH = 1_200;
export const MAX_CURRICULUM_SOURCE_CHARS_PER_PAGE = 4_000;
export const MAX_CURRICULUM_SOURCE_CHARS_TOTAL = 24_000;
export const CURRICULUM_SCHEMA_VERSION = "curriculum-unit-v1";

const CURRICULUM_TERM_ALIASES = [
  { label: "First Term", aliases: ["first term", "1st term", "term 1"] },
  { label: "Second Term", aliases: ["second term", "2nd term", "term 2"] },
  { label: "Third Term", aliases: ["third term", "3rd term", "term 3"] },
] as const;

export type CurriculumProposalInput = {
  weekNumber?: number;
  title: string;
  subtopics: string[];
  learningObjectives: string[];
  suggestedDuration?: string;
  sourcePages: number[];
  sourceChunkHash: string;
  supportingExcerpt: string;
  confidence: number;
};

type CurriculumEvidenceChunk = {
  _id?: string;
  chunkHash?: string;
  chunkText: string;
  pageNumbers?: number[];
  pageStart?: number;
  pageEnd?: number;
};

export function getCurriculumChunkReference(chunk: CurriculumEvidenceChunk) {
  const storedHash = chunk.chunkHash?.trim();
  if (storedHash) return storedHash;
  const stableChunkId = chunk._id ? String(chunk._id).trim() : "";
  return stableChunkId || null;
}

export function normalizeCurriculumText(value: string, label: string, maxLength = 240) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new ConvexError(`${label} is required`);
  if (normalized.length > maxLength) throw new ConvexError(`${label} is too long`);
  return normalized;
}

function normalizeTextList(values: string[], label: string, maximum: number) {
  const unique = [...new Set(values.map((value) => normalizeCurriculumText(value, label, 240)))];
  if (unique.length === 0) throw new ConvexError(`At least one ${label.toLowerCase()} is required`);
  if (unique.length > maximum) throw new ConvexError(`Too many ${label.toLowerCase()} entries`);
  return unique;
}

export function normalizeCurriculumProposal(input: CurriculumProposalInput): CurriculumProposalInput {
  const pages = [...new Set(input.sourcePages)].sort((a, b) => a - b);
  if (pages.length === 0 || pages.length > MAX_CURRICULUM_SOURCE_PAGES || pages.some((page) => !Number.isInteger(page) || page < 1)) {
    throw new ConvexError("Source pages must be a bounded list of positive whole numbers");
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new ConvexError("Confidence must be between 0 and 1");
  }
  if (input.weekNumber !== undefined && (!Number.isInteger(input.weekNumber) || input.weekNumber < 1 || input.weekNumber > 60)) {
    throw new ConvexError("Week number must be between 1 and 60");
  }
  return {
    ...(input.weekNumber === undefined ? {} : { weekNumber: input.weekNumber }),
    title: normalizeCurriculumText(input.title, "Unit title"),
    subtopics: normalizeTextList(input.subtopics, "Subtopic", 12),
    learningObjectives: normalizeTextList(input.learningObjectives, "Learning objective", 12),
    ...(input.suggestedDuration ? { suggestedDuration: normalizeCurriculumText(input.suggestedDuration, "Suggested duration", 120) } : {}),
    sourcePages: pages,
    sourceChunkHash: normalizeCurriculumText(input.sourceChunkHash, "Source chunk reference", 200),
    supportingExcerpt: normalizeCurriculumText(input.supportingExcerpt, "Supporting excerpt", MAX_CURRICULUM_EXCERPT_LENGTH),
    confidence: input.confidence,
  };
}

export function hasMatchingCurriculumEvidence(args: {
  title: string;
  subtopics: string[];
  learningObjectives: string[];
  sourcePages: number[];
  sourceChunkHash: string;
  supportingExcerpt: string;
  chunks: CurriculumEvidenceChunk[];
}) {
  if (
    !isMeaningfulCurriculumEvidenceExcerpt(args.supportingExcerpt) ||
    !hasCurriculumEvidenceSemanticOverlap(args.supportingExcerpt, args)
  ) return false;
  return args.chunks.some((chunk) => {
    if (getCurriculumChunkReference(chunk) !== args.sourceChunkHash) return false;
    const evidencePages = chunk.pageNumbers ?? range(chunk.pageStart, chunk.pageEnd);
    return args.sourcePages.every((page) => evidencePages.includes(page)) &&
      normalizeEvidenceText(chunk.chunkText).includes(normalizeEvidenceText(args.supportingExcerpt));
  });
}

export function normalizeEvidenceText(value: string) {
  return canonicalizeCurriculumEvidence(value);
}

export function detectCurriculumTermMismatch(requestedTerm: string, sourceText: string) {
  const requested = normalizeEvidenceText(requestedTerm);
  const sourceHeading = sourceText
    .split(/\r?\n/)
    .map((line) => normalizeEvidenceText(line))
    .find(Boolean) ?? "";
  const requestedGroup = CURRICULUM_TERM_ALIASES.find((group) =>
    group.aliases.some((alias) => requested.includes(alias))
  );
  if (!requestedGroup) return null;

  if (requestedGroup.aliases.some((alias) => sourceHeading.includes(alias))) return null;
  const isLikelyHeading = sourceHeading.length <= 160 && !/[.!?]/.test(sourceHeading);
  if (!isLikelyHeading) return null;
  const detected = CURRICULUM_TERM_ALIASES.filter((group) =>
    group.label !== requestedGroup.label && group.aliases.some((alias) => sourceHeading.includes(alias))
  );
  return detected.length === 1
    ? { requestedTerm: requestedGroup.label, detectedTerm: detected[0].label }
    : null;
}

function range(start?: number, end?: number) {
  if (!start || !end || end < start || end - start > MAX_CURRICULUM_SOURCE_PAGES) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function isReadyCurriculumSource(material: {
  sourceType: string; processingStatus: string; searchStatus: string; reviewStatus: string;
}) {
  return material.sourceType === "imported_curriculum" && material.processingStatus === "ready" &&
    material.searchStatus === "indexed" && material.reviewStatus === "approved";
}

export function buildBoundedCurriculumSourcePages(chunks: CurriculumEvidenceChunk[]) {
  const pages: Array<{ pageNumbers: number[]; text: string; chunkHash: string }> = [];
  const seen = new Set<string>();
  let totalCharacters = 0;
  for (const chunk of chunks) {
    const text = chunk.chunkText.trim().slice(0, MAX_CURRICULUM_SOURCE_CHARS_PER_PAGE);
    const numbers = chunk.pageNumbers ?? range(chunk.pageStart, chunk.pageEnd);
    const pageNumbers = [...new Set(numbers)].filter((page) => Number.isInteger(page) && page > 0).sort((a, b) => a - b).slice(0, MAX_CURRICULUM_SOURCE_PAGES);
    const chunkReference = getCurriculumChunkReference(chunk);
    if (!chunkReference || !text || !pageNumbers.length) continue;
    const key = `${chunkReference}:${normalizeEvidenceText(text)}`;
    const duplicateIndex = pages.findIndex((page) => `${page.chunkHash}:${normalizeEvidenceText(page.text)}` === key);
    if (duplicateIndex >= 0) {
      pages[duplicateIndex].pageNumbers = [...new Set([...pages[duplicateIndex].pageNumbers, ...pageNumbers])].sort((a, b) => a - b).slice(0, MAX_CURRICULUM_SOURCE_PAGES);
      continue;
    }
    if (seen.has(key) || pages.length >= MAX_CURRICULUM_SOURCE_PAGES || totalCharacters + text.length > MAX_CURRICULUM_SOURCE_CHARS_TOTAL) continue;
    pages.push({ pageNumbers, text, chunkHash: chunkReference });
    seen.add(key); totalCharacters += text.length;
  }
  return pages;
}

export function assertCurriculumAdminScope(args: { actorSchoolId: string; targetSchoolId: string; isAdmin: boolean }) {
  if (args.actorSchoolId !== args.targetSchoolId) throw new ConvexError("Cross-school access denied");
  if (!args.isAdmin) throw new ConvexError("Admin access required");
}

export function resolveCurriculumApproval(args: { currentTopicId?: string; matchingTopicId?: string }) {
  if (args.currentTopicId) return { kind: "already_approved" as const, topicId: args.currentTopicId };
  if (args.matchingTopicId) return { kind: "link_existing" as const, topicId: args.matchingTopicId };
  return { kind: "create_topic" as const };
}

export function calculateCurriculumImportStatus(counts: { proposed: number; approved: number; rejected: number }) {
  if (counts.proposed > 0) return counts.approved > 0 || counts.rejected > 0 ? "partially_approved" : "ready_for_review";
  return counts.approved > 0 ? "approved" : "ready_for_review";
}
