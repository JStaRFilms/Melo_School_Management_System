import type { Metadata } from "next";
import { ArrowRight, BarChart3, BookOpen, CreditCard, GraduationCap, Lock, Shield, Users, Zap } from "lucide-react";
import { ButtonLink, Container, GoldButton, SectionLabel } from "@/site-ui";
import { buildPageMetadata, capabilities, siteBrand, toJsonLd, trustPoints } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: `${siteBrand.name} — ${siteBrand.tagline}`,
  description: siteBrand.description,
  path: "/",
});

const platformSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteBrand.name,
  description: siteBrand.description,
  url: siteBrand.siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
};

const capabilityIcons = [BookOpen, GraduationCap, CreditCard, Users, Users, Zap];

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(platformSchema) }} />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        {/* Decorative gradient mesh */}
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-amber-100/60 via-amber-50/30 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-stone-200/40 to-transparent blur-3xl" />

        <Container className="relative pb-20 pt-20 sm:pb-28 sm:pt-28 lg:pb-36 lg:pt-32">
          <div className="mx-auto max-w-4xl text-center stagger">
            {/* Eyebrow */}
            <div className="animate-fade-up">
              <SectionLabel>School management, simplified</SectionLabel>
            </div>

            {/* Headline */}
            <h1 className="mt-8 font-serif text-5xl leading-[1.08] text-melo-ink sm:text-6xl lg:text-7xl xl:text-8xl animate-fade-up">
              Your school deserves{" "}
              <span className="relative inline-block">
                <span className="relative z-10">better software.</span>
                <span className="absolute -bottom-1 left-0 h-3 w-full bg-melo-gold/20 sm:h-4" />
              </span>
            </h1>

            {/* Subline */}
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-melo-muted sm:text-xl animate-fade-up">
              Melo is the all-in-one platform for Nigerian schools — admin, academics, billing, 
              and parent communication, running from one dashboard.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row animate-fade-up">
              <GoldButton href="/contact" size="lg">
                Book a demo
              </GoldButton>
              <ButtonLink href="/features" variant="outline" size="lg">
                See all features
              </ButtonLink>
            </div>
          </div>

          {/* Trust metrics */}
          <div className="mx-auto mt-20 flex max-w-2xl flex-wrap items-center justify-center gap-8 sm:gap-14 animate-fade-up" style={{ animationDelay: "400ms" }}>
            {trustPoints.map((point) => (
              <div key={point.label} className="text-center">
                <p className="text-2xl font-semibold text-melo-ink sm:text-3xl">{point.metric}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-melo-muted">{point.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════ CAPABILITIES ═══════════════ */}
      <section className="relative border-t border-melo-border py-24 sm:py-32">
        <Container>
          <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            {/* Left: sticky intro */}
            <div className="lg:sticky lg:top-28">
              <SectionLabel>What Melo does</SectionLabel>
              <h2 className="mt-5 font-serif text-4xl leading-tight text-melo-ink sm:text-5xl">
                Everything your school needs. Nothing it doesn&apos;t.
              </h2>
              <p className="mt-5 text-base leading-relaxed text-melo-muted">
                Six core modules that cover the full lifecycle of a school — from enrollment to results day to the final fee payment.
              </p>
              <div className="mt-8">
                <GoldButton href="/features">Explore features</GoldButton>
              </div>
            </div>

            {/* Right: capability grid */}
            <div className="grid gap-px rounded-2xl border border-melo-border bg-melo-border overflow-hidden sm:grid-cols-2">
              {capabilities.map((cap, idx) => {
                const Icon = capabilityIcons[idx] ?? Zap;
                return (
                  <div
                    key={cap.title}
                    className="group bg-white p-7 transition-colors duration-300 hover:bg-stone-50 cursor-pointer"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-melo-gold/10 text-melo-gold transition-colors duration-300 group-hover:bg-melo-gold group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-melo-ink">{cap.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-melo-muted">{cap.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════ SOCIAL PROOF / WHY ═══════════════ */}
      <section className="relative overflow-hidden bg-melo-ink py-24 text-white sm:py-32">
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-melo-gold/10 to-transparent blur-3xl" />

        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>Why schools choose Melo</SectionLabel>
            <h2 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">
              Built for how Nigerian schools <em className="not-italic text-melo-gold">actually</em> run.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-400">
              We didn&apos;t build a generic SaaS and add a school label. 
              Every feature exists because a real school needed it.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "Secure by default",
                description: "Every school's data is isolated. Role-based access ensures teachers, parents, and admins see only what they should.",
              },
              {
                icon: Zap,
                title: "Fast, even on 3G",
                description: "Optimised for Nigerian network conditions. Your staff can enter grades on a phone with a weak connection.",
              },
              {
                icon: BarChart3,
                title: "Real-time visibility",
                description: "From fee collection to attendance to results — see the state of your school at a glance, updated live.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-stone-800 bg-stone-900/50 p-7 transition-all duration-300 hover:border-stone-700 hover:bg-stone-800/50 cursor-pointer">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-melo-gold/15 text-melo-gold">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-400">{item.description}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section className="border-t border-melo-border py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="mt-5 font-serif text-4xl leading-tight text-melo-ink sm:text-5xl">
              Up and running in days, not months.
            </h2>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-0">
            {[
              { step: "01", title: "Book a walkthrough", description: "See the platform in action with your actual school structure — not a canned demo." },
              { step: "02", title: "We set you up", description: "Your sessions, terms, classes, and subjects are configured. Staff accounts are created." },
              { step: "03", title: "Go live", description: "Teachers enter grades, parents check results, fees are collected — everything from day one." },
            ].map((item, idx) => (
              <div key={item.step} className="group grid items-start gap-6 border-b border-melo-border py-10 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[80px_1fr] sm:gap-8">
                <span className="font-serif text-5xl text-melo-border transition-colors duration-300 group-hover:text-melo-gold sm:text-6xl">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-melo-ink sm:text-2xl">{item.title}</h3>
                  <p className="mt-2 max-w-lg text-base leading-relaxed text-melo-muted">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="relative overflow-hidden border-t border-melo-border">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50/40 to-stone-100" />
        <div className="pointer-events-none absolute inset-0 grain" />

        <Container className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-4xl leading-tight text-melo-ink sm:text-5xl lg:text-6xl">
              Ready to run your school{" "}
              <span className="text-melo-gold">the right way?</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-melo-muted">
              Join schools across Nigeria that trust Melo to handle their operations. 
              Book a 15-minute demo and see why.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <GoldButton href="/contact" size="lg">
                Book your demo
              </GoldButton>
              <ButtonLink href="/pricing" variant="outline" size="lg">
                View pricing
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
