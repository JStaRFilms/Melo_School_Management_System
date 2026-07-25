import type { ApplicationLinkV1, SiteLinkIntentV1 } from "@/core/links";

export type SiteMode = "managed" | "external" | "none";
export type SiteProfileStatus = "draft" | "review" | "published" | "suspended" | "retired";
export type DomainLifecycle =
  | "requested"
  | "verification_pending"
  | "verified"
  | "routing_pending"
  | "certificate_pending"
  | "ready"
  | "active"
  | "suspended"
  | "retired";
export type RendererFieldValue =
  | { kind: "text"; value: string }
  | { kind: "rich_text"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "link_intent"; value: SiteLinkIntentV1 }
  | { kind: "asset_ref"; assetId: string }
  | { kind: "string_list"; value: readonly string[] };

export interface PublicDomainProjection {
  id: string;
  hostname: string;
  status: DomainLifecycle;
  canonicalIntent: "canonical" | "redirect";
  canonicalDomainId?: string;
}

export interface ApprovedPublicAsset {
  id: string;
  kind: "logo" | "favicon" | "hero" | "gallery" | "staff" | "facility" | "document" | "social_share";
  url: string;
  altText?: string;
  decorative: boolean;
}

export interface PublicSiteEnvelope {
  profile: {
    schoolId: string;
    schoolSlug: string;
    mode: SiteMode;
    status: SiteProfileStatus;
    rendererKey?: string;
    rendererSchemaVersion?: string;
    canonicalDomainId?: string;
  };
  domains: readonly PublicDomainProjection[];
  revision: {
    id: string;
    state: "published" | "draft";
    rendererKey: string;
    rendererSchemaVersion: string;
    publishedAt?: number;
    fields: Readonly<Record<string, RendererFieldValue>>;
    routeSeo: Readonly<Record<string, { title?: string; description?: string; shareAssetId?: string }>>;
  };
  assets: readonly (ApprovedPublicAsset & { rightsStatus: "approved"; status: "published"; rightsExpiresAt?: number })[];
  links: { application: ApplicationLinkV1; portal?: { href: string; enabled: true } };
  preview?: { authorized: true; expiresAt: number };
}

export interface PublicSchoolIdentity {
  id: string;
  slug: string;
  displayName?: string;
  shortName?: string;
}

export interface SiteRenderContext<TData = unknown> {
  school: PublicSchoolIdentity;
  fields: Readonly<Record<string, RendererFieldValue>>;
  assets: Readonly<Record<string, ApprovedPublicAsset>>;
  links: Readonly<{ application: ApplicationLinkV1; portal?: { href: string; enabled: true } }>;
  seo: Readonly<Record<string, { title?: string; description?: string; shareAsset?: ApprovedPublicAsset }>>;
  publication: { revisionId: string; publishedAt: number };
  request: { routeKey: string; canonicalUrl: string; preview: boolean; params: Readonly<Record<string, string>> };
  rendererData: TData;
}

export type SiteLoadResult =
  | { status: "available"; site: PublicSiteEnvelope; canonicalDomain: PublicDomainProjection; redirectToHostname?: string; preview: boolean }
  | { status: "unavailable"; reason: "unknown_host" | "inactive_domain" | "unpublished" | "invalid_content" | "unauthorized_preview" };
