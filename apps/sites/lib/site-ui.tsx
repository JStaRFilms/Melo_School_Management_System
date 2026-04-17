import Link from "next/link";
import { ArrowRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import {
  getSchoolNavigationPages,
  siteThemeStyle,
  type ContactItem,
  type FaqItem,
  type PageContent,
  type PageKey,
  type SchoolConfig,
  type SchoolTemplateConfig,
  type SummaryCard,
} from "@/site";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function SurfaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-soft sm:p-6", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-3">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--school-secondary)]">{eyebrow}</p>
      ) : null}
      <h2 className="max-w-3xl text-3xl font-semibold text-slate-950 sm:text-4xl">{title}</h2>
      {description ? <p className="max-w-3xl text-base leading-7 text-slate-600">{description}</p> : null}
    </div>
  );
}

function ActionLink({
  href,
  children,
  variant = "solid",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline" | "ghost";
  className?: string;
}) {
  const styles = {
    solid:
      "bg-[color:var(--school-primary)] text-white shadow-soft hover:translate-y-[-1px] hover:bg-[color:var(--school-secondary)]",
    outline:
      "border border-slate-200 bg-white text-slate-900 hover:border-[color:var(--school-primary)] hover:text-[color:var(--school-primary)]",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-950",
  } as const;

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition duration-200",
        styles[variant],
        className,
      )}
    >
      {children}
      {variant === "solid" ? <ArrowRight className="h-4 w-4" /> : null}
    </Link>
  );
}

function SiteHeader({ school }: { school: SchoolConfig }) {
  const navigationPages = getSchoolNavigationPages(school);

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur-xl">
      <Container className="py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--school-primary)] text-sm font-bold text-white shadow-soft">
              {school.brand.logoMark || school.brand.fallbackMark}
            </div>
            <div className="leading-tight">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">School website</p>
              <p className="font-display text-lg font-semibold text-slate-950">{school.brand.name}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navigationPages.map((item) => {
              const href = item.key === "home" ? "/" : `/${item.slug}`;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  {item.label}
                </Link>
              );
            })}
            <ActionLink href="/contact" variant="solid" className="ml-2">
              Enquire now
            </ActionLink>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href={`tel:${school.contact.phone.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Phone className="h-4 w-4" />
              {school.contact.phone}
            </a>
            <ActionLink href="/contact">Contact office</ActionLink>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Primary">
          {navigationPages.map((item) => {
            const href = item.key === "home" ? "/" : `/${item.slug}`;
            return (
              <Link
                key={item.key}
                href={href}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </Container>
    </header>
  );
}

function SiteFooter({ school }: { school: SchoolConfig }) {
  const navigationPages = getSchoolNavigationPages(school);

  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <div className="space-y-4">
            <p className="font-display text-2xl font-semibold text-slate-950">{school.brand.name}</p>
            <p className="max-w-md text-sm leading-7 text-slate-600">{school.brand.tagline}</p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                <MapPin className="h-4 w-4" />
                {school.contact.address}
              </span>
              <a
                href={`mailto:${school.contact.email}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 transition hover:bg-slate-200"
              >
                <Mail className="h-4 w-4" />
                {school.contact.email}
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Quick links</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {navigationPages.map((item) => {
                const href = item.key === "home" ? "/" : `/${item.slug}`;
                return (
                  <Link key={item.key} href={href} className="text-sm font-medium text-slate-700 transition hover:text-[color:var(--school-primary)]">
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Contact</p>
            <p className="text-sm leading-7 text-slate-600">{school.contact.hours}</p>
            <div className="flex flex-col gap-3">
              <a
                href={`tel:${school.contact.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--school-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--school-secondary)]"
              >
                <Phone className="h-4 w-4" />
                Call office
              </a>
              <ActionLink href="/visit" variant="outline" className="justify-center">
                Plan a visit
              </ActionLink>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

function HeroSection({ school, page }: { school: SchoolConfig; page: PageContent }) {
  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--school-secondary)]">{page.hero.eyebrow}</p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold text-slate-950 sm:text-5xl lg:text-6xl">{page.hero.title}</h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">{page.hero.description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ActionLink href={page.hero.primaryAction.href}>{page.hero.primaryAction.label}</ActionLink>
              {page.hero.secondaryAction ? (
                <ActionLink href={page.hero.secondaryAction.href} variant="outline">
                  {page.hero.secondaryAction.label}
                </ActionLink>
              ) : null}
            </div>
            {page.hero.facts?.length ? (
              <div className="flex flex-wrap gap-2">
                {page.hero.facts.map((fact) => (
                  <span key={fact} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <SurfaceCard className="space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
            <div className="space-y-3 rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">At a glance</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Office hours</p>
                    <p className="text-sm leading-6 text-slate-600">{school.contact.hours}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
                  <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--school-secondary)]/10 text-[color:var(--school-secondary)]">
                    <Phone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Admissions line</p>
                    <p className="text-sm leading-6 text-slate-600">{school.contact.admissionsPhone}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">School identity</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{school.brand.shortName}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{school.brand.tagline}</p>
            </div>
          </SurfaceCard>
        </div>
      </Container>
    </section>
  );
}

function renderListCards(items: SummaryCard[], titleClassName = "text-xl") {
  return items.map((item) => (
    <SurfaceCard key={item.title} className="space-y-3">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
        <ArrowRight className="h-5 w-5" />
      </div>
      <div className="space-y-2">
        <h3 className={cn("font-semibold text-slate-950", titleClassName)}>{item.title}</h3>
        <p className="text-sm leading-7 text-slate-600">{item.description}</p>
      </div>
    </SurfaceCard>
  ));
}

function PointsSection({ items }: { items: SummaryCard[] }) {
  return (
    <section className="pb-16">
      <Container>
        <SectionHeading eyebrow="What families notice" title="The parts of school life that matter most." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <SurfaceCard key={item.title} className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Point</p>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </Container>
    </section>
  );
}

function TimelineSection({ items }: { items: SummaryCard[] }) {
  return (
    <section className="pb-16">
      <Container>
        <SectionHeading eyebrow="How it works" title="A simple rhythm families can follow." />
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {items.map((item, index) => (
            <SurfaceCard key={item.title} className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-secondary)]/10 text-[color:var(--school-secondary)]">
                <span className="text-sm font-bold">0{index + 1}</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </Container>
    </section>
  );
}

function StepsSection({ items }: { items: SummaryCard[] }) {
  return (
    <section className="pb-16">
      <Container>
        <SectionHeading eyebrow="Steps" title="What happens next." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <SurfaceCard key={item.title} className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                <span className="text-sm font-bold">{index + 1}</span>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                <p className="text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FeesSection({ items }: { items: { label: string; detail: string }[] }) {
  return (
    <section className="pb-16">
      <Container>
        <SectionHeading eyebrow="Fee structure" title="Published simply and explained by the office." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <SurfaceCard key={item.label} className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
              <p className="text-sm leading-7 text-slate-600">{item.detail}</p>
            </SurfaceCard>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="pb-16">
      <Container>
        <SectionHeading eyebrow="Questions" title="Common admissions questions." />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <SurfaceCard key={item.question} className="space-y-3">
              <p className="text-lg font-semibold text-slate-950">{item.question}</p>
              <p className="text-sm leading-7 text-slate-600">{item.answer}</p>
            </SurfaceCard>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ContactsSection({ items }: { items: ContactItem[] }) {
  return (
    <section className="pb-16">
      <Container>
        <SectionHeading eyebrow="Contact details" title="The school office is the best first stop." />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {items.map((item) => {
            const content = (
              <SurfaceCard className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">{item.label}</p>
                <p className="text-base font-semibold text-slate-950">{item.value}</p>
              </SurfaceCard>
            );

            if (!item.href) {
              return <div key={item.label}>{content}</div>;
            }

            return (
              <Link key={item.label} href={item.href} className="block transition hover:-translate-y-0.5">
                {content}
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

function NoteSection({ note }: { note: string }) {
  return (
    <section className="pb-16">
      <Container>
        <SurfaceCard className="bg-[linear-gradient(135deg,#173b72_0%,#0f766e_100%)] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/80">Note</p>
          <p className="mt-3 max-w-3xl text-base leading-7 text-white/90">{note}</p>
        </SurfaceCard>
      </Container>
    </section>
  );
}

function CtaSection({
  title,
  description,
  primaryAction,
  secondaryAction,
}: PageContent["cta"]) {
  return (
    <section className="pb-20">
      <Container>
        <SurfaceCard className="bg-[linear-gradient(135deg,#173b72_0%,#0f766e_100%)] p-8 text-white sm:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/80">Next step</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">{title}</h2>
              <p className="max-w-2xl text-sm leading-7 text-white/85">{description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ActionLink href={primaryAction.href} className="bg-white text-slate-950 hover:bg-slate-100">
                {primaryAction.label}
              </ActionLink>
              {secondaryAction ? (
                <ActionLink href={secondaryAction.href} variant="outline" className="border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/15">
                  {secondaryAction.label}
                </ActionLink>
              ) : null}
            </div>
          </div>
        </SurfaceCard>
      </Container>
    </section>
  );
}

function renderSection(slot: string, page: PageContent): ReactNode {
  switch (slot) {
    case "points":
      return page.points?.length ? <PointsSection items={page.points} /> : null;
    case "cards":
      return page.cards?.length ? (
        <section className="pb-16">
          <Container>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{renderListCards(page.cards)}</div>
          </Container>
        </section>
      ) : null;
    case "timeline":
      return page.timeline?.length ? <TimelineSection items={page.timeline} /> : null;
    case "steps":
      return page.steps?.length ? <StepsSection items={page.steps} /> : null;
    case "fees":
      return page.fees?.length ? <FeesSection items={page.fees} /> : null;
    case "faq":
      return page.faq?.length ? <FaqSection items={page.faq} /> : null;
    case "contacts":
      return page.contacts?.length ? <ContactsSection items={page.contacts} /> : null;
    case "note":
      return page.note ? <NoteSection note={page.note} /> : null;
    case "cta":
      return <CtaSection {...page.cta} />;
    default:
      return null;
  }
}

export function PublicSiteFrame({ school, children }: { school: SchoolConfig; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[color:var(--school-background)] text-[color:var(--school-ink)]" style={siteThemeStyle(school.theme)}>
      <SiteHeader school={school} />
      <main>{children}</main>
      <SiteFooter school={school} />
    </div>
  );
}

export function PublicSchoolPage({
  school,
  template,
  pageKey,
}: {
  school: SchoolConfig;
  template: SchoolTemplateConfig;
  pageKey: PageKey;
}) {
  const page = school.pageContent[pageKey];
  const layout = template.pageLayouts[pageKey];

  return (
    <PublicSiteFrame school={school}>
      {layout.slots.map((slot) => {
        if (slot === "hero") {
          return <HeroSection key="hero" school={school} page={page} />;
        }

        const section = renderSection(slot, page);
        return <div key={slot}>{section}</div>;
      })}
    </PublicSiteFrame>
  );
}
