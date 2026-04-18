import type { CSSProperties } from "react";
import type { Metadata } from "next";

/* ─── Navigation ─── */
export type SiteNavigationItem = {
  href: string;
  label: string;
};

/* ─── Brand ─── */
export const siteBrand = {
  name: "Melo",
  tagline: "School management, simplified.",
  description:
    "Melo is one platform for everything your school needs — admin, academics, billing, and parent communication — built for how Nigerian schools actually run.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://meloschool.com",
  phone: "+234 812 345 6789",
  email: "hello@meloschool.com",
  address: "Lagos, Nigeria",
  hours: "Monday – Friday, 9 am – 5 pm",
} as const;

export const siteNavigation: SiteNavigationItem[] = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

/* ─── Homepage Data ─── */
export const capabilities = [
  {
    title: "Student Records",
    description: "Admissions, enrollment, class placement, and complete academic histories — all in one place.",
  },
  {
    title: "Result Management",
    description: "Grade entry, broadsheets, report cards, and cumulative results across all terms.",
  },
  {
    title: "Fee Collection",
    description: "Invoice generation, Paystack integration, payment tracking, and real-time financial reporting.",
  },
  {
    title: "Teacher Workbench",
    description: "Attendance, grade entry, and class management built for teachers who need to move fast.",
  },
  {
    title: "Parent Portal",
    description: "Results, invoices, payment history and attendance — parents see what matters, when it matters.",
  },
  {
    title: "School Website",
    description: "A public-facing site for your school, managed from the same platform. No external tools needed.",
  },
];

export const trustPoints = [
  { metric: "99.9%", label: "Uptime guarantee" },
  { metric: "< 2s", label: "Average page load" },
  { metric: "256-bit", label: "Data encryption" },
];

/* ─── Features Page Data ─── */
export const featureGroups = [
  {
    group: "Operations",
    features: [
      {
        title: "Multi-session & Term Management",
        description: "Configure academic sessions, terms, and class structures. Support for Nigerian school calendar patterns.",
      },
      {
        title: "Student & Staff Profiles",
        description: "Comprehensive records with enrollment tracking, guardian details, and document management.",
      },
      {
        title: "Attendance Tracking",
        description: "Daily attendance with absence flagging, reports, and parent notification triggers.",
      },
    ],
  },
  {
    group: "Academics",
    features: [
      {
        title: "Grade Entry & Broadsheets",
        description: "Teachers enter marks, the system generates broadsheets, rankings, and cumulative reports automatically.",
      },
      {
        title: "Report Card Generation",
        description: "Beautiful, printable report cards with school branding, principal remarks, and attendance summaries.",
      },
      {
        title: "Subject & Class Configuration",
        description: "Flexible subject assignment, class arms, and teacher-subject mapping across the school.",
      },
    ],
  },
  {
    group: "Finance",
    features: [
      {
        title: "Fee Plans & Invoicing",
        description: "Create fee structures, generate bulk invoices, and track payment status per student.",
      },
      {
        title: "Online Payments",
        description: "Paystack-powered collection with automatic reconciliation and digital receipts.",
      },
      {
        title: "Financial Reports",
        description: "Revenue dashboards, outstanding balance tracking, and term-by-term financial summaries.",
      },
    ],
  },
];

/* ─── Pricing Page Data ─── */
export const pricingTiers = [
  {
    name: "Starter",
    price: "₦50,000",
    period: "/term",
    description: "For small schools getting started with digital operations.",
    features: [
      "Up to 200 students",
      "Admin & teacher access",
      "Student records & grades",
      "Basic report cards",
      "Email support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "₦120,000",
    period: "/term",
    description: "For established schools that need the complete toolkit.",
    features: [
      "Up to 800 students",
      "Everything in Starter",
      "Online fee collection",
      "Parent portal access",
      "Branded report cards",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "Custom",
    period: "",
    description: "For large schools and multi-campus operations.",
    features: [
      "Unlimited students",
      "Everything in Growth",
      "Multi-campus support",
      "Managed school website",
      "Dedicated account manager",
      "Custom integrations",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

/* ─── Contact Page Data ─── */
export const contactMethods = [
  {
    label: "Email",
    value: siteBrand.email,
    href: `mailto:${siteBrand.email}`,
    description: "For general inquiries and support",
  },
  {
    label: "Phone",
    value: siteBrand.phone,
    href: `tel:${siteBrand.phone.replace(/\s+/g, "")}`,
    description: "Speak to someone directly",
  },
  {
    label: "Office",
    value: siteBrand.address,
    href: "#",
    description: siteBrand.hours,
  },
];

/* ─── SEO ─── */
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
  const shareTitle = `${title} — ${siteBrand.name}`;

  return {
    title,
    description,
    alternates: { canonical: url },
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
    robots: { index: true, follow: true },
  };
}

export function toJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
