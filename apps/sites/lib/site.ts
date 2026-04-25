import type { Metadata,MetadataRoute } from "next";
import type { CSSProperties } from "react";

export type TemplateKey =
  | "modern-campus"
  | "classic-institutional"
  | "primary-garden"
  | "secondary-studio"
  | "faith-tradition";

export type PageKey = "home" | "about" | "academics" | "admissions" | "fees" | "visit" | "contact";
export type PageSlot = "hero" | "points" | "cards" | "timeline" | "steps" | "fees" | "faq" | "contacts" | "note" | "cta";
export type SchoolStatus = "active" | "inactive";
export type DomainKind = "platform_subdomain" | "custom_domain" | "preview";
export type DomainStatus = "pending" | "verified" | "active";
export type DomainReadiness = "dns_pending" | "dns_verified" | "ssl_pending" | "ready";
export type DomainSslStatus = "pending" | "ready" | "failed";
export type DomainVerificationMethod = "txt" | "cname" | "manual";
export type DomainCanonicalIntent = "canonical" | "redirect";

export interface LinkAction {
  label: string;
  href: string;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: LinkAction;
  secondaryAction?: LinkAction;
  facts?: string[];
}

export interface SummaryCard {
  title: string;
  description: string;
}

export interface FeeBand {
  label: string;
  detail: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ContactItem {
  label: string;
  value: string;
  href?: string;
}

export interface PageContent {
  hero: HeroContent;
  points?: SummaryCard[];
  cards?: SummaryCard[];
  timeline?: SummaryCard[];
  steps?: SummaryCard[];
  fees?: FeeBand[];
  faq?: FaqItem[];
  contacts?: ContactItem[];
  note?: string;
  cta: {
    title: string;
    description: string;
    primaryAction: LinkAction;
    secondaryAction?: LinkAction;
  };
}

export interface DomainVerificationConfig {
  method: DomainVerificationMethod;
  token?: string;
  recordName?: string;
  recordValue?: string;
  instructions: string[];
}

export interface SchoolDomain {
  id: string;
  hostname: string;
  surface: "public";
  kind: DomainKind;
  status: DomainStatus;
  readiness: DomainReadiness;
  sslStatus: DomainSslStatus;
  isPrimary?: boolean;
  isCanonical?: boolean;
  canonicalIntent: DomainCanonicalIntent;
  dnsManagedBySchool: boolean;
  verification: DomainVerificationConfig;
  redirectToHostname?: string;
  notes?: string;
}

export interface SchoolTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  ink: string;
  muted: string;
}

export interface SchoolBrand {
  name: string;
  shortName: string;
  logoMark: string;
  fallbackMark: string;
  tagline: string;
  faviconUrl?: string;
}

export interface SchoolContact {
  phone: string;
  admissionsPhone: string;
  email: string;
  admissionsEmail: string;
  address: string;
  hours: string;
}

export interface SchoolTemplateLayout {
  visible: boolean;
  slots: PageSlot[];
}

export interface FuturePageDefinition {
  slug: string;
  label: string;
  description: string;
}

export interface SchoolTemplateConfig {
  key: TemplateKey;
  label: string;
  launchReady: boolean;
  designIntent: string;
  pageLayouts: Record<PageKey, SchoolTemplateLayout>;
  supportedFuturePages: FuturePageDefinition[];
}

export interface SchoolConfig {
  key: string;
  status: SchoolStatus;
  domains: SchoolDomain[];
  brand: SchoolBrand;
  theme: SchoolTheme;
  contact: SchoolContact;
  templateKey: TemplateKey;
  pageContent: Record<PageKey, PageContent>;
}

export interface SchoolResolution {
  status: "active" | "inactive" | "unknown";
  hostname: string;
  school?: SchoolConfig;
  template?: SchoolTemplateConfig;
  matchedDomain?: SchoolDomain;
  canonicalDomain?: SchoolDomain;
  redirectToHostname?: string;
}

export interface ResolvedPage {
  key: PageKey;
  slug: string;
  title: string;
  description: string;
  visible: boolean;
  slots: PageSlot[];
  content: PageContent;
  canonicalPath: string;
}

export interface SiteNavigationPage {
  key: PageKey;
  slug: string;
  label: string;
}

const corePages: SiteNavigationPage[] = [
  { key: "home", slug: "", label: "Home" },
  { key: "about", slug: "about", label: "About" },
  { key: "academics", slug: "academics", label: "Academics" },
  { key: "admissions", slug: "admissions", label: "Admissions" },
  { key: "fees", slug: "fees", label: "Fees" },
  { key: "visit", slug: "visit", label: "Visit" },
  { key: "contact", slug: "contact", label: "Contact" },
];

export const coreSitePages = corePages;

const modernCampusLayout: Record<PageKey, SchoolTemplateLayout> = {
  home: { visible: true, slots: ["hero", "points", "cards", "cta"] },
  about: { visible: true, slots: ["hero", "cards", "timeline", "cta"] },
  academics: { visible: true, slots: ["hero", "cards", "points", "cta"] },
  admissions: { visible: true, slots: ["hero", "steps", "faq", "cta"] },
  fees: { visible: true, slots: ["hero", "fees", "points", "cta"] },
  visit: { visible: true, slots: ["hero", "steps", "cards", "cta"] },
  contact: { visible: true, slots: ["hero", "contacts", "note", "cta"] },
};

const classicInstitutionalLayout: Record<PageKey, SchoolTemplateLayout> = {
  home: { visible: true, slots: ["hero", "cards", "points", "cta"] },
  about: { visible: true, slots: ["hero", "timeline", "cards", "cta"] },
  academics: { visible: true, slots: ["hero", "points", "cards", "cta"] },
  admissions: { visible: true, slots: ["hero", "faq", "steps", "cta"] },
  fees: { visible: true, slots: ["hero", "fees", "cards", "cta"] },
  visit: { visible: true, slots: ["hero", "cards", "steps", "cta"] },
  contact: { visible: true, slots: ["hero", "contacts", "cta", "note"] },
};

const primaryGardenLayout: Record<PageKey, SchoolTemplateLayout> = {
  home: { visible: true, slots: ["hero", "points", "cta", "cards"] },
  about: { visible: true, slots: ["hero", "points", "cards", "cta"] },
  academics: { visible: true, slots: ["hero", "cards", "points", "cta"] },
  admissions: { visible: true, slots: ["hero", "steps", "cta", "faq"] },
  fees: { visible: true, slots: ["hero", "fees", "points", "cta"] },
  visit: { visible: true, slots: ["hero", "steps", "cards", "cta"] },
  contact: { visible: true, slots: ["hero", "contacts", "note", "cta"] },
};

const secondaryStudioLayout: Record<PageKey, SchoolTemplateLayout> = {
  home: { visible: true, slots: ["hero", "cards", "points", "cta"] },
  about: { visible: true, slots: ["hero", "timeline", "cards", "cta"] },
  academics: { visible: true, slots: ["hero", "cards", "points", "cta"] },
  admissions: { visible: true, slots: ["hero", "faq", "steps", "cta"] },
  fees: { visible: true, slots: ["hero", "fees", "cards", "cta"] },
  visit: { visible: true, slots: ["hero", "steps", "cards", "cta"] },
  contact: { visible: true, slots: ["hero", "contacts", "cta", "note"] },
};

const faithTraditionLayout: Record<PageKey, SchoolTemplateLayout> = {
  home: { visible: true, slots: ["hero", "points", "cards", "cta"] },
  about: { visible: true, slots: ["hero", "timeline", "cards", "cta"] },
  academics: { visible: true, slots: ["hero", "points", "cards", "cta"] },
  admissions: { visible: true, slots: ["hero", "steps", "faq", "cta"] },
  fees: { visible: true, slots: ["hero", "fees", "points", "cta"] },
  visit: { visible: true, slots: ["hero", "cards", "steps", "cta"] },
  contact: { visible: true, slots: ["hero", "contacts", "note", "cta"] },
};

export const schoolTemplates: Record<TemplateKey, SchoolTemplateConfig> = {
  "modern-campus": {
    key: "modern-campus",
    label: "Modern campus",
    launchReady: true,
    designIntent: "Bright, premium, and calm for independent schools that want a polished but welcoming public presence.",
    pageLayouts: modernCampusLayout,
    supportedFuturePages: [
      { slug: "gallery", label: "Gallery", description: "Optional campus photography and school-life highlights." },
      { slug: "boarding", label: "Boarding", description: "A future boarding-life page for residential schools." },
      {
        slug: "cambridge-programme",
        label: "Cambridge Programme",
        description: "A future programme page for international curriculum pathways.",
      },
    ],
  },
  "classic-institutional": {
    key: "classic-institutional",
    label: "Classic institutional",
    launchReady: true,
    designIntent: "Formal and trustworthy for long-standing schools that want a traditional layout with strong structure.",
    pageLayouts: classicInstitutionalLayout,
    supportedFuturePages: [
      { slug: "archive", label: "Archive", description: "A future archive or history page for school heritage content." },
      { slug: "old-boys", label: "Old Boys", description: "A future alumni-oriented community page." },
      { slug: "alumni", label: "Alumni", description: "A future alumni network and updates page." },
    ],
  },
  "primary-garden": {
    key: "primary-garden",
    label: "Primary garden",
    launchReady: true,
    designIntent: "Warm, energetic, and parent-friendly for nursery and primary schools.",
    pageLayouts: primaryGardenLayout,
    supportedFuturePages: [
      { slug: "nursery", label: "Nursery", description: "A future page for nursery-specific information." },
      { slug: "after-school", label: "After School", description: "A future page for extended care and enrichment." },
      { slug: "gallery", label: "Gallery", description: "A future campus gallery page with photos and highlights." },
    ],
  },
  "secondary-studio": {
    key: "secondary-studio",
    label: "Secondary studio",
    launchReady: false,
    designIntent: "Sharper and more academic for secondary or college-style schools with exam-focused storytelling.",
    pageLayouts: secondaryStudioLayout,
    supportedFuturePages: [
      { slug: "results", label: "Results", description: "A future page for exam outcomes and achievement highlights." },
      {
        slug: "subject-offerings",
        label: "Subject Offerings",
        description: "A future page for detailed subject and option listings.",
      },
      { slug: "careers", label: "Careers", description: "A future page for careers guidance and student pathways." },
    ],
  },
  "faith-tradition": {
    key: "faith-tradition",
    label: "Faith tradition",
    launchReady: false,
    designIntent: "Reverent and orderly for faith-based or values-led schools that want a composed public tone.",
    pageLayouts: faithTraditionLayout,
    supportedFuturePages: [
      { slug: "worship", label: "Worship", description: "A future page for worship life and chapel rhythm." },
      { slug: "service", label: "Service", description: "A future page for service and outreach activity." },
      { slug: "house-system", label: "House System", description: "A future page for house culture and belonging." },
    ],
  },
};

const greenfieldSchool: SchoolConfig = {
  key: "greenfield-preparatory",
  status: "active",
  domains: [
    {
      id: "greenfield-preview-localhost",
      hostname: "localhost",
      surface: "public",
      kind: "preview",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      canonicalIntent: "redirect",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Local preview host for development and safety checks."],
      },
      redirectToHostname: "greenfield.schoolos.localhost",
      notes: "Preview hostname for local development.",
    },
    {
      id: "greenfield-platform-canonical",
      hostname: "greenfield.schoolos.localhost",
      surface: "public",
      kind: "platform_subdomain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      isPrimary: true,
      isCanonical: true,
      canonicalIntent: "canonical",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Platform-managed canonical public subdomain."],
      },
    },
    {
      id: "greenfield-platform-alias",
      hostname: "greenfield.localhost",
      surface: "public",
      kind: "platform_subdomain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      canonicalIntent: "redirect",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Platform-managed alias host used for canonical redirect checks."],
      },
      redirectToHostname: "greenfield.schoolos.localhost",
      notes: "Non-canonical alias for the greenfield public site.",
    },
    {
      id: "greenfield-custom-onboarding",
      hostname: "greenfieldprep.ng",
      surface: "public",
      kind: "custom_domain",
      status: "pending",
      readiness: "dns_pending",
      sslStatus: "pending",
      canonicalIntent: "redirect",
      dnsManagedBySchool: true,
      verification: {
        method: "txt",
        token: "greenfield-prep-verification-token",
        recordName: "_schoolos.greenfieldprep.ng",
        recordValue: "greenfield-prep-verification-token",
        instructions: [
          "Add the TXT verification record at your DNS provider.",
          "Keep the platform-managed subdomain live until the custom domain becomes active.",
        ],
      },
      notes: "School-managed custom domain onboarding record.",
    },
  ],
  brand: {
    name: "Greenfield Preparatory School",
    shortName: "Greenfield",
    logoMark: "GF",
    fallbackMark: "G",
    tagline: "A calm, confident learning community for growing children.",
  },
  theme: {
    primary: "#1E4B7A",
    secondary: "#0F766E",
    accent: "#C08B2E",
    background: "#F7FAFC",
    surface: "#FFFFFF",
    ink: "#0F172A",
    muted: "#475569",
  },
  contact: {
    phone: "+234 803 111 4200",
    admissionsPhone: "+234 803 111 4201",
    email: "hello@greenfieldprep.example",
    admissionsEmail: "admissions@greenfieldprep.example",
    address: "12 Cedar Road, Ikoyi, Lagos",
    hours: "Monday to Friday, 8:00am to 4:00pm",
  },
  templateKey: "modern-campus",
  pageContent: {
    home: {
      hero: {
        eyebrow: "Welcome to Greenfield",
        title: "A calm, confident school where children grow with purpose.",
        description:
          "Greenfield Preparatory School blends strong routines, warm relationships, and clear communication for families who want a focused school experience.",
        primaryAction: { label: "Contact admissions", href: "/contact" },
        secondaryAction: { label: "Explore academics", href: "/academics" },
        facts: ["Nursery to Primary 6", "Daily reading and numeracy focus", "Parent communication built in"],
      },
      points: [
        { title: "Small, steady routines", description: "Children know what to expect, which helps them settle and learn." },
        { title: "Whole-child support", description: "Character, confidence, and academics are developed together." },
      ],
      cards: [
        { title: "Purposeful classrooms", description: "Bright spaces, clear routines, and teacher guidance that keeps learning moving." },
        { title: "Family partnership", description: "Regular updates, accessible staff, and a welcoming admissions process." },
        { title: "Extra support where needed", description: "Reading, numeracy, and pastoral care are built into the school rhythm." },
      ],
      note: "The public site focuses on school life and admissions, not product messaging.",
      cta: {
        title: "Plan a visit",
        description: "See the classrooms, meet the team, and ask the questions that matter to your family.",
        primaryAction: { label: "Book a visit", href: "/visit" },
        secondaryAction: { label: "Call the office", href: "tel:+2348031114200" },
      },
    },
    about: {
      hero: {
        eyebrow: "About Greenfield",
        title: "A school built around clarity, care, and academic confidence.",
        description:
          "Our approach combines a calm culture, high expectations, and approachable leadership so children and families feel supported from the first day.",
        primaryAction: { label: "View admissions", href: "/admissions" },
        secondaryAction: { label: "Contact us", href: "/contact" },
        facts: ["Strong routines", "Visible leadership", "Family-first communication"],
      },
      timeline: [
        { title: "Clear school identity", description: "A premium but warm tone that helps children feel grounded." },
        { title: "Reliable daily structure", description: "Predictable learning blocks keep pupils settled and attentive." },
        { title: "Open communication", description: "Families know what is happening and how to reach the school." },
      ],
      cards: [
        { title: "Our values", description: "Respect, resilience, and a love of learning guide everyday practice." },
        { title: "Our team", description: "Teachers and leaders work closely to support progress and wellbeing." },
      ],
      cta: {
        title: "Meet the school in person",
        description: "A short visit helps families understand the culture far better than copy alone.",
        primaryAction: { label: "Schedule a visit", href: "/visit" },
        secondaryAction: { label: "Speak to admissions", href: "/contact" },
      },
    },
    academics: {
      hero: {
        eyebrow: "Academics",
        title: "A steady academic journey from early years into primary learning.",
        description:
          "Our curriculum keeps literacy, numeracy, reasoning, and practical learning in balance so every child can build confidence step by step.",
        primaryAction: { label: "Admissions overview", href: "/admissions" },
        secondaryAction: { label: "Review fees", href: "/fees" },
        facts: ["Early numeracy", "Reading fluency", "Project-based learning"],
      },
      cards: [
        { title: "Core literacy", description: "Reading, writing, and spoken confidence are reinforced every week." },
        { title: "Numeracy foundations", description: "Pupils get structured practice and patient support." },
        { title: "Broader learning", description: "Art, music, and practical activities keep school life balanced." },
      ],
      points: [
        { title: "Assessment that helps", description: "Teachers use simple evidence to guide support and next steps." },
        { title: "Progress at a sensible pace", description: "Children are challenged without being rushed." },
      ],
      cta: {
        title: "See how learning is organised",
        description: "We can explain class placement, subjects, and daily expectations during a visit.",
        primaryAction: { label: "Book a visit", href: "/visit" },
        secondaryAction: { label: "Contact admissions", href: "/contact" },
      },
    },
    admissions: {
      hero: {
        eyebrow: "Admissions",
        title: "A straightforward admissions process for busy families.",
        description:
          "We keep the process clear: enquiry, visit, application, and confirmation. The office can guide you at every step.",
        primaryAction: { label: "Start enquiry", href: "/contact" },
        secondaryAction: { label: "Review fees", href: "/fees" },
        facts: ["Simple enquiry flow", "Visit before enrolment", "Responsive office support"],
      },
      steps: [
        { title: "Make an enquiry", description: "Share your child's age, current class, and preferred start date." },
        { title: "Visit the school", description: "Walk through the site and meet a member of the admissions team." },
        { title: "Complete enrolment", description: "Confirm the place, submit documents, and receive onboarding details." },
      ],
      faq: [
        { question: "Do we need a visit before applying?", answer: "A visit is encouraged so families can make an informed choice." },
        { question: "Can the office explain fees?", answer: "Yes. The admissions team can walk through the current fee structure and payment options." },
      ],
      cta: {
        title: "Ready to start?",
        description: "A quick call is often the fastest way to confirm the right entry point for your child.",
        primaryAction: { label: "Call admissions", href: "tel:+2348031114201" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@greenfieldprep.example" },
      },
    },
    fees: {
      hero: {
        eyebrow: "Fees",
        title: "Clear fee guidance, without turning the website into a payment funnel.",
        description:
          "We publish the fee story in a family-friendly way so parents understand the structure before they contact the office.",
        primaryAction: { label: "Contact billing office", href: "/contact" },
        secondaryAction: { label: "Visit the school", href: "/visit" },
        facts: ["Term-based billing", "Transparent communication", "Office support available"],
      },
      fees: [
        { label: "Tuition", detail: "Published by term and explained during admissions." },
        { label: "Meals and activities", detail: "Optional items can be discussed with the office." },
        { label: "Uniform and books", detail: "Families receive a simple checklist before enrolment." },
      ],
      points: [
        { title: "Payment guidance is clear", description: "The office can explain due dates, instalments, and any allowances." },
        { title: "No hidden website prompts", description: "The public site stays informational and school-facing." },
      ],
      cta: {
        title: "Need the latest fee details?",
        description: "The admissions team can confirm current amounts, due dates, and payment steps.",
        primaryAction: { label: "Speak to billing", href: "/contact" },
        secondaryAction: { label: "Book a visit", href: "/visit" },
      },
    },
    visit: {
      hero: {
        eyebrow: "Visit",
        title: "See the school at a time that works for your family.",
        description:
          "A visit gives you the best sense of the classroom culture, the campus layout, and how the office supports new families.",
        primaryAction: { label: "Contact admissions", href: "/contact" },
        secondaryAction: { label: "View academics", href: "/academics" },
        facts: ["Campus walkthrough", "Meet the team", "Ask about class placement"],
      },
      steps: [
        { title: "Share your preferred timing", description: "Weekday visits are usually easiest to arrange." },
        { title: "Meet the school office", description: "Ask about classes, fees, uniforms, and start dates." },
        { title: "Take a guided walk", description: "See the learning spaces and get a feel for the environment." },
      ],
      cards: [
        { title: "Short and practical", description: "Visits are designed to be informative without becoming a long sales process." },
        { title: "Family-led questions", description: "We encourage parents to ask about the things that matter most at home." },
      ],
      cta: {
        title: "Pick a time to visit",
        description: "The office can help you choose a time that works for your schedule.",
        primaryAction: { label: "Call the office", href: "tel:+2348031114200" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@greenfieldprep.example" },
      },
    },
    contact: {
      hero: {
        eyebrow: "Contact",
        title: "Talk to the school office directly.",
        description:
          "Use the contact details below for admissions questions, school visits, fee guidance, or any other family enquiry.",
        primaryAction: { label: "Call the office", href: "tel:+2348031114200" },
        secondaryAction: { label: "Email us", href: "mailto:hello@greenfieldprep.example" },
        facts: ["Fast responses", "Admissions support", "Visit scheduling"],
      },
      contacts: [
        { label: "Main line", value: "+234 803 111 4200", href: "tel:+2348031114200" },
        { label: "Admissions", value: "+234 803 111 4201", href: "tel:+2348031114201" },
        { label: "Email", value: "admissions@greenfieldprep.example", href: "mailto:admissions@greenfieldprep.example" },
      ],
      note: "If you are looking for sign-in or staff access, the school office can direct you to the right internal entry point.",
      cta: {
        title: "Need a quick response?",
        description: "Send a message, and the school office will point you to the right next step.",
        primaryAction: { label: "Email admissions", href: "mailto:admissions@greenfieldprep.example" },
        secondaryAction: { label: "Book a visit", href: "/visit" },
      },
    },
  },
};

const obhisSchool: SchoolConfig = {
  key: "obhis-heritage-academy",
  status: "active",
  domains: [
    {
      id: "obhis-custom-canonical",
      hostname: "obhis.test",
      surface: "public",
      kind: "custom_domain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      isPrimary: true,
      isCanonical: true,
      canonicalIntent: "canonical",
      dnsManagedBySchool: true,
      verification: {
        method: "txt",
        instructions: ["Verification completed for the school-owned canonical public domain."],
      },
      notes: "Canonical school-owned public domain.",
    },
    {
      id: "obhis-platform-alias",
      hostname: "obhis.schoolos.localhost",
      surface: "public",
      kind: "platform_subdomain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      canonicalIntent: "redirect",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Platform-managed alias host that should redirect to the canonical custom domain."],
      },
      redirectToHostname: "obhis.test",
      notes: "Non-canonical platform-managed alias for the Obhis public site.",
    },
  ],
  brand: {
    name: "Obhis Heritage Academy",
    shortName: "Obhis",
    logoMark: "OH",
    fallbackMark: "O",
    tagline: "Tradition, discipline, and steady academic growth.",
  },
  theme: {
    primary: "#174E67",
    secondary: "#7A4D0B",
    accent: "#A85E14",
    background: "#F6F4EF",
    surface: "#FFFFFF",
    ink: "#172033",
    muted: "#576174",
  },
  contact: {
    phone: "+234 809 414 2200",
    admissionsPhone: "+234 809 414 2201",
    email: "hello@obhisheritage.example",
    admissionsEmail: "admissions@obhisheritage.example",
    address: "4 Cathedral Avenue, Enugu",
    hours: "Monday to Friday, 8:30am to 3:30pm",
  },
  templateKey: "classic-institutional",
  pageContent: {
    home: {
      hero: {
        eyebrow: "Welcome to Obhis Heritage Academy",
        title: "A disciplined school culture that honours tradition and achievement.",
        description:
          "Obhis Heritage Academy pairs clear routines with strong teaching so students can settle quickly and build momentum.",
        primaryAction: { label: "Contact admissions", href: "/contact" },
        secondaryAction: { label: "Learn about academics", href: "/academics" },
        facts: ["Structured day", "Strong house culture", "Consistent academic expectations"],
      },
      cards: [
        { title: "A composed campus", description: "Every space is arranged to support focus, order, and comfort." },
        { title: "Academic seriousness", description: "The school keeps a steady pace that families can understand and trust." },
        { title: "Clear communication", description: "Parents receive practical information without unnecessary noise." },
      ],
      points: [
        { title: "Tradition with purpose", description: "The school culture feels familiar, disciplined, and reassuring." },
        { title: "Progress you can track", description: "Families know how their children are doing and what comes next." },
      ],
      note: "The school website stays focused on children, families, and admissions — not platform promotion.",
      cta: {
        title: "Arrange a visit",
        description: "A school tour is the fastest way to understand the structure and tone of the campus.",
        primaryAction: { label: "Book a visit", href: "/visit" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@obhisheritage.example" },
      },
    },
    about: {
      hero: {
        eyebrow: "About Obhis",
        title: "An orderly school with a calm, respectful atmosphere.",
        description:
          "We aim for clear expectations, visible leadership, and a culture where students can grow with confidence.",
        primaryAction: { label: "Admissions process", href: "/admissions" },
        secondaryAction: { label: "Visit the school", href: "/visit" },
        facts: ["Respectful culture", "Strong routines", "Family communication"],
      },
      timeline: [
        { title: "Rooted identity", description: "The school tone reflects the seriousness of the learning environment." },
        { title: "Visible care", description: "Families can see who leads the school and how support is organised." },
        { title: "Predictable structure", description: "Students benefit from routines that reduce confusion and build focus." },
      ],
      cards: [
        { title: "Leadership", description: "Leadership is visible, accessible, and committed to standards." },
        { title: "Community", description: "The school encourages respect, cooperation, and pride in learning." },
      ],
      cta: {
        title: "See the campus for yourself",
        description: "A short visit will tell you more than any brochure can.",
        primaryAction: { label: "Schedule a visit", href: "/visit" },
        secondaryAction: { label: "Contact us", href: "/contact" },
      },
    },
    academics: {
      hero: {
        eyebrow: "Academics",
        title: "A disciplined curriculum with room for steady progress.",
        description:
          "Obhis Heritage Academy keeps its academic story simple: strong basics, clear expectations, and support that helps students improve.",
        primaryAction: { label: "Admissions", href: "/admissions" },
        secondaryAction: { label: "Review fees", href: "/fees" },
        facts: ["Foundational mastery", "Exam readiness", "Teacher accountability"],
      },
      cards: [
        { title: "Core subjects", description: "English, mathematics, science, and the humanities are taught with consistency." },
        { title: "Assessment", description: "Teachers track progress with clear, regular checkpoints." },
        { title: "Support", description: "Students who need extra help get practical, human support." },
      ],
      points: [
        { title: "No confusing jargon", description: "Parents can understand the curriculum and the expectations quickly." },
        { title: "A serious learning tone", description: "The school keeps the focus on steady academic improvement." },
      ],
      cta: {
        title: "Explore the academic approach",
        description: "We can explain subjects, levels, and routines during a visit or phone call.",
        primaryAction: { label: "Book a visit", href: "/visit" },
        secondaryAction: { label: "Call the office", href: "tel:+2348094142200" },
      },
    },
    admissions: {
      hero: {
        eyebrow: "Admissions",
        title: "A structured admissions path for families who want clarity.",
        description:
          "The office will guide you through enquiry, review, visit, and enrolment so there are no surprises.",
        primaryAction: { label: "Make an enquiry", href: "/contact" },
        secondaryAction: { label: "Review fees", href: "/fees" },
        facts: ["Guided visits", "Document checklist", "Clear timelines"],
      },
      faq: [
        { question: "Can we speak to someone before visiting?", answer: "Yes. The admissions team can help you understand the next step." },
        { question: "Is the fee structure shared early?", answer: "Yes, the office can explain the current fee structure and payment guidance." },
      ],
      steps: [
        { title: "Initial enquiry", description: "Share the child's current class, preferred entry point, and contact details." },
        { title: "Visit and review", description: "Tour the campus and ask about school life, expectations, and fees." },
        { title: "Confirm enrolment", description: "Complete the paperwork and receive the onboarding checklist." },
      ],
      cta: {
        title: "Start the conversation",
        description: "The admissions desk can help you work through the process at a pace that suits you.",
        primaryAction: { label: "Call admissions", href: "tel:+2348094142201" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@obhisheritage.example" },
      },
    },
    fees: {
      hero: {
        eyebrow: "Fees",
        title: "Simple fee information that supports a serious admissions conversation.",
        description:
          "We keep fee guidance easy to understand so families can plan without navigating a sales-heavy website.",
        primaryAction: { label: "Contact billing", href: "/contact" },
        secondaryAction: { label: "Plan a visit", href: "/visit" },
        facts: ["Term-based billing", "Clear office support", "No product marketing"],
      },
      fees: [
        { label: "Tuition", detail: "Outlined by term and explained clearly by the school office." },
        { label: "Uniform and materials", detail: "Families get a practical checklist before enrolment." },
        { label: "Optional extras", detail: "Any additional charges are explained directly by the office." },
      ],
      cards: [
        { title: "Transparent guidance", description: "The office can explain instalments, due dates, and payment expectations." },
        { title: "Practical planning", description: "Parents can plan confidently before confirming a place." },
      ],
      cta: {
        title: "Need the latest numbers?",
        description: "Call or email the office and they will confirm the current details.",
        primaryAction: { label: "Call billing", href: "tel:+2348094142200" },
        secondaryAction: { label: "Email the office", href: "mailto:hello@obhisheritage.example" },
      },
    },
    visit: {
      hero: {
        eyebrow: "Visit",
        title: "A guided visit is the easiest way to understand the school culture.",
        description:
          "We keep visits clear and useful, so families leave with practical answers rather than vague promises.",
        primaryAction: { label: "Contact admissions", href: "/contact" },
        secondaryAction: { label: "View academics", href: "/academics" },
        facts: ["Campus tour", "Office discussion", "Questions answered directly"],
      },
      cards: [
        { title: "Short and direct", description: "Visits are structured to respect your time." },
        { title: "School-led conversation", description: "Ask about class placement, expectations, and communication." },
      ],
      steps: [
        { title: "Choose a time", description: "Weekday windows are available for most school tours." },
        { title: "Walk the campus", description: "See classrooms, entry points, and the main office." },
        { title: "Confirm next steps", description: "Leave with a clear understanding of what to do next." },
      ],
      cta: {
        title: "Book a school visit",
        description: "A short tour can answer the key questions quickly.",
        primaryAction: { label: "Call the office", href: "tel:+2348094142200" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@obhisheritage.example" },
      },
    },
    contact: {
      hero: {
        eyebrow: "Contact",
        title: "Speak directly with the school office.",
        description:
          "Use the contacts below for admissions, billing, visit arrangements, and family questions.",
        primaryAction: { label: "Call the office", href: "tel:+2348094142200" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@obhisheritage.example" },
        facts: ["Admissions support", "Fee guidance", "Visit scheduling"],
      },
      contacts: [
        { label: "Main line", value: "+234 809 414 2200", href: "tel:+2348094142200" },
        { label: "Admissions", value: "+234 809 414 2201", href: "tel:+2348094142201" },
        { label: "Email", value: "admissions@obhisheritage.example", href: "mailto:admissions@obhisheritage.example" },
      ],
      note: "If you need a portal or staff sign-in, the school office can direct you to the correct entry point.",
      cta: {
        title: "Need help now?",
        description: "Reach out and the team will point you to the right next step.",
        primaryAction: { label: "Email the office", href: "mailto:hello@obhisheritage.example" },
        secondaryAction: { label: "Book a visit", href: "/visit" },
      },
    },
  },
};

const asterPrimarySchool: SchoolConfig = {
  key: "aster-primary-school",
  status: "active",
  domains: [
    {
      id: "aster-platform-canonical",
      hostname: "aster.schoolos.localhost",
      surface: "public",
      kind: "platform_subdomain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      isPrimary: true,
      isCanonical: true,
      canonicalIntent: "canonical",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Platform-managed canonical public subdomain."],
      },
    },
    {
      id: "aster-platform-alias",
      hostname: "aster.localhost",
      surface: "public",
      kind: "platform_subdomain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      canonicalIntent: "redirect",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Local alias host used for canonical redirect checks."],
      },
      redirectToHostname: "aster.schoolos.localhost",
    },
  ],
  brand: {
    name: "Aster Primary School",
    shortName: "Aster",
    logoMark: "AS",
    fallbackMark: "A",
    tagline: "Gentle beginnings, strong foundations.",
  },
  theme: {
    primary: "#5C4BC5",
    secondary: "#0F766E",
    accent: "#E9A23B",
    background: "#F9F7FF",
    surface: "#FFFFFF",
    ink: "#182033",
    muted: "#5A6377",
  },
  contact: {
    phone: "+234 812 410 1200",
    admissionsPhone: "+234 812 410 1201",
    email: "hello@asterprimary.example",
    admissionsEmail: "admissions@asterprimary.example",
    address: "18 Palm Avenue, Port Harcourt",
    hours: "Monday to Friday, 7:30am to 3:00pm",
  },
  templateKey: "primary-garden",
  pageContent: {
    home: {
      hero: {
        eyebrow: "Welcome to Aster",
        title: "A nurturing primary school that makes early learning feel joyful.",
        description:
          "Aster Primary School supports curiosity, confidence, and strong basics through a warm and structured school day.",
        primaryAction: { label: "Contact admissions", href: "/contact" },
        secondaryAction: { label: "See academics", href: "/academics" },
        facts: ["Nursery and primary classes", "Friendly routines", "Family communication"],
      },
      points: [
        { title: "Kind, calm classrooms", description: "Children settle quickly because the day feels predictable and safe." },
        { title: "Strong foundations", description: "Reading, counting, and speaking skills are reinforced every week." },
      ],
      cards: [
        { title: "Age-appropriate learning", description: "Lessons are short, engaging, and built for attention spans that are still growing." },
        { title: "Play with purpose", description: "Activities help children build confidence, language, and social skills." },
        { title: "Easy parent communication", description: "The school keeps families informed with simple, practical updates." },
      ],
      note: "The school website is intentionally about the school; it does not mention platform branding.",
      cta: {
        title: "Come see the classrooms",
        description: "A short visit helps parents picture the daily rhythm and the learning spaces.",
        primaryAction: { label: "Book a visit", href: "/visit" },
        secondaryAction: { label: "Call admissions", href: "tel:+2348124101201" },
      },
    },
    about: {
      hero: {
        eyebrow: "About Aster",
        title: "A school that blends warmth, structure, and early confidence.",
        description:
          "Our goal is to make the first school experience feel secure, enjoyable, and easy to understand for families.",
        primaryAction: { label: "Admissions", href: "/admissions" },
        secondaryAction: { label: "Contact us", href: "/contact" },
        facts: ["Warm routines", "Gentle discipline", "Parent partnership"],
      },
      timeline: [
        { title: "Warm welcome", description: "Families meet a team that understands early-years anxiety well." },
        { title: "Learning through rhythm", description: "Simple routines make the day feel manageable for younger children." },
        { title: "Clear next steps", description: "Parents always know what the school expects and what comes next." },
      ],
      cards: [
        { title: "Values", description: "Kindness, curiosity, and care sit at the centre of the school culture." },
        { title: "Teachers", description: "Teachers keep lessons simple, engaging, and developmentally appropriate." },
      ],
      cta: {
        title: "Let us show you around",
        description: "Visit the school and see how the early years environment works in practice.",
        primaryAction: { label: "Schedule a visit", href: "/visit" },
        secondaryAction: { label: "Speak to admissions", href: "/contact" },
      },
    },
    academics: {
      hero: {
        eyebrow: "Academics",
        title: "Strong foundations in literacy, numeracy, and curious exploration.",
        description:
          "Aster keeps the academic journey simple and age-appropriate so children can build confidence each term.",
        primaryAction: { label: "Admissions overview", href: "/admissions" },
        secondaryAction: { label: "Fee guidance", href: "/fees" },
        facts: ["Early phonics", "Numeracy practice", "Hands-on activities"],
      },
      cards: [
        { title: "Literacy", description: "Phonics, reading, and oral confidence are introduced carefully and consistently." },
        { title: "Numeracy", description: "Counting, patterns, and number sense are taught with patient repetition." },
        { title: "Discovery", description: "Science, art, and play-based tasks keep young learners engaged." },
      ],
      points: [
        { title: "Learning is visible", description: "Parents can see what children are working on and how they are progressing." },
        { title: "Confidence first", description: "The school protects curiosity while building steady academic habits." },
      ],
      cta: {
        title: "Understand the learning journey",
        description: "A quick visit or call can explain class placement and curriculum rhythms.",
        primaryAction: { label: "Book a visit", href: "/visit" },
        secondaryAction: { label: "Call the office", href: "tel:+2348124101200" },
      },
    },
    admissions: {
      hero: {
        eyebrow: "Admissions",
        title: "A supportive admissions process for young families.",
        description:
          "We keep admissions short and welcoming so parents can focus on the child, not on paperwork.",
        primaryAction: { label: "Start an enquiry", href: "/contact" },
        secondaryAction: { label: "Review fees", href: "/fees" },
        facts: ["Simple enquiry", "Helpful office team", "Age-appropriate intake"],
      },
      steps: [
        { title: "Send an enquiry", description: "Tell us your child's age and preferred entry term." },
        { title: "Visit the school", description: "See the classrooms and meet someone from admissions." },
        { title: "Confirm a place", description: "Complete the checklist and receive the next-term details." },
      ],
      faq: [
        { question: "Can the office help explain class placement?", answer: "Yes. The team can guide you based on age and readiness." },
        { question: "Is a visit required?", answer: "A visit is encouraged so families can get a feel for the environment." },
      ],
      cta: {
        title: "Reach out when you're ready",
        description: "The admissions team will help you move at a pace that suits your family.",
        primaryAction: { label: "Call admissions", href: "tel:+2348124101201" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@asterprimary.example" },
      },
    },
    fees: {
      hero: {
        eyebrow: "Fees",
        title: "Fee information presented clearly for busy parents.",
        description:
          "We keep the public explanation simple and encourage direct contact for the current term's full breakdown.",
        primaryAction: { label: "Contact billing", href: "/contact" },
        secondaryAction: { label: "Plan a visit", href: "/visit" },
        facts: ["Term-based", "Simple explanation", "Office follow-up"],
      },
      fees: [
        { label: "Tuition", detail: "Shared by the school office for the current term." },
        { label: "Books and materials", detail: "Explained during admissions so families can budget well." },
        { label: "Activities", detail: "Optional extras are separated from core tuition." },
      ],
      points: [
        { title: "Current details come from the office", description: "The public website stays informative rather than transactional." },
        { title: "Budgeting support", description: "Families can ask the office how to plan ahead." },
      ],
      cta: {
        title: "Need the current figures?",
        description: "The office can confirm the latest fee details and due dates.",
        primaryAction: { label: "Email the office", href: "mailto:hello@asterprimary.example" },
        secondaryAction: { label: "Call the office", href: "tel:+2348124101200" },
      },
    },
    visit: {
      hero: {
        eyebrow: "Visit",
        title: "A school visit helps parents feel the classroom rhythm in real life.",
        description:
          "We keep tours short, friendly, and useful so families leave with a clear sense of the school.",
        primaryAction: { label: "Contact admissions", href: "/contact" },
        secondaryAction: { label: "See academics", href: "/academics" },
        facts: ["Campus walk-through", "Meet the teachers", "Ask practical questions"],
      },
      steps: [
        { title: "Choose a time", description: "The office can suggest a visit window that works well." },
        { title: "Meet the school", description: "Discuss class placement, routines, and practical needs." },
        { title: "Decide with confidence", description: "Leave knowing what the school day feels like." },
      ],
      cards: [
        { title: "Helpful and short", description: "Tours are designed to be informative without becoming long meetings." },
        { title: "Family questions are welcome", description: "Ask about lunch, rest time, and class routines." },
      ],
      cta: {
        title: "Book a family visit",
        description: "The admissions team will help you choose a good time.",
        primaryAction: { label: "Call the office", href: "tel:+2348124101200" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@asterprimary.example" },
      },
    },
    contact: {
      hero: {
        eyebrow: "Contact",
        title: "Reach the school office directly.",
        description:
          "For admissions, fees, or visit scheduling, the school office is the best first stop.",
        primaryAction: { label: "Call the office", href: "tel:+2348124101200" },
        secondaryAction: { label: "Email admissions", href: "mailto:admissions@asterprimary.example" },
        facts: ["Friendly office team", "Admissions support", "Visit scheduling"],
      },
      contacts: [
        { label: "Main line", value: "+234 812 410 1200", href: "tel:+2348124101200" },
        { label: "Admissions", value: "+234 812 410 1201", href: "tel:+2348124101201" },
        { label: "Email", value: "admissions@asterprimary.example", href: "mailto:admissions@asterprimary.example" },
      ],
      note: "Staff and portal sign-in are handled through the school's internal entry points, not this public site.",
      cta: {
        title: "Send the school a message",
        description: "The team will help you with admissions, visit planning, or billing guidance.",
        primaryAction: { label: "Email the office", href: "mailto:hello@asterprimary.example" },
        secondaryAction: { label: "Book a visit", href: "/visit" },
      },
    },
  },
};

const legacySchool: SchoolConfig = {
  key: "legacy-heights-school",
  status: "inactive",
  domains: [
    {
      id: "legacy-platform-preview",
      hostname: "legacy-heights.schoolos.localhost",
      surface: "public",
      kind: "platform_subdomain",
      status: "active",
      readiness: "ready",
      sslStatus: "ready",
      isPrimary: true,
      canonicalIntent: "canonical",
      dnsManagedBySchool: false,
      verification: {
        method: "manual",
        instructions: ["Inactive example school used for safe host handling."],
      },
      notes: "The school itself remains inactive, so requests must still fail safely.",
    },
  ],
  brand: {
    name: "Legacy Heights School",
    shortName: "Legacy Heights",
    logoMark: "LH",
    fallbackMark: "L",
    tagline: "Example inactive school for safe host handling.",
  },
  theme: {
    primary: "#234B5E",
    secondary: "#8B6C3A",
    accent: "#C38C31",
    background: "#F5F7F8",
    surface: "#FFFFFF",
    ink: "#14202B",
    muted: "#55616B",
  },
  contact: {
    phone: "+234 800 000 0000",
    admissionsPhone: "+234 800 000 0001",
    email: "hello@legacyheights.example",
    admissionsEmail: "admissions@legacyheights.example",
    address: "1 Old Road, Example City",
    hours: "Monday to Friday, 9:00am to 3:00pm",
  },
  templateKey: "faith-tradition",
  pageContent: greenfieldSchool.pageContent,
};

export const schools: SchoolConfig[] = [greenfieldSchool, obhisSchool, asterPrimarySchool, legacySchool];

interface HostnameEntry {
  school: SchoolConfig;
  domain: SchoolDomain;
}

function buildHostnameIndex() {
  const index = new Map<string, HostnameEntry>();

  for (const school of schools) {
    for (const domain of school.domains) {
      index.set(normalizeHostname(domain.hostname) ?? domain.hostname, { school, domain });
    }
  }

  return index;
}

const hostnameIndex = buildHostnameIndex();

function normalizeHostname(hostname: string | null | undefined): string | null {
  if (!hostname) {
    return null;
  }

  const firstHost = hostname.split(",")[0]?.trim().toLowerCase();
  if (!firstHost) {
    return null;
  }

  if (firstHost.startsWith("[")) {
    const closingIndex = firstHost.indexOf("]");
    if (closingIndex > 0) {
      return firstHost.slice(1, closingIndex);
    }
  }

  return firstHost.split(":")[0] ?? null;
}

function getRequestProtocol(headers: Pick<Headers, "get">): string {
  const forwardedProto = headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https" ? "https" : "http";
  }

  return "http";
}

function isLocalDevelopmentHostname(hostname: string | null | undefined): boolean {
  if (!hostname) {
    return false;
  }

  const normalizedHostname = normalizeHostname(hostname);
  return (
    normalizedHostname === "localhost" ||
    normalizedHostname?.endsWith(".localhost") === true ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  );
}

function isKnownSchoolHostname(hostname: string | null | undefined): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  return normalizedHostname ? hostnameIndex.has(normalizedHostname) : false;
}

function getHostnameEntry(hostname: string | null | undefined): HostnameEntry | null {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) {
    return null;
  }

  return hostnameIndex.get(normalizedHostname) ?? null;
}

function getActivePublicDomains(school: SchoolConfig): SchoolDomain[] {
  return school.domains.filter((domain) => domain.status === "active" && domain.surface === "public");
}

export function getCanonicalPublicDomain(school: SchoolConfig): SchoolDomain | null {
  const activeDomains = getActivePublicDomains(school);
  if (!activeDomains.length) {
    return null;
  }

  return (
    activeDomains.find((domain) => domain.isCanonical && domain.kind !== "preview") ??
    activeDomains.find((domain) => domain.isPrimary && domain.kind !== "preview") ??
    activeDomains.find((domain) => domain.kind !== "preview") ??
    activeDomains.find((domain) => domain.isCanonical) ??
    activeDomains.find((domain) => domain.isPrimary) ??
    activeDomains[0] ??
    null
  );
}

export function buildCanonicalPublicOrigin({
  headers,
  resolution,
}: {
  headers: Pick<Headers, "get">;
  resolution: SchoolResolution;
}): string {
  const canonicalDomain = resolution.canonicalDomain ?? (resolution.school ? getCanonicalPublicDomain(resolution.school) : null);
  const hostname = canonicalDomain?.hostname ?? getRequestHostHeader(headers) ?? "localhost:3005";
  return `${getRequestProtocol(headers)}://${hostname}`;
}

export function getRequestHostHeader(headers: Pick<Headers, "get">): string | null {
  const host = headers.get("host");
  const normalizedHost = host ? host.split(",")[0]?.trim() ?? null : null;

  if (normalizedHost && !isLocalDevelopmentHostname(normalizedHost)) {
    return normalizedHost;
  }

  const forwardedHost = headers.get("x-forwarded-host");
  const normalizedForwardedHost = forwardedHost ? forwardedHost.split(",")[0]?.trim() ?? null : null;

  if (
    normalizedForwardedHost &&
    normalizedHost &&
    isLocalDevelopmentHostname(normalizedHost) &&
    isKnownSchoolHostname(normalizedForwardedHost)
  ) {
    return normalizedForwardedHost;
  }

  if (!normalizedHost && normalizedForwardedHost && isKnownSchoolHostname(normalizedForwardedHost)) {
    return normalizedForwardedHost;
  }

  return normalizedHost;
}

export function getRequestHostname(headers: Pick<Headers, "get">): string | null {
  return normalizeHostname(getRequestHostHeader(headers));
}

export function resolveSchoolFromHostname(hostname: string | null | undefined): SchoolResolution {
  const resolvedHostname = normalizeHostname(hostname);
  if (!resolvedHostname) {
    return { status: "unknown", hostname: "" };
  }

  const entry = getHostnameEntry(resolvedHostname);
  if (!entry) {
    return { status: "unknown", hostname: resolvedHostname };
  }

  const { school, domain } = entry;
  const template = schoolTemplates[school.templateKey];
  const canonicalDomain = getCanonicalPublicDomain(school);
  const redirectToHostname =
    canonicalDomain && canonicalDomain.hostname !== resolvedHostname ? canonicalDomain.hostname : undefined;

  if (school.status !== "active" || domain.status !== "active") {
    return {
      status: "inactive",
      hostname: resolvedHostname,
      school,
      template,
      matchedDomain: domain,
      canonicalDomain: canonicalDomain ?? undefined,
      redirectToHostname,
    };
  }

  return {
    status: "active",
    hostname: resolvedHostname,
    school,
    template,
    matchedDomain: domain,
    canonicalDomain: canonicalDomain ?? undefined,
    redirectToHostname,
  };
}

export function resolveSiteRequest(headers: Pick<Headers, "get">): SchoolResolution {
  const hostname = getRequestHostname(headers);
  return resolveSchoolFromHostname(hostname);
}

export function getSchoolNavigationPages(school: SchoolConfig): SiteNavigationPage[] {
  const template = schoolTemplates[school.templateKey];

  return corePages.filter((page) => {
    const layout = template.pageLayouts[page.key];
    return Boolean(layout?.visible && school.pageContent[page.key]);
  });
}

export function getTemplateFuturePages(template: SchoolTemplateConfig): FuturePageDefinition[] {
  return template.supportedFuturePages;
}

export function resolveRequestedPage(school: SchoolConfig, slugParts?: string[]): ResolvedPage | null {
  const normalizedSlug = (slugParts ?? []).filter(Boolean).join("/");
  const pageDefinition = corePages.find((page) => page.slug === normalizedSlug);

  if (!pageDefinition) {
    return null;
  }

  const template = schoolTemplates[school.templateKey];
  const layout = template.pageLayouts[pageDefinition.key];
  const content = school.pageContent[pageDefinition.key];

  if (!layout?.visible || !content) {
    return null;
  }

  return {
    key: pageDefinition.key,
    slug: normalizedSlug,
    title: pageDefinition.key === "home" ? school.brand.name : pageDefinition.label,
    description: content.hero.description,
    visible: layout.visible,
    slots: layout.slots,
    content,
    canonicalPath: normalizedSlug ? `/${normalizedSlug}` : "/",
  };
}

function toSafeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function siteThemeStyle(theme: SchoolTheme): CSSProperties {
  return {
    ["--school-primary" as never]: theme.primary,
    ["--school-secondary" as never]: theme.secondary,
    ["--school-accent" as never]: theme.accent,
    ["--school-background" as never]: theme.background,
    ["--school-surface" as never]: theme.surface,
    ["--school-ink" as never]: theme.ink,
    ["--school-muted" as never]: theme.muted,
  } as CSSProperties;
}

export function buildPageMetadata({
  origin,
  school,
  page,
}: {
  origin: string;
  school: SchoolConfig;
  page: ResolvedPage;
}): Metadata {
  const canonicalUrl = new URL(page.canonicalPath, origin).toString();
  const shareTitle = page.key === "home" ? school.brand.name : `${page.title} — ${school.brand.name}`;

  return {
    metadataBase: new URL(origin),
    title: shareTitle,
    description: page.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: shareTitle,
      description: page.description,
      url: canonicalUrl,
      siteName: school.brand.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: page.description,
    },
    icons: {
      icon: school.brand.faviconUrl ?? "/icon.svg",
      apple: school.brand.faviconUrl ?? "/icon.svg",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildSchoolStructuredData({
  canonicalUrl,
  school,
  page,
}: {
  canonicalUrl: string;
  school: SchoolConfig;
  page: ResolvedPage;
}): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: school.brand.name,
        url: canonicalUrl,
        description: page.description,
      },
      {
        "@type": "EducationalOrganization",
        name: school.brand.name,
        url: canonicalUrl,
        telephone: school.contact.phone,
        email: school.contact.email,
        address: school.contact.address,
        logo: school.brand.faviconUrl ? new URL(school.brand.faviconUrl, canonicalUrl).toString() : new URL("/icon.svg", canonicalUrl).toString(),
      },
    ],
  };

  return toSafeJsonLd(structuredData);
}

export function buildRobotsMetadata({
  headers,
  resolution,
}: {
  headers: Pick<Headers, "get">;
  resolution: SchoolResolution;
}): MetadataRoute.Robots {
  if (resolution.status !== "active" || !resolution.school || !resolution.template) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  const canonicalOrigin = buildCanonicalPublicOrigin({ headers, resolution });
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${canonicalOrigin}/sitemap.xml`,
  };
}

export function buildSitemapEntries({
  headers,
  resolution,
}: {
  headers: Pick<Headers, "get">;
  resolution: SchoolResolution;
}): MetadataRoute.Sitemap {
  if (resolution.status !== "active" || !resolution.school || !resolution.template) {
    return [];
  }

  const canonicalOrigin = buildCanonicalPublicOrigin({ headers, resolution });
  const pages = getSchoolNavigationPages(resolution.school);
  const now = new Date();

  return pages.map((page) => ({
    url: new URL(page.key === "home" ? "/" : `/${page.slug}`, canonicalOrigin).toString(),
    lastModified: now,
    changeFrequency: page.key === "home" ? "weekly" : "monthly",
    priority: page.key === "home" ? 1 : 0.7,
  }));
}

export function buildMissingSiteMetadata(): Metadata {
  return {
    title: "Public school website unavailable",
    description: "This school website is unavailable on the current hostname.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export function buildOrigin(headers: Pick<Headers, "get">): string {
  const hostname = getRequestHostHeader(headers) ?? "localhost:3005";
  return `${getRequestProtocol(headers)}://${hostname}`;
}
