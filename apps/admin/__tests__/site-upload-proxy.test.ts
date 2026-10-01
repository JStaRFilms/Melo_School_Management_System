import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getToken: vi.fn(async () => "synthetic-session" as string | undefined) }));
vi.mock("@/auth-server", () => ({ getToken: mocks.getToken }));
import { POST } from "../app/api/site-assets/upload/route";
const url = "https://admin.test/api/site-assets/upload";
const schoolId = "schoolSynthetic01";
const bytes = new Uint8Array(16).fill(42);
function request(origin = "https://admin.test", overrides: Record<string,string> = {}) {
  return new Request(url, { method: "POST", body: bytes, headers: { Origin: origin, "Content-Type": "image/png", "Content-Length": "16", "X-Site-School": schoolId, "X-Site-Kind": "hero", "X-Site-Filename": "synthetic.png", "X-Site-Alt": "Fictional scene", ...overrides } });
}
beforeEach(() => { vi.stubEnv("CONVEX_SITE_URL", "https://synthetic.convex.site"); mocks.getToken.mockResolvedValue("synthetic-session"); vi.stubGlobal("fetch",vi.fn(async () => Response.json({assetId:"assetSynthetic01"},{status:201}))); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it("denies unauthenticated or cross-origin bytes before calling upstream", async () => {
  mocks.getToken.mockResolvedValueOnce(undefined);
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request("https://other.test"))).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("proxies only bounded image bytes and returns only an opaque asset ID", async () => {
  const response = await POST(request());
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({assetId:"assetSynthetic01"});
  expect(fetch).toHaveBeenCalledWith("https://synthetic.convex.site/sites/asset-upload", expect.objectContaining({ method:"POST", cache:"no-store", headers:expect.objectContaining({Authorization:"Bearer synthetic-session","X-Site-School":schoolId}) }));
  expect((await POST(request("https://admin.test",{"Content-Type":"application/pdf"}))).status).toBe(400);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("does not forward private upstream errors or a storage identifier", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("private storage id",{status:403}));
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain("storage id");
});
