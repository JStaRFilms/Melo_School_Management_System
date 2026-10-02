// Versioned, ASCII-only upload metadata headers. Raw headers remain accepted for
// clients deployed before the encoded headers; a raw percent sign stays literal.
export const siteUploadHeaders = {
  fileName: "x-site-filename-uri-v1",
  altText: "x-site-alt-uri-v1",
} as const;

export function validSiteUploadMetadata(fileName: string, altText: string): boolean {
  return valid(fileName,120,true) && valid(altText,200,false);
}

function valid(value: string, max: number, fileName: boolean): boolean {
  if (value.length > max || (fileName && !value.length) ||
      /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value) ||
      (fileName && /[<>/\\]/u.test(value))) return false;
  try { encodeURIComponent(value); return true; } catch { return false; }
}

export function encodeSiteUploadMetadata(fileName: string, altText: string): Record<string,string> {
  if (!validSiteUploadMetadata(fileName,altText)) throw Error("Invalid upload metadata");
  return {
    [siteUploadHeaders.fileName]: encodeURIComponent(fileName),
    [siteUploadHeaders.altText]: encodeURIComponent(altText),
  };
}

export function readSiteUploadMetadata(headers: Pick<Headers,"get">): {fileName:string; altText:string} | null {
  function field(rawName: string, encodedName: string, max: number, fileName: boolean): string | null {
    const raw = headers.get(rawName);
    const encoded = headers.get(encodedName);
    if (raw !== null && encoded !== null) return null;
    if (encoded !== null) {
      if (encoded.length > max * 9 || !/^[\x21-\x7e]*$/.test(encoded)) return null;
      try {
        const decoded = decodeURIComponent(encoded);
        return encodeURIComponent(decoded) === encoded && valid(decoded,max,fileName) ? decoded : null;
      } catch { return null; }
    }
    if (raw === null) return fileName ? null : "";
    return valid(raw,max,fileName) ? raw : null;
  }
  const fileName = field("x-site-filename",siteUploadHeaders.fileName,120,true);
  const altText = field("x-site-alt",siteUploadHeaders.altText,200,false);
  return fileName === null || altText === null ? null : {fileName,altText};
}
