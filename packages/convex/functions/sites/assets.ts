import { v } from "convex/values";
import { internalMutation, httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { deny, schoolActor, sha256, storageDigest } from "./shared";
import { cleanImage } from "./image";
import { gatewayAuthorized, normalizeHostname } from "./domainRules";

const MAX_BYTES = 5_000_000;
const kinds = v.union(v.literal("logo"),v.literal("favicon"),v.literal("hero"),v.literal("gallery"),v.literal("staff"),v.literal("facility"),v.literal("social_share"));
export const registerReceivedBytes = internalMutation({
  args: {schoolId: v.id("schools"), storageId: v.id("_storage"), kind: kinds, fileName: v.string(), mediaType: v.string(), byteSize: v.number(), checksum: v.string(), altText: v.string(), decorative: v.boolean()},
  handler: async (ctx, args) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, args.schoolId, "settings.manage", now);
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).unique();
    if (!profile || profile.mode !== "managed" || args.fileName.length < 1 || args.fileName.length > 120 || /[<>/\\\u0000-\u001f]/.test(args.fileName) || args.altText.length > 200 || (!args.decorative && !args.altText.trim())) return deny();
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata || storageDigest(metadata.sha256) !== args.checksum || !/^[a-f0-9]{64}$/.test(args.checksum) || metadata.size !== args.byteSize || (metadata.contentType !== undefined && metadata.contentType !== args.mediaType) || args.byteSize > MAX_BYTES || args.byteSize < 12) return deny();
    const existing = await ctx.db.query("schoolSiteAssets").withIndex("by_storage", q => q.eq("storageId", args.storageId)).unique();
    if (existing) return deny();
    const assetId = await ctx.db.insert("schoolSiteAssets", {schoolId: args.schoolId, storageId: args.storageId, kind: args.kind, fileName: args.fileName, mediaType: args.mediaType, byteSize: args.byteSize, checksum: args.checksum, altText: args.altText || undefined, decorative: args.decorative, rightsStatus: "pending", childApplicability: "unknown", uploadProvenance: "website_direct_upload_v1", status: "draft", createdAt: now, updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId: args.schoolId, actorUserId: actor, eventType: "asset_uploaded", outcome: "success", summary: `Uploaded ${args.kind} site asset`, createdAt: now});
    return assetId;
  },
});

// This endpoint alone is permitted to register storage. The internal mutation is
// not a browser API and checks the calling identity again after bytes are stored.
export const uploadWebsiteAsset = httpAction(async (ctx, request) => {
  let storageId: Id<"_storage"> | undefined;
  try {
    if (!await ctx.auth.getUserIdentity()) return new Response(null, {status: 403});
    const length = Number(request.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length < 12 || length > MAX_BYTES) return new Response(null, {status: 413});
    const schoolId = request.headers.get("x-site-school") as Id<"schools">;
    const kind = request.headers.get("x-site-kind") as "logo" | "favicon" | "hero" | "gallery" | "staff" | "facility" | "social_share";
    const fileName = request.headers.get("x-site-filename") ?? "";
    const altText = request.headers.get("x-site-alt") ?? "";
    const decorative = request.headers.get("x-site-decorative") === "true";
    const mediaType = request.headers.get("content-type") ?? "";
    if (!schoolId || !["logo","favicon","hero","gallery","staff","facility","social_share"].includes(kind) || !["image/png","image/jpeg"].includes(mediaType)) return new Response(null, {status: 400});
    const chunks: Uint8Array[] = []; let total = 0;
    if (!request.body) return new Response(null, {status: 400});
    const reader = request.body.getReader();
    while (true) {
      const next = await reader.read(); if (next.done) break;
      total += next.value.byteLength;
      if (total > length || total > MAX_BYTES) { await reader.cancel(); return new Response(null, {status: 413}); }
      chunks.push(next.value);
    }
    if (total !== length) return new Response(null, {status: 400});
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    let cleaned: ReturnType<typeof cleanImage>;
    try { cleaned = cleanImage(bytes,mediaType); } catch { return new Response(null, {status: 415}); }
    const checksum = await sha256(cleaned.bytes);
    storageId = await ctx.storage.store(new Blob([new Uint8Array(cleaned.bytes)], {type: cleaned.mediaType}));
    const assetId = await ctx.runMutation(internal.functions.sites.assets.registerReceivedBytes, {schoolId, storageId, kind, fileName, mediaType: cleaned.mediaType, byteSize: cleaned.bytes.length, checksum, altText, decorative});
    return new Response(JSON.stringify({assetId}), {status: 201, headers: {"Content-Type":"application/json", "Cache-Control":"no-store"}});
  } catch {
    if (storageId) { try { await ctx.storage.delete(storageId); } catch { /* Alert on orphan storage in operations. */ } }
    return new Response(null, {status: 403, headers: {"Cache-Control":"no-store"}});
  }
});

// Only the configured first-party Sites server knows the gateway key. The browser
// never calls this endpoint and never receives an upstream storage URL or ID.
export const streamWebsiteAsset = httpAction(async (ctx, request) => {
  const denied = () => new Response(null, {status: 404, headers: {"Cache-Control":"no-store"}});
  if (!gatewayAuthorized(request.headers.get("x-sites-gateway-secret"))) return denied();
  let hostname: string;
  try {hostname = normalizeHostname(request.headers.get("x-sites-hostname") ?? "");} catch {return denied();}
  let input: unknown;
  try {input = await request.json();} catch {return denied();}
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 || typeof (input as {assetId?: unknown}).assetId !== "string") return denied();
  try {
    const access = await ctx.runQuery(internal.functions.sites.public.assetAtTime, {hostname, assetId: (input as {assetId: Id<"schoolSiteAssets">}).assetId, now: Date.now()});
    if (!access) return denied();
    const blob = await ctx.storage.get(access.storageId);
    if (!blob || blob.size > MAX_BYTES || blob.type !== access.mediaType) return denied();
    const finalAccess = await ctx.runQuery(internal.functions.sites.public.assetAtTime, {hostname, assetId: (input as {assetId: Id<"schoolSiteAssets">}).assetId, now: Date.now()});
    if (!finalAccess || finalAccess.storageId !== access.storageId || finalAccess.mediaType !== access.mediaType) return denied();
    return new Response(blob, {status: 200, headers: {"Content-Type":access.mediaType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch {return denied();}
});
