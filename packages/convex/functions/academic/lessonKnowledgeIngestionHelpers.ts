import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { KnowledgeActorContext } from "./lessonKnowledgeAccess";
import type {
  KnowledgeVisibility,
  KnowledgeReviewStatus,
} from "./lessonKnowledgeAccess";

export type KnowledgeMaterialIngestionStatus =
  | "awaiting_upload"
  | "queued"
  | "extracting"
  | "ocr_needed"
  | "ready"
  | "failed";

export type KnowledgeMaterialIngestionSourceType =
  | "file_upload"
  | "text_entry"
  | "youtube_link"
  | "generated_draft"
  | "student_upload"
  | "imported_curriculum";

export type KnowledgeMaterialDefaults = {
  visibility: KnowledgeVisibility;
  reviewStatus: KnowledgeReviewStatus;
  processingStatus: KnowledgeMaterialIngestionStatus;
};

export type KnowledgeMaterialIngestionOwnerRole =
  | "teacher"
  | "admin"
  | "student"
  | "system";

export type KnowledgeMaterialIngestionSnapshot = {
  materialId: Id<"knowledgeMaterials">;
  schoolId: Id<"schools">;
  ownerUserId: Id<"users">;
  ownerRole: KnowledgeMaterialIngestionOwnerRole;
  sourceType: KnowledgeMaterialIngestionSourceType;
  visibility: KnowledgeVisibility;
  reviewStatus: KnowledgeReviewStatus;
  title: string;
  description?: string;
  subjectId: Id<"subjects">;
  level: string;
  topicLabel: string;
  topicId?: Id<"knowledgeTopics">;
  storageId?: Id<"_storage">;
  storageContentType?: string;
  externalUrl?: string;
  searchText: string;
  processingStatus: KnowledgeMaterialIngestionStatus;
  processingAttemptCount: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "the",
  "this",
  "that",
  "to",
  "with",
  "without",
  "lesson",
  "lessons",
  "note",
  "notes",
  "video",
  "videos",
  "youtube",
  "file",
  "upload",
]);

export function assertKnowledgeMaterialIngestionAccess(actor: KnowledgeActorContext) {
  if (actor.role !== "teacher" && actor.role !== "admin" && !actor.isSchoolAdmin) {
    throw new ConvexError("Knowledge material ingestion is restricted to staff");
  }
}

export function canManageKnowledgeMaterial(
  actor: KnowledgeActorContext,
  material: { schoolId: string; ownerUserId: string }
) {
  if (String(actor.schoolId) !== String(material.schoolId)) {
    return false;
  }

  if (actor.isSchoolAdmin || actor.role === "admin") {
    return true;
  }

  return actor.role === "teacher" && String(actor.userId) === String(material.ownerUserId);
}

export function resolveKnowledgeMaterialDefaults(args: {
  actor: KnowledgeActorContext;
  sourceType: KnowledgeMaterialIngestionSourceType;
}): KnowledgeMaterialDefaults {
  if (args.actor.isSchoolAdmin || args.actor.role === "admin") {
    return {
      visibility: "staff_shared",
      reviewStatus: "approved",
      processingStatus:
        args.sourceType === "file_upload" ? "awaiting_upload" : "queued",
    };
  }

  if (args.actor.role === "teacher") {
    return {
      visibility: "private_owner",
      reviewStatus: "draft",
      processingStatus:
        args.sourceType === "file_upload" ? "awaiting_upload" : "queued",
    };
  }

  throw new ConvexError("Knowledge material ingestion is restricted to staff");
}

export function normalizeKnowledgeMaterialText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildKnowledgeMaterialSearchText(parts: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const segments: string[] = [];

  for (const part of parts) {
    if (part === undefined || part === null) continue;
    const normalized = normalizeKnowledgeMaterialText(part);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    segments.push(normalized);
  }

  const searchText = segments.join(" ");
  return searchText.length > 6000 ? searchText.slice(0, 6000) : searchText;
}

export function chunkKnowledgeMaterialText(
  rawText: string,
  args?: {
    chunkSize?: number;
    maxChunks?: number;
  }
): string[] {
  const chunkSize = args?.chunkSize ?? 1200;
  const maxChunks = args?.maxChunks ?? 24;
  const normalizedText = normalizeKnowledgeMaterialText(rawText);

  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(/\s+/);
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < words.length && chunks.length < maxChunks) {
    let nextCursor = cursor;
    let candidate = "";

    while (nextCursor < words.length) {
      const nextWord = words[nextCursor];
      const tentative = candidate ? `${candidate} ${nextWord}` : nextWord;
      if (tentative.length > chunkSize && candidate) {
        break;
      }
      candidate = tentative;
      nextCursor += 1;
      if (candidate.length >= chunkSize) {
        break;
      }
    }

    const chunk = normalizeKnowledgeMaterialText(candidate);
    if (chunk) {
      chunks.push(chunk);
    }

    cursor = nextCursor > cursor ? nextCursor : cursor + 1;
  }

  return chunks;
}

export function estimateKnowledgeMaterialTokens(text: string): number {
  return Math.max(1, Math.ceil(normalizeKnowledgeMaterialText(text).length / 4));
}

export function suggestKnowledgeMaterialLabels(args: {
  title: string;
  topicLabel: string;
  description?: string | null;
  extractedText?: string | null;
  externalUrl?: string | null;
}): string[] {
  const candidates: string[] = [args.topicLabel, args.title];
  if (args.description) candidates.push(args.description);
  if (args.extractedText) candidates.push(args.extractedText);
  if (args.externalUrl) candidates.push(args.externalUrl);

  const phrases = new Set<string>();
  for (const candidate of candidates) {
    const normalized = normalizeKnowledgeMaterialText(candidate);
    if (normalized) {
      phrases.add(normalized);
    }
  }

  const keywordCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const normalized = normalizeKnowledgeMaterialText(candidate).toLowerCase();
    if (!normalized) continue;

    for (const token of normalized.split(/[^a-z0-9]+/g)) {
      if (!token || token.length < 4 || STOP_WORDS.has(token)) continue;
      keywordCounts.set(token, (keywordCounts.get(token) ?? 0) + 1);
    }
  }

  const keywordLabels = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([token]) => token.replace(/^[a-z]/, (match) => match.toUpperCase()));

  const labels: string[] = [];
  const seen = new Set<string>();

  for (const value of [...phrases, ...keywordLabels]) {
    const normalized = normalizeKnowledgeMaterialText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(normalized);
    if (labels.length >= 8) break;
  }

  return labels;
}

export function normalizeKnowledgeMaterialUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ConvexError("External URL is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ConvexError("External URL is invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConvexError("External URL must use http or https");
  }

  return parsed.toString();
}

export function assertYouTubeUrl(url: string): string {
  const normalized = normalizeKnowledgeMaterialUrl(url);
  const parsed = new URL(normalized);
  const hostname = parsed.hostname.toLowerCase();
  const isYouTubeHost =
    hostname === "youtu.be" ||
    hostname.endsWith(".youtube.com") ||
    hostname === "youtube.com" ||
    hostname === "m.youtube.com";

  if (!isYouTubeHost) {
    throw new ConvexError("Only YouTube links can be registered here");
  }

  return normalized;
}

export function buildMaterialSearchSeed(args: {
  title: string;
  topicLabel: string;
  description?: string | null;
  labels?: string[];
  externalUrl?: string | null;
  extractedTextPreview?: string | null;
}) {
  return buildKnowledgeMaterialSearchText([
    args.title,
    args.topicLabel,
    args.description ?? undefined,
    args.externalUrl ?? undefined,
    ...(args.labels ?? []),
    args.extractedTextPreview ?? undefined,
  ]);
}
