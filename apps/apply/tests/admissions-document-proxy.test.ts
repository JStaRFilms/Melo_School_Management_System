import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(async () => "guardian-session" as string | undefined),
}));

vi.mock("@/lib/auth-server", () => ({ getToken: mocks.getToken }));

import { GET } from "../app/api/admissions/documents/[grant]/route";

const grant = "a".repeat(64);

describe("Apply admissions document proxy", () => {
  beforeEach(() => {
    vi.stubEnv("CONVEX_SITE_URL", "https://deployment.convex.site");
    mocks.getToken.mockResolvedValue("guardian-session");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("content", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": "7",
        "content-disposition": "inline; filename=\"birth.pdf\"; filename*=UTF-8''birth.pdf",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("streams through the authenticated same-origin URL with private safe headers", async () => {
    const browserUrl = `http://apply.test/api/admissions/documents/${grant}`;
    const response = await GET(new Request(browserUrl), { params: Promise.resolve({ grant }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("content");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toMatch(/^inline; filename="birth\.pdf"/);
    expect(browserUrl).not.toMatch(/convex\.cloud|convex\.site|api\/storage|storage-id|document-key|database-id/);
    expect(fetch).toHaveBeenCalledWith(new URL("https://deployment.convex.site/admissions/document-access"), {
      method: "POST",
      headers: { Authorization: "Bearer guardian-session", "X-Admissions-Access-Audience": "apply", "X-Admissions-Access-Grant": grant },
      cache: "no-store",
      redirect: "error",
    });
  });

  it("returns only a generic no-store error for missing auth and upstream failures", async () => {
    mocks.getToken.mockResolvedValueOnce(undefined);
    const unauthenticated = await GET(new Request(`http://apply.test/api/admissions/documents/${grant}`), { params: Promise.resolve({ grant }) });
    expect(unauthenticated.status).toBe(401);
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ConvexError storage-id database-id"));
    const failed = await GET(new Request(`http://apply.test/api/admissions/documents/${grant}`), { params: Promise.resolve({ grant }) });
    expect(failed.status).toBe(404);
    expect(await failed.text()).toBe('{"error":"Document access is unavailable."}');
    expect(failed.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
