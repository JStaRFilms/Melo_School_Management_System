import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePath } from "../../core/gateway";
import { hasRenderer, renderSite } from "../../core/registry";
import { legacyDemoFromHeaders, LegacyDemo } from "../../core/legacy";
import { safePath } from "../../core/public";
import { deniedMetadata, jsonLd, seo } from "../../core/seo";

export const dynamic = "force-dynamic";
type Props = {params:Promise<{slug?:string[]}>};
const pathname = (slug?:string[]) => {
  const path = slug?.length ? `/${slug.join("/")}` : "/";
  return safePath(path) ? path : null;
};
export async function generateMetadata({params}:Props):Promise<Metadata> {
  const path = pathname((await params).slug);
  if (!path) return deniedMetadata;
  const requestHeaders = await headers();
  const result = await resolvePath(requestHeaders,path);
  if (result.status === "available" && result.routeId && hasRenderer(result.site)) return seo(result.site,result.routeId);
  const demo = path === "/" ? legacyDemoFromHeaders(requestHeaders) : null;
  return demo ? {title:demo.name,robots:{index:false,follow:false}} : deniedMetadata;
}
export default async function Page({params}:Props) {
  const path = pathname((await params).slug);
  if (!path) notFound();
  const requestHeaders = await headers();
  const result = await resolvePath(requestHeaders,path);
  if (result.status !== "available" || !result.routeId) {
    const demo = path === "/" ? legacyDemoFromHeaders(requestHeaders) : null;
    if (demo) return <LegacyDemo name={demo.name} />;
    notFound();
  }
  if (!hasRenderer(result.site)) notFound();
  const structured = jsonLd(result.site,result.routeId);
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:structured}} />{renderSite(result.site,result.routeId)}</>;
}
