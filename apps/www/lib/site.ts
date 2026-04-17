import type { CSSProperties } from "react";
import type { Metadata } from "next";

export type SiteNavigationItem = {
  href: string;
  label: string;
};

export const siteBrand = {
  name: "SchoolOS",
  shortName: "SchoolOS",
  tagline: "The operating system for school owners and operators.",
  description:
    "SchoolOS helps schools run admin, teaching, family access, billing, and public web from separate, tenant-aware surfaces.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  phone: "+234 812 345 6789",
  salesEmail: "hello@schoolos.example",
  email: "hello@schoolos.example",
  address: "Lagos, Nigeria",
  hours: "Monday to Friday, 9:00am to 5:00pm",
  colors: {
    primary: "#173B72",
    secondary: "#0F766E",
    accent: "#C08B2E",
    background: "#F8FAFC",
    surface: "#FFFFFF",
    ink: "#0F172A",
    muted: "#475569",
  },
} as const;

export const siteNavigation: SiteNavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "Overview" },
  { href: "/academics", label: "Modules" },
  { href: "/admissions", label: "Packages" },
  { href: "/fees", label: "Commercials" },
  { href: "/visit", label: "Demo" },
  { href: "/contact", label: "Contact" },
];

export const homeSellingPoints = [
  {
    title: "Separate public and workspace surfaces",
    description:
      "The marketing site explains the product; admin, teacher, and portal work stays behind workspace sign-in.",
  },
  {
    title: "Built for one real school first",
    description:
      "The product can launch with a single school and still keep multi-school boundaries ready for later growth.",
  },
  {
    title: "Commercials stay separate from school fees",
    description:
      "Setup fees, recurring access, and optional upgrades live outside the student billing flow.",
  },
];

export const academicTracks = [
  {
    title: "Core operations",
    description:
      "School setup, classes, sessions, terms, subjects, and teacher assignments live in one bounded workspace.",
  },
  {
    title: "Family access",
    description:
      "Parent and student portal entry points, notifications, and status visibility stay connected but separate.",
  },
  {
    title: "Public web path",
    description:
      "The public site markets the platform now while future managed school websites arrive through T20-T23.",
  },
];

export const aboutMilestones = [
  {
    title: "Clear product story",
    description:
      "Explain SchoolOS in language that school buyers can act on without mixing it into admissions copy.",
  },
  {
    title: "One tenant at a time",
    description:
      "Keep the first rollout simple while preserving school-scoped data boundaries for later growth.",
  },
  {
    title: "Commercial separation",
    description:
      "Keep platform packaging distinct from student fee collection and school billing.",
  },
  {
    title: "Future-ready public web",
    description:
      "Leave room for managed school websites later without forcing that work into the marketing site now.",
  },
];

export const admissionsSteps = [
  {
    title: "Discover the fit",
    description:
      "Review the modules, pricing model, and operating boundaries to see whether the product matches the school.",
  },
  {
    title: "Plan the rollout",
    description:
      "Agree on setup, support, and the first school workflows that need to go live.",
  },
  {
    title: "Launch the workspace",
    description:
      "Move into internal platform onboarding and configure the school tenant.",
  },
  {
    title: "Expand later",
    description:
      "Add public-web or other service layers when the school is ready.",
  },
];

export const feeHighlights = [
  {
    title: "Setup fee",
    description:
      "One-time onboarding, launch help, and brand kickoff for the school.",
  },
  {
    title: "Recurring platform access",
    description:
      "Term-based or annual access to the modules included in the package.",
  },
  {
    title: "Optional upgrades",
    description:
      "Managed services and add-ons stay separate from the base tier.",
  },
];

export const visitMoments = [
  {
    title: "Short discovery call",
    description:
      "Discuss the school's current setup, goals, and operating constraints.",
  },
  {
    title: "Focused product walkthrough",
    description:
      "See the admin, teacher, and family surfaces without any admissions-style detour.",
  },
  {
    title: "Commercial alignment",
    description:
      "Confirm package fit, service level, and rollout path.",
  },
];

export const contactChannels = [
  {
    label: "Sales email",
    value: siteBrand.salesEmail,
    href: `mailto:${siteBrand.salesEmail}`,
  },
  {
    label: "Sales line",
    value: siteBrand.phone,
    href: `tel:${siteBrand.phone.replace(/\s+/g, "")}`,
  },
  {
    label: "Office hours",
    value: siteBrand.hours,
    href: "/contact",
  },
];

export function siteThemeStyle(): CSSProperties {
  return {
    ["--school-primary" as never]: siteBrand.colors.primary,
    ["--school-secondary" as never]: siteBrand.colors.secondary,
    ["--school-accent" as never]: siteBrand.colors.accent,
    ["--school-background" as never]: siteBrand.colors.background,
    ["--school-surface" as never]: siteBrand.colors.surface,
    ["--school-ink" as never]: siteBrand.colors.ink,
    ["--school-muted" as never]: siteBrand.colors.muted,
  } as CSSProperties;
}

export function buildPageMetadata({
  title,
  description = siteBrand.description,
  path = "/",
}: {
  title: string;
  description?: string;
  path?: string;
}): Metadata {
  const url = new URL(path, siteBrand.siteUrl).toString();
  const shareTitle = `${title} | ${siteBrand.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: shareTitle,
      description,
      url,
      siteName: siteBrand.name,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: shareTitle,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function toJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
