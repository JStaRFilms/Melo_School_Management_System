"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import {
  buildKnowledgeMaterialSearchText,
  chunkKnowledgeMaterialPages,
  estimateKnowledgeMaterialTokens,
  isLikelyReadableKnowledgeMaterialText,
  normalizeKnowledgeMaterialText,
  suggestKnowledgeMaterialLabels,
} from "./lessonKnowledgeIngestionHelpers";

const OPENROUTER_OCR_MODEL = "baidu/qianfan-ocr-fast:free";
const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_OCR_TIMEOUT_MS = 30_000;

type OcrImage = {
  storageId: string;
  pageNumber: number;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function parseOpenRouterTextResponse(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return normalizeKnowledgeMaterialText(content);
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          const partText = (part as { text?: unknown }).text;
          return typeof partText === "string" ? partText : "";
        })
        .join(" ");
      return normalizeKnowledgeMaterialText(text);
    }
  }
  return "";
}

async function extractOcrTextFromImages(args: {
  images: Array<{ pageNumber: number; contentType: string; bytes: ArrayBuffer }>;
  apiKey: string;
}) {
  const pages: Array<{ pageNumber: number; text: string }> = [];
  for (const image of args.images) {
    const base64 = Buffer.from(image.bytes).toString("base64");
    const response = await withTimeout(
      fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`,
          "HTTP-Referer": "https://school-management-system.local",
          "X-Title": "School Management System",
        },
        body: JSON.stringify({
          model: OPENROUTER_OCR_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all visible text from this school document page image. Return only the extracted text. Preserve headings and line breaks. Do not summarize.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${image.contentType};base64,${base64}` },
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 4096,
        }),
      }),
      OPENROUTER_OCR_TIMEOUT_MS,
      "OpenRouter image OCR timed out"
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`OpenRouter image OCR failed with HTTP ${response.status}${errorText ? `: ${errorText.slice(0, 400)}` : ""}`);
    }
    const payload = (await response.json()) as unknown;
    const text = parseOpenRouterTextResponse(payload);
    if (text) pages.push({ pageNumber: image.pageNumber, text });
  }
  return pages;
}

export const runKnowledgeMaterialBrowserPreparedOcrRetry = action({
  args: {
    materialId: v.id("knowledgeMaterials"),
    images: v.array(
      v.object({
        storageId: v.id("_storage"),
        pageNumber: v.number(),
        contentType: v.union(v.literal("image/jpeg"), v.literal("image/png"), v.literal("image/webp")),
      })
    ),
  },
  returns: v.object({
    materialId: v.id("knowledgeMaterials"),
    processingStatus: v.union(v.literal("ready"), v.literal("ocr_needed"), v.literal("failed")),
    chunkCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new ConvexError("OpenRouter OCR is not configured");

    const snapshot = await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion.startKnowledgeMaterialBrowserOcrRetryInternal,
      {
        materialId: args.materialId,
        actorSubject: identity.subject,
        images: args.images,
      }
    );

    try {
      const images = [] as Array<{ pageNumber: number; contentType: string; bytes: ArrayBuffer }>;
      for (const image of snapshot.images.sort((a: OcrImage, b: OcrImage) => a.pageNumber - b.pageNumber)) {
        const url = await ctx.storage.getUrl(image.storageId);
        if (!url) throw new Error("OCR page image could not be retrieved");
        const response = await fetch(url);
        if (!response.ok) throw new Error("OCR page image could not be fetched");
        images.push({ pageNumber: image.pageNumber, contentType: image.contentType, bytes: await response.arrayBuffer() });
      }

      const pages = await extractOcrTextFromImages({ images, apiKey });
      const extractedText = normalizeKnowledgeMaterialText(pages.map((page) => page.text).join("\n\n"));
      const readable = isLikelyReadableKnowledgeMaterialText(extractedText) && extractedText.length >= 80;
      const labels = suggestKnowledgeMaterialLabels({
        title: snapshot.title,
        topicLabel: snapshot.topicLabel,
        description: snapshot.description ?? undefined,
        extractedText: readable ? extractedText : undefined,
      });
      const searchText = buildKnowledgeMaterialSearchText([
        snapshot.title,
        snapshot.topicLabel,
        snapshot.description ?? undefined,
        ...labels,
        readable ? extractedText.slice(0, 1200) : undefined,
      ]);
      const chunks = readable
        ? chunkKnowledgeMaterialPages(pages, { chunkSize: 1200, maxChunks: 24 }).map((chunk) => ({
            ...chunk,
            tokenEstimate: estimateKnowledgeMaterialTokens(chunk.chunkText),
          }))
        : [];
      const status: "ready" | "ocr_needed" = readable ? "ready" : "ocr_needed";
      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
        materialId: args.materialId,
        actorUserId: snapshot.actorUserId,
        actorRole: snapshot.actorRole,
        schoolId: snapshot.schoolId,
        status,
        searchText,
        labelSuggestions: labels,
        chunks,
        ingestionErrorMessage: readable ? null : "Browser-prepared OCR did not return enough readable text.",
      });
      return { materialId: args.materialId, processingStatus: status, chunkCount: chunks.length } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Browser-prepared OCR failed";
      await ctx.runMutation(internal.functions.academic.lessonKnowledgeIngestion.applyKnowledgeMaterialIngestionResultInternal, {
        materialId: args.materialId,
        actorUserId: snapshot.actorUserId,
        actorRole: snapshot.actorRole,
        schoolId: snapshot.schoolId,
        status: "failed",
        searchText: buildKnowledgeMaterialSearchText([snapshot.title, snapshot.topicLabel, snapshot.description ?? undefined]),
        labelSuggestions: suggestKnowledgeMaterialLabels({
          title: snapshot.title,
          topicLabel: snapshot.topicLabel,
          description: snapshot.description ?? undefined,
        }),
        chunks: [],
        ingestionErrorMessage: message,
      });
      return { materialId: args.materialId, processingStatus: "failed", chunkCount: 0 } as const;
    }
  },
});
