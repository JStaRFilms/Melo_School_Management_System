import { getToken } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function unavailable(status = 404) {
  return Response.json({ error: "Document access is unavailable." }, { status, headers: privateHeaders });
}

export async function GET(_request: Request, context: { params: Promise<{ grant: string }> }) {
  const authToken = await getToken();
  if (!authToken) return unavailable(401);
  const siteUrl = process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) return unavailable(503);
  const { grant } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(grant)) return unavailable();

  try {
    const upstream = await fetch(new URL("/admissions/document-access", siteUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Admissions-Access-Audience": "apply",
        "X-Admissions-Access-Grant": grant,
      },
      cache: "no-store",
      redirect: "error",
    });
    if (!upstream.ok || !upstream.body) return unavailable(upstream.status === 502 ? 502 : 404);
    const headers = new Headers(privateHeaders);
    for (const name of ["content-type", "content-length", "content-disposition", "content-security-policy"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return unavailable();
  }
}
