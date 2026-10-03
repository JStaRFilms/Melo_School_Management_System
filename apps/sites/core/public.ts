import type { PublicSiteV1, PublicAssetV1, PublicFieldValueV1, SiteManifestV1 } from "@school/shared/site-manifests";
import { siteManifest, routeIdAtPath, validSiteEmail, oliveSeoCopyMatches } from "@school/shared/site-manifests";
import { normalizeThemeColor } from "@school/shared/theme";

export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type ProductionSiteContext = DeepReadonly<PublicSiteV1>;
export type PrivateReviewContext = { readonly kind: "private-review"; readonly watermark: string };
const unavailable = { status: "unavailable" as const };
export type SiteResult = typeof unavailable | { status: "available"; site: ProductionSiteContext };
const assetId = /^[a-zA-Z0-9_-]{8,100}$/;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text = (v: unknown, max: number) => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v && !/[<>\u0000-\u001f\u007f]/u.test(v) && !/\b(?:javascript:|data:|url\s*\(|@import)\b/iu.test(v);
const exact = (v: unknown, keys: string[]) => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every(k => keys.includes(k));
export function hostname(headers: Pick<Headers,"get">): string | null {
  const raw = headers.get("host");
  if (!raw || raw.length > 253 || raw !== raw.trim() || raw.includes(":") || raw.includes(",")) return null;
  const host = raw.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || !host.split(".").every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  return host;
}
export function routeForPath(path: string, key: string, version: string): string | null {
  if (!safePath(path)) return null;
  const descriptor = siteManifest(key,version);
  return descriptor ? routeIdAtPath(descriptor,path) : null;
}
export function safePath(path: string): boolean {
  return path.length <= 1024 && path.startsWith("/") && !path.startsWith("//") && !/[\\\u0000-\u001f\u007f%?#]/.test(path) && !path.split("/").some(s => s === "." || s === "..");
}
export function safeQuery(query: string): boolean {
  return query.length <= 2048 && !/[\\\u0000-\u001f\u007f]/.test(query) && !/%(?:5c|00|0[0-9a-f]|7f|25)/i.test(query);
}
export function canonicalRedirect(site: ProductionSiteContext, path: string, query = ""): string | null {
  if (!site.redirectToCanonical || !safePath(path) || !safeQuery(query) || !siteManifest(site.rendererKey,site.rendererSchemaVersion)?.routes.some(r => r.path === path) || !validOrigin(site)) return null;
  return `${site.canonicalOrigin}${path}${query}`;
}
export function applyDestination(site: ProductionSiteContext): string | null {
  const link = site.applicationLink;
  if (link.version !== "1" || link.availability !== "open" || link.schoolSlug !== site.schoolSlug || typeof link.href !== "string") return null;
  try { const u = new URL(link.href); return u.protocol === "https:" && !u.username && !u.password && !u.hash && !u.search && new RegExp(`^/s/${site.schoolSlug}(?:/i/[a-z0-9]+(?:-[a-z0-9]+)*)?$`).test(u.pathname) && !/[\\\u0000-\u001f]/.test(link.href) ? link.href : null; } catch { return null; }
}
function validOrigin(s: PublicSiteV1): boolean {
  const host = s.canonicalOrigin.slice(8);
  return s.canonicalOrigin === `https://${host}` && host.includes(".") && host.split(".").every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) && s.activeHostname.length > 0;
}
function validAsset(a: PublicAssetV1): boolean {
  return exact(a,["id","src","kind","altText","decorative"]) && assetId.test(a.id) && a.src === `/api/site-assets/${a.id}` && ["logo","favicon","hero","gallery","staff","facility","document","social_share"].includes(a.kind) && typeof a.decorative === "boolean" && (a.altText === undefined || text(a.altText,300));
}
export function validPublicFieldValue(def: SiteManifestV1["fields"][number], value: PublicFieldValueV1): boolean {
  if (!value || value.kind !== def.kind) return false;
  if (value.kind === "text") return exact(value,["kind","value"]) && text(value.value,def.maxLength ?? 500);
  if (value.kind === "asset_ref") return exact(value,["kind","asset"]) && validAsset(value.asset) && value.asset.kind === def.assetKind;
  if (value.kind === "boolean") return exact(value,["kind","value"]) && typeof value.value === "boolean";
  if (value.kind === "string_list") return exact(value,["kind","value"]) && Array.isArray(value.value) && value.value.length <= 12 && value.value.every((item: unknown) => text(item,def.maxLength ?? 120));
  if (value.kind === "link_intent") return exact(value,["kind","intent","href"]) && value.href === null && ["admissions_info","application","portal","contact","visit"].includes(value.intent);
  return false; // rich_text needs a registered AST parser.
}
function freeze<T>(v: T): DeepReadonly<T> {
  if (v && typeof v === "object") { for (const child of Object.values(v)) freeze(child); Object.freeze(v); }
  return v as DeepReadonly<T>;
}
export function admitSite(value: unknown, routeId: string, host: string): SiteResult {
  if (!exact(value,["status","site"]) || (value as {status?: unknown}).status !== "available") return unavailable;
  const s = (value as {site?: PublicSiteV1}).site;
  if (!s || !exact(s,["version","schoolSlug","rendererKey","rendererSchemaVersion","revisionId","publishedAt","canonicalOrigin","activeHostname","redirectToCanonical","routeIds","fields","routeSeo","applicationLink","portal"])) return unavailable;
  const m = siteManifest(s.rendererKey,s.rendererSchemaVersion);
  if (!m || s.version !== "1" || !slug.test(s.schoolSlug) || !s.revisionId || !Number.isFinite(s.publishedAt) || s.publishedAt <= 0 || s.publishedAt > Date.now() || !validOrigin(s) || s.activeHostname !== host || typeof s.redirectToCanonical !== "boolean" || (s.redirectToCanonical === (s.canonicalOrigin === `https://${host}`)) || !Array.isArray(s.routeIds) || s.routeIds.length !== m.routes.length || !m.routes.every((r,i) => s.routeIds[i] === r.routeId) || !m.routes.some(r => r.routeId === routeId) || !Array.isArray(s.fields) || !Array.isArray(s.routeSeo)) return unavailable;
  if (!exact(s.applicationLink,["version","schoolSlug","href","availability","intakeSlug","opensAt","closesAt"]) || s.applicationLink.schoolSlug !== s.schoolSlug || s.applicationLink.version !== "1" || typeof s.applicationLink.href !== "string" || !["open","upcoming","paused","closed","unavailable"].includes(s.applicationLink.availability) || (s.applicationLink.intakeSlug !== null && (typeof s.applicationLink.intakeSlug !== "string" || !slug.test(s.applicationLink.intakeSlug))) || ![s.applicationLink.opensAt,s.applicationLink.closesAt].every(t => t === null || (typeof t === "number" && Number.isFinite(t) && t > 0)) || (s.applicationLink.availability === "open" && !applyDestination(s))) return unavailable;
  if (!exact(s.portal,["availability"]) || s.portal.availability !== "unavailable") return unavailable;
  const fields = new Set<string>();
  for (const f of s.fields) {
    if (!exact(f,["fieldId","value"]) || fields.has(f.fieldId)) return unavailable;
    fields.add(f.fieldId);
    const def = m.fields.find(d => d.fieldId === f.fieldId);
    if (!def || !validPublicFieldValue(def,f.value)) return unavailable;
    if (m.rendererKey === "obhis-v1" && f.value.kind === "asset_ref" && (f.value.asset.decorative || !f.value.asset.altText)) return unavailable;
    if (m.rendererKey === "obhis-v1" && f.value.kind === "text") {
      if (["primary_color", "accent_color"].includes(f.fieldId) && (!normalizeThemeColor(f.value.value) || normalizeThemeColor(f.value.value) !== f.value.value.toLowerCase())) return unavailable;
      if (f.fieldId === "phone" && !/^\+[1-9]\d{6,14}$/.test(f.value.value)) return unavailable;
      if (f.fieldId === "email" && !validSiteEmail(f.value.value)) return unavailable;
    }
  }
  if (m.fields.some(f => f.required && !fields.has(f.fieldId))) return unavailable;
  const textField = (id: string) => {
    const value = s.fields.find(field => field.fieldId === id)?.value;
    return value?.kind === "text" ? value.value : undefined;
  };
  for (const def of m.fields) {
    if (!def.altFieldId) continue;
    const value = s.fields.find(field => field.fieldId === def.fieldId)?.value;
    if (value?.kind !== "asset_ref" || value.asset.altText !== textField(def.altFieldId)) return unavailable;
  }
  const seo = new Set<string>();
  for (const r of s.routeSeo) {
    if (!exact(r,["routeId","title","description","shareAsset"]) || seo.has(r.routeId) || !m.routes.some(mr => mr.routeId === r.routeId) || (r.title !== undefined && !text(r.title,120)) || (r.description !== undefined && !text(r.description,300)) || (r.shareAsset !== undefined && (!validAsset(r.shareAsset) || r.shareAsset.kind !== "social_share"))) return unavailable;
    if (m.rendererKey === "obhis-v1" && (r.shareAsset !== undefined || !oliveSeoCopyMatches(r, textField("school_name"), textField("intro")))) return unavailable;
    seo.add(r.routeId);
  }
  return {status:"available",site:freeze(structuredClone(s))};
}
