import type { Metadata } from "next";
import { BadgeCheck, Clock3, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { feeHighlights, buildPageMetadata, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Fees",
  description:
    "Review the fee conversation early so families understand tuition expectations, payment timing, and support options.",
  path: "/fees",
});

const feeQuestions = [
  "What does the term fee cover?",
  "When are payments due?",
  "Are there optional extras or activity costs?",
  "Who do families contact if they need clarification?",
];

export default function FeesPage() {
  return (
    <>
      <PageHero
        eyebrow="Fees"
        title="Transparent fee conversations help families plan with confidence."
        description={`${siteBrand.name} keeps financial communication straightforward: what is due, when it is due, and who to ask if a family needs help understanding the term breakdown.`}
        primaryAction={{ label: "Speak to admissions", href: "/contact" }}
        secondaryAction={{ label: "Book a visit", href: "/visit" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Fee conversation goals</p>
            <div className="space-y-3">
              {[
                "Explain the tuition structure before enrolment",
                "Separate required fees from optional extras",
                "Keep payment timing visible and easy to plan for",
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
            eyebrow="What families should expect"
            title="Clear, honest, and early enough to plan ahead."
            description="The website should not hide fee reality. It should help parents know what to ask and what they will receive in return."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {feeHighlights.map((highlight) => {
              const Icon = highlight.title.includes("Transparent") ? FileText : highlight.title.includes("Simple") ? Clock3 : ShieldCheck;
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Questions worth asking</p>
              <h2 className="text-3xl font-semibold text-slate-950">A good fee page answers the obvious questions up front.</h2>
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Support and payment conversations</p>
              <h2 className="text-3xl font-semibold text-slate-950">Need help understanding a term balance?</h2>
              <p className="text-sm leading-7 text-slate-600">
                Families should always know where to ask for clarification. The admissions team can route payment questions to the right person quickly.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={`tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}`}>
                  <CreditCard className="h-4 w-4" />
                  Call admissions
                </ButtonLink>
                <ButtonLink href="/contact" variant="outline">
                  Contact the school
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
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Financial clarity</p>
                <h2 className="text-3xl font-semibold">Admissions decisions are easier when fee information is easy to trust.</h2>
                <p className="max-w-2xl text-sm leading-7 text-white/80">
                  We keep the conversation direct so families can compare options and move forward with confidence.
                </p>
              </div>
              <ButtonLink href="/contact" className="bg-white text-slate-950 hover:bg-slate-100">
                Ask a question
              </ButtonLink>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
