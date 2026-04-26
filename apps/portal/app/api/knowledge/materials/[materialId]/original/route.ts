import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@school/convex/_generated/api";
import { getToken } from "@/auth-server";

function getConvexUrl() {
  return process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ materialId: string }> }
) {
  const token = await getToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const convexUrl = getConvexUrl();
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL is not configured." }, { status: 500 });
  }

  const { materialId } = await context.params;
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  try {
    const access = await client.query(
      api.functions.academic.lessonKnowledgePortal.getPortalKnowledgeMaterialOriginalFileAccess,
      { materialId: materialId as never }
    );

    const upstream = await fetch(access.downloadUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Original file could not be opened." }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("cache-control", "private, no-store");
    if (access.contentType) {
      headers.set("content-type", access.contentType);
    }
    if (access.size !== null) {
      headers.set("content-length", String(access.size));
    }

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Original file could not be opened.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
