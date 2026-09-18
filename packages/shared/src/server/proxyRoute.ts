/**
 * Shared proxy-route factory for admissions document-grant downloads (P14).
 *
 * Consolidates apps/apply and apps/admin
 * `app/api/admissions/documents/[grant]/route.ts`, which were byte-identical
 * except for the `X-Admissions-Access-Audience` string ("apply" vs "admin").
 *
 * The audience is a required parameter — it is never defaulted — so each
 * thin route wrapper must pass its own audience explicitly.
 */

export const DOCUMENT_GRANT_PATTERN = /^[a-f0-9]{64}$/;

export const DOCUMENT_GRANT_UPSTREAM_PATH = "/admissions/document-access";

export const DOCUMENT_GRANT_FORWARD_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-security-policy",
] as const;

export const DOCUMENT_GRANT_PRIVATE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export const DOCUMENT_GRANT_UNAVAILABLE_BODY = "Document access is unavailable.";

export type DocumentGrantProxyDeps = {
  getToken: () => Promise<string | null | undefined>;
  getSiteUrl?: () => string | null | undefined;
  fetchImpl?: typeof fetch;
};

export type DocumentGrantRouteContext = {
  params: Promise<{ grant: string }>;
};

function defaultSiteUrl(): string | null {
  return (
    process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL || null
  );
}

export function isValidDocumentGrant(grant: string): boolean {
  return DOCUMENT_GRANT_PATTERN.test(grant);
}

/** Preserve the exact upstream-error mapping: 502 stays 502, everything else is 404. */
export function mapDocumentGrantUpstreamError(status: number): 502 | 404 {
  return status === 502 ? 502 : 404;
}

export function buildDocumentGrantProxyHeaders(upstream: Response): Headers {
  const headers = new Headers(DOCUMENT_GRANT_PRIVATE_HEADERS);
  for (const name of DOCUMENT_GRANT_FORWARD_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function unavailable(status = 404) {
  return Response.json(
    { error: DOCUMENT_GRANT_UNAVAILABLE_BODY },
    { status, headers: DOCUMENT_GRANT_PRIVATE_HEADERS }
  );
}

/**
 * Create the GET handler for the document-grant proxy route.
 * @param audience - the admissions audience for this app ("apply" | "admin"); required, no default.
 */
export function createDocumentGrantProxy(
  audience: string,
  deps: DocumentGrantProxyDeps
) {
  if (!audience) {
    throw new Error("createDocumentGrantProxy requires an explicit audience.");
  }
  const { getToken, getSiteUrl = defaultSiteUrl, fetchImpl = fetch } = deps;

  return async function GET(
    _request: Request,
    context: DocumentGrantRouteContext
  ): Promise<Response> {
    const authToken = await getToken();
    if (!authToken) return unavailable(401);
    const siteUrl = getSiteUrl();
    if (!siteUrl) return unavailable(503);
    const { grant } = await context.params;
    if (!isValidDocumentGrant(grant)) return unavailable();

    try {
      const upstream = await fetchImpl(
        new URL(DOCUMENT_GRANT_UPSTREAM_PATH, siteUrl),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "X-Admissions-Access-Audience": audience,
            "X-Admissions-Access-Grant": grant,
          },
          cache: "no-store",
          redirect: "error",
        }
      );
      if (!upstream.ok || !upstream.body)
        return unavailable(mapDocumentGrantUpstreamError(upstream.status));
      return new Response(upstream.body, {
        status: 200,
        headers: buildDocumentGrantProxyHeaders(upstream),
      });
    } catch {
      return unavailable();
    }
  };
}
