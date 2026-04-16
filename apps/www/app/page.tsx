import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Clock3, Mail, MapPin, Phone, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { academicTracks, buildPageMetadata, homeSellingPoints, siteBrand, toJsonLd } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Private School in Lagos",
  description:
    "Discover a calm, ambitious private school experience with strong academics, clear admissions steps, and a warm community.",
  path: "/",
});

const trustMarkers = [
  { icon: ShieldCheck, label: "Safe routines and steady pastoral care" },
  { icon: Users, label: "Children known by name, not just by class" },
  { icon: BadgeCheck, label: "Clear admissions, fees, and next steps" },
];

const schoolSchema = {
  "@context": "https://schema.org",
  "@type": "School",
  name: siteBrand.name,
  description: siteBrand.description,
  url: siteBrand.siteUrl,
  email: siteBrand.email,
  telephone: siteBrand.phone,
  address: {
    "@type": "PostalAddress",
    streetAddress: siteBrand.address,
    addressLocality: "Lagos",
    addressCountry: "NG",
  },
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(schoolSchema) }} />

      <PageHero
        eyebrow="Private school website"
        title="A school where children are known, challenged, and cared for."
        description={`${siteBrand.name} pairs excellent teaching with a calm daily rhythm, so families get strong academics, clear communication, and a community that feels personal from day one.`}
        primaryAction={{ label: "Book a visit", href: "/visit" }}
        secondaryAction={{ label: "Contact admissions", href: "/contact" }}
        note="Open weekdays, 8:00am to 4:00pm · Nursery through Senior Secondary"
        aside={
          <SurfaceCard className="space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
            <div className="space-y-3 rounded-[1.5rem] bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What families notice first</p>
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
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Admissions</p>
                <p className="mt-2 text-sm text-slate-700">Simple enquiry, visit, and enrolment steps.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Academics</p>
                <p className="mt-2 text-sm text-slate-700">Early years, primary, and secondary pathways.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Support</p>
                <p className="mt-2 text-sm text-slate-700">Responsive family communication and clear next steps.</p>
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
            eyebrow="Learning that grows with the child"
            title="A steady path from first letters to confident subject choices."
            description="The website speaks to parents first, but the story underneath is academic clarity: structured teaching, rich feedback, and classroom routines that make progress visible."
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Admissions at a glance</p>
              <h2 className="text-3xl font-semibold text-slate-950">Clear steps, friendly guidance, no guesswork.</h2>
              <p className="text-sm leading-7 text-slate-600">
                Parents should not have to decode a school website to understand what happens next. We keep the admissions journey simple and human.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/admissions">See admissions</ButtonLink>
                <ButtonLink href="/fees" variant="outline">
                  Review fees
                </ButtonLink>
              </div>
            </SurfaceCard>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Make an enquiry",
                  description: "Call or email to ask about class availability and the right next step.",
                  icon: Phone,
                },
                {
                  title: "Visit the campus",
                  description: "Walk the grounds, meet the team, and see how the school feels in person.",
                  icon: MapPin,
                },
                {
                  title: "Prepare your documents",
                  description: "Collect the basics so we can review the application without delay.",
                  icon: Mail,
                },
                {
                  title: "Complete enrolment",
                  description: "We guide families through the final confirmation and onboarding steps.",
                  icon: Clock3,
                },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <SurfaceCard key={step.title} className="space-y-4">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                      <p className="text-sm leading-7 text-slate-600">{step.description}</p>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <SurfaceCard className="bg-[linear-gradient(135deg,#173b72_0%,#0f766e_100%)] p-8 text-white sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/80">Ready to start?</p>
                <h2 className="text-3xl font-semibold sm:text-4xl">Visit the campus and see if Cedar Grove feels right for your family.</h2>
                <p className="max-w-2xl text-sm leading-7 text-white/85">
                  We welcome families who value warm discipline, clear communication, and a school that keeps learning visible from the first conversation.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink href="/visit" className="bg-white text-slate-950 hover:bg-slate-100">
                  Book a visit
                </ButtonLink>
                <ButtonLink href="/contact" variant="outline" className="border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/15">
                  Contact admissions
                </ButtonLink>
              </div>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
