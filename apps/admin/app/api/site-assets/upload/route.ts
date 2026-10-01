import { getToken } from "@/auth-server";

export const runtime = "nodejs";
const kinds = new Set(["logo", "favicon", "hero", "gallery", "staff", "facility", "social_share"]);
const types = new Set(["image/png", "image/jpeg"]);
const denied = (status: number) => Response.json({ error: "Upload unavailable" }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const token = await getToken();
  if (!token) return denied(401);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return denied(403);
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !/^https:\/\/[^/?#]+$/.test(site)) return denied(503);
  const schoolId = request.headers.get("x-site-school") ?? "";
  const kind = request.headers.get("x-site-kind") ?? "";
  const fileName = request.headers.get("x-site-filename") ?? "";
  const alt = request.headers.get("x-site-alt") ?? "";
  const type = request.headers.get("content-type") ?? "";
  const length = Number(request.headers.get("content-length"));
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(schoolId) || !kinds.has(kind) || !types.has(type) || !fileName || fileName.length > 180 || alt.length > 300 || !Number.isSafeInteger(length) || length < 12 || length > 5_000_000) return denied(400);
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength !== length) return denied(400);
  try {
    const upstream = await fetch(`${site}/sites/asset-upload`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": type, "Content-Length": String(length), "X-Site-School": schoolId, "X-Site-Kind": kind, "X-Site-Filename": fileName, "X-Site-Alt": alt, "X-Site-Decorative": request.headers.get("x-site-decorative") === "true" ? "true" : "false" },
      body: bytes,
    });
    if (!upstream.ok) return denied(upstream.status >= 500 ? 502 : upstream.status);
    const result: unknown = await upstream.json();
    if (!result || typeof result !== "object" || !("assetId" in result) || typeof result.assetId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(result.assetId)) return denied(502);
    return Response.json({ assetId: result.assetId }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch { return denied(502); }
}
