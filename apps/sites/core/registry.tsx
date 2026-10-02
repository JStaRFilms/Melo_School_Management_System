import type { ProductionSiteContext } from "./public";
import { siteManifest } from "@school/shared/site-manifests";
import { SyntheticPage } from "./synthetic";

const registry = {"school-core-synthetic-v1/1": SyntheticPage} as const;
export function hasRenderer(site: ProductionSiteContext): boolean {
  return !!siteManifest(site.rendererKey,site.rendererSchemaVersion) && Object.prototype.hasOwnProperty.call(registry,`${site.rendererKey}/${site.rendererSchemaVersion}`);
}
export function renderSite(site: ProductionSiteContext, routeId: string) {
  if (!hasRenderer(site)) return null;
  const Renderer = registry[`${site.rendererKey}/${site.rendererSchemaVersion}` as keyof typeof registry];
  return Renderer ? <Renderer site={site} routeId={routeId} /> : null;
}
