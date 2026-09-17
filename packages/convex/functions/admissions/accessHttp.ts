import { httpAction } from "../../_generated/server";
import { consumeGuardianDocumentAccessGrantRef, consumeStaffDocumentAccessGrantRef } from "./refs";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Cross-Origin-Resource-Policy": "same-site",
  "Referrer-Policy": "no-referrer",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
};

function unavailable(status = 404) {
  return new Response(JSON.stringify({ error: "Document access is unavailable." }), {
    status,
    headers: { ...privateHeaders, "Content-Type": "application/json" },
  });
}

function contentDisposition(action: "view" | "download", fileName: string) {
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/[\\/"]/g, "_")
    .slice(0, 120) || "document";
  const encodedName = encodeURIComponent(fileName.slice(0, 200)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${action === "download" ? "attachment" : "inline"}; filename="${safeName}"; filename*=UTF-8''${encodedName}`;
}

export const streamAdmissionsDocument = httpAction(async (ctx, request) => {
  const token = request.headers.get("X-Admissions-Access-Grant")?.trim() ?? "";
  const audience = request.headers.get("X-Admissions-Access-Audience")?.trim();
  if (!/^[a-f0-9]{64}$/.test(token) || (audience !== "apply" && audience !== "admin")) return unavailable();
  try {
    const access = audience === "apply"
      ? await ctx.runMutation(consumeGuardianDocumentAccessGrantRef, { token })
      : await ctx.runMutation(consumeStaffDocumentAccessGrantRef, { token });
    if (access.status !== "available") return unavailable();
    const upstream = await fetch(access.upstreamUrl, { cache: "no-store", redirect: "error" });
    if (!upstream.ok || !upstream.body) return unavailable(502);
    const headers = new Headers(privateHeaders);
    headers.set("Content-Type", access.contentType);
    headers.set("Content-Length", String(access.byteSize));
    headers.set("Content-Disposition", contentDisposition(access.action, access.fileName));
    headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return unavailable();
  }
});
