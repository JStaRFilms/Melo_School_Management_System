import type { Metadata } from "next";
import { BadgeCheck, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { aboutMilestones, buildPageMetadata, homeSellingPoints, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Overview",
  description:
    "Learn how SchoolOS keeps product marketing, internal workspace access, and future school websites in separate lanes.",
  path: "/about",
});

const values = [
  {
    title: "Clarity",
    description: "School buyers should always understand what the platform does and why it matters.",
    icon: Sparkles,
  },
  {
    title: "Separation",
    description: "Public marketing, internal admin, and tenant school surfaces must not blur together.",
    icon: ShieldCheck,
  },
  {
    title: "Scale",
    description: "The first school should launch cleanly while the architecture stays ready for future growth.",
    icon: BadgeCheck,
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Overview"
        title="A product story built for school operators, not families browsing admissions copy."
        description={`${siteBrand.name} exists to help schools run the operational side of the business without tying the product story to a tenant school website.`}
        primaryAction={{ label: "Request a demo", href: "/contact" }}
        secondaryAction={{ label: "Explore modules", href: "/academics" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What the product protects</p>
            <div className="space-y-3">
              {homeSellingPoints.map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                  <Users className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                    <p className="text-sm leading-6 text-slate-700">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        }
      />

      <section className="pb-16">
        <Container>
          <SectionHeading
            eyebrow="Values"
            title="The product should feel clear, separated, and scalable."
            description="These values shape the public site, the workspace boundaries, and the way the platform is packaged for schools."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <SurfaceCard key={value.title} className="space-y-4">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-950">{value.title}</h2>
                    <p className="text-sm leading-7 text-slate-600">{value.description}</p>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Why this exists</p>
              <h2 className="text-3xl font-semibold text-slate-950">A platform story that keeps admissions and operations apart.</h2>
              <p className="text-sm leading-7 text-slate-600">
                The public website should help decision-makers understand the product quickly. It should not imply that the marketing site is the same thing as a school public website.
              </p>
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p>• Internal workspaces stay behind sign-in and platform-admin access.</p>
                <p>• Public marketing speaks to buyers, not school admissions traffic.</p>
                <p>• School website work can still come later through the public-web backlog.</p>
              </div>
            </SurfaceCard>

            <div className="space-y-4">
              {aboutMilestones.map((milestone, index) => (
                <SurfaceCard key={milestone.title} className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-start">
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Step</p>
                    <p className="mt-2 text-2xl font-semibold text-[color:var(--school-primary)]">0{index + 1}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-950">{milestone.title}</h3>
                    <p className="text-sm leading-7 text-slate-600">{milestone.description}</p>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <SurfaceCard className="flex flex-col gap-4 bg-slate-950 p-8 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Next step</p>
              <h2 className="text-3xl font-semibold">See how the product fit is discussed in practice.</h2>
              <p className="max-w-2xl text-sm leading-7 text-white/80">
                SchoolOS is intended to keep the commercial conversation clean: one product, one workspace boundary, and one clear rollout path.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ButtonLink href="/visit" className="bg-white text-slate-950 hover:bg-slate-100">
                Book a demo
              </ButtonLink>
              <ButtonLink href="/fees" variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15">
                Review packages
              </ButtonLink>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
