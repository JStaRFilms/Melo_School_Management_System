import type { Doc } from "../../_generated/dataModel";

export const FRESH_MS = 15 * 60_000;
export const CHALLENGE_MS = 30 * 24 * 60 * 60_000;
export const PROBE_PATH = "/.well-known/school-sites-deployment";
export const PROBE_BODY = "school-sites-production-core:v1\n";

export function normalizeHostname(input: string): string {
  if (typeof input !== "string" || input.length > 254 || input.trim() !== input) throw Error("Invalid hostname");
  const host = input.toLowerCase().replace(/\.$/, "");
  if (host.length > 253 || !host.includes(".") || !host.split(".").every(label => label.length >= 1 && label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) ||
    /^(localhost|local|internal|test|invalid|example|onion|lan|home|arpa)$/.test(host.split(".").at(-1)!) ||
    ["example.com", "example.net", "example.org"].some(s => host === s || host.endsWith(`.${s}`)) || host.endsWith(".vercel.app") || host.endsWith(".convex.site") || host.endsWith(".localhost") || /^\d+(?:\.\d+){3}$/.test(host)) throw Error("Invalid hostname");
  return host;
}

export function ready(domain: Doc<"schoolDomains">, now: number, projectId: string): boolean {
  const {ownershipObservation: owner, providerRoutingObservation: route, tlsObservation: tls} = domain;
  const fresh = (at: number) => Number.isFinite(at) && at <= now && now - at < FRESH_MS;
  return (domain.status === "ready" || domain.status === "active") && !domain.providerOperation && !!domain.verificationGeneration &&
    !!domain.verificationTokenHash && !!domain.verificationExpiresAt && domain.verificationExpiresAt > now &&
    !!owner && owner.generation === domain.verificationGeneration && owner.tokenHash === domain.verificationTokenHash && fresh(owner.observedAt) &&
    !!route && route.generation === domain.verificationGeneration && route.projectId === projectId && route.projectDomainVerified && !route.misconfigured &&
    (route.configuredBy === "A" || route.configuredBy === "CNAME") && fresh(route.observedAt) &&
    !!tls && tls.generation === domain.verificationGeneration && tls.deploymentProbeMatched && /^[a-f0-9]{64}$/.test(tls.leafFingerprintSha256) &&
    tls.leafNotAfter > now + 24 * 60 * 60_000 && fresh(tls.observedAt);
}

export function providerSettings(): {projectId: string; teamId: string | undefined; token: string} | null {
  const projectId = process.env.SITES_VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.SITES_VERCEL_TEAM_ID?.trim();
  const token = process.env.SITES_VERCEL_API_TOKEN?.trim();
  if (!projectId || !/^prj_[A-Za-z0-9]{12,80}$/.test(projectId) || (teamId && !/^team_[A-Za-z0-9]{12,80}$/.test(teamId)) || !token || token.length < 24 || /^(change|placeholder|example|test)/i.test(token)) return null;
  return {projectId, teamId, token};
}
export function currentProjectId(): string | null { return providerSettings()?.projectId ?? null; }
export function gatewayConfigured(): boolean {
  const secret = process.env.SITES_GATEWAY_SECRET;
  return !!secret && secret.length >= 32 && !/^(change|placeholder|example|test)/i.test(secret);
}
export function gatewayAuthorized(value: string | null): boolean {
  // Never use client-side or NEXT_PUBLIC values. A missing/placeholder key closes the gate.
  return gatewayConfigured() && value === process.env.SITES_GATEWAY_SECRET;
}
