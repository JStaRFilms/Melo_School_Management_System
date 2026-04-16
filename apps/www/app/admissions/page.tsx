import type { Metadata } from "next";
import { BadgeCheck, CalendarDays, CheckCircle2, FileText, MapPin, Phone } from "lucide-react";
import { ButtonLink, Container, PageHero, SectionHeading, SurfaceCard } from "@/site-ui";
import { admissionsSteps, buildPageMetadata, siteBrand } from "@/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Admissions",
  description:
    "See how families can enquire, visit, and enrol at Cedar Grove Academy with a simple, human admissions process.",
  path: "/admissions",
});

const checklist = [
  "Child's birth certificate or proof of age",
  "Previous school records, if applicable",
  "Passport photographs",
  "Any learning support notes or medical information families want us to know",
  "Contact details for a parent or guardian",
];

export default function AdmissionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Admissions"
        title="A simple admissions process with real people on the other end."
        description={`${siteBrand.name} keeps the process clear so families can ask questions early, visit with confidence, and move forward when the fit feels right.`}
        primaryAction={{ label: "Call admissions", href: `tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}` }}
        secondaryAction={{ label: "Book a visit", href: "/visit" }}
        aside={
          <SurfaceCard className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">What to expect</p>
            <div className="space-y-3">
              {[
                "A human conversation before any paperwork",
                "A campus visit so families can feel the school culture",
                "Support with the final enrolment steps",
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
            eyebrow="Admissions journey"
            title="The steps stay the same, even when every family is different."
            description="Our process is designed to reduce friction, answer practical questions, and help the school and the family decide together whether to proceed."
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Documents checklist</p>
              <h2 className="text-3xl font-semibold text-slate-950">Prepare the basics before your visit.</h2>
              <p className="text-sm leading-7 text-slate-600">
                Keeping the paperwork light makes it easier for families to focus on the fit, not the forms.
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Practical guidance</p>
              <h2 className="text-3xl font-semibold text-slate-950">Admissions questions we are ready to answer.</h2>
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                <p>
                  • Which class is the right fit for my child?
                </p>
                <p>
                  • What are the term fee expectations and payment timing?
                </p>
                <p>
                  • How do we arrange a visit outside normal office hours?
                </p>
                <p>
                  • What support do you offer for transfer students?
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ButtonLink href={`tel:${siteBrand.admissionsPhone.replace(/\s+/g, "")}`}>
                  <Phone className="h-4 w-4" />
                  Call admissions
                </ButtonLink>
                <ButtonLink href="/contact" variant="outline">
                  <MapPin className="h-4 w-4" />
                  Find contact details
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
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Admissions next step</p>
                <h2 className="text-3xl font-semibold">Book a visit before you make any decision.</h2>
                <p className="max-w-2xl text-sm leading-7 text-white/80">
                  Seeing the campus, meeting the team, and asking your questions in person usually makes the answer much clearer.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ButtonLink href="/visit" className="bg-white text-slate-950 hover:bg-slate-100">
                  <FileText className="h-4 w-4" />
                  Plan a visit
                </ButtonLink>
                <ButtonLink href="/fees" variant="outline" className="border-white/25 bg-white/10 text-white hover:border-white/40 hover:bg-white/15">
                  Review fees
                </ButtonLink>
              </div>
            </div>
          </SurfaceCard>
        </Container>
      </section>
    </>
  );
}
