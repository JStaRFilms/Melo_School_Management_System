import type { Metadata } from "next";
import { BadgeCheck, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { aboutMilestones, buildPageMetadata, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "About",
  description:
    "Learn how Cedar Grove Academy combines strong teaching, purposeful routines, and warm pastoral care for growing children.",
  path: "/about",
});

const values = [
  {
    title: "Clarity",
    description: "Parents should always understand what the school is doing and why it matters.",
    icon: Sparkles,
  },
  {
    title: "Care",
    description: "Children thrive when adults are consistent, responsive, and calm in daily routines.",
    icon: ShieldCheck,
  },
  {
    title: "Ambition",
    description: "We expect steady academic growth without losing sight of confidence and character.",
    icon: BadgeCheck,
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About the school"
        title="A warm school culture backed by serious teaching."
        description={`${siteBrand.name} was built for families who want a school that feels personal, communicates clearly, and protects a child's love for learning while raising academic expectations.`}
        primaryAction={{ label: "Meet admissions", href: "/contact" }}
        secondaryAction={{ label: "Explore academics", href: "/academics" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What our mission protects</p>
            <div className="space-y-3">
              {[
                "Learning routines that feel calm and purposeful",
                "Small enough relationships for every child to be seen",
                "Progress updates that help families stay engaged",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                  <Users className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
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
            eyebrow="Our values"
            title="The school experience should feel clear, caring, and ambitious."
            description="These values shape how we teach, how we speak with families, and how we set expectations in every classroom."
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What we protect every day</p>
              <h2 className="text-3xl font-semibold text-slate-950">A rhythm that helps children settle, focus, and grow.</h2>
              <p className="text-sm leading-7 text-slate-600">
                From morning arrival to dismissal, our team works to make the school day predictable enough for confidence and rich enough for curiosity.
              </p>
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p>• Clear classroom routines reduce anxiety and create more room for learning.</p>
                <p>• Teachers give feedback that helps children improve, not just complete tasks.</p>
                <p>• Families know who to contact when they need a practical answer quickly.</p>
              </div>
            </SurfaceCard>

            <div className="space-y-4">
              {aboutMilestones.map((milestone, index) => (
                <SurfaceCard key={milestone.title} className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-start">
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Stage</p>
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Leadership story</p>
              <h2 className="text-3xl font-semibold">Built to serve families, not just fill a timetable.</h2>
              <p className="max-w-2xl text-sm leading-7 text-white/80">
                Cedar Grove Academy is designed to feel modern without losing the human detail that makes a school trusted over time.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ButtonLink href="/visit" className="bg-white text-slate-950 hover:bg-slate-100">
                See the campus
              </ButtonLink>
              <ButtonLink href="/admissions" variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15">
                Understand admissions
              </ButtonLink>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
