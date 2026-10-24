import {afterEach, expect, it, vi} from "vitest";
import {copyableAdminLogo, webpDimensions} from "../lib/site-logo-copy";

afterEach(() => { vi.restoreAllMocks(); });
function webp(width: number, height: number) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"),0);
  new DataView(bytes.buffer).setUint32(4,22,true);
  bytes.set(new TextEncoder().encode("WEBPVP8X"),8);
  new DataView(bytes.buffer).setUint32(16,10,true);
  for (const [offset,value] of [[24,width-1],[27,height-1]]) {
    bytes[offset] = value & 255; bytes[offset+1] = (value >>> 8) & 255; bytes[offset+2] = value >>> 16;
  }
  return bytes;
}
it("passes PNG/JPEG bytes to a new file and bounds the download", async () => {
  for (const type of ["image/png","image/jpeg"]) {
    const bytes = new Uint8Array(20).fill(42);
    const fetcher = vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(bytes,{headers:{"Content-Type":type}}));
    const file = await copyableAdminLogo("https://private-storage.test/logo");
    expect(file.type).toBe(type);
    expect(file.size).toBe(bytes.length);
    expect(file.name).toBe(type === "image/png" ? "admin-logo-copy.png" : "admin-logo-copy.jpg");
    expect(fetcher).toHaveBeenCalledWith("https://private-storage.test/logo",expect.objectContaining({credentials:"omit",redirect:"error",cache:"no-store"}));
    fetcher.mockRestore();
  }
  vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(new Uint8Array(5_000_001),{headers:{"Content-Type":"image/png"}}));
  await expect(copyableAdminLogo("https://private-storage.test/logo")).rejects.toThrow("exceeds 5 MB");
});
it("checks WebP dimensions before decoding and rejects animation or oversized output", async () => {
  expect(webpDimensions(webp(100,80))).toEqual({width:100,height:80});
  expect(() => webpDimensions(webp(4000,4000))).toThrow("dimensions");
  const animated = webp(100,80); animated[20] = 2;
  expect(() => webpDimensions(animated)).toThrow("Animated");
  expect(() => webpDimensions(new Uint8Array(30))).toThrow("Invalid WebP");
  const decode = vi.fn();
  vi.stubGlobal("createImageBitmap",decode);
  try {
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(webp(4000,4000),{headers:{"Content-Type":"image/webp"}}));
    await expect(copyableAdminLogo("https://private-storage.test/logo")).rejects.toThrow("dimensions");
    expect(decode).not.toHaveBeenCalled();
    decode.mockResolvedValue({width:100,height:80,close:vi.fn()});
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(webp(100,80),{headers:{"Content-Type":"image/webp"}}));
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(null);
    await expect(copyableAdminLogo("https://private-storage.test/logo")).rejects.toThrow("conversion unavailable");
    expect(decode).toHaveBeenCalledOnce();
  } finally {vi.unstubAllGlobals();}
});
