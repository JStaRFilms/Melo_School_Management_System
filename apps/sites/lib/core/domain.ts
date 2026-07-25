import type { PublicDomainProjection } from "@/core/contracts";

export function normalizeHostname(input: string | null | undefined): string | null {
  if (!input) return null;
  const candidate = input.split(",")[0]?.trim().replace(/\.$/, "");
  if (!candidate) return null;
  const withoutIpv6Brackets = candidate.startsWith("[") ? candidate.slice(1, candidate.indexOf("]")) : candidate.split(":")[0];
  if (!withoutIpv6Brackets) return null;
  try {
    return new URL(`http://${withoutIpv6Brackets}`).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

export function getRequestHostname(headers: Pick<Headers, "get">): string | null {
  const host = headers.get("host");
  const localHost = normalizeHostname(host);
  const forwarded = normalizeHostname(headers.get("x-forwarded-host"));
  const trustProxy = process.env.SITE_TRUST_PROXY === "true";
  if (trustProxy && forwarded) return forwarded;
  if (localHost && (localHost === "localhost" || localHost.endsWith(".localhost")) && forwarded) return forwarded;
  return localHost;
}

export function canonicalScheme(): "http" | "https" {
  if (process.env.NODE_ENV === "production") return "https";
  return process.env.SITE_CANONICAL_SCHEME === "https" ? "https" : "http";
}

export function buildCanonicalOrigin(domain: PublicDomainProjection): string {
  return `${canonicalScheme()}://${domain.hostname}`;
}

export function getActiveCanonicalDomain(domains: readonly PublicDomainProjection[], canonicalDomainId?: string): PublicDomainProjection | null {
  const active = domains.filter((domain) => domain.status === "active");
  if (!canonicalDomainId) return null;
  const canonical = active.find((domain) => domain.id === canonicalDomainId);
  return canonical?.canonicalIntent === "canonical" ? canonical : null;
}

export function getRedirectTarget(domain: PublicDomainProjection, canonical: PublicDomainProjection): string | undefined {
  if (domain.hostname === canonical.hostname) return undefined;
  return domain.status === "active" && domain.canonicalIntent === "redirect" && domain.canonicalDomainId === canonical.id
    ? canonical.hostname
    : undefined;
}
