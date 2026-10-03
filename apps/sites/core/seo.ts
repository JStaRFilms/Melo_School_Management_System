import type { Metadata } from "next";
import type { ProductionSiteContext } from "./public";
import { siteManifest } from "@school/shared/site-manifests";

export const deniedMetadata: Metadata = {title:"School website unavailable",robots:{index:false,follow:false}};
export function seo(site: ProductionSiteContext, routeId: string): Metadata {
  const path = siteManifest(site.rendererKey,site.rendererSchemaVersion)?.routes.find(r => r.routeId === routeId)?.path;
  const name = site.fields.find(f => f.fieldId === "school_name")?.value;
  if (!path || name?.kind !== "text") return deniedMetadata;
  const entry = site.routeSeo.find(r => r.routeId === routeId);
  const url = `${site.canonicalOrigin}${path}`;
  const title = entry?.title ?? (path === "/" ? name.value : `${routeId.replace(/[-_]/g," ")} | ${name.value}`);
  const description = entry?.description;
  const image = entry?.shareAsset?.src;
  const imageUrl = image ? `${site.canonicalOrigin}${image}` : undefined;
  return {title,description,alternates:{canonical:url},robots:{index:true,follow:true},openGraph:{title,description,url,siteName:name.value,images:imageUrl ? [{url:imageUrl}] : []},...(imageUrl ? {twitter:{card:"summary_large_image",images:[imageUrl]}} : {})};
}
export function jsonLd(site: ProductionSiteContext, routeId: string): string {
  const name = site.fields.find(f => f.fieldId === "school_name")?.value;
  const path = siteManifest(site.rendererKey,site.rendererSchemaVersion)?.routes.find(r => r.routeId === routeId)?.path;
  if (!path || name?.kind !== "text") return "";
  return JSON.stringify({"@context":"https://schema.org","@type":"EducationalOrganization",name:name.value,url:`${site.canonicalOrigin}${path}`}).replace(/</g,"\\u003c").replace(/>/g,"\\u003e").replace(/&/g,"\\u0026");
}
