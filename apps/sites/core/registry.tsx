import type { ProductionSiteContext } from "./public";
import { siteManifest } from "@school/shared/site-manifests";
import { SyntheticPage } from "./synthetic";
import { Homepage } from "../renderers/obhis-v1/Homepage";
import { oliveFromPublication } from "../renderers/obhis-v1/model";

const registry = {"school-core-synthetic-v1/1": SyntheticPage, "obhis-v1/1": Homepage} as const;
export function hasRenderer(site: ProductionSiteContext): boolean {
  return !!siteManifest(site.rendererKey,site.rendererSchemaVersion) && Object.prototype.hasOwnProperty.call(registry,`${site.rendererKey}/${site.rendererSchemaVersion}`);
}
export function renderSite(site: ProductionSiteContext, routeId: string) {
  if (!hasRenderer(site)) return null;
  if (site.rendererKey === "obhis-v1" && site.rendererSchemaVersion === "1") {
    if (routeId !== "home") return null;
    const model = oliveFromPublication(site);
    return model ? <Homepage model={model} /> : null;
  }
  if (site.rendererKey === "school-core-synthetic-v1" && site.rendererSchemaVersion === "1") return <SyntheticPage site={site} routeId={routeId} />;
  return null;
}
