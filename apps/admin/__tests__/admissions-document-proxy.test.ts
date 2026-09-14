import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(async () => "staff-session" as string | undefined),
}));

vi.mock("@/auth-server", () => ({ getToken: mocks.getToken }));

import { GET } from "../app/api/admissions/documents/[grant]/route";

const grant = "b".repeat(64);

describe("Admin admissions document proxy", () => {
  beforeEach(() => {
    vi.stubEnv("CONVEX_SITE_URL", "https://deployment.convex.site");
    mocks.getToken.mockResolvedValue("staff-session");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("content", {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-length": "7",
        "content-disposition": "attachment; filename=\"medical report.pdf\"; filename*=UTF-8''medical%20report.pdf",
        "content-security-policy": "sandbox; default-src 'none'",
      },
    })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it("streams downloads without redirecting or exposing Convex/internal identifiers in the browser URL", async () => {
    const browserUrl = `http://admin.test/api/admissions/documents/${grant}`;
    const response = await GET(new Request(browserUrl), { params: Promise.resolve({ grant }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("content");
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="medical report\.pdf"/);
    expect(browserUrl).not.toMatch(/convex\.cloud|convex\.site|api\/storage|storage-id|document-key|database-id|sha256/i);
    expect(fetch).toHaveBeenCalledWith(new URL("https://deployment.convex.site/admissions/document-access"), {
      method: "POST",
      headers: { Authorization: "Bearer staff-session", "X-Admissions-Access-Audience": "admin", "X-Admissions-Access-Grant": grant },
      cache: "no-store",
      redirect: "error",
    });
  });

  it("does not surface raw upstream errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ConvexError: document-key private-storage-id"));
    const response = await GET(new Request(`http://admin.test/api/admissions/documents/${grant}`), { params: Promise.resolve({ grant }) });
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('{"error":"Document access is unavailable."}');
  });
});
