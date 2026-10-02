import { decode, encode } from "fast-png";
import { Unzlib } from "fflate";
import jpeg from "jpeg-js";

// Keep decoded pixels below the Convex action memory budget. JPEG inputs are
// converted to PNG so neither encoder needs a Node Buffer or native codec.
const MAX_PIXELS = 4_000_000;
const MAX_DECODED = 20_000_000;
function pngHeader(bytes: Uint8Array) {
  const signature = [137,80,78,71,13,10,26,10];
  if (bytes.length < 57 || !signature.every((b,i) => bytes[i] === b)) throw Error("Invalid PNG signature");
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12,16)) !== "IHDR") throw Error("Invalid PNG header");
  const width = view.getUint32(16), height = view.getUint32(20);
  if (!width || !height || width > 8000 || height > 8000 || width * height > MAX_PIXELS || bytes[24] !== 8 || ![2,6].includes(bytes[25]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) throw Error("Unsupported PNG dimensions or format");
  let offset = 8, idat = 0, iend = false;
  const compressed: Uint8Array[] = [];
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    if (length > bytes.length - offset - 12) throw Error("Truncated PNG chunk");
    const type = String.fromCharCode(...bytes.subarray(offset + 4,offset + 8));
    if (type === "IDAT") { compressed.push(bytes.subarray(offset + 8,offset + 8 + length)); idat += length; }
    // APNG, ICC, unknown critical chunks and embedded metadata never reach the decoder.
    if (!["IHDR","IDAT","IEND","tEXt","zTXt","iTXt","pHYs","gAMA","cHRM","sRGB"].includes(type)) throw Error("Unsupported PNG chunk");
    offset += 12 + length;
    if (type === "IEND") { if (length || offset !== bytes.length) throw Error("PNG trailing payload"); iend = true; break; }
  }
  if (!iend || !idat) throw Error("Incomplete PNG");
  let size = 0;
  const inflater = new Unzlib((chunk) => { size += chunk.length; if (size > MAX_DECODED) throw Error("PNG inflate limit"); });
  for (const data of compressed) for (let pos = 0; pos < data.length; pos += 1024) inflater.push(data.subarray(pos,pos+1024), false);
  inflater.push(new Uint8Array(0), true);
  // A scanline contains one filter byte plus RGB or RGBA samples.
  if (size !== height * (1 + width * (bytes[25] === 6 ? 4 : 3))) throw Error("PNG pixel length mismatch");
  return {width,height};
}
export function cleanImage(bytes: Uint8Array, mediaType: string): {bytes: Uint8Array; mediaType: "image/png"} {
  if (bytes.length > 5_000_000 || bytes.length < 12) throw Error("Image size denied");
  // Reject common active/document formats embedded in image metadata as well as
  // trailing payloads. Re-encoding then writes pixels alone.
  const polyglot = new TextDecoder("latin1").decode(bytes);
  if (/<(?:script|html|svg|iframe)\b|%PDF-|PK\x03\x04|GIF8[79]a/i.test(polyglot)) throw Error("Embedded active payload denied");
  let image: {width: number;height: number;data: Uint8Array | Uint8ClampedArray};
  if (mediaType === "image/png") {
    const header = pngHeader(bytes);
    const decoded = decode(bytes,{checkCrc:true});
    if (decoded.width !== header.width || decoded.height !== header.height || decoded.depth !== 8 || ![3,4].includes(decoded.channels)) throw Error("Invalid PNG pixels");
    const rgba = new Uint8Array(decoded.width * decoded.height * 4);
    for (let src = 0, dest = 0; dest < rgba.length; src += decoded.channels, dest += 4) {
      rgba[dest] = decoded.data[src]; rgba[dest+1] = decoded.data[src+1]; rgba[dest+2] = decoded.data[src+2]; rgba[dest+3] = decoded.channels === 4 ? decoded.data[src+3] : 255;
    }
    image = {width:decoded.width,height:decoded.height,data:rgba};
  } else if (mediaType === "image/jpeg") {
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length-2] !== 255 || bytes[bytes.length-1] !== 217) throw Error("Invalid JPEG boundary");
    const decoded = jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxResolutionInMP:4,maxMemoryUsageInMB:64});
    if (!decoded.width || !decoded.height || decoded.width > 8000 || decoded.height > 8000 || decoded.width * decoded.height > MAX_PIXELS || decoded.data.length !== decoded.width * decoded.height * 4) throw Error("Invalid JPEG pixels");
    image = decoded;
  } else throw Error("Unsupported image format");
  const result = encode({width:image.width,height:image.height,data:image.data,channels:4,depth:8});
  if (result.length > 5_000_000) throw Error("Encoded image exceeds upload limit");
  return {bytes:result,mediaType:"image/png"};
}
