import type { Metadata } from "next";
import { CalendarDays, Clock3, MapPin, MessageSquare, Route, Sparkles } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { siteBrand, visitMoments, buildPageMetadata } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Visit",
  description:
    "Plan a visit to Cedar Grove Academy and see the classrooms, routines, and admissions flow for yourself.",
  path: "/visit",
});

const visitTips = [
  "Come with the questions that matter most to your family.",
  "Bring any previous school details that may help with placement.",
  "Ask about the school day, supervision, and communication routines.",
];

export default function VisitPage() {
  return (
    <>
      <PageHero
        eyebrow="Visit the campus"
        title="The best school decision usually starts with walking the campus."
        description={`${siteBrand.name} welcomes families who want to see the environment, meet the team, and get practical answers before making a commitment.`}
        primaryAction={{ label: "Call admissions", href: `tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}` }}
        secondaryAction={{ label: "Email admissions", href: `mailto:${siteBrand.email}` }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Visit details</p>
            <div className="space-y-3">
              {[
                { label: "Office hours", value: siteBrand.hours, icon: Clock3 },
                { label: "Campus", value: siteBrand.address, icon: MapPin },
                { label: "Best next step", value: "Call or email to schedule a tour", icon: MessageSquare },
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
            eyebrow="What a visit looks like"
            title="Short, friendly, and focused on the information families really need."
            description="We keep visits practical so parents can quickly understand the school's culture, routines, and support systems."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {visitMoments.map((moment) => {
              const Icon = moment.title.includes("Welcome") ? Sparkles : moment.title.includes("Walk") ? Route : CalendarDays;
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Visit tips</p>
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Directions and logistics</p>
              <h2 className="text-3xl font-semibold text-slate-950">Make the trip easy to plan.</h2>
              <p className="text-sm leading-7 text-slate-600">
                If you are travelling from outside the immediate area, call ahead so the team can give you the most helpful arrival details.
              </p>
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p>• Tell us the day and time that works best for your family.</p>
                <p>• Ask for the admissions lead if you want a more detailed discussion.</p>
                <p>• If needed, we can point you to the easiest landmark on the route.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <ButtonLink href={`tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}`}>
                  <MapPin className="h-4 w-4" />
                  Call for directions
                </ButtonLink>
                <ButtonLink href="/contact" variant="outline">
                  <MessageSquare className="h-4 w-4" />
                  Send a message
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
                <h2 className="text-3xl font-semibold text-slate-950">Book a visit while the question is still fresh.</h2>
                <p className="max-w-2xl text-sm leading-7 text-slate-600">
                  The right visit can make the admissions decision feel simple. We would be glad to host you.
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
