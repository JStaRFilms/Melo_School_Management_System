import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../packages/convex/_generated/api";
import { admitSite, hostname, routeForPath, safePath, type SiteResult } from "./public";
import { approvedIngressHost } from "./ingress";

function config(): { url: string; siteUrl: string; secret: string } | null {
  const url = process.env.CONVEX_URL;
  const siteUrl = process.env.CONVEX_SITE_URL;
  const secret = process.env.SITES_GATEWAY_SECRET;
  if (!url || !siteUrl || !secret || secret.length < 32 || !/^https:\/\/[a-z0-9.-]+$/i.test(url) || !/^https:\/\/[a-z0-9.-]+$/i.test(siteUrl)) return null;
  return {url,siteUrl,secret};
}
export async function resolve(headers: Pick<Headers,"get">, routeId: string): Promise<SiteResult> {
  const host = hostname(headers);
  const c = config();
  if (!host || !approvedIngressHost(host) || !c) return {status:"unavailable"};
  try {
    const client = new ConvexHttpClient(c.url);
    const result = await client.action(api.functions.sites.public.resolvePublicSite,{hostname:host,routeId,gatewaySecret:c.secret});
    return admitSite(result,routeId,host);
  } catch { return {status:"unavailable"}; }
}
export async function resolvePath(headers: Pick<Headers,"get">, path: string): Promise<SiteResult & {routeId?: string}> {
  const host = hostname(headers);
  const c = config();
  if (!safePath(path) || !host || !approvedIngressHost(host) || !c) return {status:"unavailable"};
  try {
    const client = new ConvexHttpClient(c.url);
    const result = await client.action(api.functions.sites.public.resolvePublicPath,{hostname:host,path,gatewaySecret:c.secret});
    if (result.status !== "available") return {status:"unavailable"};
    const routeId = routeForPath(path,result.site.rendererKey,result.site.rendererSchemaVersion);
    if (!routeId) return {status:"unavailable"};
    const admitted = admitSite(result,routeId,host);
    return admitted.status === "available" ? {...admitted,routeId} : admitted;
  } catch { return {status:"unavailable"}; }
}
export async function assetBytes(headers: Pick<Headers,"get">, id: string): Promise<Response> {
  const denied = () => new Response(null,{status:404,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  const host = hostname(headers);
  const c = config();
  if (!host || !approvedIngressHost(host) || !c || !/^[a-zA-Z0-9_-]{8,100}$/.test(id)) return denied();
  try {
    const upstream = await fetch(`${c.siteUrl}/sites/asset-bytes`,{method:"POST",redirect:"manual",cache:"no-store",headers:{"Content-Type":"application/json","X-Sites-Gateway-Secret":c.secret,"X-Sites-Hostname":host},body:JSON.stringify({assetId:id}),signal:AbortSignal.timeout(10000)});
    const length = Number(upstream.headers.get("content-length"));
    const mime = upstream.headers.get("content-type");
    if (upstream.status !== 200 || !mime || !["image/png"].includes(mime) || (upstream.headers.has("content-length") && (!Number.isSafeInteger(length) || length < 0 || length > 5_000_000))) { await upstream.body?.cancel(); return denied(); }
    if (!upstream.body) return denied();
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5_000_000) { await reader.cancel(); return denied(); }
      chunks.push(value);
    }
    if (upstream.headers.has("content-length") && size !== length) return denied();
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
    return new Response(bytes,{status:200,headers:{"Content-Type":mime,"Content-Length":String(size),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch { return denied(); }
}
