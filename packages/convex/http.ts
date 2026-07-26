import { httpRouter, type FunctionReference } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { authComponent, createAuth } from "./betterAuth";
import { handlePaymentWebhook } from "./functions/billingWebhooks";

const http = httpRouter();
// Kept typed here while generated API reconciliation is unavailable in an
// unconfigured worktree. `convex codegen` will replace this structural bridge
// on the configured deployment; no generated file is hand-edited.
const siteProjectionApi = api as unknown as { functions: { foundation: { siteProjections: {
  getPublishedProjection: FunctionReference<"query", "public", { hostname: string }, unknown>;
  getPreviewProjection: FunctionReference<"query", "public", { hostname: string; tokenHash: string }, unknown>;
} } } };

authComponent.registerRoutes(http, createAuth);
http.route({
  path: "/webhooks/payment",
  method: "POST",
  handler: handlePaymentWebhook,
});

function noStoreJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

// This response is deliberately the same approved projection consumed by
// apps/sites. It returns no draft, storage ID, rights evidence, or other tenant.
http.route({
  path: "/site-public-projection",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const hostname = new URL(request.url).searchParams.get("hostname") ?? "";
    const projection = await ctx.runQuery(siteProjectionApi.functions.foundation.siteProjections.getPublishedProjection, { hostname });
    return projection ? noStoreJson(projection) : noStoreJson({ error: "unavailable" }, 404);
  }),
});

// A preview token is a bearer capability, but only its SHA-256 digest reaches
// the query layer. The persisted capability also binds it to host and revision.
http.route({
  path: "/site-preview-projection",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: { hostname?: unknown; previewToken?: unknown };
    try { body = await request.json(); } catch { return noStoreJson({ error: "unavailable" }, 404); }
    if (typeof body.hostname !== "string" || typeof body.previewToken !== "string" || body.previewToken.length < 32 || body.previewToken.length > 512) return noStoreJson({ error: "unavailable" }, 404);
    const projection = await ctx.runQuery(siteProjectionApi.functions.foundation.siteProjections.getPreviewProjection, { hostname: body.hostname, tokenHash: await tokenHash(body.previewToken) });
    return projection ? noStoreJson(projection) : noStoreJson({ error: "unavailable" }, 404);
  }),
});

export default http;
