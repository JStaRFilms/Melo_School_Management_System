import type { SiteContentSource } from "@/core/content";
import { getLegacyEnvelopeForHostname } from "@/renderers/legacy-template/fixtures";

/**
 * B0 projection boundary. A deployment may configure this server-to-server
 * endpoint once the public/preview Convex projection is exposed. It is not a
 * content field and it is never passed to a renderer or browser.
 */
function safeEndpoint(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" || (process.env.NODE_ENV !== "production" && endpoint.protocol === "http:") ? endpoint : null;
  } catch {
    return null;
  }
}

function configuredProjectionSource(): SiteContentSource | null {
  const publishedEndpoint = safeEndpoint(process.env.SITE_PUBLIC_CONTENT_ENDPOINT);
  if (!publishedEndpoint) return null;
  const previewEndpoint = safeEndpoint(process.env.SITE_PREVIEW_CONTENT_ENDPOINT);
  return {
    async loadPublished(hostname) {
      try {
        const url = new URL(publishedEndpoint);
        url.searchParams.set("hostname", hostname);
        const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
        return response.ok ? response.json() : null;
      } catch { return null; }
    },
    async loadPreview({ hostname, previewToken }) {
      if (!previewEndpoint) return null;
      try {
        const response = await fetch(previewEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ hostname, previewToken }),
          cache: "no-store",
        });
        return response.ok ? response.json() : null;
      } catch { return null; }
    },
  };
}

const legacyCompatibilitySource: SiteContentSource = {
  async loadPublished(hostname) { return getLegacyEnvelopeForHostname(hostname); },
};

let siteContentSource: SiteContentSource | undefined;

export function getSiteContentSource(): SiteContentSource {
  // Reused per server process so revision-keyed cache entries survive requests.
  siteContentSource ??= configuredProjectionSource() ?? legacyCompatibilitySource;
  return siteContentSource;
}
