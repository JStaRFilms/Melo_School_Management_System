import type { ApplicationAvailabilityV1, ApplicationLinkV1, SiteLinkIntentV1 } from "@school/shared/admissions-foundation";

export type { ApplicationAvailabilityV1, ApplicationLinkV1, SiteLinkIntentV1 };

export function unavailableApplicationLink(schoolSlug: string): ApplicationLinkV1 {
  return { version: "1", schoolSlug, href: "", availability: "unavailable", intakeSlug: null, opensAt: null, closesAt: null };
}

function isSafeAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isApplicationLinkV1(value: unknown): value is ApplicationLinkV1 {
  if (!value || typeof value !== "object") return false;
  const link = value as Partial<ApplicationLinkV1>;
  return link.version === "1" && typeof link.schoolSlug === "string" && typeof link.href === "string" && isSafeAbsoluteHttpUrl(link.href)
    && ["open", "upcoming", "paused", "closed", "unavailable"].includes(link.availability ?? "")
    && (typeof link.intakeSlug === "string" || link.intakeSlug === null)
    && (typeof link.opensAt === "number" || link.opensAt === null)
    && (typeof link.closesAt === "number" || link.closesAt === null);
}

/** A CTA may only navigate when B0 explicitly reports an open application. */
export function applicationCtaHref(link: ApplicationLinkV1): string | null {
  return link.availability === "open" && isSafeAbsoluteHttpUrl(link.href) ? link.href : null;
}

/** `/apply` preserves only bounded attribution and starts from B0's exact href. */
export function buildApplicationRedirectHref(link: ApplicationLinkV1, requestUrl: URL): string | null {
  const href = applicationCtaHref(link);
  if (!href) return null;
  const destination = new URL(href);
  for (const key of ["source", "campaign"]) {
    const value = requestUrl.searchParams.get(key);
    if (value && value.length <= 100 && /^[a-zA-Z0-9._~-]+$/.test(value)) destination.searchParams.set(key, value);
  }
  return destination.toString();
}

export function isSafePortalLink(value: unknown): value is { href: string; enabled: true } {
  return Boolean(value && typeof value === "object" && (value as { enabled?: unknown }).enabled === true
    && typeof (value as { href?: unknown }).href === "string" && isSafeAbsoluteHttpUrl((value as { href: string }).href));
}

/** Shared integration projection for managed, external, and no-site schools. */
export function getPublicLinkIntegration(input: { mode: "managed" | "external" | "none"; application: ApplicationLinkV1; portal?: { href: string; enabled: true } }) {
  return {
    mode: input.mode,
    application: { availability: input.application.availability, href: applicationCtaHref(input.application) },
    ...(input.portal?.enabled ? { portal: input.portal } : {}),
  } as const;
}
