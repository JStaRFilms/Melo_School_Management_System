import type { Metadata } from "next";
import { CalendarDays, Clock3, MessageSquare, Route, Sparkles } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { buildPageMetadata, siteBrand, visitMoments } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Demo",
  description:
    "Plan a demo of SchoolOS and see the admin, teacher, family, and commercial surfaces in one walkthrough.",
  path: "/visit",
});

const visitTips = [
  "Come with the questions that matter most to your team.",
  "Bring any current workflow notes that may help with rollout planning.",
  "Ask about the first modules you would want to launch.",
];

export default function VisitPage() {
  return (
    <>
      <PageHero
        eyebrow="Demo"
        title="The best product decision usually starts with seeing the workflow."
        description={`${siteBrand.name} is easier to judge once you have seen the internal workspace, the family access layer, and the public marketing story together.`}
        primaryAction={{ label: "Request a demo", href: "/contact" }}
        secondaryAction={{ label: "Review modules", href: "/academics" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Demo details</p>
            <div className="space-y-3">
              {[
                { label: "Discovery", value: "School goals and constraints", icon: Clock3 },
                { label: "Walkthrough", value: "Product and access boundaries", icon: MessageSquare },
                { label: "Follow-up", value: "Commercial fit and rollout path", icon: Route },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <Icon className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        }
      />

      <section className="pb-16">
        <Container>
          <SectionHeading
            eyebrow="What a demo looks like"
            title="Short, focused, and built around the product boundaries that matter."
            description="The walkthrough should help the school understand how the platform works without detouring into admissions or school-site content."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {visitMoments.map((moment) => {
              const Icon = moment.title.includes("Discovery") ? Sparkles : moment.title.includes("Walkthrough") ? Route : CalendarDays;
              return (
                <SurfaceCard key={moment.title} className="space-y-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-950">{moment.title}</h2>
                    <p className="text-sm leading-7 text-slate-600">{moment.description}</p>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Prep for the call</p>
              <h2 className="text-3xl font-semibold text-slate-950">Arrive with the right questions.</h2>
              <div className="space-y-3">
                {visitTips.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Rollout conversation</p>
              <h2 className="text-3xl font-semibold text-slate-950">Confirm the scope before anything is launched.</h2>
              <p className="text-sm leading-7 text-slate-600">
                A good demo ends with a clear understanding of the starting package, the support path, and whether future public-web work belongs in the roadmap.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/contact">Request demo</ButtonLink>
                <ButtonLink href="/fees" variant="outline">
                  Review packages
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <SurfaceCard className="border-[color:var(--school-primary)]/20 bg-[color:var(--school-primary)]/5 p-8 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--school-secondary)]">Next step</p>
                <h2 className="text-3xl font-semibold text-slate-950">Book the demo while the question is still fresh.</h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  The product is clearer once you see the boundaries in action. We would be glad to walk you through it.
                </p>
              </div>
              <ButtonLink href="/contact">Book now</ButtonLink>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
