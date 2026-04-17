import type { Metadata } from "next";
import { BadgeCheck, Clock3, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { buildPageMetadata, feeHighlights, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Commercials",
  description:
    "Review the SchoolOS commercial model: setup fee, recurring access, and optional upgrades.",
  path: "/fees",
});

const feeQuestions = [
  "What does the setup fee cover?",
  "Is access billed termly or annually?",
  "Which upgrades are optional?",
  "How do commercial fees stay separate from school fee billing?",
];

export default function FeesPage() {
  return (
    <>
      <PageHero
        eyebrow="Commercials"
        title="Transparent pricing language helps a school plan ahead."
        description={`${siteBrand.name} keeps the commercial conversation straightforward: one-time setup, recurring platform access, and optional upgrades.`}
        primaryAction={{ label: "Request a demo", href: "/contact" }}
        secondaryAction={{ label: "Review packages", href: "/admissions" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What the pricing model protects</p>
            <div className="space-y-3">
              {[
                "Base plan stays simple",
                "Upgrades stay optional",
                "Student billing remains separate",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                  <CreditCard className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        }
      />

      <section className="pb-16">
        <Container>
          <SectionHeading
            eyebrow="Pricing components"
            title="The model stays mixed, not single-metric."
            description="This commercial language can support small schools, mid-tier schools, and premium service arrangements without making every buyer fit the same shape."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {feeHighlights.map((highlight) => {
              const Icon = highlight.title.includes("Setup") ? FileText : highlight.title.includes("Recurring") ? Clock3 : ShieldCheck;
              return (
                <SurfaceCard key={highlight.title} className="space-y-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-950">{highlight.title}</h2>
                    <p className="text-sm leading-7 text-slate-600">{highlight.description}</p>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Questions worth answering early</p>
              <h2 className="text-3xl font-semibold text-slate-950">A strong commercial page answers the obvious questions.</h2>
              <div className="space-y-3">
                {feeQuestions.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What stays out of scope</p>
              <h2 className="text-3xl font-semibold text-slate-950">Platform fees should not blur into school fee billing.</h2>
              <p className="text-sm leading-7 text-slate-600">
                The product can charge for software access and service layers while school collections continue to live in the school billing domain.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/contact">Talk commercial fit</ButtonLink>
                <ButtonLink href="/visit" variant="outline">
                  Request a walkthrough
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <SurfaceCard className="bg-[linear-gradient(135deg,#173b72_0%,#0f766e_100%)] p-8 text-white sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Commercial clarity</p>
                <h2 className="text-3xl font-semibold">Setup fees, recurring access, and optional upgrades.</h2>
                <p className="max-w-2xl text-sm leading-7 text-white/80">
                  The packaging story leaves space for custom quoting while staying simple enough to understand quickly.
                </p>
              </div>
              <ButtonLink href="/contact" className="bg-white text-slate-950 hover:bg-slate-100">
                Request a demo
              </ButtonLink>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
