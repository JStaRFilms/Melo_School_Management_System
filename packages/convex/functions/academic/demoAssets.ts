/**
 * Frozen, locally generated demo artwork. These SVGs are original vector
 * illustrations generated from the supplied seed; they do not depict real people
 * and require no network or third-party asset licence.
 */
const PALETTES = [
  ["#7c3aed", "#fbbf24", "#f8d5bf", "#24130c"],
  ["#0f766e", "#38bdf8", "#8d5524", "#171717"],
  ["#be123c", "#fb7185", "#f1c27d", "#3f1d0d"],
  ["#1d4ed8", "#60a5fa", "#6b4226", "#111827"],
] as const;

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

export function demoSchoolLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Demo Academy crest">
  <rect width="512" height="512" rx="92" fill="#0f2d52"/>
  <path d="M256 69 413 127v113c0 104-67 172-157 204C166 412 99 344 99 240V127L256 69Z" fill="#f6c84c"/>
  <path d="M256 108 374 151v86c0 76-46 133-118 164-72-31-118-88-118-164v-86l118-43Z" fill="#fffaf0"/>
  <path d="M170 242h172v24H170z" fill="#0f2d52"/><path d="M192 222h128v20H192z" fill="#0f2d52"/>
  <path d="m256 154 22 45 49 7-35 34 8 48-44-23-44 23 8-48-35-34 49-7 22-45Z" fill="#e07a32"/>
  <text x="256" y="351" text-anchor="middle" font-family="Georgia,serif" font-size="34" font-weight="700" fill="#0f2d52">DA</text>
</svg>`;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  for (let index = 0; index < 4; index += 1) chunk[4 + index] = type.charCodeAt(index);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.slice(4, 8 + data.length)));
  return chunk;
}

function color(value: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function pngFromPixels(width: number, height: number, pixels: Uint8Array) {
  const filtered = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) filtered.set(pixels.slice(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const blocks: number[] = [0x78, 0x01];
  for (let start = 0; start < filtered.length; start += 65_535) {
    const length = Math.min(65_535, filtered.length - start);
    blocks.push(start + length >= filtered.length ? 1 : 0, length & 255, length >>> 8, (~length) & 255, (~length >>> 8) & 255);
    for (let offset = start; offset < start + length; offset += 1) blocks.push(filtered[offset]);
  }
  let adlerA = 1; let adlerB = 0;
  for (const byte of filtered) { adlerA = (adlerA + byte) % 65521; adlerB = (adlerB + adlerA) % 65521; }
  blocks.push(adlerB >>> 8, adlerB & 255, adlerA >>> 8, adlerA & 255);
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = new Uint8Array(13); const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header.set([8, 6, 0, 0, 0], 8);
  const chunks = [signature, pngChunk("IHDR", header), pngChunk("IDAT", new Uint8Array(blocks)), pngChunk("IEND", new Uint8Array())];
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0)); let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return output;
}

const RASTER_PALETTES = [
  ["#23395d", "#f6bd60", "#8d5524", "#1c1412", "#f8fafc"], ["#1d5d57", "#87ceeb", "#c68642", "#241b17", "#fef3c7"],
  ["#7c2d3f", "#f59e8b", "#f1c27d", "#3d2418", "#f3e8ff"], ["#244c8a", "#a5d8ff", "#6b4226", "#111827", "#ecfeff"],
  ["#5b3a8a", "#facc15", "#d19a6a", "#34231d", "#fdf2f8"], ["#166534", "#86efac", "#7a4a2a", "#18181b", "#eff6ff"],
] as const;

function drawCircle(pixels: Uint8Array, size: number, cx: number, cy: number, radius: number, rgb: number[]) {
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(size - 1, Math.ceil(cy + radius)); y += 1) for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(size - 1, Math.ceil(cx + radius)); x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) { const offset = (y * size + x) * 4; pixels.set([...rgb, 255], offset); }
}
function drawRect(pixels: Uint8Array, size: number, left: number, top: number, right: number, bottom: number, rgb: number[]) {
  for (let y = Math.max(0, top); y < Math.min(size, bottom); y += 1) for (let x = Math.max(0, left); x < Math.min(size, right); x += 1) pixels.set([...rgb, 255], (y * size + x) * 4);
}

/** Deterministic polished synthetic raster portrait; not a photograph of a real person. */
export function demoPortraitPng(index: number) {
  const size = 192; const pixels = new Uint8Array(size * size * 4); const palette = RASTER_PALETTES[index % RASTER_PALETTES.length];
  const background = color(palette[0]); const accent = color(palette[1]); const skin = color(palette[2]); const hair = color(palette[3]); const shirt = color(palette[4]);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) { const mix = (x * (index % 5 + 1) + y * 2) / (size * 7); const offset = (y * size + x) * 4; pixels.set([Math.round(background[0] * (1 - mix) + accent[0] * mix), Math.round(background[1] * (1 - mix) + accent[1] * mix), Math.round(background[2] * (1 - mix) + accent[2] * mix), 255], offset); }
  // Decorative studio halo, shoulders and clothing variation.
  drawCircle(pixels, size, 96, 85, 66, accent); drawCircle(pixels, size, 96, 86, 59, hair);
  drawCircle(pixels, size, 96, 91, 46, skin); drawRect(pixels, size, 43, 132, 149, 192, shirt);
  if (index % 3 === 0) drawRect(pixels, size, 88, 132, 104, 192, accent);
  if (index % 3 === 1) { drawRect(pixels, size, 43, 150, 149, 157, accent); drawRect(pixels, size, 43, 171, 149, 178, accent); }
  // Six deterministic hair silhouettes.
  const style = index % 6;
  if (style === 0) drawCircle(pixels, size, 96, 58, 42, hair);
  if (style === 1) for (let x = 58; x <= 134; x += 12) drawCircle(pixels, size, x, 58 + (x % 3) * 4, 16, hair);
  if (style === 2) { drawRect(pixels, size, 49, 40, 143, 70, hair); drawRect(pixels, size, 52, 62, 67, 110, hair); }
  if (style === 3) { drawCircle(pixels, size, 96, 54, 44, hair); drawRect(pixels, size, 51, 55, 66, 118, hair); drawRect(pixels, size, 126, 55, 141, 118, hair); }
  if (style === 4) { drawCircle(pixels, size, 96, 61, 40, hair); drawCircle(pixels, size, 137, 62, 18, hair); }
  if (style === 5) { drawCircle(pixels, size, 96, 53, 43, hair); drawRect(pixels, size, 63, 42, 130, 58, hair); }
  // Face details: eyes, brows, nose, smile and optional glasses/freckles.
  drawRect(pixels, size, 69, 82, 83, 85, hair); drawRect(pixels, size, 109, 82, 123, 85, hair);
  drawCircle(pixels, size, 76, 92, 4, [31, 41, 55]); drawCircle(pixels, size, 116, 92, 4, [31, 41, 55]);
  drawRect(pixels, size, 94, 95, 99, 108, [150, 79, 54]); drawRect(pixels, size, 86, 116, 107, 119, [142, 66, 63]);
  if (index % 4 === 0) { drawRect(pixels, size, 63, 87, 88, 98, [31, 41, 55]); drawRect(pixels, size, 104, 87, 129, 98, [31, 41, 55]); drawRect(pixels, size, 88, 91, 104, 94, [31, 41, 55]); }
  if (index % 5 === 0) { drawCircle(pixels, size, 70, 107, 2, [145, 83, 59]); drawCircle(pixels, size, 121, 107, 2, [145, 83, 59]); }
  // Index-specific, invisible-to-the-eye texture keeps every frozen portrait byte-distinct.
  const marker = (index * 29) % size; drawRect(pixels, size, marker, 187, marker + 2, 191, accent);
  return pngFromPixels(size, size, pixels);
}

/** Recognizable raster rendering of the Demo Academy shield, book and DA star crest. */
export function demoSchoolLogoPng() {
  const size = 256; const pixels = new Uint8Array(size * size * 4); const navy = [15, 45, 82]; const gold = [246, 200, 76]; const ivory = [255, 250, 240]; const orange = [224, 122, 50];
  drawRect(pixels, size, 0, 0, size, size, navy); drawCircle(pixels, size, 128, 128, 110, gold); drawCircle(pixels, size, 128, 128, 94, ivory);
  for (let y = 55; y < 202; y += 1) for (let x = 55; x < 202; x += 1) if (Math.abs(x - 128) + (y - 55) * 0.58 < 84 && Math.abs(x - 128) + (202 - y) * 0.72 < 105) pixels.set([...gold, 255], (y * size + x) * 4);
  drawRect(pixels, size, 78, 126, 178, 138, navy); drawRect(pixels, size, 88, 112, 168, 124, navy); drawCircle(pixels, size, 128, 92, 27, orange); drawRect(pixels, size, 112, 78, 144, 106, orange);
  // DA monogram strokes below the book.
  drawRect(pixels, size, 92, 157, 100, 184, navy); drawRect(pixels, size, 116, 157, 124, 184, navy); drawRect(pixels, size, 100, 157, 116, 165, navy); drawRect(pixels, size, 100, 176, 116, 184, navy); drawRect(pixels, size, 137, 157, 145, 184, navy); drawRect(pixels, size, 145, 157, 162, 165, navy); drawRect(pixels, size, 145, 176, 162, 184, navy); drawRect(pixels, size, 162, 165, 170, 176, navy);
  return pngFromPixels(size, size, pixels);
}

export function demoPortraitSvg(name: string, index: number) {
  const [background, accent, skin, hair] = PALETTES[index % PALETTES.length];
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="Synthetic illustrated portrait of ${escapeXml(name)}">
  <defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
  <rect width="480" height="480" rx="48" fill="url(#g)"/>
  <circle cx="240" cy="190" r="100" fill="${hair}"/><circle cx="240" cy="207" r="80" fill="${skin}"/>
  <path d="M153 185c7-79 161-96 174 2-35-32-118-28-174-2Z" fill="${hair}"/>
  <circle cx="210" cy="210" r="8" fill="#1f2937"/><circle cx="270" cy="210" r="8" fill="#1f2937"/><path d="M211 252c18 15 40 15 58 0" fill="none" stroke="#9a4e36" stroke-width="7" stroke-linecap="round"/>
  <path d="M102 480c14-112 79-165 138-165s124 53 138 165" fill="#f8fafc"/><path d="M174 336c20 19 42 29 66 29s46-10 66-29l28 144H146l28-144Z" fill="${background}"/>
  <text x="240" y="452" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#fff">${initials}</text>
</svg>`;
}
