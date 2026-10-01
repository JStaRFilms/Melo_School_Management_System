import { v } from "convex/values";
import { action, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { PublicSiteV1, PublicAssetV1, SiteFieldValueV1 } from "@school/shared/site-manifests";
import { siteManifest, routeIdAtPath } from "@school/shared/site-manifests";
import { approvedAsset, validatePublication } from "./shared";
import { applicationLinkAtTime } from "../foundation/applicationLinks";
import { currentProjectId, gatewayAuthorized, normalizeHostname, ready } from "./domainRules";

const unavailable = {status: "unavailable" as const};
async function state(ctx: Parameters<typeof approvedAsset>[0], hostname: string, now: number) {
  const project = currentProjectId(); if (!project) return null;
  const host = await ctx.db.query("schoolDomains").withIndex("by_hostname", q => q.eq("hostname",hostname)).take(2);
  if (host.length !== 1 || host[0].status !== "active" || !ready(host[0],now,project)) return null;
  const domain = host[0];
  const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school",q => q.eq("schoolId",domain.schoolId)).unique();
  const canonical = profile?.canonicalDomainId ? await ctx.db.get(profile.canonicalDomainId) : null;
  const school = await ctx.db.get(domain.schoolId);
  if (!school || school.status !== "active" || !profile || profile.mode !== "managed" || profile.status !== "published" || !profile.publishedRevisionId || !canonical || canonical.schoolId !== domain.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical" || !ready(canonical,now,project) || (domain.canonicalIntent === "redirect" && domain.canonicalDomainId !== canonical._id) || (domain.canonicalIntent === "canonical" && domain._id !== canonical._id)) return null;
  const revision = await ctx.db.get(profile.publishedRevisionId);
  if (!revision || revision.schoolId !== school._id || revision.state !== "published" || !revision.publishedByUserId || revision.rendererKey !== profile.rendererKey || revision.rendererSchemaVersion !== profile.rendererSchemaVersion || !revision.publishedAt) return null;
  const manifest = siteManifest(revision.rendererKey,revision.rendererSchemaVersion); if (!manifest) return null;
  try {const validated = await validatePublication(ctx,profile,revision.content,revision.publishedByUserId,now); if (validated.digest !== revision.contentDigest) return null;} catch {return null;}
  return {domain,canonical,school,revision,manifest};
}
const assetDTO = (asset: { _id: Id<"schoolSiteAssets">; kind: PublicAssetV1["kind"]; altText?: string; decorative: boolean }): PublicAssetV1 => ({id: asset._id, src: `/api/site-assets/${asset._id}`,kind:asset.kind,altText:asset.altText,decorative:asset.decorative});
export const publicAtTime = internalQuery({args: {hostname: v.string(), routeId: v.optional(v.string()), path: v.optional(v.string()), now: v.number()}, handler: async (ctx,args): Promise<{status: "unavailable"} | {status: "available"; site: PublicSiteV1}> => {
  const s = await state(ctx,args.hostname,args.now);
  if (!s || (args.path !== undefined ? !routeIdAtPath(s.manifest,args.path) : !s.manifest.routes.some(r => r.routeId === args.routeId))) return unavailable;
  const {school,revision,domain,canonical,manifest} = s;
  const fields: PublicSiteV1["fields"][number][] = [];
  for (const {fieldId,value} of revision.content.fields) {
    if (value.kind === "asset_ref") {
      const kind = manifest.fields.find(f => f.fieldId === fieldId)?.assetKind ?? "";
      const asset = await approvedAsset(ctx,school._id,value.assetId as Id<"schoolSiteAssets">,kind,args.now,revision.publishedByUserId!);
      if (asset.status !== "published") return unavailable;
      fields.push({fieldId,value:{kind:"asset_ref",asset:assetDTO(asset)}});
    } else if (value.kind === "link_intent") {
      const intent = value.value.kind;
      // Intents without a configured reviewed resolver cannot invent a destination.
      fields.push({fieldId,value:{kind:"link_intent",intent,href:null}});
    } else fields.push({fieldId,value: value as Exclude<SiteFieldValueV1,{kind:"asset_ref" | "link_intent"}>});
  }
  const routeSeo: PublicSiteV1["routeSeo"][number][] = [];
  for (const seo of revision.content.routeSeo) {
    let shareAsset: PublicAssetV1 | undefined;
    if (seo.shareAssetId) {
      const asset = await approvedAsset(ctx,school._id,seo.shareAssetId as Id<"schoolSiteAssets">,"social_share",args.now,revision.publishedByUserId!);
      if (asset.status !== "published") return unavailable;
      shareAsset = assetDTO(asset);
    }
    routeSeo.push({routeId:seo.routeId,title:seo.title,description:seo.description,shareAsset});
  }
  // This is the same ApplicationLinkV1 resolver as foundation, with trusted server time.
  const applicationLink = await applicationLinkAtTime(ctx,{schoolSlug:school.slug},args.now);
  return {status:"available",site:{version:"1",schoolSlug:school.slug,rendererKey:revision.rendererKey,rendererSchemaVersion:revision.rendererSchemaVersion,revisionId:revision._id,publishedAt:revision.publishedAt!,canonicalOrigin:`https://${canonical.hostname}`,activeHostname:domain.hostname,redirectToCanonical:domain._id !== canonical._id,routeIds:manifest.routes.map(r=>r.routeId),fields,routeSeo,applicationLink,portal:{availability:"unavailable"}}};
}});
export const resolvePublicSite = action({
  args: {hostname: v.string(), routeId: v.string(), gatewaySecret: v.string()},
  handler: async (ctx,args): Promise<{status: "unavailable"} | {status: "available"; site: PublicSiteV1}> => {
    if (!gatewayAuthorized(args.gatewaySecret)) return unavailable;
    let hostname: string; try {hostname = normalizeHostname(args.hostname); if (hostname !== args.hostname.toLowerCase().replace(/\.$/,"")) return unavailable;} catch {return unavailable;}
    try {return await ctx.runQuery(internal.functions.sites.public.publicAtTime,{hostname,routeId:args.routeId,now:Date.now()});} catch {return unavailable;}
  },
});
export const resolvePublicPath = action({
  args: {hostname: v.string(), path: v.string(), gatewaySecret: v.string()},
  handler: async (ctx,args): Promise<{status: "unavailable"} | {status: "available"; site: PublicSiteV1}> => {
    if (!gatewayAuthorized(args.gatewaySecret) || args.path.length > 1024) return unavailable;
    let hostname: string; try {hostname = normalizeHostname(args.hostname); if (hostname !== args.hostname.toLowerCase().replace(/\.$/,"")) return unavailable;} catch {return unavailable;}
    try {return await ctx.runQuery(internal.functions.sites.public.publicAtTime,{hostname,path:args.path,now:Date.now()});} catch {return unavailable;}
  },
});
export const assetAtTime = internalQuery({args: {hostname:v.string(),assetId:v.id("schoolSiteAssets"),now:v.number()},handler: async (ctx,args) => {
  const s = await state(ctx,args.hostname,args.now); if (!s) return null;
  const {revision,school,manifest} = s;
  const kind = revision.content.fields.flatMap(f => f.value.kind === "asset_ref" && f.value.assetId === args.assetId ? [manifest.fields.find(def => def.fieldId === f.fieldId)?.assetKind ?? ""] : []).concat(revision.content.routeSeo.some(seo => seo.shareAssetId === args.assetId) ? ["social_share"] : [])[0];
  if (!kind) return null;
  try {
    const asset = await approvedAsset(ctx,school._id,args.assetId,kind,args.now,revision.publishedByUserId!);
    if (asset.status !== "published") return null;
    return {storageId:asset.storageId,mediaType:asset.mediaType};
  } catch {return null;}
}});
