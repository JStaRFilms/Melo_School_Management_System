import { ConvexError } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { httpAction } from "../../_generated/server";
import {
  assertKnowledgeMaterialBytesMatchContentType,
  normalizeKnowledgeMaterialContentType,
} from "./lessonKnowledgeIngestionHelpers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Knowledge-Upload-Intent, X-Knowledge-Upload-Token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export const knowledgeMaterialUploadOptions = httpAction(async () =>
  new Response(null, { status: 204, headers: corsHeaders }),
);

export const uploadKnowledgeMaterial = httpAction(async (ctx, request) => {
  const intentHeader = request.headers.get("X-Knowledge-Upload-Intent")?.trim();
  const uploadToken = request.headers.get("X-Knowledge-Upload-Token")?.trim();
  if (!intentHeader || !uploadToken) {
    return jsonResponse(400, { error: "Secure upload credentials are required" });
  }

  const uploadIntentId = intentHeader as Id<"knowledgeMaterialUploadIntents">;
  const uploadAttemptId = crypto.randomUUID();
  let uploadBegan = false;
  let storageId: Id<"_storage"> | undefined;
  let storageRecorded = false;
  try {
    const intent: { contentType: string; expectedSize: number } =
      await ctx.runMutation(
        internal.functions.academic.lessonKnowledgeIngestion
          .beginKnowledgeMaterialHttpUpload,
        { uploadIntentId, uploadToken, uploadAttemptId },
      );
    uploadBegan = true;
    const requestContentType = normalizeKnowledgeMaterialContentType(
      request.headers.get("Content-Type"),
    );
    if (requestContentType !== intent.contentType) {
      throw new ConvexError("Uploaded file type does not match the reserved upload");
    }
    const contentLength = request.headers.get("Content-Length");
    if (contentLength && Number(contentLength) !== intent.expectedSize) {
      throw new ConvexError("Uploaded file size does not match the reserved upload");
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength !== intent.expectedSize) {
      throw new ConvexError("Uploaded file size does not match the reserved upload");
    }
    assertKnowledgeMaterialBytesMatchContentType(bytes, intent.contentType);

    storageId = await ctx.storage.store(
      new Blob([bytes], { type: intent.contentType }),
    );
    await ctx.runMutation(
      internal.functions.academic.lessonKnowledgeIngestion
        .recordKnowledgeMaterialUploadStorage,
      { uploadIntentId, uploadToken, uploadAttemptId, storageId },
    );
    storageRecorded = true;
    return jsonResponse(200, { uploaded: true });
  } catch (error) {
    if (uploadBegan) {
      if (storageId && !storageRecorded) {
        try {
          await ctx.runMutation(
            internal.functions.academic.lessonKnowledgeIngestion
              .recordKnowledgeMaterialUploadStorage,
            { uploadIntentId, uploadToken, uploadAttemptId, storageId },
          );
          storageRecorded = true;
        } catch {
          try {
            await ctx.storage.delete(storageId);
          } catch {
            // The storage provider will need operational orphan reconciliation.
          }
        }
      }
      try {
        await ctx.runMutation(
          internal.functions.academic.lessonKnowledgeIngestion
            .failKnowledgeMaterialHttpUpload,
          {
            uploadIntentId,
            uploadToken,
            uploadAttemptId,
            failureReason:
              error instanceof Error ? error.message : "Secure upload failed",
          },
        );
      } catch {
        // The scheduled expiry handler is the final cleanup backstop.
      }
    }
    return jsonResponse(400, { error: "The secure material upload was rejected" });
  }
});
