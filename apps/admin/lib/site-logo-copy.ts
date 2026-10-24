const MAX_BYTES = 5_000_000;

// Read dimensions before decoding WebP. The website upload endpoint accepts only
// PNG/JPEG and independently validates and re-encodes every uploaded image.
export function webpDimensions(bytes: Uint8Array): {width: number; height: number} {
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 30 || tag(0) !== "RIFF" || tag(8) !== "WEBP") throw Error("Invalid WebP logo");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length) throw Error("Invalid WebP length");
  let width: number, height: number;
  if (tag(12) === "VP8X") {
    if (bytes[20] & 2) throw Error("Animated logos are not supported");
    const uint24 = (at: number) => bytes[at] + bytes[at + 1] * 256 + bytes[at + 2] * 65536;
    width = uint24(24) + 1; height = uint24(27) + 1;
  } else if (tag(12) === "VP8L" && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true);
    width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1;
  } else if (tag(12) === "VP8 " && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
    width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
  } else throw Error("Unsupported WebP logo");
  if (!width || !height || width > 8000 || height > 8000 || width * height > 4_000_000) throw Error("Logo dimensions exceed the website image limit");
  return {width, height};
}

export async function copyableAdminLogo(url: string): Promise<File> {
  const source = new URL(url);
  if (source.protocol !== "https:" || source.username || source.password) throw Error("Admin logo source unavailable");
  const response = await fetch(url, {cache:"no-store", credentials:"omit", redirect:"error", signal:AbortSignal.timeout(20_000)});
  const type = response.headers.get("content-type")?.split(";")[0];
  if (!response.ok || !response.body || !["image/png", "image/jpeg", "image/webp"].includes(type ?? "")) throw Error("Admin logo must be PNG, JPEG or WebP");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > MAX_BYTES) throw Error("Admin logo exceeds 5 MB");
      chunks.push(chunk.value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  let blob = new Blob([bytes], {type});
  if (type === "image/webp") {
    const dimensions = webpDimensions(bytes);
    const bitmap = await createImageBitmap(blob);
    try {
      if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) throw Error("WebP dimensions changed during decoding");
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      if (!context) throw Error("Logo conversion unavailable");
      context.drawImage(bitmap, 0, 0);
      blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error("Logo conversion failed")), "image/png"));
    } finally { bitmap.close(); }
  }
  if (blob.size < 12 || blob.size > MAX_BYTES) throw Error("Logo exceeds the website upload limit");
  return new File([blob], type === "image/jpeg" ? "admin-logo-copy.jpg" : "admin-logo-copy.png", {type:blob.type});
}
