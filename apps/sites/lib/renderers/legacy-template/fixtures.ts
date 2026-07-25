import { legacyDemoSchools } from "@/renderers/legacy-template/legacy-data";

const publishedAt = Date.UTC(2025, 0, 1);

/** Explicit non-production compatibility projection; never a B0 seed source. */
export function getLegacyEnvelopeForHostname(hostname: string) {
  const school = legacyDemoSchools.find((candidate) => candidate.status === "active" && candidate.domains.some((domain) => domain.hostname === hostname));
  if (!school) return null;
  const canonical = school.domains.find((domain) => domain.isCanonical && domain.status === "active");
  if (!canonical) return null;
  return {
    profile: { schoolId: `legacy:${school.key}`, schoolSlug: school.key, mode: "managed", status: "published", rendererKey: "legacy-template", rendererSchemaVersion: "1", canonicalDomainId: canonical.id },
    domains: school.domains.map((domain) => ({ id: domain.id, hostname: domain.hostname, status: domain.status === "active" && domain.readiness === "ready" && domain.sslStatus === "ready" ? "active" : "verification_pending", canonicalIntent: domain.canonicalIntent, canonicalDomainId: domain.canonicalIntent === "redirect" ? canonical.id : undefined })),
    revision: { id: `legacy-revision:${school.key}`, state: "published", rendererKey: "legacy-template", rendererSchemaVersion: "1", publishedAt, fields: { schoolKey: { kind: "text", value: school.key } }, routeSeo: {} },
    assets: [],
    links: { application: { version: "1", schoolSlug: school.key, href: "https://unavailable.invalid/", availability: "unavailable", intakeSlug: null, opensAt: null, closesAt: null } },
  };
}
