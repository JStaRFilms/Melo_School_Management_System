import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@school/convex/_generated/api";
import { getToken } from "../../../../../../../../lib/auth-server";

function convexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? null;
}

function contentDisposition(fileName: string, inline: boolean) {
  const safeName = fileName.replace(/[\r\n"\\]/g, "_").slice(0, 256) || "document";
  return `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ schoolSlug: string; publicReference: string; documentKey: string }> },
) {
  const token = await getToken();
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const url = convexUrl();
  if (!url) return NextResponse.json({ error: "Application storage is not configured." }, { status: 500 });

  const { schoolSlug, publicReference, documentKey } = await context.params;
  const client = new ConvexHttpClient(url);
  client.setAuth(token);
  try {
    const access = await client.mutation(api.functions.admissions.public.getOwnDocumentProxyAccessByPublicReference, {
      schoolSlug,
      publicReference,
      documentKey,
    });
    if (access.status !== "available") return NextResponse.json({ error: "Document unavailable." }, { status: 404 });
    const upstream = await fetch(access.url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: "Document unavailable." }, { status: 502 });
    const inline = access.mimeType === "application/pdf" || access.mimeType.startsWith("image/");
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-disposition": contentDisposition(access.fileName, inline),
        "content-length": String(access.byteSize),
        "content-security-policy": "default-src 'none'; sandbox",
        "content-type": access.mimeType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document unavailable." }, { status: 404 });
  }
}
