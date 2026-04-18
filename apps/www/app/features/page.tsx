import type { Metadata } from "next";
import { BookOpen, CreditCard, Settings } from "lucide-react";
import { Container, GoldButton, SectionLabel, ButtonLink } from "@/site-ui";
import { buildPageMetadata, featureGroups } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Features",
  description:
    "Explore every module in Melo — student records, grade management, fee collection, parent portals, and more.",
  path: "/features",
});

const groupIcons = [Settings, BookOpen, CreditCard];

export default function FeaturesPage() {
  return (
    <>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-100/50 to-transparent blur-3xl" />

        <Container className="relative pb-16 pt-20 sm:pb-20 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center stagger">
            <div className="animate-fade-up">
              <SectionLabel>Features</SectionLabel>
            </div>
            <h1 className="mt-6 font-serif text-5xl leading-[1.08] text-melo-ink sm:text-6xl lg:text-7xl animate-fade-up">
              Built for every part of your school.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-melo-muted animate-fade-up">
              Three module groups. One connected platform. Everything your admin, 
              teachers, and parents need — without the spreadsheet chaos.
            </p>
          </div>
        </Container>
      </section>

      {/* ═══════════════ FEATURE GROUPS ═══════════════ */}
      {featureGroups.map((group, groupIdx) => {
        const GroupIcon = groupIcons[groupIdx] ?? Settings;
        const isEven = groupIdx % 2 === 0;

        return (
          <section
            key={group.group}
            className={`border-t border-melo-border py-20 sm:py-28 ${isEven ? "bg-white" : "bg-melo-paper"}`}
          >
            <Container>
              <div className={`grid gap-16 lg:grid-cols-[1fr_1.3fr] lg:items-start ${!isEven ? "lg:grid-cols-[1.3fr_1fr]" : ""}`}>
                {/* Intro Column */}
                <div className={`${!isEven ? "lg:order-2" : ""}`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-melo-gold/10 text-melo-gold">
                    <GroupIcon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-5 font-serif text-4xl leading-tight text-melo-ink sm:text-5xl">
                    {group.group}
                  </h2>
                  <div className="gold-bar mt-4" />
                </div>

                {/* Features Column */}
                <div className={`space-y-0 ${!isEven ? "lg:order-1" : ""}`}>
                  {group.features.map((feature, idx) => (
                    <div
                      key={feature.title}
                      className="group border-b border-melo-border py-8 first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-start gap-4">
                        <span className="mt-1 font-serif text-2xl text-melo-border transition-colors duration-300 group-hover:text-melo-gold">
                          0{idx + 1}
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-melo-ink">{feature.title}</h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-melo-muted">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Container>
          </section>
        );
      })}

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="relative overflow-hidden border-t border-melo-border bg-melo-ink py-24 text-white sm:py-32">
        <div className="pointer-events-none absolute inset-0 grain" />
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-bl from-melo-gold/8 to-transparent blur-3xl" />

        <Container className="relative">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-serif text-4xl leading-tight sm:text-5xl">
              See it all in action.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-stone-400">
              A 15-minute walkthrough shows you how every module connects. 
              Bring your school structure — we&apos;ll show you exactly how it maps.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <GoldButton href="/contact" size="lg">
                Book a demo
              </GoldButton>
              <ButtonLink href="/pricing" variant="outline" size="lg" className="border-stone-700 text-stone-300 hover:border-stone-500 hover:bg-stone-800 hover:text-white">
                View pricing
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
