import Link from "next/link";
import { ArrowRight, Mail, MapPin, Menu, Phone, X } from "lucide-react";
import type { ReactNode } from "react";
import { siteBrand, siteNavigation } from "@/site";

/* ─── Utilities ─── */
function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ─── Container ─── */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-content px-5 sm:px-8 lg:px-12", className)}>{children}</div>;
}

/* ─── Button Link ─── */
export function ButtonLink({
  href,
  children,
  variant = "solid",
  className,
  size = "default",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline" | "ghost";
  className?: string;
  size?: "default" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 cursor-pointer";

  const sizes = {
    default: "px-6 py-3 text-sm rounded-full",
    lg: "px-8 py-4 text-base rounded-full",
  };

  const variants = {
    solid:
      "bg-melo-ink text-white hover:bg-melo-ash shadow-soft hover:shadow-lift hover:-translate-y-px active:translate-y-0",
    outline:
      "border border-melo-border bg-transparent text-melo-stone hover:border-melo-stone hover:bg-melo-stone hover:text-white",
    ghost:
      "bg-transparent text-melo-muted hover:text-melo-stone hover:bg-stone-100",
  };

  return (
    <Link href={href} className={cn(base, sizes[size], variants[variant], className)}>
      {children}
      {variant === "solid" && <ArrowRight className="h-4 w-4" />}
    </Link>
  );
}

/* ─── Gold Button ─── */
export function GoldButton({
  href,
  children,
  className,
  size = "default",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  size?: "default" | "lg";
}) {
  const sizes = {
    default: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 cursor-pointer",
        "bg-melo-gold text-white hover:bg-amber-600 shadow-glow hover:shadow-[0_0_64px_rgba(202,138,4,0.25)] hover:-translate-y-px active:translate-y-0",
        sizes[size],
        className,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/* ─── Section Label ─── */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-melo-gold">
      <span className="inline-block h-px w-6 bg-melo-gold" />
      {children}
    </span>
  );
}

/* ─── Site Header ─── */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-melo-border/60 bg-melo-paper/80 backdrop-blur-2xl">
      <Container>
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-melo-ink text-white text-sm font-bold transition-transform duration-300 group-hover:scale-105">
              M
            </div>
            <span className="font-serif text-2xl text-melo-ink">Melo</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {siteNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-2 text-sm text-melo-muted transition-colors duration-200 hover:text-melo-ink cursor-pointer"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href={`tel:${siteBrand.phone.replace(/\s+/g, "")}`}
              className="text-sm text-melo-muted transition-colors duration-200 hover:text-melo-ink cursor-pointer"
            >
              {siteBrand.phone}
            </Link>
            <GoldButton href="/contact" size="default">
              Book a demo
            </GoldButton>
          </div>

          {/* Mobile menu toggle (CSS-only via :target or details/summary) */}
          <div className="md:hidden">
            <GoldButton href="/contact" size="default">
              Demo
            </GoldButton>
          </div>
        </div>
      </Container>
    </header>
  );
}

/* ─── Site Footer ─── */
export function SiteFooter() {
  return (
    <footer className="border-t border-melo-border bg-melo-ink text-white">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr]">
          {/* Brand */}
          <div className="space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-melo-gold text-white text-sm font-bold">
                M
              </div>
              <span className="font-serif text-2xl">Melo</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-stone-400">
              {siteBrand.description}
            </p>
          </div>

          {/* Nav */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Navigate</p>
            <div className="mt-5 flex flex-col gap-3">
              {siteNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-stone-400 transition-colors duration-200 hover:text-white cursor-pointer"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Contact</p>
            <div className="mt-5 flex flex-col gap-3">
              <a href={`mailto:${siteBrand.email}`} className="flex items-center gap-2 text-sm text-stone-400 transition-colors duration-200 hover:text-white cursor-pointer">
                <Mail className="h-3.5 w-3.5" />
                {siteBrand.email}
              </a>
              <a href={`tel:${siteBrand.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 text-sm text-stone-400 transition-colors duration-200 hover:text-white cursor-pointer">
                <Phone className="h-3.5 w-3.5" />
                {siteBrand.phone}
              </a>
              <span className="flex items-center gap-2 text-sm text-stone-400">
                <MapPin className="h-3.5 w-3.5" />
                {siteBrand.address}
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Ready?</p>
            <p className="text-sm text-stone-400">See Melo in action. Book a 15-minute walkthrough with our team.</p>
            <GoldButton href="/contact">Book a demo</GoldButton>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-stone-800 pt-8 text-xs text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Melo. All rights reserved.</p>
          <p>Built in Lagos, Nigeria 🇳🇬</p>
        </div>
      </Container>
    </footer>
  );
}
