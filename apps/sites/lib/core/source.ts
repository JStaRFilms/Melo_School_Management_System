import type { SiteContentSource } from "@/core/content";
import { getLegacyEnvelopeForHostname } from "@/renderers/legacy-template/fixtures";

/**
 * B0 projection boundary. A deployment may configure this server-to-server
 * endpoint once the public/preview Convex projection is exposed. It is not a
 * content field and it is never passed to a renderer or browser.
 */
function configuredProjectionSource(): SiteContentSource | null {
  const publishedEndpoint = process.env.SITE_PUBLIC_CONTENT_ENDPOINT;
  if (!publishedEndpoint) return null;
  return {
    async loadPublished(hostname) {
      const url = new URL(publishedEndpoint);
      url.searchParams.set("hostname", hostname);
      const response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
      return response.ok ? response.json() : null;
    },
    async loadPreview({ hostname, previewToken }) {
      const endpoint = process.env.SITE_PREVIEW_CONTENT_ENDPOINT;
      if (!endpoint) return null;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ hostname, previewToken }),
        cache: "no-store",
      });
      return response.ok ? response.json() : null;
    },
  };
}

const legacyCompatibilitySource: SiteContentSource = {
  async loadPublished(hostname) { return getLegacyEnvelopeForHostname(hostname); },
};

export function getSiteContentSource(): SiteContentSource {
  return configuredProjectionSource() ?? legacyCompatibilitySource;
}
