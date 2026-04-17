import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, BookOpenCheck, CheckCircle2, Layers3, Sparkles } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { academicTracks, buildPageMetadata, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Modules",
  description:
    "Explore the module stack, access boundaries, and public-web separation that shape the SchoolOS product.",
  path: "/academics",
});

const moduleNotes = [
  {
    title: "Operations first",
    description: "School setup, classes, terms, and teacher assignments belong in the internal workspace.",
    icon: Layers3,
  },
  {
    title: "Visibility for families",
    description: "Parent and student portals connect to the school experience without turning the public site into a portal.",
    icon: BookOpenCheck,
  },
  {
    title: "Controlled expansion",
    description: "Future managed school websites can be introduced later through the public-web roadmap.",
    icon: Sparkles,
  },
];

export default function AcademicsPage() {
  return (
    <>
      <PageHero
        eyebrow="Modules"
        title="A module stack that matches how schools actually run."
        description={`${siteBrand.name} keeps the internal system focused on operations, family access, and rollout paths instead of trying to make the marketing site do everything.`}
        primaryAction={{ label: "Review packages", href: "/fees" }}
        secondaryAction={{ label: "Request a demo", href: "/contact" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What the modules cover</p>
            <div className="space-y-3">
              {[
                "Core admin workflows",
                "Portal access for families",
                "Commercial and public-web separation",
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
            eyebrow="Module groups"
            title="Three layers that stay connected but not confused."
            description="The product story can explain the shape of the platform without pretending it is already a school website engine."
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
            {moduleNotes.map((note) => {
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">How the product is framed</p>
              <h2 className="text-3xl font-semibold text-slate-950">A clear product message without school admissions framing.</h2>
              <p className="text-sm leading-7 text-slate-600">
                The public site should make the internal boundaries obvious: internal workspace, family access, and public marketing each live in their own lane.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Distinct admin and workspace flows",
                  "Family-facing access stays separate",
                  "Billing remains platform-aware",
                  "Future managed school websites stay on the roadmap",
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
              <h2 className="text-3xl font-semibold text-slate-950">Bring your product questions to a demo.</h2>
              <p className="text-sm leading-7 text-slate-600">
                We can explain scope, rollout order, and what stays in the internal workspace versus the public marketing surface.
              </p>
              <div className="flex flex-col gap-3">
                <ButtonLink href="/contact">Request a demo</ButtonLink>
                <ButtonLink href="/about" variant="outline">
                  Read the overview
                </ButtonLink>
              </div>
            </SurfaceCard>
          </div>
        </Container>
      </section>
    </>
  );
}
