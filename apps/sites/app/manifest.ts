import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolvePath } from "../core/gateway";
import { publishedSiteIcon } from "../core/seo";
export const dynamic = "force-dynamic";
export default async function manifest():Promise<MetadataRoute.Manifest> {
  const result = await resolvePath(await headers(),"/");
  if (result.status !== "available" || result.site.redirectToCanonical) return {name:"School website unavailable",start_url:"/",display:"browser"};
  const name = result.site.fields.find(f => f.fieldId === "school_name")?.value;
  const icon = publishedSiteIcon(result.site);
  return {icons:icon ? [{src:icon,purpose:"any"}] : [],name:name?.kind === "text" ? name.value : "School",start_url:result.site.canonicalOrigin + "/",scope:result.site.canonicalOrigin + "/",display:"browser"};
}
