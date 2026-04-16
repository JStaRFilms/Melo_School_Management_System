import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, BookOpenCheck, CheckCircle2, Layers3, Sparkles } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { academicTracks, buildPageMetadata, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Academics",
  description:
    "Explore the academic structure, learning support, and enrichment approach that shape the Cedar Grove Academy experience.",
  path: "/academics",
});

const academicNotes = [
  {
    title: "Learning is structured",
    description: "Each stage has clear goals, repeatable routines, and evidence of progress families can understand.",
    icon: Layers3,
  },
  {
    title: "Assessment is visible",
    description: "Teachers use feedback, classwork, and formal assessments to guide the next teaching step.",
    icon: BookOpenCheck,
  },
  {
    title: "Support is personal",
    description: "When a child needs more challenge or more care, the response is coordinated and practical.",
    icon: Sparkles,
  },
];

export default function AcademicsPage() {
  return (
    <>
      <PageHero
        eyebrow="Academics"
        title="A curriculum that builds confidence, mastery, and curiosity."
        description={`${siteBrand.name} keeps the academic offer simple to understand: strong foundations, thoughtful teaching, and enough breadth for children to discover where they shine.`}
        primaryAction={{ label: "Review admissions", href: "/admissions" }}
        secondaryAction={{ label: "Book a visit", href: "/visit" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Academic promise</p>
            <div className="space-y-3">
              {[
                "Early years that make learning feel safe and playful",
                "Primary years that strengthen literacy and numeracy",
                "Secondary years that prepare students for exam success",
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
            eyebrow="Learning stages"
            title="One school, three clear academic phases."
            description="Families can see where their child fits today and how the school supports the next step without confusion."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {academicTracks.map((track) => (
              <SurfaceCard key={track.title} className="space-y-4">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-secondary)]/10 text-[color:var(--school-secondary)]">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-slate-950">{track.title}</h2>
                  <p className="text-sm leading-7 text-slate-600">{track.description}</p>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </Container>
      </section>

      <section className="pb-16">
        <Container>
          <div className="grid gap-4 lg:grid-cols-3">
            {academicNotes.map((note) => {
              const Icon = note.icon;
              return (
                <SurfaceCard key={note.title} className="space-y-4 lg:col-span-1">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--school-primary)]/10 text-[color:var(--school-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-950">{note.title}</h3>
                  <p className="text-sm leading-7 text-slate-600">{note.description}</p>
                </SurfaceCard>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">How we teach</p>
              <h2 className="text-3xl font-semibold text-slate-950">Teaching that stays disciplined without feeling rigid.</h2>
              <p className="text-sm leading-7 text-slate-600">
                The academic experience balances explanation, guided practice, independent work, and feedback so children can make progress with confidence.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Clear daily objectives",
                  "Teacher feedback and corrections",
                  "Homework that reinforces classwork",
                  "Enrichment in arts, ICT, and leadership",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--school-primary)]" />
                    <p className="text-sm leading-6 text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Need the right fit?</p>
              <h2 className="text-3xl font-semibold text-slate-950">Bring your questions to a visit.</h2>
              <p className="text-sm leading-7 text-slate-600">
                We are happy to explain class placement, subject coverage, or how we support a child who is moving from another school.
              </p>
              <div className="flex flex-col gap-3">
                <ButtonLink href="/visit">Plan a visit</ButtonLink>
                <ButtonLink href="/contact" variant="outline">
                  Contact admissions
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>
    </>
  );
}
