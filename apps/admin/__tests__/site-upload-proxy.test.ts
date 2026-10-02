import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getToken: vi.fn(async () => "synthetic-session" as string | undefined) }));
vi.mock("@/auth-server", () => ({ getToken: mocks.getToken }));
import { POST } from "../app/api/site-assets/upload/route";
import { encodeSiteUploadMetadata } from "@school/shared/site-upload-metadata";
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
it("forwards Unicode as canonical ASCII and preserves old raw percent literals",async () => {
  const unicode = request("https://admin.test",{"X-Site-Filename":"", "X-Site-Alt":"",...encodeSiteUploadMetadata("学校.png","Àwọn ọmọ")});
  // No simultaneous raw and versioned fields, including empty raw values.
  expect((await POST(unicode)).status).toBe(400);
  const headers = new Headers(request().headers);
  headers.delete("x-site-filename"); headers.delete("x-site-alt");
  for (const [key,value] of Object.entries(encodeSiteUploadMetadata("学校.png","Àwọn ọmọ"))) headers.set(key,value);
  expect((await POST(new Request(url,{method:"POST",body:bytes,headers}))).status).toBe(201);
  const sent = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string,string>;
  expect(sent["x-site-filename-uri-v1"]).toBe(encodeURIComponent("学校.png"));
  expect(sent["x-site-alt-uri-v1"]).toBe(encodeURIComponent("Àwọn ọmọ"));
  expect(sent["X-Site-Filename"]).toBeUndefined();
  expect((await POST(request("https://admin.test",{"X-Site-Filename":"100%.png"}))).status).toBe(201);
  const legacy = vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string,string>;
  expect(legacy["x-site-filename-uri-v1"]).toBe("100%25.png");
  expect((await POST(request("https://admin.test",{"X-Site-Filename":"bad.png","x-site-alt-uri-v1":"%GG"}))).status).toBe(400);
  expect((await POST(request("https://admin.test",{"X-Site-Filename":"bad.png","X-Site-Alt":"x".repeat(201)}))).status).toBe(400);
  expect((await POST(request("https://admin.test",{"Content-Length":"5000001"}))).status).toBe(400);
  expect((await POST(request("https://admin.test",{"x-site-filename-uri-v1":"%0Abad.png"}))).status).toBe(400);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("does not forward private upstream errors or a storage identifier", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("private storage id",{status:403}));
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(await response.text()).not.toContain("storage id");
});
