import {expect,test} from "vitest";
import {encode,decode} from "fast-png";
import jpeg from "jpeg-js";
import {cleanImage} from "./image";
import {storageDigest} from "./shared";
const pixel = () => encode({width:1,height:1,channels:4,depth:8,data:new Uint8Array([4,90,15,255])});
test("decodes PNG and JPEG into metadata-free pixel PNG",() => {
  const png = pixel();
  expect(decode(cleanImage(png,"image/png").bytes).data).toEqual(decode(png).data);
  const withMetadata = encode({width:1,height:1,channels:4,depth:8,data:new Uint8Array([4,90,15,255]),text:{Comment:"Synthetic copyright note"}});
  expect(decode(withMetadata).text.Comment).toBe("Synthetic copyright note");
  expect(decode(cleanImage(withMetadata,"image/png").bytes).text).toEqual({});
  const activeMetadata = encode({width:1,height:1,channels:4,depth:8,data:new Uint8Array([4,90,15,255]),text:{Comment:"<script>alert(1)</script>"}});
  expect(() => cleanImage(activeMetadata,"image/png")).toThrow();
  const jpegBytes = jpeg.encode({width:1,height:1,data:new Uint8Array([20,30,40,255])},85).data;
  const result = cleanImage(jpegBytes,"image/jpeg");
  expect(result.mediaType).toBe("image/png");
  expect(decode(result.bytes).width).toBe(1);
  // Chunks after IEND, including polyglot payloads, never pass admission.
  expect(() => cleanImage(new Uint8Array([...png,60,115,99,114,105,112,116,62]),"image/png")).toThrow();
});
test("denies malformed, truncated, excessive pixels, unsupported WebP and metadata",() => {
  const png = pixel();
  for (const bad of [png.subarray(0,20),new Uint8Array([...png.subarray(0,-1)]),new Uint8Array([...png.slice(0,16),...new Uint8Array(40),...png.slice(56)])]) expect(() => cleanImage(bad,"image/png")).toThrow();
  const huge = new Uint8Array(png); huge.set([0,0,32,0],16);
  expect(() => cleanImage(huge,"image/png")).toThrow();
  expect(() => cleanImage(png,"image/webp")).toThrow();
  const jpegBytes = jpeg.encode({width:1,height:1,data:new Uint8Array([20,30,40,255])},85).data;
  expect(() => cleanImage(jpegBytes.subarray(0,-3),"image/jpeg")).toThrow();
});
test("canonical digest accepts exact base64 or hex only",() => {
  const hex = "ab".repeat(32);
  expect(storageDigest(hex.toUpperCase())).toBe(hex);
  expect(storageDigest(btoa(String.fromCharCode(...new Uint8Array(32).fill(0xab))))).toBe(hex);
  expect(storageDigest("0".repeat(64))).not.toBe(hex);
  expect(storageDigest("not-a-digest")).toBeNull();
});
