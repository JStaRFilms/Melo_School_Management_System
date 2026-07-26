import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { legacyTemplateRenderer } from "@/renderers/legacy-template/adapter";

describe("legacy-template compatibility adapter", () => {
  const fields = { schoolKey: { kind: "text", value: "greenfield-preparatory" } };
  const school = { id: "legacy:greenfield-preparatory", slug: "greenfield-preparatory", displayName: "Greenfield Preparatory School" };

  test("cannot bind a demonstration renderer to another tenant", () => {
    expect(legacyTemplateRenderer.validateRendererData({ school: { ...school, id: "other-school" }, fields })).toBeNull();
    expect(legacyTemplateRenderer.validateRendererData({ school, fields })).toEqual({ schoolKey: "greenfield-preparatory" });
  });

  test("retains the authorized preview path for every internal legacy link", () => {
    const rendererData = legacyTemplateRenderer.validateRendererData({ school, fields });
    const markup = renderToStaticMarkup(legacyTemplateRenderer.render({
      school, assets: {}, links: { application: { version: "1", schoolSlug: "greenfield-preparatory", href: "https://apply.example/s/greenfield-preparatory", availability: "unavailable", intakeSlug: null, opensAt: null, closesAt: null } }, seo: {}, publication: { revisionId: "legacy", publishedAt: 1 },
      request: { routeKey: "home", canonicalUrl: "https://preview.example/", preview: true, params: {}, pathPrefix: "/__preview/opaque-token" }, rendererData,
    }));
    expect(markup).toContain('href="/__preview/opaque-token/about"');
    expect(markup).toContain('href="/__preview/opaque-token/contact"');
  });
});
