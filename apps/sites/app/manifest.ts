import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { resolvePath } from "../core/gateway";
export const dynamic = "force-dynamic";
export default async function manifest():Promise<MetadataRoute.Manifest> {
  const result = await resolvePath(await headers(),"/");
  if (result.status !== "available" || result.site.redirectToCanonical) return {name:"School website unavailable",start_url:"/",display:"browser"};
  const name = result.site.fields.find(f => f.fieldId === "school_name")?.value;
  return {name:name?.kind === "text" ? name.value : "School",start_url:result.site.canonicalOrigin + "/",scope:result.site.canonicalOrigin + "/",display:"browser"};
}
