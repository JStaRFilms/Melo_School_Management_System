import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { httpAction } from "../../_generated/server";
import { MAX_ADMISSIONS_DOCUMENT_BYTES, sha256Hex } from "./shared";
import { beginHttpUploadRef, failHttpUploadRef, recordHttpUploadStorageRef } from "./refs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Content-Length, X-Admissions-Upload-Intent, X-Admissions-Upload-Token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizedContentType(value: string | null) {
  return value?.split(";", 1)[0].trim().toLowerCase() ?? "";
}

function matchesMagic(bytes: Uint8Array, contentType: string) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (contentType === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (contentType === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (contentType === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (contentType === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  return false;
}

async function readMeasuredBody(request: Request, expectedSize: number) {
  if (!request.body) throw new ConvexError("Upload body is required");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let measured = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    measured += result.value.byteLength;
    if (measured > expectedSize) {
      await reader.cancel("Measured upload exceeded its reservation");
      throw new ConvexError("Uploaded document size exceeds its reservation");
    }
    chunks.push(result.value);
  }
  if (measured !== expectedSize) throw new ConvexError("Uploaded document size does not match its reservation");
  const bytes = new Uint8Array(measured);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export const admissionsDocumentUploadOptions = httpAction(async () => new Response(null, { status: 204, headers: corsHeaders }));

export const uploadAdmissionsDocument = httpAction(async (ctx, request) => {
  const contentLengthValue = request.headers.get("Content-Length");
  if (!contentLengthValue || !/^\d+$/.test(contentLengthValue)) return response(411, { error: "A valid Content-Length header is required" });
  const contentLength = Number(contentLengthValue);
  if (!Number.isSafeInteger(contentLength) || contentLength < 1 || contentLength > MAX_ADMISSIONS_DOCUMENT_BYTES) return response(413, { error: "Upload size is outside the supported bound" });
  const intentValue = request.headers.get("X-Admissions-Upload-Intent")?.trim();
  const uploadToken = request.headers.get("X-Admissions-Upload-Token")?.trim();
  if (!intentValue || !uploadToken) return response(400, { error: "Secure upload credentials are required" });
  const uploadIntentId = intentValue as Id<"admissionsDocumentUploadIntents">;
  const uploadAttemptId = crypto.randomUUID();
  let began = false;
  let storageId: Id<"_storage"> | undefined;
  let recorded = false;
  try {
    const intent = await ctx.runMutation(beginHttpUploadRef, { uploadIntentId, uploadToken, uploadAttemptId });
    began = true;
    if (normalizedContentType(request.headers.get("Content-Type")) !== intent.contentType) throw new ConvexError("Uploaded document type does not match its reservation");
    if (contentLength !== intent.expectedSize) throw new ConvexError("Uploaded document size does not match its reservation");
    const bytes = await readMeasuredBody(request, intent.expectedSize);
    if (!matchesMagic(bytes, intent.contentType)) throw new ConvexError("Uploaded document content does not match its declared type");
    if (await sha256Hex(bytes) !== intent.expectedSha256) throw new ConvexError("Uploaded document fingerprint does not match its reservation");
    storageId = await ctx.storage.store(new Blob([bytes], { type: intent.contentType }));
    await ctx.runMutation(recordHttpUploadStorageRef, { uploadIntentId, uploadToken, uploadAttemptId, storageId });
    recorded = true;
    return response(200, { uploaded: true });
  } catch (error) {
    if (storageId && !recorded) {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // The scheduled cleanup remains the operational backstop.
      }
    }
    if (began) {
      try {
        await ctx.runMutation(failHttpUploadRef, { uploadIntentId, uploadToken, uploadAttemptId, failureReason: error instanceof Error ? error.message : "Secure upload failed" });
      } catch {
        // The scheduled expiry remains the final cleanup backstop.
      }
    }
    return response(400, { error: "The secure admissions document upload was rejected" });
  }
});
