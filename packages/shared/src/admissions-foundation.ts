/**
 * Stable cross-surface contracts for the admissions platform and managed sites.
 *
 * These types deliberately contain no Convex IDs, auth identifiers, or storage
 * identifiers so they can be consumed by sites, the future apply app, and
 * external onboarding material without expanding any authorization boundary.
 */

export const APPLICATION_LINK_VERSION = "1" as const;

export type ApplicationAvailabilityV1 =
  | "open"
  | "upcoming"
  | "paused"
  | "closed"
  | "unavailable";

export type ApplicationLinkV1 = {
  version: typeof APPLICATION_LINK_VERSION;
  schoolSlug: string;
  href: string;
  availability: ApplicationAvailabilityV1;
  intakeSlug: string | null;
  opensAt: number | null;
  closesAt: number | null;
};

export type SiteLinkIntentV1 =
  | { kind: "admissions_info" }
  | { kind: "application"; intakeSlug?: string }
  | { kind: "portal" }
  | { kind: "contact" }
  | { kind: "visit" }
  | { kind: "reviewed_external"; linkId: string };

export type PaymentDomainV1 = "billing" | "admissions";

export type PaymentReferenceV1 = {
  version: "1";
  domain: PaymentDomainV1;
  reference: string;
};

export type AdmissionsPermissionV1 =
  | "settings.view"
  | "settings.manage"
  | "site.preview"
  | "site.publish.standard"
  | "site.publish.sensitive"
  | "site.revert"
  | "site.domain.request"
  | "admissions.catalogue.manage"
  | "admissions.publish"
  | "admissions.sensitive.configure"
  | "privacy.approve"
  | "retention.manage"
  | "grants.manage"
  | "applications.list"
  | "applications.view_basic"
  | "applications.view_sensitive"
  | "documents.review"
  | "documents.download"
  | "reviews.assign"
  | "reviews.record"
  | "decisions.record"
  | "conversions.execute"
  | "audit.view";

export const ADMISSIONS_PERMISSIONS_V1: readonly AdmissionsPermissionV1[] = [
  "settings.view",
  "settings.manage",
  "site.preview",
  "site.publish.standard",
  "site.publish.sensitive",
  "site.revert",
  "site.domain.request",
  "admissions.catalogue.manage",
  "admissions.publish",
  "admissions.sensitive.configure",
  "privacy.approve",
  "retention.manage",
  "grants.manage",
  "applications.list",
  "applications.view_basic",
  "applications.view_sensitive",
  "documents.review",
  "documents.download",
  "reviews.assign",
  "reviews.record",
  "decisions.record",
  "conversions.execute",
  "audit.view",
] as const;

function normalizeConfiguredOrigin(origin: string): URL {
  const value = origin.trim();
  if (!value) throw new Error("Application origin is required");

  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Application origin must use http or https");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Application origin must be a bare origin");
  }
  parsed.pathname = "";
  return parsed;
}

function requirePublicSlug(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(normalized)) {
    throw new Error(`${label} must be a URL-safe slug`);
  }
  return normalized;
}

/** Builds the sole public application URL. Callers cannot supply an origin. */
export function buildApplicationLinkV1(input: {
  applicationOrigin: string;
  schoolSlug: string;
  availability: ApplicationAvailabilityV1;
  intakeSlug?: string | null;
  opensAt?: number | null;
  closesAt?: number | null;
}): ApplicationLinkV1 {
  const origin = normalizeConfiguredOrigin(input.applicationOrigin);
  const schoolSlug = requirePublicSlug(input.schoolSlug, "School slug");
  const intakeSlug = input.intakeSlug
    ? requirePublicSlug(input.intakeSlug, "Intake slug")
    : null;
  const path = intakeSlug
    ? `/s/${encodeURIComponent(schoolSlug)}/i/${encodeURIComponent(intakeSlug)}`
    : `/s/${encodeURIComponent(schoolSlug)}`;

  return {
    version: APPLICATION_LINK_VERSION,
    schoolSlug,
    href: new URL(path, origin).toString(),
    availability: input.availability,
    intakeSlug,
    opensAt: input.opensAt ?? null,
    closesAt: input.closesAt ?? null,
  };
}

export function classifyPaymentReferenceV1(reference: string): PaymentReferenceV1 {
  const normalized = reference.trim();
  if (!normalized) throw new Error("Payment reference is required");
  return {
    version: "1",
    domain: normalized.startsWith("adm_") ? "admissions" : "billing",
    reference: normalized,
  };
}

export function isAdmissionsPaymentReferenceV1(reference: string): boolean {
  return classifyPaymentReferenceV1(reference).domain === "admissions";
}
