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
    "Melo is the unified operating system for Nigerian schools — from academics and billing to parent visibility, built for how your institution actually runs.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://meloschool.com",
  phone: "+234 815 265 7887", // Keep placeholder or update if you have the studio line
  email: "melo@jstarstudios.com",
  address: "Abuja, Nigeria",
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
    description: "Automated enrollment, class placement, and session-aware academic histories that follow every student.",
  },
  {
    title: "Academic Command",
    description: "Grade entry, broadsheet compilation, and professional report cards that reflect your school's standards.",
  },
  {
    title: "Billing Clarity",
    description: "Invoice generation, Paystack collection, and real-time debt tracking built for the school bursary.",
  },
  {
    title: "Staff Coordination",
    description: "Attendance, approval chains, and teacher-subject mapping that keeps your academic team in sync.",
  },
  {
    title: "Family Visibility",
    description: "A secure portal where parents track performance and clear fees without needing to visit the office.",
  },
  {
    title: "Public Presence",
    description: "A professional school website that syncs your admissions and results directly from the dashboard.",
  },
];

export const operationalProof = [
  { value: "Draft to Publish", label: "Academic results workflow" },
  { value: "Session-Aware", label: "Automated term management" },
  { value: "Audit-Ready", label: "Fee, invoice & balance tracking" },
];

export const workflowMarkers = [
  "Session synchronization",
  "Broadsheet automated compilation",
  "Billing hierarchy tracking",
  "Parent visibility control",
  "Teacher-subject mapping",
  "Academic approval chains",
  "Debt tracking & reconciliation",
  "Attendance trend flagging",
  "Cumulative GPA reporting",
  "Digital payment receipting",
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

/* ─── Pricing Page Data (Per-Student Pricing Model) ─── */
export const pricingTiers = [
  {
    name: "Core Operations",
    price: "₦1,000",
    period: "/student /term",
    setupFee: "Starting from ₦30,000 setup",
    description: "Core operating system for private schools getting started with automated broadsheets.",
    features: [
      "School admin & teacher workspaces",
      "Academic setup, broadsheets & results",
      "Standard WAEC / NECO grading rules",
      "Printable report cards & result slips",
      "Session-aware student records archive",
      "Standard email & WhatsApp support",
    ],
    cta: "Get started with Core",
    highlighted: false,
  },
  {
    name: "Standard",
    price: "₦1,200",
    period: "/student /term",
    setupFee: "Starting from ₦50,000 setup",
    description: "Complete school operating engine with direct parent visibility and Paystack fee collections.",
    features: [
      "Everything in Core",
      "Parent & student mobile portal",
      "Paystack fee collection & reconciliation",
      "WhatsApp & SMS payment receipts",
      "Branded school website starter",
      "Full onboarding & staff training workshop",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "₦1,500",
    period: "/student /term",
    setupFee: "Custom managed deployment",
    description: "For established institutions and multi-campus schools requiring managed SLAs.",
    features: [
      "Everything in Standard",
      "Multi-campus & multi-arm management",
      "Advanced finance & bank auto-reconciliation",
      "Custom branding & custom domain support",
      "Priority SLA & dedicated account manager",
      "Bespoke curriculum & grading logic",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

export const platformAddOns = [
  {
    name: "Managed School Website",
    description: "Custom-branded public site with direct online admissions and result-checking integrations.",
    tag: "Popular Add-On",
  },
  {
    name: "On-Site Staff Training Workshop",
    description: "Dedicated on-campus training for teachers, bursars, and administrative leadership.",
    tag: "Training",
  },
  {
    name: "Historical Data Migration",
    description: "Digitize and backfill past Excel spreadsheets and legacy broadsheets into session archives.",
    tag: "Data Services",
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

  const imageUrl = new URL("/og-image.png", siteBrand.siteUrl).toString();

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
      locale: "en_NG",
      images: [{ url: imageUrl, width: 1731, height: 909, alt: shareTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function toJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
