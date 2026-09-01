import type { Metadata } from "next";
import { Check } from "lucide-react";
import { ButtonLink, Container, GoldButton, SectionLabel } from "@/site-ui";
import { buildPageMetadata, pricingTiers } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing",
  description:
    "Simple, transparent pricing for Melo — choose the plan that fits your school size and grow from there.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -top-32 right-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-b from-amber-100/50 to-transparent blur-3xl" />

        <Container className="relative pb-16 pt-20 sm:pb-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center stagger">
            <div className="animate-fade-up">
              <SectionLabel>Pricing</SectionLabel>
            </div>
            <h1 className="mt-6 font-serif text-5xl leading-[1.08] text-melo-ink sm:text-6xl lg:text-7xl animate-fade-up">
              Simple plans. Real value.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-melo-muted animate-fade-up">
              Every plan includes the core platform. Pick the size that matches your school and upgrade as you grow.
            </p>
          </div>
        </Container>
      </section>

      {/* ═══════════════ PRICING CARDS ═══════════════ */}
      <section className="border-t border-melo-border pb-24 sm:pb-32">
        <Container>
          <div className="mx-auto -mt-1 grid max-w-5xl gap-6 pt-16 sm:pt-20 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:shadow-lift cursor-pointer ${
                  tier.highlighted
                    ? "border-melo-gold bg-white shadow-glow"
                    : "border-melo-border bg-white hover:border-stone-300"
                }`}
              >
                {/* Badge */}
                {tier.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-melo-gold px-4 py-1 text-xs font-semibold text-white">
                    Most popular
                  </div>
                )}

                {/* Header */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-melo-muted">{tier.name}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-serif text-4xl text-melo-ink sm:text-5xl">{tier.price}</span>
                    {tier.period && <span className="text-sm text-melo-muted">{tier.period}</span>}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-melo-muted">{tier.description}</p>
                </div>

                {/* Divider */}
                <div className="my-6 h-px bg-melo-border" />

                {/* Features */}
                <ul className="flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-melo-stone">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-melo-gold" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-8">
                  {tier.highlighted ? (
                    <GoldButton href="/contact" className="w-full justify-center">
                      {tier.cta}
                    </GoldButton>
                  ) : (
                    <ButtonLink href="/contact" variant="outline" className="w-full justify-center">
                      {tier.cta}
                    </ButtonLink>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section className="border-t border-melo-border bg-white py-24 sm:py-32">
        <Container>
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <SectionLabel>Questions</SectionLabel>
              <h2 className="mt-5 font-serif text-4xl leading-tight text-melo-ink sm:text-5xl">
                Common questions, straight answers.
              </h2>
            </div>

            <div className="mt-14 space-y-0">
              {[
                {
                  q: "What's included in the setup?",
                  a: "We configure your school's sessions, terms, classes, subjects, and student data. Staff accounts are created and your team gets onboarding support.",
                },
                {
                  q: "Can I switch plans later?",
                  a: "Yes. You can upgrade or downgrade at any time. We'll pro-rate the difference.",
                },
                {
                  q: "Is my school's data secure?",
                  a: "Every school's data is fully isolated. We use 256-bit encryption, regular backups, and role-based access control.",
                },
                {
                  q: "Do parents need to install an app?",
                  a: "No. The parent portal works in any browser — phone or desktop. No app download required.",
                },
                {
                  q: "How do online payments work?",
                  a: "We integrate with Paystack. Parents pay via card, bank transfer, or USSD. Payments are automatically reconciled and receipts are generated.",
                },
              ].map((faq) => (
                <details
                  key={faq.q}
                  className="group border-b border-melo-border py-6 first:border-t cursor-pointer"
                >
                  <summary className="flex items-center justify-between text-base font-medium text-melo-ink marker:content-none [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-melo-border text-xs text-melo-muted transition-transform duration-300 group-open:rotate-45 group-open:border-melo-gold group-open:text-melo-gold">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-melo-muted">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="relative overflow-hidden border-t border-melo-border">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50/40 to-stone-100" />
        <div className="pointer-events-none absolute inset-0 grain" />

        <Container className="relative py-24 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-4xl leading-tight text-melo-ink sm:text-5xl">
              Still deciding? <span className="text-melo-gold">Let&apos;s talk.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-melo-muted">
              We&apos;ll walk you through the platform, answer your questions, and help you pick the right plan — no pressure.
            </p>
            <div className="mt-10">
              <GoldButton href="/contact" size="lg">
                Book a demo
              </GoldButton>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
