import Link from "next/link";
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { siteBrand, siteNavigation } from "@/site";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function ButtonLink({
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
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900",
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

export function SurfaceCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-soft", className)}>
      {children}
    </div>
  );
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
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--school-secondary)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="max-w-3xl text-3xl font-semibold text-slate-950 sm:text-4xl">{title}</h2>
      {description ? <p className="max-w-3xl text-base leading-7 text-slate-600">{description}</p> : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  aside,
  note,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  aside?: ReactNode;
  note?: string;
}) {
  return (
    <section className="py-12 sm:py-16 lg:py-20">
      <Container>
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--school-secondary)]">
              {eyebrow}
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold text-slate-950 sm:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">{description}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {primaryAction ? <ButtonLink href={primaryAction.href}>{primaryAction.label}</ButtonLink> : null}
              {secondaryAction ? (
                <ButtonLink href={secondaryAction.href} variant="outline">
                  {secondaryAction.label}
                </ButtonLink>
              ) : null}
            </div>
            {note ? <p className="text-sm text-slate-500">{note}</p> : null}
          </div>
          {aside ? <div>{aside}</div> : null}
        </div>
      </Container>
    </section>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur-xl">
      <Container className="py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--school-primary)] text-sm font-bold text-white shadow-soft">
              SO
            </div>
            <div className="leading-tight">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Product website</p>
              <p className="font-display text-lg font-semibold text-slate-950">{siteBrand.name}</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {siteNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href={`tel:${siteBrand.phone.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Phone className="h-4 w-4" />
              {siteBrand.phone}
            </a>
            <ButtonLink href="/contact">Request demo</ButtonLink>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Primary">
          {siteNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <div className="space-y-4">
            <p className="font-display text-2xl font-semibold text-slate-950">{siteBrand.name}</p>
            <p className="max-w-md text-sm leading-7 text-slate-600">{siteBrand.description}</p>
            <div className="flex flex-wrap gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2">
                <MapPin className="h-4 w-4" />
                {siteBrand.address}
              </span>
              <a
                href={`mailto:${siteBrand.email}`}
                className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 transition hover:bg-slate-200"
              >
                <Mail className="h-4 w-4" />
                {siteBrand.email}
              </a>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Quick links</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {siteNavigation.map((item) => (
                <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-700 transition hover:text-[color:var(--school-primary)]">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Contact</p>
            <p className="text-sm leading-7 text-slate-600">{siteBrand.hours}</p>
            <div className="flex flex-col gap-3">
              <a
                href={`tel:${siteBrand.phone.replace(/\s+/g, "")}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--school-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--school-secondary)]"
              >
                <Phone className="h-4 w-4" />
                Call sales
              </a>
              <ButtonLink href="/contact" variant="outline" className="justify-center">
                Request demo
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
