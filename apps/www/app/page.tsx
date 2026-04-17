import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Clock3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { academicTracks, buildPageMetadata, homeSellingPoints, siteBrand, toJsonLd } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "SchoolOS platform",
  description:
    "A public marketing site for SchoolOS, built for school owners and operators who want one operating system for the whole school.",
  path: "/",
});

const trustMarkers = [
  { icon: ShieldCheck, label: "Separate public marketing and internal workspace surfaces" },
  { icon: Users, label: "Tenant-aware school boundaries without admissions branding" },
  { icon: BadgeCheck, label: "Commercial packaging stays distinct from school fee billing" },
];

const platformSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteBrand.name,
  description: siteBrand.description,
  url: siteBrand.siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(platformSchema) }} />

      <PageHero
        eyebrow="Platform marketing site"
        title="Run the whole school on one operating system."
        description={`${siteBrand.name} helps school owners and operators keep admin, teaching, portals, billing, and public web in separate but connected surfaces.`}
        primaryAction={{ label: "Request a demo", href: "/contact" }}
        secondaryAction={{ label: "Review packaging", href: "/fees" }}
        note="Public marketing for the software itself, not a school admissions page."
        aside={
          <SurfaceCard className="space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
            <div className="space-y-3 rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What the product helps schools do</p>
              <div className="space-y-3">
                {trustMarkers.map((marker) => {
                  const Icon = marker.icon;
                  return (
                    <div key={marker.label} className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm leading-6 text-slate-700">{marker.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Operations</p>
                <p className="mt-2 text-sm text-slate-700">Admin setup, teacher workflow, and school-scoped data boundaries.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Families</p>
                <p className="mt-2 text-sm text-slate-700">Parent and student portals with notifications and status visibility.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Public web</p>
                <p className="mt-2 text-sm text-slate-700">Platform marketing now, with school public websites coming later.</p>
              </div>
            </div>
          </SurfaceCard>
        }
      />

      <section className="pb-16">
        <Container>
          <div className="grid gap-4 md:grid-cols-3">
            {homeSellingPoints.map((point, index) => (
              <SurfaceCard key={point.title} className="space-y-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                  {index === 0 ? <Sparkles className="h-5 w-5" /> : index === 1 ? <CalendarDays className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-slate-950">{point.title}</h2>
                  <p className="text-sm leading-7 text-slate-600">{point.description}</p>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <SectionHeading
            eyebrow="Product overview"
            title="A practical set of modules for how schools really operate."
            description="SchoolOS keeps the product surfaces separate: internal operations, family access, billing, and the public marketing site each stay in their own lane."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {academicTracks.map((track) => (
              <SurfaceCard key={track.title} className="space-y-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-secondary)]/10 text-[color:var(--school-secondary)]">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-950">{track.title}</h3>
                  <p className="text-sm leading-7 text-slate-600">{track.description}</p>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Commercial shape</p>
              <h2 className="text-3xl font-semibold text-slate-950">Pricing that leaves room for the final proposal.</h2>
              <p className="text-sm leading-7 text-slate-600">
                T12 defines the commercial structure: setup fee, recurring access, and optional upgrades. The public site can explain the model without inventing a rigid price list.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/fees">See commercial model</ButtonLink>
                <ButtonLink href="/contact" variant="outline">
                  Request a demo
                </ButtonLink>
              </div>
            </SurfaceCard>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {[
                {
                  title: "Setup fee",
                  description: "One-time onboarding, launch help, and brand kickoff.",
                  icon: Clock3,
                },
                {
                  title: "Recurring access",
                  description: "Term-based or annual platform access for the school.",
                  icon: BadgeCheck,
                },
                {
                  title: "Optional upgrades",
                  description: "Managed website rollout, service add-ons, and support tiers.",
                  icon: Sparkles,
                },
                {
                  title: "Custom quotes",
                  description: "Premium schools can move into tailored commercial terms.",
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <SurfaceCard key={item.title} className="space-y-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                      <p className="text-sm leading-7 text-slate-600">{item.description}</p>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <SectionHeading
            eyebrow="Trust signals"
            title="Signals that this is a product platform, not a school admissions page."
            description="The marketing surface is distinct from internal workspaces, and the wording stays aligned with the packaging strategy from T12."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[
              {
                title: "Tenant-aware by design",
                description:
                  "Every school operates with clear data boundaries, so growth does not require a rewrite.",
              },
              {
                title: "Platform site stays separate",
                description:
                  "The marketing surface speaks to school buyers; tenant school websites keep their own branding and admissions copy.",
              },
              {
                title: "Commercial model stays flexible",
                description:
                  "Setup fees, recurring access, and optional upgrades leave room for the packaging strategy in T12.",
              },
              {
                title: "Ready for real operations",
                description:
                  "The platform is shaped around admin, teacher, portal, and billing workflows that schools actually use.",
              },
            ].map((signal) => (
              <SurfaceCard key={signal.title} className="space-y-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-950">{signal.title}</h3>
                  <p className="text-sm leading-7 text-slate-600">{signal.description}</p>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <SurfaceCard className="bg-[linear-gradient(135deg,#173b72_0%,#0f766e_100%)] p-8 text-white sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/80">Ready to talk?</p>
                <h2 className="text-3xl font-semibold sm:text-4xl">Discuss fit, rollout, and the right package for the school.</h2>
                <p className="max-w-2xl text-sm leading-7 text-white/85">
                  The marketing site leaves room for the commercial conversation. When a school is ready, the next step is a demo request, not a forced admissions-style funnel.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink href="/contact" className="bg-white text-slate-950 hover:bg-slate-100">
                  Request demo
                </ButtonLink>
                <ButtonLink href="/fees" variant="outline" className="border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/15">
                  Review packages
                </ButtonLink>
              </div>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
