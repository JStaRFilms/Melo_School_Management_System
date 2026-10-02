import { privateReviewEnabled } from "../../../../../core/private-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (process.env.NODE_ENV !== "development" || !privateReviewEnabled()) {
    return new Response(null, { status: 404, headers });
  }
  const { key } = await params;
  const { readPrivateReviewAsset } = await import("../../../../../core/private-review-assets");
  try {
    const asset = await readPrivateReviewAsset(key);
    if (!asset) return new Response(null, { status: 404, headers });
    return new Response(new Uint8Array(asset.bytes), { headers: { ...headers, "Content-Type": asset.contentType } });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Response(null, { status: 404, headers });
    }
    throw error;
  }
}
