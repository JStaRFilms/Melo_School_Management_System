import type { CSSProperties } from "react";
import type { Metadata } from "next";

export type SiteNavigationItem = {
  href: string;
  label: string;
};

export const siteBrand = {
  name: "Cedar Grove Academy",
  shortName: "Cedar Grove",
  tagline: "A calm, ambitious school community.",
  description:
    "Cedar Grove Academy is a private school for families who want strong academics, thoughtful pastoral care, and a clear admissions journey.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
  phone: "+234 812 345 6789",
  admissionsPhone: "+234 812 345 6790",
  email: "admissions@cedargroveacademy.edu.ng",
  address: "14 Admiralty Way, Lekki Phase 1, Lagos",
  hours: "Monday to Friday, 8:00am to 4:00pm",
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
  { href: "/about", label: "About" },
  { href: "/academics", label: "Academics" },
  { href: "/admissions", label: "Admissions" },
  { href: "/fees", label: "Fees" },
  { href: "/visit", label: "Visit" },
  { href: "/contact", label: "Contact" },
];

export const homeSellingPoints = [
  {
    title: "Clear expectations",
    description:
      "Families know what learning looks like, how progress is shared, and who to speak to when they need support.",
  },
  {
    title: "Strong teaching rhythm",
    description:
      "Teachers plan lessons deliberately, keep routines consistent, and help every learner move forward with confidence.",
  },
  {
    title: "Warm school culture",
    description:
      "Children are known by name, encouraged to ask questions, and guided by adults who care about more than grades.",
  },
];

export const academicTracks = [
  {
    title: "Early Years",
    description:
      "Play-rich foundations build language, curiosity, number sense, and confidence in a nurturing environment.",
  },
  {
    title: "Primary",
    description:
      "Structured literacy, numeracy, science, and creative subjects move children from basic skills into steady mastery.",
  },
  {
    title: "Secondary",
    description:
      "Subject specialists prepare students for examinations, leadership, and life beyond the classroom.",
  },
];

export const aboutMilestones = [
  {
    title: "Foundations first",
    description:
      "The school culture begins with simple routines that make children feel safe, seen, and ready to learn.",
  },
  {
    title: "Teaching with structure",
    description:
      "Lesson planning and feedback keep every class moving with clarity, pace, and room for questions.",
  },
  {
    title: "Family partnership",
    description:
      "Parents are kept informed so they can support learning at home and understand the school journey.",
  },
  {
    title: "Future-ready growth",
    description:
      "As children mature, the school strengthens independence, leadership, and preparation for the next step.",
  },
];

export const admissionsSteps = [
  {
    title: "Make an enquiry",
    description:
      "Call, email, or visit our contact page and tell us the class level your child is joining.",
  },
  {
    title: "Visit the campus",
    description:
      "Meet the team, see the classrooms, and ask practical questions about learning and daily routines.",
  },
  {
    title: "Submit the basics",
    description:
      "Share the required documents, previous school records, and any helpful notes about your child.",
  },
  {
    title: "Complete enrolment",
    description:
      "Once places are confirmed, we guide families through the final onboarding steps with care.",
  },
];

export const feeHighlights = [
  {
    title: "Transparent term structure",
    description:
      "Tuition, activity costs, and optional extras are explained clearly before a family commits.",
  },
  {
    title: "Simple payment conversations",
    description:
      "The bursary team helps families understand the schedule, due dates, and the right place to ask for support.",
  },
  {
    title: "No hidden-school surprises",
    description:
      "We keep communication direct so parents can plan ahead without guessing what comes next.",
  },
];

export const visitMoments = [
  {
    title: "Welcome and overview",
    description:
      "We start with the school story, age ranges, and the learning culture families will experience each day.",
  },
  {
    title: "Classroom walk-through",
    description:
      "See the spaces where children learn, play, and move through the school day with steady support.",
  },
  {
    title: "Admissions conversation",
    description:
      "Finish with practical next steps, including class availability, fees, and documents to prepare.",
  },
];

export const contactChannels = [
  {
    label: "Admissions line",
    value: siteBrand.admissionsPhone,
    href: `tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}`,
  },
  {
    label: "Admissions email",
    value: siteBrand.email,
    href: `mailto:${siteBrand.email}`,
  },
  {
    label: "Campus address",
    value: siteBrand.address,
    href: "/visit",
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
