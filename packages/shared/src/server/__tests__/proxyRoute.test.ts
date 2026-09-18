import { describe, expect, it, vi } from "vitest";
import {
  DOCUMENT_GRANT_FORWARD_HEADERS,
  DOCUMENT_GRANT_PRIVATE_HEADERS,
  buildDocumentGrantProxyHeaders,
  createDocumentGrantProxy,
  isValidDocumentGrant,
  mapDocumentGrantUpstreamError,
} from "../proxyRoute";

const VALID_GRANT = "a".repeat(64);

function ctx(grant = VALID_GRANT) {
  return { params: Promise.resolve({ grant }) };
}

describe("isValidDocumentGrant", () => {
  it("accepts a 64-char lowercase hex grant", () => {
    expect(isValidDocumentGrant(VALID_GRANT)).toBe(true);
  });

  it("rejects non-hex, short, and uppercase grants", () => {
    expect(isValidDocumentGrant("g".repeat(64))).toBe(false);
    expect(isValidDocumentGrant("a".repeat(63))).toBe(false);
    expect(isValidDocumentGrant("A".repeat(64))).toBe(false);
    expect(isValidDocumentGrant("")).toBe(false);
  });
});

describe("createDocumentGrantProxy", () => {
  it("requires an explicit audience (never defaulted)", () => {
    expect(() =>
      createDocumentGrantProxy("", { getToken: async () => "t" })
    ).toThrow(/explicit audience/);
  });

  it("returns 401 when unauthenticated", async () => {
    const GET = createDocumentGrantProxy("apply", {
      getToken: async () => null,
      getSiteUrl: () => "https://convex.example",
    });
    const res = await GET(new Request("https://x/"), ctx());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Document access is unavailable.",
    });
  });

  it("returns 503 when the site URL is missing", async () => {
    const GET = createDocumentGrantProxy("apply", {
      getToken: async () => "tok",
      getSiteUrl: () => null,
    });
    const res = await GET(new Request("https://x/"), ctx());
    expect(res.status).toBe(503);
  });

  it("rejects malformed grants with 404 without calling upstream", async () => {
    const fetchImpl = vi.fn();
    const GET = createDocumentGrantProxy("admin", {
      getToken: async () => "tok",
      getSiteUrl: () => "https://convex.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await GET(new Request("https://x/"), ctx("not-a-grant"));
    expect(res.status).toBe(404);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps upstream 502 to 502 and other failures to 404", () => {
    expect(mapDocumentGrantUpstreamError(502)).toBe(502);
    expect(mapDocumentGrantUpstreamError(500)).toBe(404);
    expect(mapDocumentGrantUpstreamError(403)).toBe(404);
  });

  it("maps upstream error statuses through the handler", async () => {
    for (const [upstreamStatus, expected] of [
      [502, 502],
      [500, 404],
    ] as const) {
      const fetchImpl = vi.fn().mockResolvedValue(
        new Response("nope", { status: upstreamStatus })
      );
      const GET = createDocumentGrantProxy("apply", {
        getToken: async () => "tok",
        getSiteUrl: () => "https://convex.example",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      const res = await GET(new Request("https://x/"), ctx());
      expect(res.status).toBe(expected);
    }
  });

  it("sends the audience through and forwards only the allowlisted headers", async () => {
    let seenAudience: string | null = null;
    const fetchImpl = vi.fn().mockImplementation((_url: unknown, init: any) => {
      seenAudience = init?.headers?.["X-Admissions-Access-Audience"] ?? null;
      const upstreamHeaders = new Headers({
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="doc.pdf"',
        "x-evil": "drop-me",
      });
      return Promise.resolve(
        new Response("bytes", { status: 200, headers: upstreamHeaders })
      );
    });
    const GET = createDocumentGrantProxy("admin", {
      getToken: async () => "tok",
      getSiteUrl: () => "https://convex.example",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const res = await GET(new Request("https://x/"), ctx());
    expect(seenAudience).toBe("admin");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("doc.pdf");
    expect(res.headers.get("x-evil")).toBeNull();
    // private no-store caching preserved
    expect(res.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });
});

describe("buildDocumentGrantProxyHeaders snapshot", () => {
  it("keeps private headers plus exactly the allowlist", () => {
    const upstream = new Headers({
      "content-type": "application/pdf",
      "content-length": "42",
      "content-disposition": 'attachment; filename="doc.pdf"',
      "content-security-policy": "default-src 'none'",
      "x-should-drop": "yes",
    });
    const headers = buildDocumentGrantProxyHeaders(
      new Response("x", { headers: upstream })
    );
    expect(Object.fromEntries(headers.entries())).toMatchSnapshot();
    expect([...DOCUMENT_GRANT_FORWARD_HEADERS]).toEqual([
      "content-type",
      "content-length",
      "content-disposition",
      "content-security-policy",
    ]);
    expect(DOCUMENT_GRANT_PRIVATE_HEADERS["Cache-Control"]).toBe(
      "private, no-store, max-age=0"
    );
  });
});
