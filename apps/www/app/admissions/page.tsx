import type { Metadata } from "next";
import { BadgeCheck, CalendarDays, CheckCircle2, FileText, Workflow } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { admissionsSteps, buildPageMetadata, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Packages",
  description:
    "Review the commercial path for SchoolOS, including setup fees, recurring access, and optional upgrades.",
  path: "/admissions",
});

const checklist = [
  "Current school processes that need to move into software",
  "Whether the school wants only the core workspace or a fuller rollout",
  "Support expectations for setup and launch",
  "Any future public-web or managed-service interest",
];

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Packages"
        title="Pick a commercial path that matches the school."
        description={`${siteBrand.name} uses a mixed pricing model: setup fee, recurring access, and optional upgrades. The package conversation stays separate from student fee billing.`}
        primaryAction={{ label: "Review commercials", href: "/fees" }}
        secondaryAction={{ label: "Request a demo", href: "/contact" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What the package discussion should answer</p>
            <div className="space-y-3">
              {[
                "What the base plan includes",
                "Which upgrades are optional",
                "How the rollout starts",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
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
            eyebrow="Rollout steps"
            title="The implementation path should be simple enough to explain quickly."
            description="The commercial conversation should help a school understand the sequence before anyone opens the workspace."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {admissionsSteps.map((step, index) => (
              <SurfaceCard key={step.title} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-bold text-slate-400">0{index + 1}</p>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-slate-950">{step.title}</h2>
                  <p className="text-sm leading-7 text-slate-600">{step.description}</p>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Commercial checklist</p>
              <h2 className="text-3xl font-semibold text-slate-950">Be clear about the first rollout before the contract lands.</h2>
              <p className="text-sm leading-7 text-slate-600">
                A good package conversation helps the school plan the launch without mixing platform fees with school collections.
              </p>
              <div className="space-y-3">
                {checklist.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What the package can include</p>
              <h2 className="text-3xl font-semibold text-slate-950">Setup, recurring access, and optional upgrades.</h2>
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                <p>• Core admin and teacher workflows.</p>
                <p>• Family portal access and notifications where included.</p>
                <p>• Managed public-web paths only when the school later wants them.</p>
                <p>• Premium service and custom terms for larger schools.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/fees">
                  <Workflow className="h-4 w-4" />
                  See commercial model
                </ButtonLink>
                <ButtonLink href="/contact" variant="outline">
                  <FileText className="h-4 w-4" />
                  Ask for a demo
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <SurfaceCard className="bg-slate-950 p-8 text-white sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Commercial next step</p>
                <h2 className="text-3xl font-semibold">Start with a demo and decide the package afterward.</h2>
                <p className="max-w-2xl text-sm leading-7 text-white/80">
                  The product story stays flexible until the school has seen the platform and decided what level of rollout it needs.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink href="/contact" className="bg-white text-slate-950 hover:bg-slate-100">
                  Request demo
                </ButtonLink>
                <ButtonLink href="/about" variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15">
                  Read overview
                </ButtonLink>
              </div>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
