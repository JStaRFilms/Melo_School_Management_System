import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
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

export type KnowledgeMaterialUploadIntent =
  | "private_draft"
  | "request_review"
  | "staff_shared";

export const MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_KNOWLEDGE_MATERIAL_PDF_PAGES = 80;
export const MAX_KNOWLEDGE_MATERIAL_INGESTION_ATTEMPTS = 3;

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

function normalizeKnowledgeMaterialContentType(contentType?: string | null) {
  const normalized = contentType?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized.split(";")[0].trim();
}

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

export function isSupportedKnowledgeMaterialContentType(contentType?: string | null) {
  const normalized = normalizeKnowledgeMaterialContentType(contentType);
  if (!normalized) {
    return false;
  }

  return (
    normalized === "application/pdf" ||
    normalized === "application/x-pdf" ||
    normalized.endsWith("+pdf") ||
    normalized.startsWith("text/")
  );
}

export function assertKnowledgeMaterialUploadIsSupported(args: {
  contentType?: string | null;
  size: number;
}) {
  if (!Number.isFinite(args.size) || args.size <= 0) {
    throw new ConvexError("Uploaded file is empty");
  }

  if (args.size > MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES) {
    throw new ConvexError(
      "Uploaded file is too large for the planning library. Keep uploads at or below 12 MB."
    );
  }

  if (!normalizeKnowledgeMaterialContentType(args.contentType)) {
    throw new ConvexError("Uploaded file type is missing");
  }

  if (!isSupportedKnowledgeMaterialContentType(args.contentType)) {
    throw new ConvexError(
      "Only PDF and text-based uploads are supported in the planning library right now."
    );
  }
}

export function resolveKnowledgeMaterialDefaults(args: {
  actor: KnowledgeActorContext;
  sourceType: KnowledgeMaterialIngestionSourceType;
  uploadIntent?: KnowledgeMaterialUploadIntent;
  defaultsMode?: "actor_default" | "private_first";
}): KnowledgeMaterialDefaults {
  const processingStatus =
    args.sourceType === "file_upload" ? "awaiting_upload" : "queued";

  if (args.uploadIntent === "staff_shared") {
    if (!args.actor.isSchoolAdmin && args.actor.role !== "admin") {
      throw new ConvexError("Only admins can start a material as staff shared");
    }

    return {
      visibility: "staff_shared",
      reviewStatus: "approved",
      processingStatus,
    };
  }

  if (args.uploadIntent === "request_review") {
    return {
      visibility: "private_owner",
      reviewStatus: "pending_review",
      processingStatus,
    };
  }

  if (args.uploadIntent === "private_draft") {
    return {
      visibility: "private_owner",
      reviewStatus: "draft",
      processingStatus,
    };
  }

  if (args.defaultsMode === "private_first") {
    if (args.actor.role !== "teacher" && args.actor.role !== "admin" && !args.actor.isSchoolAdmin) {
      throw new ConvexError("Knowledge material ingestion is restricted to staff");
    }

    return {
      visibility: "private_owner",
      reviewStatus: "draft",
      processingStatus,
    };
  }

  if (args.actor.isSchoolAdmin || args.actor.role === "admin") {
    return {
      visibility: "staff_shared",
      reviewStatus: "approved",
      processingStatus,
    };
  }

  if (args.actor.role === "teacher") {
    return {
      visibility: "private_owner",
      reviewStatus: "draft",
      processingStatus,
    };
  }

  throw new ConvexError("Knowledge material ingestion is restricted to staff");
}

export function normalizeKnowledgeMaterialText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeKnowledgeLevelKey(value: string) {
  return value.trim().toLowerCase();
}

export async function assertActiveKnowledgeSubjectTopicScope(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  args: {
    schoolId: Id<"schools">;
    subjectId: Id<"subjects">;
    level: string;
    topicId?: Id<"knowledgeTopics"> | null;
  }
): Promise<{
  subject: Doc<"subjects">;
  topic: Doc<"knowledgeTopics"> | null;
}> {
  const subject = await ctx.db.get(args.subjectId);
  if (!subject || String(subject.schoolId) !== String(args.schoolId) || subject.isArchived) {
    throw new ConvexError("Subject not found");
  }

  if (!args.topicId) {
    return { subject, topic: null };
  }

  const topic = await ctx.db.get(args.topicId);
  if (!topic || String(topic.schoolId) !== String(args.schoolId) || topic.status !== "active") {
    throw new ConvexError("Knowledge topic not found");
  }

  if (String(topic.subjectId) !== String(args.subjectId)) {
    throw new ConvexError("Topic must belong to the selected subject");
  }

  if (normalizeKnowledgeLevelKey(topic.level) !== normalizeKnowledgeLevelKey(args.level)) {
    throw new ConvexError("Topic must match the selected level");
  }

  return { subject, topic };
}

export function isLikelyReadableKnowledgeMaterialText(value: string): boolean {
  const normalized = normalizeKnowledgeMaterialText(value);
  if (!normalized) {
    return false;
  }

  const tokens = normalized
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z]/g, ""))
    .filter((token) => token.length >= 2);

  if (tokens.length === 0) {
    return false;
  }

  const letters = (normalized.match(/[A-Za-z]/g) ?? []).length;
  const stopWordCount = tokens.filter((token) => STOP_WORDS.has(token)).length;
  const vowelTokenCount = tokens.filter((token) => /[aeiou]/.test(token)).length;
  const consonantOnlyTokens = tokens.filter((token) => !/[aeiou]/.test(token)).length;
  const suspiciousCharCount = normalized.replace(/[\p{L}\p{N}\s.,;:'"?!()\-–—/%&]/gu, "").length;
  const suspiciousCharRatio = suspiciousCharCount / normalized.length;
  const hasNoiseRuns = /(.)\1{5,}/.test(normalized);

  return (
    letters >= 20 &&
    suspiciousCharRatio <= 0.35 &&
    !hasNoiseRuns &&
    consonantOnlyTokens <= Math.max(2, Math.floor(tokens.length * 0.6)) &&
    (stopWordCount >= 1 || vowelTokenCount >= Math.max(3, Math.ceil(tokens.length / 2)))
  );
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
