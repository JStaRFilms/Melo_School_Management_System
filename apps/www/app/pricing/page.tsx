import type { Metadata } from "next";
import { Check, Layers } from "lucide-react";
import { ButtonLink, Container, GoldButton, SectionLabel } from "@/site-ui";
import { buildPageMetadata, pricingTiers, platformAddOns } from "@/site";
import { Card3DTilt } from "../../components/ui/card-3d-tilt";

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
              Structured setup with term-based recurring access. Pick the package that fits your institution and add services as you grow.
            </p>
          </div>
        </Container>
      </section>

      {/* ═══════════════ PRICING CARDS ═══════════════ */}
      <section className="border-t border-melo-border pb-24 sm:pb-32">
        <Container>
          <div className="mx-auto -mt-1 grid max-w-5xl gap-6 pt-16 sm:pt-20 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <Card3DTilt key={tier.name} maxTilt={4} className="h-full">
                <div
                  className={`relative flex flex-col rounded-3xl border p-8 transition-all duration-300 h-full justify-between ${
                    tier.highlighted
                      ? "border-stone-900 bg-stone-900 text-white shadow-2xl scale-[1.02]"
                      : "border-stone-200 bg-white hover:border-stone-300 shadow-sm"
                  }`}
                >
                  {/* Badge */}
                  {tier.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1 text-xs font-bold uppercase tracking-wider text-stone-950">
                      Most popular
                    </div>
                  )}

                  {/* Header */}
                  <div>
                    <p
                      className={`text-xs font-mono uppercase tracking-[0.2em] ${
                        tier.highlighted ? "text-amber-400" : "text-stone-500"
                      }`}
                    >
                      {tier.name}
                    </p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="font-serif text-4xl sm:text-5xl font-bold">
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span
                          className={`text-xs font-mono ${
                            tier.highlighted ? "text-stone-400" : "text-stone-500"
                          }`}
                        >
                          {tier.period}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs font-mono mt-1 ${
                        tier.highlighted ? "text-stone-400" : "text-stone-500"
                      }`}
                    >
                      {tier.setupFee}
                    </div>
                    <p
                      className={`mt-3 text-sm leading-relaxed ${
                        tier.highlighted ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      {tier.description}
                    </p>
                  </div>

                  {/* Divider */}
                  <div
                    className={`my-6 h-px ${
                      tier.highlighted ? "bg-stone-800" : "bg-stone-100"
                    }`}
                  />

                  {/* Features */}
                  <ul className="flex-1 space-y-3">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-start gap-3 text-sm ${
                          tier.highlighted ? "text-stone-200" : "text-stone-700"
                        }`}
                      >
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            tier.highlighted ? "text-amber-400" : "text-emerald-600"
                          }`}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-8 pt-4">
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
              </Card3DTilt>
            ))}
          </div>

          {/* ═══════════════ OPTIONAL ADD-ONS SECTION ═══════════════ */}
          <div className="mx-auto max-w-5xl mt-16 rounded-3xl border border-stone-200 bg-stone-50/80 p-8 sm:p-10">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="h-5 w-5 text-amber-600" />
              <h3 className="font-serif text-2xl font-bold text-stone-900">
                Commercial Add-On Services
              </h3>
            </div>
            <p className="text-stone-600 text-sm font-light mb-6">
              Attach specialized service modules to any plan tier as your school requires:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {platformAddOns.map((addon) => (
                <div
                  key={addon.name}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                    {addon.tag}
                  </span>
                  <h4 className="font-sans font-bold text-stone-900 text-sm mt-2">
                    {addon.name}
                  </h4>
                  <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
                    {addon.description}
                  </p>
                </div>
              ))}
            </div>
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
                  q: "What's included in the setup fee?",
                  a: "We configure your school's sessions, terms, classes, subjects, grading rules, and student data. Staff accounts are created and your team receives hands-on onboarding support.",
                },
                {
                  q: "Can I switch plans later?",
                  a: "Yes. You can upgrade or downgrade at the start of any term cycle. We'll pro-rate any differences smoothly.",
                },
                {
                  q: "Is my school's data isolated and secure?",
                  a: "Every school's database is fully tenant-isolated. We use 256-bit encryption, continuous backups, and strict role-based permissions.",
                },
                {
                  q: "Do parents need to download an app?",
                  a: "No. The parent portal works natively in any smartphone or desktop web browser with zero app store installations.",
                },
                {
                  q: "How does Paystack fee collection work?",
                  a: "Parents pay directly via card, bank transfer, or USSD into your school's dedicated merchant account. Payments auto-reconcile with invoices instantly.",
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
              We&apos;ll walk you through the platform, answer your questions, and help you pick the right plan for your school structure.
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
